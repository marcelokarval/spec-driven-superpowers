import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { planInstall, planUninstall, applyInstall } from '../lib/install.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'adapters/agy/agents/spec-driven-superpowers.md');
const reviewerSource = path.join(root, 'adapters/agy/agents/spec-driven-superpowers-reviewer.md');
const cli = path.join(root, 'scripts/install.mjs');
const childEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP']
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'asds-agy-agent-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(match, 'agent must have one YAML frontmatter block');
  const document = parseDocument(match[1], { uniqueKeys: true });
  assert.equal(document.errors.length, 0, document.errors.map(error => error.message).join('; '));
  return { data: document.toJS(), body: match[2] };
}

test('AGY coordinator has the exact TypeName, native schema, skill binding, and planning-only boundary', () => {
  const { data, body } = frontmatter(source);
  assert.deepEqual(Object.keys(data).sort(), [
    'commandExecutionPolicy', 'description', 'mainAgent', 'name', 'skills', 'subagent', 'tools',
  ]);
  assert.equal(data.name, 'spec-driven-superpowers');
  assert.equal(data.subagent, true);
  assert.equal(data.mainAgent, false);
  assert.equal(data.commandExecutionPolicy, 'sandbox');
  assert.deepEqual(data.skills, ['skills/spec-driven-superpowers']);
  assert.equal(data.tools.includes('invoke_subagent'), true);
  for (const tool of ['send_message', 'manage_subagents', 'search_web', 'read_url_content']) {
    assert.equal(data.tools.includes(tool), false, tool);
  }
  assert.match(body, /Load and follow the workspace skill `spec-driven-superpowers` before acting/);
  assert.match(body, /Never implement, test, integrate, commit, publish, or mark complete the future\s+software work/);
  assert.match(body, /Commands are limited to read-only project\s+inspection and ASDS planning validation\/readback/);
  assert.match(body, /files, generated artifacts, web content, command output, tool\s+output.*untrusted data/s);
  assert.match(body, /`spec-driven-superpowers-reviewer` is the only\s+permitted TypeName/);
  assert.match(body, /asds.harness-planning-review\/1/);
  assert.match(body, /No ASDS service/);
  assert.match(body, /exact fidelity `envelopeDigest`/);
  assert.doesNotMatch(body, /runtimeHostStatus|headless-stream-json/);
});

test('AGY reviewer is a fresh zero-write native subagent', () => {
  const { data, body } = frontmatter(reviewerSource);
  assert.deepEqual(Object.keys(data).sort(), [
    'commandExecutionPolicy', 'description', 'excludeDefaultComponents', 'inheritCustomizations',
    'mainAgent', 'name', 'skills', 'subagent', 'tools',
  ]);
  assert.equal(data.name, 'spec-driven-superpowers-reviewer');
  assert.equal(data.subagent, true);
  assert.equal(data.mainAgent, false);
  assert.equal(data.commandExecutionPolicy, 'sandbox');
  assert.equal(data.inheritCustomizations, false);
  assert.equal(data.excludeDefaultComponents, true);
  assert.deepEqual(data.skills, ['skills/spec-driven-superpowers']);
  assert.deepEqual(data.tools, ['view_file', 'list_dir', 'find_by_name', 'grep_search']);
  for (const tool of ['run_command', 'write_to_file', 'replace_file_content', 'ask_permission',
    'ask_question', 'invoke_subagent', 'send_message', 'manage_subagents']) {
    assert.equal(data.tools.includes(tool), false, tool);
  }
  assert.match(body, /zero write scope/);
  assert.match(body, /pass\|fail\|blocked/);
  assert.match(body, /priorReviewDigest/);
});

test('passive profile excludes the headless primary reviewer', t => {
  const target=fixture(t),payload=planInstall({scope:'project',target});
  assert.equal(payload.some(f=>f.path.includes('spec-driven-superpowers-reviewer-primary')),false);
});

