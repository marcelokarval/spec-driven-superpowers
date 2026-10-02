import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectGitScope } from '../lib/git-scope.mjs';

// Git accepts NUL on Windows, but not Node's \\.\nul device namespace spelling.
const gitNull = process.platform === 'win32' ? 'NUL' : os.devNull;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-git-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: gitNull,
    GIT_AUTHOR_NAME: 'ASDS fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'ASDS fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  });
  const git = (...args) => execFileSync('git', [
    '-c', `core.hooksPath=${gitNull}`, '-c', 'commit.gpgSign=false',
    '-c', 'tag.gpgSign=false', ...args,
  ], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  git('init');
  write('.gitignore', 'ignored/\n');
  write('tracked.txt', 'base\n');
  write('deleted.txt', 'delete\n');
  write('rename.txt', 'rename content\n');
  git('add', '.');
  // Commits are made only in this disposable repository.
  git('commit', '-m', 'fixture base');
  return { root, git, write, base: git('rev-parse', 'HEAD') };
}

test('clean scope resolves revisions and includes committed out-of-scope paths', t => {
  const { root, git, write, base } = fixture(t);
  write('outside/contract.txt', 'committed\n');
  git('add', '.');
  git('commit', '-m', 'fixture delivery');
  assert.deepEqual(collectGitScope(root, base), {
    baseRevision: base,
    revision: git('rev-parse', 'HEAD'),
    changedFiles: ['outside/contract.txt'],
  });
  assert.equal(collectGitScope(root, 'HEAD~1').baseRevision, base);
  if (process.platform === 'win32') {
    const alternate = root.replace(/^[A-Za-z]/, drive => drive.toLowerCase()).replaceAll('\\', '/');
    assert.deepEqual(collectGitScope(alternate, base), collectGitScope(root, base));
  }
});

test('scope unions staged, unstaged, untracked, deleted and renamed paths', t => {
  const { root, git, write, base } = fixture(t);
  write('tracked.txt', 'staged\n');
  git('add', 'tracked.txt');
  write('tracked.txt', 'unstaged\n');
  fs.unlinkSync(path.join(root, 'deleted.txt'));
  git('mv', 'rename.txt', 'renamed.txt');
  const untracked = process.platform === 'win32' ? 'untracked with space.txt' : 'untracked with\nnewline.txt';
  write(untracked, 'new\n');
  write('ignored/private.txt', 'must not capture\n');
  const scope = collectGitScope(root, base);
  assert.deepEqual(scope.changedFiles, [
    'deleted.txt', 'rename.txt', 'renamed.txt', 'tracked.txt', untracked,
  ]);
  assert.match(scope.revision, /^[a-f0-9]{40,64}\+worktree:[a-f0-9]{64}$/);
  assert.deepEqual(collectGitScope(root, base), scope);
});

test('committed and unstaged renames include both sides', t => {
  const { root, git, base } = fixture(t);
  git('mv', 'rename.txt', 'committed-name.txt');
  git('commit', '-m', 'fixture rename');
  fs.renameSync(path.join(root, 'tracked.txt'), path.join(root, 'untracked-name.txt'));
  assert.deepEqual(collectGitScope(root, base).changedFiles, [
    'committed-name.txt', 'rename.txt', 'tracked.txt', 'untracked-name.txt',
  ]);
});

test('fingerprint changes for content, paths, deletions and staged state', t => {
  const { root, git, write, base } = fixture(t);
  const revisions = new Set();
  const capture = () => {
    const revision = collectGitScope(root, base).revision;
    assert.ok(!revisions.has(revision), 'each distinct state has a distinct revision');
    revisions.add(revision);
  };
  capture();
  write('tracked.txt', 'changed\n');
  capture();
  git('add', 'tracked.txt');
  capture();
  write('tracked.txt', 'changed again\n');
  capture();
  write('new.txt', 'new\n');
  capture();
  fs.renameSync(path.join(root, 'new.txt'), path.join(root, 'other.txt'));
  capture();
  fs.unlinkSync(path.join(root, 'deleted.txt'));
  capture();
  git('add', '-u');
  capture();
});

