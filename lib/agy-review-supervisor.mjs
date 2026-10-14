import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  AGY_REVIEW_REQUEST_SCHEMA,
  createAgyReviewRequestFromPackage,
  encodeAgyReviewRequest,
  inspectAgyReviewPackage,
  validateAgyReviewRequest,
  validateAgyReviewResponseEnvelope,
} from './agy-review-protocol.mjs';

export const AGY_REVIEW_SUPERVISOR_CONTRACT = 'asds.agy-review-supervisor-transport/1';
const CONTRACT_KEYS = Object.freeze([
  'authorityStatus', 'completionStatus', 'freshProcessPerReview', 'inputFormat', 'manifestInventorySha256',
  'nativeNestedRuntimeHostStatus', 'outputFormat', 'outputTrust', 'planningOnly',
  'protocolRelativePath', 'protocolSha256', 'qualificationStatus', 'reviewerRelativePath', 'reviewerSha256',
  'reviewerTypeName', 'reviewerWriteScope', 'schema', 'supervisorRelativePath', 'supervisorSha256',
  'transport',
]);
const capabilities = new WeakMap();
const bootstraps = new WeakMap();
const hash = data => createHash('sha256').update(data).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().length === keys.length && Object.keys(value).sort().every((key, index) => key === keys[index]);
const withinOrSame = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const within = (root, candidate) => candidate !== root && withinOrSame(root, candidate);
const manifestInventoryIdentity = (file, target, schemaRoot) => {
  if (within(target, file)) return `target:${path.relative(target, file).split(path.sep).join('/')}`;
  if (within(schemaRoot, file)) return `schema:${path.relative(schemaRoot, file).split(path.sep).join('/')}`;
  throw new Error(`manifest-owned path is outside target and schema roots: ${file}`);
};
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

function canonicalDirectory(value, label) {
  if (!text(value) || path.resolve(value) !== value) throw new Error(`${label} must be an absolute path`);
  const current = fs.realpathSync(value), info = fs.lstatSync(current);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return current;
}

function readOwnedFile(root, relative) {
  if (!text(relative) || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`unsafe installed supervisor path: ${relative}`);
  }
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink()) throw new Error(`installed supervisor symlink refused: ${relative}`);
  }
  const info = fs.lstatSync(current);
  if (!info.isFile() || info.nlink !== 1 || info.size === 0) throw new Error(`unsafe installed supervisor file: ${relative}`);
  return fs.readFileSync(current);
}

function readOwnedAbsolute(file, allowedRoots) {
  if (!text(file) || path.resolve(file) !== file || path.normalize(file) !== file ||
      !allowedRoots.some(root => withinOrSame(root, file))) {
    throw new Error(`unsafe AGY supervisor manifest-owned path: ${file}`);
  }
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink()) throw new Error(`manifest-owned symlink refused: ${file}`);
  }
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.nlink !== 1 || before.size === 0) {
    throw new Error(`unsafe AGY supervisor manifest-owned file: ${file}`);
  }
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(`manifest-owned file changed during open: ${file}`);
    }
    const bytes = fs.readFileSync(descriptor), after = fs.fstatSync(descriptor);
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size ||
        after.mtimeMs !== opened.mtimeMs || bytes.length !== opened.size) {
      throw new Error(`manifest-owned file changed during read: ${file}`);
    }
    return bytes;
  } finally { fs.closeSync(descriptor); }
}

