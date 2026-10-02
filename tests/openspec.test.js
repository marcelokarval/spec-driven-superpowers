import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateChange } from '../lib/validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'node_modules/@fission-ai/openspec/bin/openspec.js');
function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'asds-openspec-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = {
    ...process.env, HOME: dir, USERPROFILE: dir,
    XDG_CONFIG_HOME: path.join(dir, 'config'), XDG_DATA_HOME: path.join(dir, 'data'),
    APPDATA: path.join(dir, 'config'), LOCALAPPDATA: path.join(dir, 'data'),
    OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1', OPENSPEC_NO_UPDATE_CHECK: '1', CI: '1',
  };
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 20000 });
  return { dir, env, run };
}
function install(dir, env, ...args) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts/install.mjs'), '--target', dir, '--apply', ...args,
  ], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}
test('OpenSpec resolves and validates the installed project schema and rejects malformed YAML', t => {
  const { dir, env, run } = fixture(t);
  install(dir, env, '--scope', 'project', '--activate');
  const which = run('schema', 'which', 'superpowers-bridge', '--json');
  assert.equal(which.status, 0, which.stderr);
  assert.match(which.stdout, /superpowers-bridge/);
  const result = run('schema', 'validate', 'superpowers-bridge', '--json');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  fs.writeFileSync(path.join(dir, 'openspec/schemas/superpowers-bridge/schema.yaml'), 'version: [unterminated');
  assert.notEqual(run('schema', 'validate', 'superpowers-bridge', '--json').status, 0);
});
test('OpenSpec discovers user schemas from data home, not config home', t => {
  const { dir, env, run } = fixture(t);
  install(dir, env, '--scope', 'user', '--data-home', env.XDG_DATA_HOME);
  assert.equal(fs.existsSync(path.join(env.XDG_CONFIG_HOME, 'openspec/schemas')), false);
  const result = run('schema', 'which', 'superpowers-bridge', '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('data'));
  assert.equal(run('schema', 'validate', 'superpowers-bridge', '--json').status, 0);
});

test('OpenSpec status and apply consume the bridge master-detail fixture', t => {
  const { dir, env, run } = fixture(t);
  install(dir, env, '--scope', 'project', '--activate');
  const change = path.join(dir, 'openspec/changes/example-counts');
  fs.cpSync(path.join(root, 'examples/basic-change'), change, { recursive: true });
  assert.deepEqual(validateChange(change), []);
  const status = run('status', '--change', 'example-counts', '--json');
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).schemaName, 'superpowers-bridge');
  const apply = run('instructions', 'apply', '--change', 'example-counts', '--json');
  assert.equal(apply.status, 0, apply.stderr);
  const instructions = JSON.parse(apply.stdout);
  assert.equal(instructions.progress.total, 1);
  assert.equal(instructions.progress.complete, 0);
  assert.match(JSON.stringify(instructions.tasks), /task-0001/);
  assert.ok(instructions.contextFiles.microcontracts.some(file => file.endsWith('task-0001.md')));
  const validate = run('validate', 'example-counts', '--json');
  assert.equal(validate.status, 0, validate.stdout + validate.stderr);
});
