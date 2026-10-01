import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

export function planInstall({ scope, target, configHome, activate = false, rules = false }) {
  if (!['project', 'user'].includes(scope) || !target) throw new Error('Explicit --scope project|user and --target required');
  if (scope === 'user' && !configHome) throw new Error('User scope requires explicit --config-home');
  if (scope === 'user' && (activate || rules)) throw new Error('--activate and --rules require project scope');
  if (scope === 'project' && configHome) throw new Error('--config-home is only valid for user scope');
  target = path.resolve(target);
  assertPath(target, false);
  const schemaRoot = scope === 'project' ? target : path.resolve(configHome);
  assertPath(schemaRoot, false);
  const skillRoot = path.join(target, '.agents/skills');
  const files = tree(path.join(root, 'skills/spec-driven-superpowers'), path.join(skillRoot, 'spec-driven-superpowers'));
  const names = new Set(['spec-driven-superpowers']);
  for (const collection of ['openspec', 'superpowers']) {
    for (const entry of fs.readdirSync(path.join(root, 'skills', collection), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (names.has(entry.name)) throw new Error(`Duplicate skill source: ${entry.name}`);
      names.add(entry.name);
      files.push(...tree(path.join(root, 'skills', collection, entry.name), path.join(skillRoot, entry.name)));
    }
  }
  files.push(...tree(path.join(root, 'schemas/superpowers-bridge'), path.join(schemaRoot, 'openspec/schemas/superpowers-bridge')));
  if (activate) files.push({ path: path.join(target, 'openspec/config.yaml'), data: Buffer.from('schema: superpowers-bridge\n') });
  if (rules) files.push({ path: path.join(target, 'AGENTS.md'), data: fs.readFileSync(path.join(root, 'rules/AGENTS.md')) });
  files.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    format: 1, scope, target, schemaRoot,
    files: files.map(file => ({ path: file.path, sha256: hash(file.data) })),
  };
  files.push({ path: path.join(target, '.asds/install-manifest.json'), data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) });
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