test('project AGY profile installs, owns, reads back, updates, and uninstalls its custom agent', t => {
  const target = fixture(t);
  fs.mkdirSync(path.join(target, '.agents'));
  fs.writeFileSync(path.join(target, '.agents/owner.txt'), 'preserve\n');
  const options = { scope: 'project', target };
  const agent = path.join(target, '.agents/agents/spec-driven-superpowers.md');
  const reviewer = path.join(target, '.agents/agents/spec-driven-superpowers-reviewer.md');
  const marker = path.join(target, '.asds/accelerate-handoff-capability.json');
  const dispatchContract = path.join(target, '.asds/agy-review-dispatch-contract.json');
  const manifestPath = path.join(target, '.asds/install-manifest.json');

  const preview = planInstall(options);
  assert.equal(fs.existsSync(agent), false);
  assert.equal(fs.existsSync(reviewer), false);
  assert.ok(preview.some(file => file.path === agent));
  assert.ok(preview.some(file => file.path === reviewer));
  applyInstall(preview);
  assert.deepEqual(frontmatter(agent).data, frontmatter(source).data);
  assert.deepEqual(frontmatter(reviewer).data, frontmatter(reviewerSource).data);
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const owned = manifest.files.find(entry => entry.path === agent);
  assert.ok(owned);
  assert.equal(owned.sha256, digest(agent));
  const actualMode = process.platform === 'win32' && (fs.statSync(agent).mode & 0o777) === 0o666 ? 0o644 : (fs.statSync(agent).mode & 0o777);
  assert.equal(owned.mode, actualMode);
  assert.ok(manifest.files.some(entry => entry.path === reviewer && entry.sha256 === digest(reviewer)));
  const capability = JSON.parse(fs.readFileSync(marker));
  assert.deepEqual(capability, {
    schema: 'asds.accelerate-handoff-capability/1',
    typeName: 'spec-driven-superpowers',
    agentRelativePath: '.agents/agents/spec-driven-superpowers.md',
    agentSha256: digest(agent),
    asdsVersion: '2.1.0',
    planningOnly: true,
    writesApplicationCode: false,
    futureTaskExecution: false,
  });
  assert.ok(manifest.files.some(entry => entry.path === marker && entry.sha256 === digest(marker)));
  assert.equal(fs.existsSync(dispatchContract), false);

  applyInstall(planInstall({ ...options, update: true }));
  assert.equal(digest(agent), digest(source));
  assert.equal(digest(reviewer), digest(reviewerSource));

  const uninstall = planUninstall(options);
  assert.equal(fs.existsSync(agent), true, 'uninstall preview must not mutate');
  applyInstall(uninstall);
  assert.equal(fs.existsSync(agent), false);
  assert.equal(fs.existsSync(reviewer), false);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(dispatchContract), false);
  assert.equal(fs.existsSync(manifestPath), false);
  assert.equal(fs.readFileSync(path.join(target, '.agents/owner.txt'), 'utf8'), 'preserve\n');
});

