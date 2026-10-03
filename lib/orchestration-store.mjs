import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { replay, appendEvent } from './orchestration.mjs';

// Local trusted single-writer store. Locks are never stolen on age alone.
function checkedPath(file, missing = false) {
  const resolved = path.resolve(file);
  const parts = resolved.slice(path.parse(resolved).root.length).split(path.sep);
  let current = path.parse(resolved).root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (missing && index === parts.length - 1 && error.code === 'ENOENT') return resolved; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`Store symlink refused: ${current}`);
    if (index === parts.length - 1 && (!stat.isFile() || stat.nlink !== 1)) throw new Error('Store must be a regular file with one link');
  }
  return resolved;
}
function writeExclusive(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
export function initializeStore(file, journal) {
  replay(journal);
  const resolved = checkedPath(file, true);
  // Complete bytes are prepared before publication. A hard link provides no-clobber
  // publication; the transient second link is removed before returning.
  const temporary = `${resolved}.${randomUUID()}.tmp`;
  try { writeExclusive(temporary, journal); fs.linkSync(temporary, resolved); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
export function readStore(file) {
  const journal = JSON.parse(fs.readFileSync(checkedPath(file), 'utf8'));
  replay(journal);
  return journal;
}
export function updateStore(file, event, expectedSequence) {
  const resolved = checkedPath(file);
  const lock = `${resolved}.lock`;
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx', 0o600); }
  catch (error) { throw new Error(`Store lock unavailable: ${error.message}`); }
  const temporary = `${resolved}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, state: resolved })); fs.fsyncSync(lockFd);
    const next = appendEvent(readStore(resolved), event, expectedSequence);
    writeExclusive(temporary, next);
    checkedPath(resolved);
    fs.renameSync(temporary, resolved);
    return next;
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.closeSync(lockFd); fs.unlinkSync(lock);
  }
}