function inspectSupervisorInstallation(installationRoot) {
  const root = canonicalDirectory(installationRoot, 'installationRoot');
  const contractRelativePath = '.asds/agy-review-supervisor-transport.json';
  const contractBytes = readOwnedFile(root, contractRelativePath);
  let contract;
  try { contract = JSON.parse(contractBytes); } catch { throw new Error('AGY supervisor contract is not valid JSON'); }
  if (!exact(contract, CONTRACT_KEYS) || contract.schema !== AGY_REVIEW_SUPERVISOR_CONTRACT ||
      contract.transport !== 'headless-stream-json' || contract.inputFormat !== 'stream-json' ||
      contract.outputFormat !== 'stream-json' || contract.reviewerTypeName !== 'spec-driven-superpowers-reviewer-primary' ||
      contract.freshProcessPerReview !== true || contract.planningOnly !== true ||
      contract.nativeNestedRuntimeHostStatus !== 'unavailable' || contract.qualificationStatus !== 'source-tested' ||
      contract.authorityStatus !== 'unavailable' || contract.completionStatus !== 'unavailable' ||
      contract.outputTrust !== 'untrusted-capture-only' || !digest(contract.manifestInventorySha256) ||
      !Array.isArray(contract.reviewerWriteScope) || contract.reviewerWriteScope.length !== 0) {
    throw new Error('invalid closed AGY supervisor transport contract');
  }
  const profiles = [
    { reviewerRelativePath: '.agents/agents/spec-driven-superpowers-reviewer-primary.md',
      protocolRelativePath: '.agents/skills/asds-execution-consumer/lib/agy-review-protocol.mjs',
      supervisorRelativePath: '.agents/skills/asds-execution-consumer/lib/agy-review-supervisor.mjs',
      manifestRelativePath: '.asds/install-manifest.json', scope: 'project', skillsDir: '.agents/skills' },
    { reviewerRelativePath: '.gemini/config/agents/spec-driven-superpowers-reviewer-primary.md',
      protocolRelativePath: '.gemini/config/skills/asds-execution-consumer/lib/agy-review-protocol.mjs',
      supervisorRelativePath: '.gemini/config/skills/asds-execution-consumer/lib/agy-review-supervisor.mjs',
      manifestRelativePath: `.asds/install-manifests/${hash(Buffer.from('.gemini/config/skills'))}.json`,
      scope: 'user', skillsDir: '.gemini/config/skills' },
  ];
  const profile = profiles.find(candidate => ['reviewerRelativePath', 'protocolRelativePath', 'supervisorRelativePath']
    .every(key => candidate[key] === contract[key]));
  if (!profile) throw new Error('AGY supervisor contract does not use one exact official profile');
  for (const [pathKey, shaKey] of [
    ['reviewerRelativePath', 'reviewerSha256'], ['protocolRelativePath', 'protocolSha256'],
    ['supervisorRelativePath', 'supervisorSha256'],
  ]) {
    if (!digest(contract[shaKey]) || hash(readOwnedFile(root, contract[pathKey])) !== contract[shaKey]) {
      throw new Error(`AGY supervisor installed payload drifted: ${contract[pathKey]}`);
    }
  }
  const manifestRelativePath = profile.manifestRelativePath;
  const manifestBytes = readOwnedFile(root, manifestRelativePath);
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch { throw new Error('AGY supervisor install manifest is not valid JSON'); }
  const manifestKeys = ['features', 'files', 'format', 'schemaRoot', 'scope', 'skillsDir', 'target'];
  const featureKeys = ['activate', 'rules'];
  const entryKeys = ['mode', 'nlinkPolicy', 'path', 'sha256', 'type'];
  if (!exact(manifest, manifestKeys) || manifest.format !== 3 || manifest.target !== root ||
      manifest.scope !== profile.scope || manifest.skillsDir !== profile.skillsDir ||
      !text(manifest.schemaRoot) || path.resolve(manifest.schemaRoot) !== manifest.schemaRoot ||
      !exact(manifest.features, featureKeys) || typeof manifest.features.activate !== 'boolean' ||
      typeof manifest.features.rules !== 'boolean' || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('AGY supervisor requires exact install manifest v3 ownership');
  }
  const schemaRoot = canonicalDirectory(manifest.schemaRoot, 'manifest schemaRoot');
  const owned = new Map();
  for (const entry of manifest.files) {
    if (!exact(entry, entryKeys) || path.resolve(entry.path) !== entry.path || path.normalize(entry.path) !== entry.path ||
        !digest(entry.sha256) || entry.mode !== 0o644 || entry.type !== 'file' ||
        entry.nlinkPolicy !== 'exactly-one' || owned.has(entry.path)) {
      throw new Error('AGY supervisor install manifest has an invalid or duplicate owned entry');
    }
    const bytes = readOwnedAbsolute(entry.path, [root, schemaRoot]);
    const info = fs.statSync(entry.path);
    if ((info.mode & 0o777) !== entry.mode || hash(bytes) !== entry.sha256) {
      throw new Error(`AGY supervisor full manifest ownership drifted: ${entry.path}`);
    }
    owned.set(entry.path, entry);
  }
  const inventorySha256 = hash(Buffer.from(JSON.stringify([...owned.keys()]
    .map(file => manifestInventoryIdentity(file, root, schemaRoot)).sort())));
  if (inventorySha256 !== contract.manifestInventorySha256) {
    throw new Error('AGY supervisor manifest inventory is incomplete or contains non-release entries');
  }
  for (const [relative, expected] of [
    [contractRelativePath, hash(contractBytes)], [contract.reviewerRelativePath, contract.reviewerSha256],
    [contract.protocolRelativePath, contract.protocolSha256], [contract.supervisorRelativePath, contract.supervisorSha256],
  ]) {
    const entry = owned.get(path.join(root, ...relative.split('/')));
    if (!entry || entry.sha256 !== expected || entry.mode !== 0o644 || entry.type !== 'file' ||
        entry.nlinkPolicy !== 'exactly-one') {
      throw new Error(`AGY supervisor payload is not exactly manifest-owned: ${relative}`);
    }
  }
  return freeze({ root, contract, manifestSha256: hash(manifestBytes), contractSha256: hash(contractBytes) });
}