test('update adds a newly released AGY agent and marker only when unreceipted targets are absent', t => {
  const target = fixture(t), options = { scope: 'project', target };
  applyInstall(planInstall(options));
  const agent = path.join(target, '.agents/agents/spec-driven-superpowers.md');
  const reviewer = path.join(target, '.agents/agents/spec-driven-superpowers-reviewer.md');
  const marker = path.join(target, '.asds/accelerate-handoff-capability.json');
  const dispatchContract = path.join(target, '.asds/agy-review-dispatch-contract.json');
  const manifestPath = path.join(target, '.asds/install-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files = manifest.files.filter(entry => ![agent, reviewer, marker, dispatchContract].includes(entry.path));
  fs.unlinkSync(agent);
  fs.unlinkSync(reviewer);
  fs.unlinkSync(marker);
  assert.equal(fs.existsSync(dispatchContract), false);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  applyInstall(planInstall({ ...options, update: true }));
  assert.equal(digest(agent), digest(source));
  assert.equal(digest(reviewer), digest(reviewerSource));
  const updated = JSON.parse(fs.readFileSync(manifestPath));
  assert.ok(updated.files.some(entry => entry.path === agent));
  assert.ok(updated.files.some(entry => entry.path === reviewer));
  assert.ok(updated.files.some(entry => entry.path === marker));
  assert.equal(updated.files.some(entry => entry.path === dispatchContract), false);
  assert.equal(JSON.parse(fs.readFileSync(marker)).agentSha256, digest(agent));

  const receipt = JSON.parse(fs.readFileSync(manifestPath));
  receipt.files = receipt.files.filter(entry => entry.path !== agent);
  fs.writeFileSync(manifestPath, `${JSON.stringify(receipt, null, 2)}\n`);
  assert.throws(() => planInstall({ ...options, update: true }), /cannot reclaim unreceipted payload/);
  assert.equal(digest(agent), digest(source));
});

test('user AGY profile uses the official global agent root and uninstall preserves sibling profile shared payload', t => {
  const target = fixture(t), dataHome = fixture(t);
  const base = { scope: 'user', target, dataHome };
  applyInstall(planInstall(base));
  const shared = path.join(target, '.asds/LICENSE');
  const defaultSkill = path.join(target, '.agents/skills/spec-driven-superpowers/SKILL.md');
  const agent = path.join(target, '.gemini/config/agents/spec-driven-superpowers.md');
  const reviewer = path.join(target, '.gemini/config/agents/spec-driven-superpowers-reviewer.md');
  const dispatchContract = path.join(target, '.asds/agy-review-dispatch-contract.json');
  assert.equal(fs.existsSync(agent), false);

  const agy = { ...base, skillsDir: '.gemini/config/skills' };
  applyInstall(planInstall(agy));
  assert.equal(frontmatter(agent).data.name, 'spec-driven-superpowers');
  assert.equal(frontmatter(reviewer).data.name, 'spec-driven-superpowers-reviewer');
  const profilePath = path.join(target, '.asds/install-manifests', fs.readdirSync(path.join(target, '.asds/install-manifests'))[0]);
  const profile = JSON.parse(fs.readFileSync(profilePath));
  assert.ok(profile.files.some(entry => entry.path === agent && entry.sha256 === digest(agent)));
  assert.ok(profile.files.some(entry => entry.path === reviewer && entry.sha256 === digest(reviewer)));
  const marker = path.join(target, '.asds/accelerate-handoff-capability.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(marker)), {
    schema: 'asds.accelerate-handoff-capability/1',
    typeName: 'spec-driven-superpowers',
    agentRelativePath: '.gemini/config/agents/spec-driven-superpowers.md',
    agentSha256: digest(agent),
    asdsVersion: '2.1.0',
    planningOnly: true,
    writesApplicationCode: false,
    futureTaskExecution: false,
  });
  assert.ok(profile.files.some(entry => entry.path === marker && entry.sha256 === digest(marker)));
  assert.equal(profile.files.some(entry => entry.path === dispatchContract), false);

  applyInstall(planUninstall(agy));
  assert.equal(fs.existsSync(agent), false);
  assert.equal(fs.existsSync(reviewer), false);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(dispatchContract), false);
  assert.equal(fs.existsSync(profilePath), false);
  assert.equal(fs.existsSync(defaultSkill), true);
  assert.equal(fs.existsSync(shared), true);
  assert.equal(fs.existsSync(path.join(target, '.asds/install-manifest.json')), true);
});

test('uninstall fails closed when an owned AGY agent changed', t => {
  const target = fixture(t), options = { scope: 'project', target };
  applyInstall(planInstall(options));
  const agent = path.join(target, '.agents/agents/spec-driven-superpowers.md');
  fs.writeFileSync(agent, 'owner edit\n');
  assert.throws(() => planUninstall(options), /modified bytes/);
  assert.equal(fs.readFileSync(agent, 'utf8'), 'owner edit\n');
  assert.equal(fs.existsSync(path.join(target, '.asds/install-manifest.json')), true);
});

