import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { safePath } from './planning-paths.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;

function destinationPath(root, relative) {
  if (!safePath(relative)) throw new Error(`unsafe planning path: ${relative}`);
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`planning symlink refused: ${relative}`);
  }
  return current;
}

export function validatePlanningBundle(bundle) {
  const errors = [];
  if (!object(bundle) || !text(bundle.revision) || !Array.isArray(bundle.files) || !bundle.files.length) return ['bundle requires revision and files'];
  const seen = new Set();
  for (const file of bundle.files) {
    if (!object(file) || !safePath(file.path) || typeof file.content !== 'string') { errors.push('invalid bundle file'); continue; }
    if (seen.has(file.path)) errors.push(`duplicate bundle file: ${file.path}`);
    seen.add(file.path);
    if (file.sha256 !== undefined && file.sha256 !== hash(Buffer.from(file.content))) errors.push(`bundle hash mismatch: ${file.path}`);
  }
  for (const required of ['planning-manifest.json', 'tasks.md']) if (!seen.has(required)) errors.push(`missing bundle file: ${required}`);
  return errors;
}

export function readPlanningBundle(root, expectedPaths) {
  const files = expectedPaths.map(relative => {
    const file = destinationPath(root, relative);
    const content = fs.readFileSync(file, 'utf8');
    return { path: relative, content, sha256: hash(Buffer.from(content)) };
  });
  const manifest = JSON.parse(files.find(file => file.path === 'planning-manifest.json').content);
  return { revision: manifest.revision, files };
}

/** Publish a bounded bundle without persistent staging or backup copies. */
export function publishPlanningBundle(root, bundle, { expectedRevision = null, failAfter = null } = {}) {
  const errors = validatePlanningBundle(bundle);
  if (errors.length) throw new Error(errors.join('; '));
  fs.mkdirSync(root, { recursive: true });
  const manifestPath = destinationPath(root, 'planning-manifest.json');
  const currentRevision = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).revision : null;
  if (currentRevision !== expectedRevision) throw new Error(`planning revision conflict: expected ${expectedRevision}, observed ${currentRevision}`);
  const prior = new Map(), created = [], temporaries = [], written = [];
  try {
    for (const [index, entry] of bundle.files.entries()) {
      const file = destinationPath(root, entry.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file)) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.nlink !== 1) throw new Error(`unsafe existing planning file: ${entry.path}`);
        prior.set(file, { data: fs.readFileSync(file), mode: stat.mode & 0o777 });
      } else created.push(file);
      const temporary = path.join(path.dirname(file), `.asds-write-${randomBytes(12).toString('hex')}`);
      temporaries.push(temporary);
      fs.writeFileSync(temporary, entry.content, { flag: 'wx', mode: prior.get(file)?.mode ?? 0o600 });
      fs.renameSync(temporary, file); written.push(file);
      if (failAfter === index + 1) throw new Error('injected planning publication failure');
    }
    const readback = readPlanningBundle(root, bundle.files.map(file => file.path));
    if (readback.revision !== bundle.revision || readback.files.some((file, index) => file.sha256 !== hash(Buffer.from(bundle.files[index].content)))) throw new Error('planning readback mismatch');
    return { status: 'matched', revision: bundle.revision, destination: path.resolve(root), files: readback.files.map(({ path, sha256 }) => ({ path, sha256 })) };
  } catch (error) {
    const rollback = [];
    for (const file of written.reverse()) {
      try { if (prior.has(file)) fs.writeFileSync(file, prior.get(file).data, { mode: prior.get(file).mode }); else if (fs.existsSync(file)) fs.unlinkSync(file); }
      catch (failure) { rollback.push(failure.message); }
    }
    throw new Error(`${error.message}${rollback.length ? `; rollback incomplete: ${rollback.join('; ')}` : '; prior planning restored'}`);
  } finally {
    for (const temporary of temporaries) if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