function validatePrivateStateRoot(stateRoot, projectRoot, installationRoot) {
  const supplied = fs.lstatSync(stateRoot);
  if (supplied.isSymbolicLink()) throw new Error('trusted supervisor state root cannot be a symlink');
  const root = canonicalDirectory(stateRoot, 'trusted supervisor state root');
  const info = fs.statSync(root);
  if ((info.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
    throw new Error('trusted supervisor state root must be owner-only and owned by the supervisor user');
  }
  for (const controlled of [projectRoot, installationRoot]) {
    if (withinOrSame(controlled, root) || withinOrSame(root, controlled)) {
      throw new Error('trusted supervisor state root must be disjoint from workspace and installed model-visible payload');
    }
  }
  return root;
}

function reserveFile(root, relative, bytes = Buffer.alloc(0)) {
  if (!text(relative) || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) {
    throw new Error(`unsafe supervisor state path: ${relative}`);
  }
  const file = path.join(root, relative);
  let directory = root;
  for (const part of path.dirname(relative).split(path.sep).filter(Boolean)) {
    directory = path.join(directory, part);
    try { fs.mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = fs.lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
        (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
      throw new Error(`unsafe supervisor state directory: ${directory}`);
    }
  }
  const descriptor = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY |
    (fs.constants.O_NOFOLLOW ?? 0), 0o600);
  try { if (bytes.length) fs.writeFileSync(descriptor, bytes); } finally { fs.closeSync(descriptor); }
  return file;
}

function streamInput(prompt) {
  return `${JSON.stringify({ event: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } })}\n`;
}

const AGY_REVIEW_READ_TOOLS = Object.freeze(['view_file', 'list_dir', 'find_by_name', 'grep_search']);
const AGY_USAGE_KEYS = Object.freeze([
  'cache_read_tokens', 'input_tokens', 'output_tokens', 'thinking_tokens', 'total_tokens',
]);
const finiteNonNegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const tokenCount = value => Number.isSafeInteger(value) && value >= 0;

function validUsage(value) {
  return exact(value, AGY_USAGE_KEYS) && AGY_USAGE_KEYS.every(key => tokenCount(value[key]));
}

function validateStepUpdate(event, conversationId, openSteps, terminalSteps) {
  if (!exact(event, ['event', 'step_update']) || event.event !== 'step_update') {
    throw new Error('AGY stream contained an invalid closed step_update event');
  }
  const step = event.step_update;
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    throw new Error('AGY stream contained an invalid closed step_update payload');
  }
  const allowedStepKeys = new Set([
    'conversation_id', 'duration_seconds', 'state', 'step_index', 'step_type', 'text_delta', 'tool_info',
    'tool_name', 'usage',
  ]);
  if (Object.keys(step).some(key => !allowedStepKeys.has(key)) || step.conversation_id !== conversationId ||
      !Number.isSafeInteger(step.step_index) || step.step_index < 0 ||
      !['ACTIVE', 'DONE', 'ERROR'].includes(step.state) ||
      !['user_input', 'system_message', 'agent_response', 'tool'].includes(step.step_type)) {
    throw new Error('AGY stream contained an invalid closed step_update payload');
  }
  if ('duration_seconds' in step && !finiteNonNegative(step.duration_seconds)) {
    throw new Error('AGY stream contained an invalid step duration');
  }
  if ('usage' in step && !validUsage(step.usage)) throw new Error('AGY stream contained invalid step usage');
  if ('text_delta' in step && typeof step.text_delta !== 'string') {
    throw new Error('AGY stream contained an invalid text delta');
  }
  if (terminalSteps.has(step.step_index)) throw new Error('AGY stream repeated a terminal step');

  const prior = openSteps.get(step.step_index);
  if (prior && (prior.stepType !== step.step_type || prior.toolName !== step.tool_name)) {
    throw new Error('AGY stream changed the identity of an active step');
  }

  if (step.step_type === 'tool') {
    const toolInfo = step.tool_info && typeof step.tool_info === 'object' && !Array.isArray(step.tool_info)
      ? step.tool_info : null;
    if (!text(step.tool_name) || !AGY_REVIEW_READ_TOOLS.includes(step.tool_name) ||
        !toolInfo || !exact(toolInfo, step.state === 'ACTIVE' ? ['name', 'parameters'] :
          ('output' in toolInfo ? ['name', 'output', 'parameters'] : ['name', 'parameters'])) ||
        toolInfo.name !== step.tool_name || !toolInfo.parameters ||
        typeof toolInfo.parameters !== 'object' || Array.isArray(toolInfo.parameters) ||
        ('output' in toolInfo && typeof toolInfo.output !== 'string') ||
        (step.state === 'ACTIVE' && ('duration_seconds' in step || 'output' in toolInfo)) ||
        'text_delta' in step || 'usage' in step) {
      throw new Error('AGY stream attempted a forbidden permission, background, delegation, command or write action');
    }
  } else {
    const allowed = step.step_type === 'agent_response'
      ? new Set(['conversation_id', 'duration_seconds', 'state', 'step_index', 'step_type', 'text_delta', 'usage'])
      : new Set(['conversation_id', 'duration_seconds', 'state', 'step_index', 'step_type', 'usage']);
    if (Object.keys(step).some(key => !allowed.has(key)) || step.state === 'ACTIVE' && step.step_type !== 'agent_response' ||
        step.state === 'ACTIVE' && 'duration_seconds' in step) {
      throw new Error('AGY stream contained an invalid closed non-tool step');
    }
  }

  if (step.state === 'ACTIVE') {
    openSteps.set(step.step_index, { stepType: step.step_type, toolName: step.tool_name });
  } else {
    openSteps.delete(step.step_index);
    terminalSteps.add(step.step_index);
  }
}