test('CLI uninstall is preview-first and applies only with the explicit flag', t => {
  const target = fixture(t), options = { scope: 'project', target };
  applyInstall(planInstall(options));
  const agent = path.join(target, '.agents/agents/spec-driven-superpowers.md');
  const run = (...args) => {
    const result = spawnSync(process.execPath, [cli, '--scope', 'project', '--target', target, ...args],
      { encoding: 'utf8', cwd: root, env: childEnv });
    assert.ifError(result.error);
    return result;
  };
  const preview = run('--uninstall');
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Preview only/);
  assert.equal(fs.existsSync(agent), true);
  const applied = run('--uninstall', '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /Uninstalled\/verified/);
  assert.equal(fs.existsSync(agent), false);
});

test('uninstall refuses foreign skill and optional-path injections outside the exact profile inventory', t => {
  for (const relative of ['.agents/skills/foreign-skill/SKILL.md', 'AGENTS.md', 'openspec/config.yaml', 'owner-data.txt']) {
  const target = fixture(t), options = { scope: 'project', target };
  applyInstall(planInstall(options));
  const foreign = path.join(target, relative);
  fs.mkdirSync(path.dirname(foreign), { recursive: true });
  fs.writeFileSync(foreign, 'preserve\n');
  const manifestPath = path.join(target, '.asds/install-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files.push({ path: foreign, sha256: digest(foreign), mode: fs.statSync(foreign).mode & 0o777,
    type: 'file', nlinkPolicy: 'exactly-one' });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => planUninstall(options), /exact official profile inventory|optional rule or activation/);
  assert.equal(fs.readFileSync(foreign, 'utf8'), 'preserve\n');
  }
});

test('uninstall rejects a foreign entry injected into a sibling profile before preserving ownership', t => {
  const target = fixture(t), dataHome = fixture(t);
  const base = { scope: 'user', target, dataHome };
  applyInstall(planInstall(base));
  const agy = { ...base, skillsDir: '.gemini/config/skills' };
  applyInstall(planInstall(agy));
  const siblingPath = path.join(target, '.asds/install-manifests',
    fs.readdirSync(path.join(target, '.asds/install-manifests'))[0]);
  const sibling = JSON.parse(fs.readFileSync(siblingPath));
  const foreign = path.join(target, '.gemini/config/skills/foreign-skill/SKILL.md');
  fs.mkdirSync(path.dirname(foreign), { recursive: true });
  fs.writeFileSync(foreign, 'preserve\n');
  sibling.files.push({ path: foreign, sha256: digest(foreign), mode: fs.statSync(foreign).mode & 0o777,
    type: 'file', nlinkPolicy: 'exactly-one' });
  fs.writeFileSync(siblingPath, `${JSON.stringify(sibling, null, 2)}\n`);
  assert.throws(() => planUninstall(base), /sibling.*exact official profile inventory/);
  assert.equal(fs.readFileSync(foreign, 'utf8'), 'preserve\n');
  assert.equal(fs.existsSync(path.join(target, '.asds/install-manifest.json')), true);
});

test('marker tamper and agent drift both block update and uninstall', t => {
  for (const changed of ['.asds/accelerate-handoff-capability.json', '.agents/agents/spec-driven-superpowers.md',
    '.agents/agents/spec-driven-superpowers-reviewer.md']) {
    const target = fixture(t), options = { scope: 'project', target };
    applyInstall(planInstall(options));
    const file = path.join(target, changed);
    fs.writeFileSync(file, 'tampered\n');
    assert.throws(() => planInstall({ ...options, update: true }), /modified bytes/);
    assert.throws(() => planUninstall(options), /modified bytes/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'tampered\n');
  }
});

