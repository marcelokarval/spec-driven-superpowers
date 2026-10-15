import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { applyInstall, planInstall } from '../lib/install.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function temp(t, prefix) {
  const value = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  fs.chmodSync(value, 0o700);
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

function installedProject(t, fixture = 'prop4you') {
  const projectRoot = temp(t, 'asds-supervisor-project-');
  applyInstall(planInstall({ scope: 'project', target: projectRoot }));
  const source = fixture === 'complete' ? path.join(root, 'examples/planning-delivery/complete')
    : path.join(root, 'tests/fixtures/agy-review/prop4you-real-shaped');
  fs.cpSync(source, path.join(projectRoot, 'change'), { recursive: true });
  return projectRoot;
}

function fakeSpawn({ replay = false, mode = 'pass', calls, mutate = null }) {
  return (_executable, args, options) => {
    const call = { args, options, input: null };
    calls.push(call);
    const child = new EventEmitter();
    child.pid = 987654;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    let input = '';
    child.stdin = new Writable({
      write(chunk, _encoding, callback) { input += chunk.toString(); callback(); },
      final(callback) {
        queueMicrotask(() => {
          try {
            const message = JSON.parse(input.trim());
            call.input = message;
            assert.equal(message.event, 'user');
            const prompt = message.message.content[0].text;
            const request = JSON.parse(prompt.slice('ASDS_REVIEW_REQUEST_V1\n'.length));
            const response = { schema: 'asds.agy-review-response/1', packagePath: request.packagePath,
              reviewKind: request.reviewKind, revision: request.revision, candidateSha256: request.candidateSha256,
              freshness: request.freshness, inventorySha256: request.inventorySha256,
              verdict: 'pass', findings: [], limitations: [] };
            if (mode === 'timeout') return;
            const conversationId = replay ? 'replayed-session' : `session-${request.reviewKind}`;
            const init = { event: 'init', conversation_id: conversationId, init: {
              model: 'fake-model', cwd: options.cwd, agent: 'spec-driven-superpowers-reviewer-primary',
              tools: ['view_file', 'list_dir', 'find_by_name', 'grep_search'], permission_mode: 'request-review',
            } };
            if (mode === 'wrong-agent') init.init.agent = 'spec-driven-superpowers-reviewer';
            if (mode === 'wrong-cwd') init.init.cwd = path.dirname(options.cwd);
            if (mode === 'wrong-tools') init.init.tools = [...init.init.tools, 'write_to_file'];
            if (mode === 'wrong-mode') init.init.permission_mode = 'always-proceed';
            if (mode === 'wrong-model') init.init.model = 'other-model';
            if (mode !== 'missing-init') child.stdout.write(`${JSON.stringify(init)}\n`);
            if (mode === 'duplicate-init') child.stdout.write(`${JSON.stringify(init)}\n`);
            const step = (step_index, state, step_type, extra = {}) => ({ event: 'step_update', step_update: {
              conversation_id: conversationId, step_index, state, step_type, ...extra,
            } });
            child.stdout.write(`${JSON.stringify(step(0, 'DONE', 'user_input'))}\n`);
            const activeRead = step(1, 'ACTIVE', 'tool', { tool_name: 'view_file',
              tool_info: { name: 'view_file', parameters: { AbsolutePath: path.join(options.cwd, 'change/tasks.md') } } });
            const doneRead = step(1, 'DONE', 'tool', { tool_name: 'view_file', duration_seconds: 0.01,
              tool_info: { name: 'view_file', parameters: { AbsolutePath: path.join(options.cwd, 'change/tasks.md') },
                output: 'read-only fixture bytes' } });
            child.stdout.write(`${JSON.stringify(activeRead)}\n`);
            child.stdout.write(`${JSON.stringify(doneRead)}\n`);
            child.stdout.write(`${JSON.stringify(step(2, 'ACTIVE', 'agent_response', { text_delta: 'reviewing' }))}\n`);
            child.stdout.write(`${JSON.stringify(step(2, 'DONE', 'agent_response', { duration_seconds: 0.02,
              usage: { input_tokens: 10, output_tokens: 20, thinking_tokens: 5, cache_read_tokens: 2,
                total_tokens: 35 } }))}\n`);
            if (mode === 'old-schema-type') child.stdout.write(`${JSON.stringify({ type: 'system', subtype: 'init' })}\n`);
            if (mode === 'unknown-event') child.stdout.write(`${JSON.stringify({ event: 'mystery' })}\n`);
            if (mode === 'forbidden-tool' || mode === 'write-tool') {
              const toolName = mode === 'forbidden-tool' ? 'run_command' : 'write_to_file';
              child.stdout.write(`${JSON.stringify(step(3, 'ACTIVE', 'tool', { tool_name: toolName,
                tool_info: { name: toolName, parameters: {} } }))}\n`);
            }
            if (mode === 'subagent-info') child.stdout.write(`${JSON.stringify({ event: 'step_update', step_update: {
              conversation_id: conversationId, step_index: 3, state: 'DONE', step_type: 'subagent',
              tool_name: 'invoke_subagent', subagent_info: { subagents: [] },
            } })}\n`);
            if (mode === 'delegation' || mode === 'background' || mode === 'permission') {
              child.stdout.write(`${JSON.stringify(step(3, 'DONE', mode))}\n`);
            }
            if (mode === 'id-mismatch') child.stdout.write(`${JSON.stringify({ ...step(3, 'DONE', 'system_message'),
              step_update: { ...step(3, 'DONE', 'system_message').step_update, conversation_id: 'other-session' } })}\n`);
            if (mode === 'active-gap') child.stdout.write(`${JSON.stringify(step(3, 'ACTIVE', 'tool', {
              tool_name: 'grep_search', tool_info: { name: 'grep_search', parameters: { Query: 'x' } },
            }))}\n`);
            if (mode === 'unknown-step-field') child.stdout.write(`${JSON.stringify({ ...step(3, 'DONE', 'system_message'),
              step_update: { ...step(3, 'DONE', 'system_message').step_update, invented: true } })}\n`);
            if (mode === 'malformed') child.stdout.write('{not-json}\n');
            if (mode === 'oversized') { child.stdout.write('x'.repeat(8 * 1024 * 1024 + 1)); return; }
            if (mode === 'missing-result') {
              child.stdout.end(); child.stderr.end(); child.emit('close', 0, null); return;
            }
            const resultOutput = mode === 'soft-denial' ? 'I cannot review this package.'
              : `ASDS_REVIEW_RESPONSE_V1\n${JSON.stringify(response)}`;
            const resultEvent = { event: 'result', result: {
              conversation_id: mode === 'result-id-mismatch' ? 'other-session' : conversationId,
              status: mode === 'non-success' ? 'ERROR' : 'SUCCESS', response: resultOutput,
              duration_seconds: 0.04, num_turns: 1,
              usage: { input_tokens: 10, output_tokens: 20, thinking_tokens: 5, cache_read_tokens: 2,
                total_tokens: 35 },
            } };
            child.stdout.write(`${JSON.stringify(resultEvent)}\n`);
            if (mode === 'duplicate-result') child.stdout.write(`${JSON.stringify(resultEvent)}\n`);
            if (mode === 'trailing-event') child.stdout.write(`${JSON.stringify(step(4, 'DONE', 'system_message'))}\n`);
            mutate?.({ request, options });
            child.stdout.end(); child.stderr.end(); child.emit('close', 0, null);
          } catch (error) { child.emit('error', error); }
        });
        callback();
      },
    });
    child.kill = () => true;
    return child;
  };
}