function extractResult(stdout, { agentName, model, projectRoot }) {
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    let event;
    try { event = JSON.parse(line); } catch { throw new Error('AGY stream contained non-NDJSON output'); }
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        !['init', 'step_update', 'result'].includes(event.event)) {
      throw new Error('AGY stream contained an unknown event');
    }
    events.push(event);
  }
  const initEvents = events.filter(event => event.event === 'init');
  if (initEvents.length !== 1) throw new Error('AGY stream requires exactly one init event');
  const resultEvents = events.filter(event => event.event === 'result');
  if (resultEvents.length !== 1) throw new Error('AGY stream requires exactly one result event');
  const initEvent = initEvents[0];
  if (events[0] !== initEvent || !exact(initEvent, ['conversation_id', 'event', 'init']) ||
      !text(initEvent.conversation_id) ||
      !exact(initEvent.init, ['agent', 'cwd', 'model', 'permission_mode', 'tools']) ||
      initEvent.init.agent !== agentName || initEvent.init.model !== model ||
      initEvent.init.cwd !== projectRoot || initEvent.init.permission_mode !== 'request-review' ||
      !Array.isArray(initEvent.init.tools) || initEvent.init.tools.length !== AGY_REVIEW_READ_TOOLS.length ||
      !initEvent.init.tools.every((tool, index) => tool === AGY_REVIEW_READ_TOOLS[index])) {
    throw new Error('AGY stream contained an invalid closed init event');
  }
  const resultEvent = resultEvents[0];
  if (events.at(-1) !== resultEvent) throw new Error('AGY result must be the terminal stream event');
  const openSteps = new Map(), terminalSteps = new Set();
  for (const event of events.slice(1, -1)) {
    validateStepUpdate(event, initEvent.conversation_id, openSteps, terminalSteps);
  }
  if (openSteps.size) throw new Error('AGY stream ended with an ACTIVE step lacking a terminal update');
  if (!exact(resultEvent, ['event', 'result']) || !exact(resultEvent.result,
      ['conversation_id', 'duration_seconds', 'num_turns', 'response', 'status', 'usage']) ||
      resultEvent.result.conversation_id !== initEvent.conversation_id || resultEvent.result.status !== 'SUCCESS' ||
      typeof resultEvent.result.response !== 'string' || !finiteNonNegative(resultEvent.result.duration_seconds) ||
      !Number.isSafeInteger(resultEvent.result.num_turns) || resultEvent.result.num_turns < 1 ||
      !validUsage(resultEvent.result.usage)) {
    throw new Error('AGY stream contained an invalid or non-success terminal result');
  }
  return { events, output: resultEvent.result.response, session: initEvent.conversation_id };
}