test('uninstall rejects self-consistent receipt tampering at official paths', { skip: process.platform === 'win32' }, t => {
  for (const mutation of ['bytes', 'mode', 'type', 'link-policy']) {
    const target = fixture(t), options = { scope: 'project', target };
    applyInstall(planInstall(options));
    const file = path.join(target, '.agents/skills/spec-driven-superpowers/SKILL.md');
    const manifestPath = path.join(target, '.asds/install-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    const entry = manifest.files.find(candidate => candidate.path === file);
    if (mutation === 'bytes') {
      fs.writeFileSync(file, 'owner replacement\n');
      entry.sha256 = digest(file);
    } else if (mutation === 'mode') {
      fs.chmodSync(file, 0o600);
      entry.mode = 0o600;
    } else if (mutation === 'type') {
      entry.type = 'directory';
    } else {
      entry.nlinkPolicy = 'any';
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(() => planUninstall(options), /invalid uninstall manifest|metadata does not match/);
    assert.equal(fs.existsSync(file), true);
    assert.equal(fs.existsSync(manifestPath), true);
  }
});

test('dynamic agent and marker expectations reject replacement receipts until verified update', t => {
  for (const relative of ['.agents/agents/spec-driven-superpowers.md',
    '.agents/agents/spec-driven-superpowers-reviewer.md', '.asds/accelerate-handoff-capability.json']) {
    const target = fixture(t), options = { scope: 'project', target };
    applyInstall(planInstall(options));
    const file = path.join(target, relative);
    const manifestPath = path.join(target, '.asds/install-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    fs.writeFileSync(file, 'owner replacement\n');
    manifest.files.find(entry => entry.path === file).sha256 = digest(file);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(() => planUninstall(options), /metadata does not match the current official payload/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'owner replacement\n');
    applyInstall(planInstall({ ...options, update: true }));
    applyInstall(planUninstall(options));
    assert.equal(fs.existsSync(manifestPath), false);
  }
});

test('older v2 inventory mismatch fails closed until a verified update migrates it', t => {
  const target = fixture(t), options = { scope: 'project', target };
  applyInstall(planInstall(options));
  const agent = path.join(target, '.agents/agents/spec-driven-superpowers.md');
  const reviewer = path.join(target, '.agents/agents/spec-driven-superpowers-reviewer.md');
  const marker = path.join(target, '.asds/accelerate-handoff-capability.json');
  const dispatchContract = path.join(target, '.asds/agy-review-dispatch-contract.json');
  const manifestPath = path.join(target, '.asds/install-manifest.json');
  const legacy = JSON.parse(fs.readFileSync(manifestPath));
  legacy.format = 2;
  delete legacy.features;
  legacy.files = legacy.files.filter(entry => ![agent, reviewer, marker, dispatchContract].includes(entry.path));
  fs.unlinkSync(agent);
  fs.unlinkSync(reviewer);
  fs.unlinkSync(marker);
  assert.equal(fs.existsSync(dispatchContract), false);
  fs.writeFileSync(manifestPath, `${JSON.stringify(legacy, null, 2)}\n`);
  assert.throws(() => planUninstall(options), /missing official profile payload/);

  applyInstall(planInstall({ ...options, update: true }));
  const migrated = JSON.parse(fs.readFileSync(manifestPath));
  assert.equal(migrated.format, 3);
  assert.equal(migrated.files.some(entry => entry.path === agent), true);
  assert.equal(migrated.files.some(entry => entry.path === reviewer), true);
  assert.equal(migrated.files.some(entry => entry.path === marker), true);
  assert.equal(migrated.files.some(entry => entry.path === dispatchContract), false);
  applyInstall(planUninstall(options));
  assert.equal(fs.existsSync(manifestPath), false);
});

test('uninstall rejects an injected receipt that reuses another official path', t => {
  const target = fixture(t), options = { scope: 'project', target };
  applyInstall(planInstall(options));
  const manifestPath = path.join(target, '.asds/install-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files[0] = { ...manifest.files[1] };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => planUninstall(options), /duplicate uninstall manifest entry|missing official profile payload/);
  assert.equal(fs.existsSync(manifestPath), true);
});

test('ordinary uninstall failure restores every removed owned file from memory', t => {
  const target = fixture(t), options = { scope: 'project', target };
  applyInstall(planInstall(options));
  const manifestPath = path.join(target, '.asds/install-manifest.json');
  const before = JSON.parse(fs.readFileSync(manifestPath));
  const removal = planUninstall(options);
  assert.throws(() => applyInstall(removal, { beforeWrite(file) {
    if (file === manifestPath) throw new Error('injected uninstall failure');
  } }), /injected uninstall failure/);
  assert.equal(fs.existsSync(manifestPath), true);
  for (const entry of before.files) {
    assert.equal(fs.existsSync(entry.path), true, entry.path);
    assert.equal(digest(entry.path), entry.sha256, entry.path);
  }
});

test('AGY Stage-3 execution consumer agents enforce role-separated tool boundaries', () => {
  const coordinator = frontmatter(path.join(root, 'adapters/agy/agents/asds-coordinator.md'));
  assert.equal(coordinator.data.name, 'asds-coordinator');
  assert.deepEqual(coordinator.data.skills, ['skills/asds-execution-consumer']);
  assert.equal(coordinator.data.tools.includes('invoke_subagent'), true);
  assert.equal(coordinator.data.tools.includes('write_to_file'), false);
  assert.equal(coordinator.data.tools.includes('replace_file_content'), false);

  for (const readonlyName of ['asds-explore', 'asds-librarian', 'asds-reviewer', 'asds-verifier']) {
    const { data } = frontmatter(path.join(root, `adapters/agy/agents/${readonlyName}.md`));
    assert.equal(data.name, readonlyName);
    assert.equal(data.tools.includes('write_to_file'), false, readonlyName);
    assert.equal(data.tools.includes('replace_file_content'), false, readonlyName);
    assert.equal(data.tools.includes('invoke_subagent'), false, readonlyName);
  }

  for (const writerName of ['asds-executor', 'asds-frontend-executor', 'asds-integrator']) {
    const { data } = frontmatter(path.join(root, `adapters/agy/agents/${writerName}.md`));
    assert.equal(data.name, writerName);
    assert.equal(data.tools.includes('write_to_file'), true, writerName);
    assert.equal(data.tools.includes('replace_file_content'), true, writerName);
    assert.equal(data.tools.includes('invoke_subagent'), false, writerName);
  }
});

test('per-harness profiles (opencode, codex, claude) install, own, and uninstall their dedicated agent sets', t => {
  const cases = [
    { skillsDir: '.opencode/skills', agentsDir: '.opencode/agents', expectedCount: 10 },
    { skillsDir: '.codex/skills', agentsDir: '.codex/agents', expectedCount: 8 },
    { skillsDir: '.claude/skills', agentsDir: '.claude/agents', expectedCount: 10 },
  ];
  for (const { skillsDir, agentsDir, expectedCount } of cases) {
    const target = fixture(t);
    const options = { scope: 'project', target, skillsDir };
    applyInstall(planInstall(options));
    const installedAgentsDir = path.join(target, agentsDir);
    assert.equal(fs.existsSync(installedAgentsDir), true, agentsDir);
    const installedNames = fs.readdirSync(installedAgentsDir).sort();
    assert.equal(installedNames.length, expectedCount, agentsDir);
    assert.equal(installedNames.includes('spec-driven-superpowers.md'), true);
    assert.equal(installedNames.includes('asds-coordinator.md'), true);
    assert.equal(installedNames.includes('asds-executor.md'), true);
    assert.equal(installedNames.includes('asds-reviewer.md'), true);
    assert.equal(installedNames.includes('asds-verifier.md'), true);
    applyInstall(planUninstall(options));
    assert.equal(fs.existsSync(path.join(installedAgentsDir, 'asds-coordinator.md')), false, agentsDir);
    assert.equal(fs.readdirSync(installedAgentsDir).length, 0, agentsDir);
  }
});