test('ignored content is excluded and does not affect revision', t => {
  const { root, write, base } = fixture(t);
  const clean = collectGitScope(root, base);
  write('ignored/private.txt', 'secret\n');
  assert.deepEqual(collectGitScope(root, base), clean);
  write('new.txt', 'visible\n');
  const dirty = collectGitScope(root, base);
  write('ignored/private.txt', 'different secret\n');
  assert.deepEqual(collectGitScope(root, base), dirty);
});

test('symlinks fingerprint link targets without reading outside the repository', { skip: process.platform === 'win32' }, t => {
  const { root, base } = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'private'), 'first\n');
  fs.symlinkSync(path.join(outside, 'private'), path.join(root, 'link'));
  const initial = collectGitScope(root, base);
  fs.writeFileSync(path.join(outside, 'private'), 'second\n');
  assert.deepEqual(collectGitScope(root, base), initial);
  fs.unlinkSync(path.join(root, 'link'));
  fs.symlinkSync(path.join(outside, 'missing'), path.join(root, 'link'));
  assert.notEqual(collectGitScope(root, base).revision, initial.revision);
});

test('a tracked parent replaced by an external symlink is not followed', { skip: process.platform === 'win32' }, t => {
  const { root, git, write } = fixture(t);
  write('parent/child', 'tracked\n');
  git('add', '.');
  git('commit', '-m', 'fixture nested path');
  const base = git('rev-parse', 'HEAD');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-outside-parent-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'child'), 'outside\n');
  fs.rmSync(path.join(root, 'parent'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, 'parent'));
  const scope = collectGitScope(root, base);
  fs.writeFileSync(path.join(outside, 'child'), 'changed outside\n');
  assert.deepEqual(collectGitScope(root, base), scope);
});

test('invalid base revisions and option-like inputs fail explicitly', t => {
  const { root } = fixture(t);
  for (const base of ['missing-ref', '--all', '--help', '', undefined]) {
    assert.throws(() => collectGitScope(root, base), /base revision/i);
  }
});

test('invalid repositories, unborn HEAD and nested directories fail explicitly', t => {
  const { root, git, base } = fixture(t);
  fs.mkdirSync(path.join(root, 'nested'));
  assert.throws(() => collectGitScope(path.join(root, 'nested'), base), /repository top level/i);
  assert.throws(() => collectGitScope(path.join(root, 'missing'), base), /repository/i);
  const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-not-git-'));
  t.after(() => fs.rmSync(notRepo, { recursive: true, force: true }));
  assert.throws(() => collectGitScope(notRepo, base), /repository/i);
  git('init', path.join(notRepo, 'unborn'));
  assert.throws(() => collectGitScope(path.join(notRepo, 'unborn'), 'HEAD'), /revision/i);
});

test('collection does not modify index or working files', t => {
  const { root, git, write, base } = fixture(t);
  write('tracked.txt', 'dirty\n');
  git('add', 'tracked.txt');
  write('tracked.txt', 'worktree\n');
  const index = git('rev-parse', '--git-path', 'index');
  const indexPath = path.resolve(root, index);
  const status = git('status', '--porcelain=v1');
  const before = fs.readFileSync(indexPath);
  collectGitScope(root, base);
  assert.deepEqual(fs.readFileSync(indexPath), before);
  assert.equal(git('status', '--porcelain=v1'), status);
  assert.equal(fs.readFileSync(path.join(root, 'tracked.txt'), 'utf8'), 'worktree\n');
});

test('configured filters, external diff, textconv and fsmonitor are not executed', t => {
  const { root, git, write, base } = fixture(t);
  const helpers = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-git-drivers-'));
  t.after(() => fs.rmSync(helpers, { recursive: true, force: true }));
  const marker = path.join(helpers, 'executed');
  const script = path.join(helpers, 'driver.mjs');
  fs.writeFileSync(script, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'executed');`);
  const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(script)}`;
  write('.gitattributes', 'tracked.txt filter=trap diff=trap\n');
  for (const setting of [
    'filter.trap.clean', 'filter.trap.process', 'filter.trap.smudge',
    'diff.external', 'diff.trap.command', 'diff.trap.textconv', 'core.fsmonitor',
  ]) git('config', setting, command);
  git('config', 'filter.trap.required', 'true');
  write('tracked.txt', 'changed content\n');
  const scope = collectGitScope(root, base);
  assert.ok(scope.changedFiles.includes('tracked.txt'));
  assert.equal(fs.existsSync(marker), false);
});