function launchReview({ spawnImpl, killTreeImpl, executable, model, projectRoot, prompt, timeoutMs, printTimeout, agentName }) {
  const args = ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--agent', agentName,
    '--model', model, '--sandbox', '--mode', 'plan', '--disable-slash-commands', '--add-dir', projectRoot,
    '--print-timeout', printTimeout];
  return new Promise((resolve, reject) => {
    const child = spawnImpl(executable, args, {
      cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32',
      env: Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP'].filter(key => process.env[key] !== undefined)
        .map(key => [key, process.env[key]])),
    });
    let stdout = '', stderr = '', settled = false, terminationError = null, killTimer = null;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); clearTimeout(killTimer);
      error ? reject(error) : resolve(value); };
    const terminate = error => {
      if (settled || terminationError) return;
      terminationError = error;
      try { killTreeImpl(child); } catch (killError) { return finish(new Error(`${error.message}; kill failed: ${killError.message}`)); }
      killTimer = setTimeout(() => finish(new Error(`${error.message}; child process group did not terminate`)), 1000);
    };
    child.stdout?.setEncoding?.('utf8'); child.stderr?.setEncoding?.('utf8');
    child.stdout?.on('data', chunk => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > 8 * 1024 * 1024) {
        terminate(new Error('AGY review stdout exceeded the supervisor limit'));
      }
    });
    child.stderr?.on('data', chunk => {
      stderr += chunk;
      if (Buffer.byteLength(stderr) > 1024 * 1024) {
        terminate(new Error('AGY review stderr exceeded the supervisor limit'));
      }
    });
    child.on('error', error => finish(error));
    child.on('close', (code, signal) => {
      if (terminationError) return finish(terminationError);
      if (code !== 0) return finish(new Error(`AGY review exited ${code ?? signal}: ${stderr.slice(0, 1000)}`));
      try { finish(null, { ...extractResult(stdout, { agentName, model, projectRoot }), stdout, stderr, args }); }
      catch (error) { finish(error); }
    });
    const timer = setTimeout(() => {
      terminate(new Error('AGY review timed out and its child process was terminated'));
    }, timeoutMs);
    child.stdin.on('error', error => finish(error));
    child.stdin.end(streamInput(prompt));
  });
}

