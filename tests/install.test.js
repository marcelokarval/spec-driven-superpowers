import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planInstall, applyInstall } from '../lib/install.mjs';
import { validateLocalLinks } from '../lib/validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'scripts/install.mjs');
function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'asds-install-')));
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
  assert.ok(fs.existsSync(path.join(target, '.asds/LICENSE')));
  assert.ok(fs.existsSync(path.join(target, '.asds/vendor-provenance.json')));
  assert.deepEqual(validateLocalLinks(path.join(target, '.agents/skills/spec-driven-superpowers'), ['SKILL.md']), []);
});

test('Bash wrapper preserves arguments and native exit codes', { skip: process.platform === 'win32' }, t => {
  const target = path.join(fixture(t), 'project with spaces');
  const run = (...args) => spawnSync('bash', [path.join(root, 'scripts/install.sh'), ...args], { encoding: 'utf8' });
  const preview = run('--scope', 'project', '--target', target);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(fs.existsSync(target), false);
  const invalid = run('--unknown');
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Unknown option/);
});

test('explicit harness directory installs without creating a generic alias', t => {
  const target = fixture(t);
  const result = install(target, '--skills-dir', '.claude/skills', '--apply');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(target, '.claude/skills/spec-driven-superpowers/SKILL.md')));
  assert.equal(fs.existsSync(path.join(target, '.agents')), false);
  assert.notEqual(install(fixture(t), '--skills-dir', '../escape', '--apply').status, 0);
});

test('project rules require opt-in and never replace owner instructions', t => {
  const target = fixture(t);
  fs.writeFileSync(path.join(target, 'AGENTS.md'), 'owner rules');
  const result = install(target, '--rules', '--apply');
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), 'owner rules');
  assert.equal(fs.existsSync(path.join(target, '.agents')), false);
  const empty = fixture(t);
  assert.equal(install(empty, '--rules', '--apply').status, 0);
  assert.match(fs.readFileSync(path.join(empty, 'AGENTS.md'), 'utf8'), /Opt-in/);
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

test('native harness skill roots coexist without replacing another installation manifest', t => {
  for (const roots of [['.agents/skills', '.gemini/config/skills'], ['.gemini/config/skills', '.agents/skills']]) {
    const target = fixture(t), dataHome = fixture(t);
    const run = skillsDir => spawnSync(process.execPath, [cli, '--scope', 'user', '--target', target,
      '--data-home', dataHome, '--skills-dir', skillsDir, '--apply'], { encoding: 'utf8' });
    for (const skillsDir of roots) {
      const result = run(skillsDir);
      assert.equal(result.status, 0, result.stderr);
    }
    const legacy = path.join(target, '.asds/install-manifest.json');
    const before = fs.readFileSync(legacy, 'utf8');
    assert.ok(JSON.parse(before).files.some(file => file.path.includes(`${path.sep}.agents${path.sep}`)));
    for (const skillsDir of roots) {
      assert.ok(fs.existsSync(path.join(target, skillsDir, 'spec-driven-superpowers/SKILL.md')));
      assert.equal(run(skillsDir).status, 0);
    }
    assert.equal(fs.readFileSync(legacy, 'utf8'), before);
    const profiles = fs.readdirSync(path.join(target, '.asds/install-manifests'));
    assert.equal(profiles.length, 1);
    const other = JSON.parse(fs.readFileSync(path.join(target, '.asds/install-manifests', profiles[0]), 'utf8'));
    assert.ok(other.files.some(file => file.path.includes(`${path.sep}.gemini${path.sep}`)));
  }
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

test('user scope installs schema under explicitly selected data home', t => {
  const target = fixture(t);
  const config = fixture(t);
  const result = spawnSync(process.execPath, [
    cli, '--scope', 'user', '--target', target, '--data-home', config, '--apply',
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

test('failed apply rolls back only newly created files and directories', t => {
  const target = fixture(t);
  fs.mkdirSync(path.join(target, '.agents'));
  fs.writeFileSync(path.join(target, '.agents/AGENTS.md'), 'user-owned');
  const files = planInstall({ scope: 'project', target });
  let writes = 0;
  assert.throws(() => applyInstall(files, {
    beforeWrite() { if (++writes === 4) throw new Error('injected write failure'); },
  }), /injected write failure.*rolled back/);
  assert.deepEqual(fs.readdirSync(target), ['.agents']);
  assert.deepEqual(fs.readdirSync(path.join(target, '.agents')), ['AGENTS.md']);
  assert.equal(fs.readFileSync(path.join(target, '.agents/AGENTS.md'), 'utf8'), 'user-owned');
});


test('global installation leaves an unrelated current directory and project state untouched', t => {
  const userHome = fixture(t);
  const dataHome = fixture(t);
  const unrelated = fixture(t);
  fs.writeFileSync(path.join(unrelated, 'personal.txt'), 'keep');
  const args = [cli, '--scope', 'user', '--target', userHome, '--data-home', dataHome];
  const preview = spawnSync(process.execPath, args, { cwd: unrelated, encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(fs.readdirSync(userHome), []);
  assert.deepEqual(fs.readdirSync(dataHome), []);
  const apply = spawnSync(process.execPath, [...args, '--apply'], { cwd: unrelated, encoding: 'utf8' });
  assert.equal(apply.status, 0, apply.stderr);
  assert.deepEqual(fs.readdirSync(unrelated), ['personal.txt']);
  assert.equal(fs.readFileSync(path.join(unrelated, 'personal.txt'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(userHome, 'openspec')), false);
  assert.equal(fs.existsSync(path.join(userHome, 'AGENTS.md')), false);
  assert.deepEqual(fs.readdirSync(path.join(dataHome, 'openspec')), ['schemas']);
  assert.ok(fs.existsSync(path.join(userHome, '.agents/skills/spec-driven-superpowers/references/activation.md')));
});