async function installedApi(projectRoot) {
  const file = path.join(projectRoot, '.agents/skills/asds-execution-consumer/lib/agy-review-supervisor.mjs');
  return import(`${pathToFileURL(file).href}?test=${Date.now()}-${Math.random()}`);
}

function claimBootstrap(api, { projectRoot, stateRoot, timeoutMs = 5000 }) {
  const contract = fs.readFileSync(path.join(projectRoot, '.asds/agy-review-supervisor-transport.json'));
  const manifest = fs.readFileSync(path.join(projectRoot, '.asds/install-manifest.json'));
  const receipt = { schema: 'asds.agy-review-supervisor-bootstrap/1', installationRoot: projectRoot,
    projectRoot, stateRoot, executable: process.execPath, model: 'fake-model', timeoutMs,
    printTimeout: '4s', expectedContractSha256: createHash('sha256').update(contract).digest('hex'),
    expectedManifestSha256: createHash('sha256').update(manifest).digest('hex') };
  const file = path.join(stateRoot, 'bootstrap.json');
  fs.writeFileSync(file, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
  const fd = fs.openSync(file, 'r');
  try {
    process.env.ASDS_AGY_SUPERVISOR_BOOTSTRAP_FD = String(fd);
    return api.claimAgyReviewSupervisorBootstrap();
  } finally {
    delete process.env.ASDS_AGY_SUPERVISOR_BOOTSTRAP_FD;
    fs.closeSync(fd);
  }
}

async function supervisor(t, options = {}) {
  const projectRoot = installedProject(t, options.fixture), stateRoot = temp(t, 'asds-supervisor-state-'), calls = [];
  const spawnImpl = fakeSpawn({ ...options, calls });
  const api = await installedApi(projectRoot);
  const bootstrap = claimBootstrap(api, { projectRoot, stateRoot, timeoutMs: options.timeoutMs ?? 5000 });
  const kills = [];
  const killTreeImpl = child => { kills.push(child.pid); if (!options.survivor) {
    child.stdout?.end(); child.stderr?.end(); child.emit('close', null, 'SIGKILL');
  } };
  return { projectRoot, stateRoot, capability: api.createAgyReviewSupervisor(bootstrap, { spawnImpl, killTreeImpl }),
    calls, kills, api };
}

function makeSensitiveCandidate(projectRoot) {
  const packageRoot = path.join(projectRoot, 'change');
  const file = path.join(packageRoot, 'planning-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.synthetic = false;
  manifest.author = 'planning-author';
  manifest.tasks = manifest.tasks.map(task => ({ ...task, write: [] }));
  manifest.authority.destination = packageRoot;
  manifest.reviewPolicy = { ...manifest.reviewPolicy, risk: 'auth', independentRequired: true,
    mode: 'independent', domains: ['authentication'] };
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return packageRoot;
}

test('capture supervisor runs fresh fidelity then quality via exact primary agent without authority', async t => {
  const current = await supervisor(t);
  const result = await current.api.runAgyPlanningReviews({ supervisor: current.capability, packagePath: 'change' });
  assert.equal(result.fidelitySession, 'session-fidelity');
  assert.equal(result.qualitySession, 'session-quality');
  assert.equal(result.authoritative, false);
  assert.equal(result.completionStatus, 'unavailable');
  assert.match(result.fidelityOutput, /^ASDS_REVIEW_RESPONSE_V1\n/);
  assert.match(result.qualityOutput, /^ASDS_REVIEW_RESPONSE_V1\n/);
  for (const kind of ['fidelity', 'quality']) {
    assert.equal(fs.existsSync(path.join(current.stateRoot, 'runs', result.runId, `${kind}.ndjson`)), true);
    assert.equal(fs.existsSync(path.join(current.stateRoot, 'runs', result.runId, `${kind}.result`)), true);
    assert.equal(fs.existsSync(path.join(current.stateRoot, 'runs', result.runId, `${kind}.transcript.json`)), true);
  }
  const request = JSON.parse(result.qualityOutput.slice('ASDS_REVIEW_RESPONSE_V1\n'.length));
  assert.equal(request.reviewKind, 'quality');
  const installedContract = JSON.parse(fs.readFileSync(path.join(current.projectRoot,
    '.asds/agy-review-supervisor-transport.json')));
  assert.equal(installedContract.reviewerTypeName, 'spec-driven-superpowers-reviewer-primary');
  assert.equal(installedContract.nativeNestedRuntimeHostStatus, 'unavailable');
  assert.equal(installedContract.authorityStatus, 'unavailable');
  assert.equal(installedContract.completionStatus, 'unavailable');
  assert.equal(installedContract.outputTrust, 'untrusted-capture-only');
  assert.equal(current.calls.length, 2);
  for (const call of current.calls) {
    assert.equal(call.options.cwd, current.projectRoot);
    assert.equal(call.args.includes('--dangerously-skip-permissions'), false);
    assert.equal(call.args.includes('--continue'), false);
    assert.deepEqual(call.args.slice(0, 8), ['--print', '--input-format', 'stream-json', '--output-format',
      'stream-json', '--agent', 'spec-driven-superpowers-reviewer-primary', '--model']);
    assert.equal(call.args.includes('--sandbox'), true);
    assert.equal(call.args.includes('--disable-slash-commands'), true);
    assert.equal(call.input.event, 'user');
    assert.deepEqual(Object.keys(call.input).sort(), ['event', 'message']);
  }
});

test('self-issued bootstrap and fake PASS can never complete or mint planning authority', async t => {
  const current = await supervisor(t, { fixture: 'complete' });
  makeSensitiveCandidate(current.projectRoot);
  const result = await current.api.runAgyPlanningReviews({ supervisor: current.capability, packagePath: 'change' });
  await assert.rejects(() => current.api.completeAgyPlanningReview({ supervisor: current.capability,
    reviewHandle: Object.freeze({}), persistenceReceipt: { destination: path.join(current.projectRoot, 'change') },
    assignment: { actor: 'independent-reviewer', session: result.runId, role: 'reviewer',
      author: 'planning-author', writeScope: [] } }), /completion unavailable.*trust root/);
});

test('supervisor refuses replayed child session identities across review stages', async t => {
  const current = await supervisor(t, { replay: true });
  await assert.rejects(() => current.api.runAgyPlanningReviews({ supervisor: current.capability, packagePath: 'change' }),
    /session replay refused/);
});

test('supervisor completion remains unavailable regardless of post-review manifest drift', async t => {
  const current = await supervisor(t, { fixture: 'complete' });
  makeSensitiveCandidate(current.projectRoot);
  const result = await current.api.runAgyPlanningReviews({ supervisor: current.capability, packagePath: 'change' });
  const manifestPath = path.join(current.projectRoot, 'change/planning-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.author = 'unreviewed-author';
  manifest.reviewPolicy.risk = 'unreviewed-risk';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(() => current.api.completeAgyPlanningReview({ supervisor: current.capability,
    reviewHandle: {}, persistenceReceipt: {},
    assignment: { actor: 'independent-reviewer', session: result.runId, role: 'reviewer',
      author: 'planning-author', writeScope: [] } }), /completion unavailable.*trust root/);
});

for (const [mode, expected] of [
  ['missing-init', /exactly one init/], ['duplicate-init', /exactly one init/],
  ['old-schema-type', /unknown event/], ['unknown-event', /unknown event/],
  ['wrong-agent', /invalid closed init/], ['wrong-cwd', /invalid closed init/],
  ['wrong-tools', /invalid closed init/], ['wrong-mode', /invalid closed init/],
  ['wrong-model', /invalid closed init/], ['forbidden-tool', /forbidden permission/],
  ['write-tool', /forbidden permission/], ['subagent-info', /invalid closed step_update/],
  ['delegation', /invalid closed step_update/], ['background', /invalid closed step_update/],
  ['permission', /invalid closed step_update/], ['id-mismatch', /invalid closed step_update/],
  ['result-id-mismatch', /invalid or non-success/], ['non-success', /invalid or non-success/],
  ['active-gap', /ACTIVE step lacking a terminal/], ['unknown-step-field', /invalid closed step_update/],
  ['malformed', /non-NDJSON/], ['missing-result', /exactly one result/],
  ['duplicate-result', /exactly one result/], ['trailing-event', /terminal stream event/],
  ['soft-denial', /invalid AGY review response header/],
]) {
  test(`supervisor rejects ${mode} even when the fake CLI exits zero`, async t => {
    const current = await supervisor(t, { mode });
    await assert.rejects(() => current.api.runAgyPlanningReviews({ supervisor: current.capability, packagePath: 'change' }), expected);
  });
}

test('supervisor bounds output and kills the child tree on overflow or timeout', async t => {
  const overflow = await supervisor(t, { mode: 'oversized' });
  await assert.rejects(() => overflow.api.runAgyPlanningReviews({ supervisor: overflow.capability, packagePath: 'change' }),
    /stdout exceeded/);
  assert.deepEqual(overflow.kills, [987654]);
  const timed = await supervisor(t, { mode: 'timeout', timeoutMs: 1000 });
  await assert.rejects(() => timed.api.runAgyPlanningReviews({ supervisor: timed.capability, packagePath: 'change' }),
    /timed out/);
  assert.deepEqual(timed.kills, [987654]);
});

test('supervisor timeout fails closed when the killed child group survives', async t => {
  const current = await supervisor(t, { mode: 'timeout', timeoutMs: 1000, survivor: true });
  await assert.rejects(() => current.api.runAgyPlanningReviews({ supervisor: current.capability, packagePath: 'change' }),
    /child process group did not terminate/);
  assert.deepEqual(current.kills, [987654]);
});

test('supervisor state must be trusted, private and disjoint from model-visible roots', async t => {
  const projectRoot = installedProject(t), stateRoot = path.join(projectRoot, '.state');
  const api = await installedApi(projectRoot);
  fs.mkdirSync(stateRoot, { mode: 0o700 });
  const nestedBootstrap = claimBootstrap(api, { projectRoot, stateRoot });
  assert.throws(() => api.createAgyReviewSupervisor(nestedBootstrap), /must be disjoint/);
  if (process.platform !== 'win32') {
    const publicState = temp(t, 'asds-supervisor-public-');
    fs.chmodSync(publicState, 0o755);
    const publicBootstrap = claimBootstrap(api, { projectRoot, stateRoot: publicState });
    assert.throws(() => api.createAgyReviewSupervisor(publicBootstrap), /owner-only/);
    const realState = temp(t, 'asds-supervisor-real-state-');
    const linkedState = path.join(path.dirname(realState), `${path.basename(realState)}-link`);
    fs.symlinkSync(realState, linkedState);
    t.after(() => { try { fs.unlinkSync(linkedState); } catch {} });
    const linkedBootstrap = claimBootstrap(api, { projectRoot, stateRoot: linkedState });
    assert.throws(() => api.createAgyReviewSupervisor(linkedBootstrap), /cannot be a symlink/);
  }
});

test('public objects and wrong expected hashes cannot mint a supervisor capability', async t => {
  const projectRoot = installedProject(t), stateRoot = temp(t, 'asds-supervisor-state-');
  const api = await installedApi(projectRoot);
  assert.throws(() => api.createAgyReviewSupervisor({ installationRoot: projectRoot }), /process-local inherited/);
  const contract = fs.readFileSync(path.join(projectRoot, '.asds/agy-review-supervisor-transport.json'));
  const manifest = fs.readFileSync(path.join(projectRoot, '.asds/install-manifest.json'));
  const receipt = { schema: 'asds.agy-review-supervisor-bootstrap/1', installationRoot: projectRoot, projectRoot,
    stateRoot, executable: process.execPath, model: 'fake-model', timeoutMs: 1000, printTimeout: '1s',
    expectedContractSha256: '0'.repeat(64), expectedManifestSha256: createHash('sha256').update(manifest).digest('hex') };
  const file = path.join(stateRoot, 'forged-bootstrap.json');
  fs.writeFileSync(file, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
  const fd = fs.openSync(file, 'r');
  try {
    process.env.ASDS_AGY_SUPERVISOR_BOOTSTRAP_FD = String(fd);
    const bootstrap = api.claimAgyReviewSupervisorBootstrap();
    assert.throws(() => api.createAgyReviewSupervisor(bootstrap), /expected installation hashes/);
  } finally { delete process.env.ASDS_AGY_SUPERVISOR_BOOTSTRAP_FD; fs.closeSync(fd); }
  assert.equal(createHash('sha256').update(contract).digest('hex').length, 64);
});

test('supervisor validates exact installed manifest ownership and payload hashes', async t => {
  const projectRoot = installedProject(t), stateRoot = temp(t, 'asds-supervisor-state-');
  const api = await installedApi(projectRoot);
  const bootstrap = claimBootstrap(api, { projectRoot, stateRoot });
  fs.appendFileSync(path.join(projectRoot, '.agents/agents/spec-driven-superpowers-reviewer-primary.md'), '\ndrift\n');
  assert.throws(() => api.createAgyReviewSupervisor(bootstrap), /payload drifted/);
});

test('supervisor validates the closed schema and current bytes of the full install manifest', async t => {
  const projectRoot = installedProject(t), stateRoot = temp(t, 'asds-supervisor-state-');
  const api = await installedApi(projectRoot);
  const manifestPath = path.join(projectRoot, '.asds/install-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const unrelated = manifest.files.find(entry => entry.path.split(path.sep).join('/').endsWith('/LICENSE'));
  fs.appendFileSync(unrelated.path, '\nfull-inventory-drift\n');
  const bootstrap = claimBootstrap(api, { projectRoot, stateRoot });
  assert.throws(() => api.createAgyReviewSupervisor(bootstrap), /full manifest ownership drifted/);

  const secondProject = installedProject(t), secondState = temp(t, 'asds-supervisor-state-');
  const secondApi = await installedApi(secondProject);
  const secondManifestPath = path.join(secondProject, '.asds/install-manifest.json');
  const secondManifest = JSON.parse(fs.readFileSync(secondManifestPath, 'utf8'));
  secondManifest.unknown = true;
  fs.writeFileSync(secondManifestPath, `${JSON.stringify(secondManifest, null, 2)}\n`);
  const secondBootstrap = claimBootstrap(secondApi, { projectRoot: secondProject, stateRoot: secondState });
  assert.throws(() => secondApi.createAgyReviewSupervisor(secondBootstrap), /exact install manifest v3/);

  const incompleteProject = installedProject(t), incompleteState = temp(t, 'asds-supervisor-state-');
  const incompleteApi = await installedApi(incompleteProject);
  const incompleteManifestPath = path.join(incompleteProject, '.asds/install-manifest.json');
  const incompleteManifest = JSON.parse(fs.readFileSync(incompleteManifestPath, 'utf8'));
  const requiredSuffixes = [
    '/.asds/agy-review-supervisor-transport.json',
    '/.agents/agents/spec-driven-superpowers-reviewer-primary.md',
    '/.agents/skills/asds-execution-consumer/lib/agy-review-protocol.mjs',
    '/.agents/skills/asds-execution-consumer/lib/agy-review-supervisor.mjs',
  ];
  incompleteManifest.files = incompleteManifest.files.filter(entry =>
    requiredSuffixes.some(suffix => entry.path.split(path.sep).join('/').endsWith(suffix)));
  fs.writeFileSync(incompleteManifestPath, `${JSON.stringify(incompleteManifest, null, 2)}\n`);
  const incompleteBootstrap = claimBootstrap(incompleteApi, { projectRoot: incompleteProject, stateRoot: incompleteState });
  assert.throws(() => incompleteApi.createAgyReviewSupervisor(incompleteBootstrap), /inventory is incomplete/);

  const deletedProject = installedProject(t), deletedState = temp(t, 'asds-supervisor-state-');
  const deletedApi = await installedApi(deletedProject);
  fs.unlinkSync(path.join(deletedProject, '.asds/LICENSE'));
  const deletedBootstrap = claimBootstrap(deletedApi, { projectRoot: deletedProject, stateRoot: deletedState });
  assert.throws(() => deletedApi.createAgyReviewSupervisor(deletedBootstrap), /ENOENT|manifest-owned|ownership/);
});