export function claimAgyReviewSupervisorBootstrap() {
  const rawFd = process.env.ASDS_AGY_SUPERVISOR_BOOTSTRAP_FD;
  delete process.env.ASDS_AGY_SUPERVISOR_BOOTSTRAP_FD;
  if (!/^\d+$/.test(rawFd ?? '') || Number(rawFd) < 3) {
    throw new Error('trusted inherited supervisor bootstrap FD is required');
  }
  const fd = Number(rawFd), info = fs.fstatSync(fd);
  if (!info.isFile() || info.nlink !== 1 || (info.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
    throw new Error('supervisor bootstrap FD must reference an owner-only regular file');
  }
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(fd, 'utf8')); }
  catch { throw new Error('supervisor bootstrap FD does not contain valid JSON'); }
  const keys = ['executable', 'expectedContractSha256', 'expectedManifestSha256', 'installationRoot', 'model',
    'printTimeout', 'projectRoot', 'schema', 'stateRoot', 'timeoutMs'];
  if (!exact(receipt, keys) || receipt.schema !== 'asds.agy-review-supervisor-bootstrap/1') {
    throw new Error('invalid closed supervisor bootstrap receipt');
  }
  const bootstrap = freeze(Object.create(null));
  bootstraps.set(bootstrap, { ...receipt, consumed: false });
  return bootstrap;
}

export function createAgyReviewSupervisor(supervisorBootstrap, { spawnImpl = nodeSpawn, killTreeImpl = child => {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
  } } = {}) {
  const bootstrap = bootstraps.get(supervisorBootstrap);
  if (!bootstrap || bootstrap.consumed) throw new Error('fresh process-local inherited supervisor bootstrap capability required');
  bootstrap.consumed = true;
  const { installationRoot, projectRoot, stateRoot, executable, model, expectedContractSha256,
    expectedManifestSha256, timeoutMs, printTimeout } = bootstrap;
  const project = canonicalDirectory(projectRoot, 'projectRoot');
  const installation = inspectSupervisorInstallation(installationRoot);
  if (!digest(expectedContractSha256) || !digest(expectedManifestSha256) ||
      installation.contractSha256 !== expectedContractSha256 || installation.manifestSha256 !== expectedManifestSha256) {
    throw new Error('trusted host expected installation hashes do not match installed supervisor payload');
  }
  const executingModule = fs.realpathSync(fileURLToPath(import.meta.url));
  const installedModule = fs.realpathSync(path.join(installation.root,
    ...installation.contract.supervisorRelativePath.split('/')));
  if (executingModule !== installedModule) {
    throw new Error('AGY supervisor must execute from the exact manifest-owned installed copy');
  }
  if (!text(executable) || path.resolve(executable) !== executable) throw new Error('trusted host must supply an absolute AGY executable');
  const resolvedExecutable = fs.realpathSync(executable), executableInfo = fs.lstatSync(resolvedExecutable);
  if (!executableInfo.isFile() || executableInfo.isSymbolicLink()) throw new Error('AGY executable must resolve to a regular file');
  if (!text(model) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || !/^\d+[smh]$/.test(printTimeout)) {
    throw new Error('trusted host must supply model and bounded supervisor timeouts');
  }
  const state = validatePrivateStateRoot(stateRoot, project, installation.root);
  if (typeof spawnImpl !== 'function' || typeof killTreeImpl !== 'function') {
    throw new Error('supervisor process controls must be callable');
  }
  const capability = freeze(Object.create(null));
  capabilities.set(capability, { installation, projectRoot: project, stateRoot: state, executable: resolvedExecutable, model,
    timeoutMs, printTimeout, spawnImpl, killTreeImpl, consumedSessions: new Set() });
  return capability;
}

