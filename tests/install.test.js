import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'scripts/install.mjs');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-install-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function install(target, ...args) {
  return spawnSync(process.execPath, [
    cli, '--scope', 'project', '--target', target, ...args,
  ], { encoding: 'utf8', cwd: root });
}

test('preview performs no writes; apply installs skills and OpenSpec schema', t => {
  const target = fixture(t);
  const preview = install(target);
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(fs.readdirSync(target), []);
  const result = install(target, '--apply');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(target, '.agents/skills/spec-driven-superpowers/SKILL.md')));
  assert.ok(fs.existsSync(path.join(target, 'openspec/schemas/superpowers-bridge/schema.yaml')));
  assert.ok(fs.existsSync(path.join(target, '.asds/install-manifest.json')));
  assert.equal(fs.existsSync(path.join(target, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(target, 'openspec/config.yaml')), false);
});

test('existing .agents remains a directory and user rules are preserved', t => {
  const target = fixture(t);
  fs.mkdirSync(path.join(target, '.agents'));
  fs.writeFileSync(path.join(target, '.agents/AGENTS.md'), 'user-owned');
  assert.equal(install(target, '--apply').status, 0);
  assert.equal(fs.lstatSync(path.join(target, '.agents')).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(path.join(target, '.agents/AGENTS.md'), 'utf8'), 'user-owned');
});

test('conflicting skill aborts before any other writes', t => {
  const target = fixture(t);
  const skill = path.join(target, '.agents/skills/spec-driven-superpowers');
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), 'user-owned');
  const result = install(target, '--apply');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /conflict/i);
  assert.equal(fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8'), 'user-owned');
  assert.equal(fs.existsSync(path.join(target, 'openspec')), false);
});

test('repeat installation is idempotent', t => {
  const target = fixture(t);
  assert.equal(install(target, '--apply').status, 0);
  const manifest = fs.readFileSync(path.join(target, '.asds/install-manifest.json'), 'utf8');
  assert.equal(install(target, '--apply').status, 0);
  assert.equal(fs.readFileSync(path.join(target, '.asds/install-manifest.json'), 'utf8'), manifest);
});

test('schema selection requires explicit activation and preserves existing config', t => {
  const target = fixture(t);
  assert.equal(install(target, '--apply', '--activate').status, 0);
  assert.match(fs.readFileSync(path.join(target, 'openspec/config.yaml'), 'utf8'), /superpowers-bridge/);
  fs.writeFileSync(path.join(target, 'openspec/config.yaml'), 'schema: spec-driven\n');
  const result = install(target, '--apply', '--activate');
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(path.join(target, 'openspec/config.yaml'), 'utf8'), 'schema: spec-driven\n');
});

test('broken and external directory symlinks are rejected', { skip: process.platform === 'win32' }, t => {
  for (const existing of [true, false]) {
    const target = fixture(t);
    const outside = path.join(fixture(t), 'outside');
    if (existing) fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(target, '.agents'));
    const result = install(target, '--apply');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink/i);
    if (existing) assert.deepEqual(fs.readdirSync(outside), []);
  }
});

test('user scope installs schema under explicitly selected config home', t => {
  const target = fixture(t);
  const config = fixture(t);
  const result = spawnSync(process.execPath, [
    cli, '--scope', 'user', '--target', target, '--config-home', config, '--apply',
  ], { encoding: 'utf8', cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(target, '.agents/skills/spec-driven-superpowers/SKILL.md')));
  assert.ok(fs.existsSync(path.join(config, 'openspec/schemas/superpowers-bridge/schema.yaml')));
});

test('CLI rejects unknown flags and implicit destinations', () => {
  for (const args of [[], ['--apply'], ['--scope', 'project', '--unknown']]) {
    assert.notEqual(spawnSync(process.execPath, [cli, ...args]).status, 0);
  }
});
