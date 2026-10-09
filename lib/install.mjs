import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
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

export function planInstall({ scope, target, dataHome, activate = false, rules = false, update = false, reconcileShared = false, skillsDir = '.agents/skills' }) {
  if (!['project', 'user'].includes(scope) || !target) throw new Error('Explicit --scope project|user and --target required');
  if (scope === 'user' && !dataHome) throw new Error('User scope requires explicit --data-home (OpenSpec uses XDG_DATA_HOME)');
  if (scope === 'user' && (activate || rules)) throw new Error('--activate and --rules require project scope');
  if (scope === 'project' && dataHome) throw new Error('--data-home is only valid for user scope');
  if (reconcileShared && (!update || scope !== 'user')) throw new Error('--reconcile-shared requires --update with user scope');
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
  const receipt = files.at(-1);
  const receiptPaths = new Set([receipt.path]);
  const owned = new Map();
  if (update) {
    assertPath(receipt.path);
    if (!stat(receipt.path)) throw new Error(`update requires existing manifest: ${receipt.path}`);
    const previous = JSON.parse(fs.readFileSync(receipt.path, 'utf8'));
    if (previous.format !== 1 || previous.scope !== scope || previous.target !== target || previous.schemaRoot !== schemaRoot || !Array.isArray(previous.files)) throw new Error('invalid update manifest identity');
    const planned = new Set(files.slice(0, -1).map(file => file.path));
    for (const entry of previous.files) {
      if (!entry || !planned.has(entry.path) || owned.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('invalid update manifest entry; removals require explicit reconciliation');
      assertPath(entry.path);
      if (!stat(entry.path) || hash(fs.readFileSync(entry.path)) !== entry.sha256) throw new Error(`modified or missing owned file: ${entry.path}`);
      if (stat(entry.path).nlink !== 1) throw new Error(`hardlink refused: ${entry.path}`);
      owned.set(entry.path, entry.sha256);
    }
    if (reconcileShared) {
      const shared = new Map(files.slice(0, -1)
        .filter(file => !file.path.startsWith(skillRoot + path.sep))
        .map(file => [file.path, hash(file.data)]));
      const manifests = [path.join(target, '.asds/install-manifest.json')];
      const profiles = path.join(target, '.asds/install-manifests');
      if (stat(profiles)) {
        assertPath(profiles, false);
        for (const entry of fs.readdirSync(profiles, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (!entry.isFile() || !entry.name.endsWith('.json')) throw new Error(`invalid shared reconciliation manifest: ${path.join(profiles, entry.name)}`);
          manifests.push(path.join(profiles, entry.name));
        }
      }
      for (const otherPath of manifests) {
        if (otherPath === receipt.path || !stat(otherPath)) continue;
        assertPath(otherPath);
        if (stat(otherPath).nlink !== 1) throw new Error(`hardlink refused: ${otherPath}`);
        const previousBytes = fs.readFileSync(otherPath);
        const other = JSON.parse(previousBytes);
        if (other.format !== 1 || other.scope !== scope || other.target !== target || other.schemaRoot !== schemaRoot || !Array.isArray(other.files)) throw new Error(`invalid shared reconciliation manifest identity: ${otherPath}`);
        const seen = new Set();
        for (const entry of other.files) {
          if (!entry || typeof entry.path !== 'string' || seen.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`invalid shared reconciliation manifest entry: ${otherPath}`);
          seen.add(entry.path);
          assertPath(entry.path);
          const info = stat(entry.path);
          if (!info || info.nlink !== 1 || hash(fs.readFileSync(entry.path)) !== entry.sha256) throw new Error(`modified or missing owned file during shared reconciliation: ${entry.path}`);
          if (shared.has(entry.path)) entry.sha256 = shared.get(entry.path);
        }
        const data = Buffer.from(`${JSON.stringify(other, null, 2)}\n`);
        if (!data.equals(previousBytes)) {
          receiptPaths.add(otherPath);
          files.push({ path: otherPath, data, previous: previousBytes, mode: stat(otherPath).mode & 0o777 });
        }
      }
    }
  }
  for (const file of files) {
    assertPath(file.path);
    if (update && stat(file.path) && stat(file.path).nlink !== 1) throw new Error(`hardlink refused: ${file.path}`);
    const existing = stat(file.path) ? fs.readFileSync(file.path) : null;
    if (existing && !existing.equals(file.data)) {
      if (!update || (file !== receipt && !owned.has(file.path) && !receiptPaths.has(file.path))) throw new Error(`conflict: ${file.path}`);
      if (scope === 'user' && !reconcileShared && file !== receipt && !file.path.startsWith(skillRoot + path.sep)) throw new Error(`shared payload update requires explicit reconciliation: ${file.path}`);
      file.previous = existing;
      file.mode = stat(file.path).mode & 0o777;
    }
  }
  return files;
}

function replaceFile(file, data) {
  const temporary = path.join(path.dirname(file.path), `.asds-update-${randomBytes(12).toString('hex')}`);
  try {
    fs.writeFileSync(temporary, data, { flag: 'wx', mode: file.mode });
    fs.chmodSync(temporary, file.mode);
    fs.renameSync(temporary, file.path);
  } finally { if (stat(temporary)) fs.unlinkSync(temporary); }
}

// Ordinary failures restore replaced bytes from memory and remove newly created
// files/directories. No disk backup, crash recovery, or hostile-race guarantee.
export function applyInstall(files, { beforeWrite = () => {} } = {}) {
  const createdFiles = [], createdDirs = [], replacedFiles = [];
  function mkdir(directory) {
    assertPath(directory, false);
    if (stat(directory)) return;
    mkdir(path.dirname(directory));
    fs.mkdirSync(directory);
    createdDirs.push(directory);
  }
  try {
    // Validate every planned replacement before the first mutation.
    for (const file of files.filter(file => file.previous)) {
      assertPath(file.path);
      if (stat(file.path)?.nlink !== 1 || (stat(file.path).mode & 0o777) !== file.mode || !fs.readFileSync(file.path).equals(file.previous)) throw new Error(`changed since update preview: ${file.path}`);
    }
    for (const file of files) {
      assertPath(file.path);
      if (file.previous) {
        beforeWrite(file.path);
        assertPath(file.path);
        if (stat(file.path)?.nlink !== 1 || (stat(file.path).mode & 0o777) !== file.mode || !fs.readFileSync(file.path).equals(file.previous)) throw new Error(`changed since update preview: ${file.path}`);
        replaceFile(file, file.data);
        replacedFiles.push(file);
        continue;
      }
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
    for (const file of replacedFiles.reverse()) {
      try {
        assertPath(file.path);
        if (stat(file.path)?.nlink !== 1 || !fs.readFileSync(file.path).equals(file.data)) throw new Error(`concurrent change retained: ${file.path}`);
        replaceFile(file, file.previous);
      } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const file of createdFiles.reverse()) {
      try { fs.unlinkSync(file); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const directory of createdDirs.reverse()) {
      try { fs.rmdirSync(directory); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    throw new Error(`${error.message}${rollbackErrors.length ? `; rollback incomplete: ${rollbackErrors.join('; ')}` : '; newly created files rolled back'}`);
  }
}