async function oneReview(state, runId, kind, request) {
  const reservation = reserveFile(state.stateRoot, `sessions/${runId}-${kind}.lock`, Buffer.from(`${kind}\n`));
  let result;
  try {
    result = await launchReview({ spawnImpl: state.spawnImpl, killTreeImpl: state.killTreeImpl,
      executable: state.executable, model: state.model,
      projectRoot: state.projectRoot, prompt: encodeAgyReviewRequest(request), timeoutMs: state.timeoutMs,
      printTimeout: state.printTimeout, agentName: state.installation.contract.reviewerTypeName });
    if (state.consumedSessions.has(result.session)) throw new Error('AGY reviewer session replay refused');
    state.consumedSessions.add(result.session);
    reserveFile(state.stateRoot, `sessions/by-id/${hash(Buffer.from(result.session))}.lock`, Buffer.from(`${runId}:${kind}\n`));
    const parsed = validateAgyReviewResponseEnvelope(result.output, request);
    reserveFile(state.stateRoot, `runs/${runId}/${kind}.ndjson`, Buffer.from(result.stdout));
    reserveFile(state.stateRoot, `runs/${runId}/${kind}.result`, Buffer.from(result.output));
    reserveFile(state.stateRoot, `runs/${runId}/${kind}.transcript.json`, Buffer.from(`${JSON.stringify(result.events)}\n`));
    return { request, output: result.output, response: parsed, session: result.session, args: result.args };
  } catch (error) {
    try { fs.appendFileSync(reservation, `failed:${error.message}\n`, { encoding: 'utf8' }); } catch {}
    throw error;
  }
}

export async function runAgyPlanningReviews({ supervisor, packagePath }) {
  const state = capabilities.get(supervisor);
  if (!state) throw new Error('process-local AGY supervisor capability required');
  const runId = randomBytes(18).toString('hex');
  reserveFile(state.stateRoot, `runs/${runId}/run.lock`, Buffer.from('reserved\n'));
  const before = inspectAgyReviewPackage({ projectRoot: state.projectRoot, packagePath });
  const fidelityRequest = createAgyReviewRequestFromPackage({ projectRoot: state.projectRoot, packagePath, reviewKind: 'fidelity' });
  const fidelity = await oneReview(state, runId, 'fidelity', fidelityRequest);
  if (fidelity.response.verdict !== 'pass') throw new Error('AGY fidelity review did not pass');
  const qualitySnapshot = inspectAgyReviewPackage({ projectRoot: state.projectRoot, packagePath });
  for (const key of ['packagePath', 'revision', 'candidateSha256', 'inventorySha256']) {
    if (qualitySnapshot[key] !== fidelityRequest[key]) throw new Error(`fidelity response is stale for current ${key}`);
  }
  const qualityRequest = freeze({ schema: AGY_REVIEW_REQUEST_SCHEMA,
    packagePath: qualitySnapshot.packagePath, revision: qualitySnapshot.revision,
    candidateSha256: qualitySnapshot.candidateSha256, inventorySha256: qualitySnapshot.inventorySha256,
    sourceInventory: qualitySnapshot.sourceInventory, packageInventory: qualitySnapshot.packageInventory,
    freshness: randomBytes(32).toString('hex'), priorFidelityOutput: fidelity.output,
    priorFidelitySha256: hash(Buffer.from(fidelity.output)), reviewKind: 'quality' });
  validateAgyReviewRequest(qualityRequest);
  const quality = await oneReview(state, runId, 'quality', qualityRequest);
  if (quality.response.verdict !== 'pass') throw new Error('AGY quality review did not pass');
  const after = inspectAgyReviewPackage({ projectRoot: state.projectRoot, packagePath });
  if (before.candidateSha256 !== after.candidateSha256 || before.inventorySha256 !== after.inventorySha256 ||
      qualityRequest.candidateSha256 !== after.candidateSha256 || qualityRequest.inventorySha256 !== after.inventorySha256) {
    throw new Error('planning package drifted during supervised AGY review');
  }
  return freeze({ authoritative: false, completionStatus: 'unavailable', runId,
    revision: qualityRequest.revision, candidateSha256: after.candidateSha256,
    inventorySha256: after.inventorySha256, fidelityOutput: fidelity.output, qualityOutput: quality.output,
    fidelitySession: fidelity.session, qualitySession: quality.session });
}

export async function completeAgyPlanningReview({ supervisor, reviewHandle, persistenceReceipt, assignment }) {
  void supervisor; void reviewHandle; void persistenceReceipt; void assignment;
  throw new Error('AGY supervised review completion unavailable: no qualified OS-private or signed durable trust root');
}
