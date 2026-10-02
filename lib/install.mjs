import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { safePath } from './contracts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
const stat = file => {
  try { return fs.lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

function assertPath(file, leafIsFile = true) {
  const chain = [];
  for (let part = file; ; part = path.dirname(part)) {
    chain.unshift(part);
    if (part === path.dirname(part)) break;
  }
  for (const part of chain) {
    const info = stat(part);
    if (info?.isSymbolicLink()) throw new Error(`symlink refused: ${part}`);
    if (info && !(part === file && leafIsFile ? info.isFile() : info.isDirectory())) {
      throw new Error(`conflict: unexpected file type at ${part}`);
    }
  }
}

function tree(source, destination) {
  const files = [];
  for (const entry of fs.readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) files.push(...tree(from, to));
    else if (entry.isFile()) files.push({ path: to, data: fs.readFileSync(from) });
    else throw new Error(`Unsupported source entry: ${from}`);
  }
  return files;
}

export function discoverSkills(collection, names = new Set()) {
  assertPath(collection, false);
  const sources = [];
  for (const entry of fs.readdirSync(collection, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const source = path.join(collection, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symlink refused: ${source}`);
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(source, 'SKILL.md');
    const info = stat(skillFile);
    if (!info) continue;
    if (info.isSymbolicLink()) throw new Error(`symlink refused: ${skillFile}`);
    if (!info.isFile() || !fs.readFileSync(skillFile, 'utf8').trim()) {
      throw new Error(`Invalid skill source: ${skillFile}`);
    }
    if (names.has(entry.name)) throw new Error(`Duplicate skill source: ${entry.name}`);
    names.add(entry.name);
    sources.push(source);
  }
  return sources;
}

export function planInstall({ scope, target, dataHome, activate = false, rules = false, skillsDir = '.agents/skills' }) {
  if (!['project', 'user'].includes(scope) || !target) throw new Error('Explicit --scope project|user and --target required');
  if (scope === 'user' && !dataHome) throw new Error('User scope requires explicit --data-home (OpenSpec uses XDG_DATA_HOME)');
  if (scope === 'user' && (activate || rules)) throw new Error('--activate and --rules require project scope');
  if (scope === 'project' && dataHome) throw new Error('--data-home is only valid for user scope');
  target = path.resolve(target);
  assertPath(target, false);
  const schemaRoot = scope === 'project' ? target : path.resolve(dataHome);
  assertPath(schemaRoot, false);
  if (!safePath(skillsDir)) throw new Error('Invalid --skills-dir: expected a relative directory');
  const skillRoot = path.join(target, skillsDir);
  const files = tree(path.join(root, 'skills/spec-driven-superpowers'), path.join(skillRoot, 'spec-driven-superpowers'));
  const names = new Set(['spec-driven-superpowers']);
  for (const collection of ['openspec', 'superpowers']) {
    for (const source of discoverSkills(path.join(root, 'skills', collection), names)) {
      files.push(...tree(source, path.join(skillRoot, path.basename(source))));
    }
  }
  files.push(...tree(path.join(root, 'schemas/superpowers-bridge'), path.join(schemaRoot, 'openspec/schemas/superpowers-bridge')));
  for (const name of ['LICENSE', 'vendor-provenance.json']) {
    files.push({ path: path.join(target, '.asds', name), data: fs.readFileSync(path.join(root, name)) });
  }
  if (activate) files.push({ path: path.join(target, 'openspec/config.yaml'), data: Buffer.from('schema: superpowers-bridge\n') });
  if (rules) files.push({ path: path.join(target, 'AGENTS.md'), data: fs.readFileSync(path.join(root, 'rules/AGENTS.md')) });
  files.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    format: 1, scope, target, schemaRoot,
    files: files.map(file => ({ path: file.path, sha256: hash(file.data) })),
  };
  // Keep the existing default manifest byte-compatible. Other native skill
  // roots get independent receipts, so selecting a second harness cannot
  // overwrite or conflict with the first harness's ownership record.
  const manifestPath = skillsDir === '.agents/skills'
    ? '.asds/install-manifest.json'
    : `.asds/install-manifests/${hash(Buffer.from(skillsDir))}.json`;
  files.push({ path: path.join(target, manifestPath), data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) });
  for (const file of files) {
    assertPath(file.path);
    if (stat(file.path) && !fs.readFileSync(file.path).equals(file.data)) throw new Error(`conflict: ${file.path}`);
  }
  return files;
}

// Additive transaction: on ordinary errors only files/directories created here
// are removed. No overwrites, upgrades, crash recovery, or hostile-race guarantee.
export function applyInstall(files, { beforeWrite = () => {} } = {}) {
  const createdFiles = [], createdDirs = [];
  function mkdir(directory) {
    assertPath(directory, false);
    if (stat(directory)) return;
    mkdir(path.dirname(directory));
    fs.mkdirSync(directory);
    createdDirs.push(directory);
  }
  try {
    for (const file of files) {
      assertPath(file.path);
      if (stat(file.path)) {
        if (!fs.readFileSync(file.path).equals(file.data)) throw new Error(`conflict: ${file.path}`);
        continue;
      }
      mkdir(path.dirname(file.path));
      beforeWrite(file.path);
      assertPath(file.path);
      const fd = fs.openSync(file.path, 'wx');
      createdFiles.push(file.path);
      try { fs.writeFileSync(fd, file.data); }
      finally { fs.closeSync(fd); }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const file of createdFiles.reverse()) {
      try { fs.unlinkSync(file); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const directory of createdDirs.reverse()) {
      try { fs.rmdirSync(directory); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    throw new Error(`${error.message}${rollbackErrors.length ? `; rollback incomplete: ${rollbackErrors.join('; ')}` : '; newly created files rolled back'}`);
  }
}
