import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hostDispatchVerifier } from '../../../lib/host-bridge.mjs';
import { digest, replay } from '../../../lib/orchestration.mjs';
import { validateCanonicalReceipt } from '../../../lib/contracts.mjs';
import { inspectTaskIndexProgress } from '../../../lib/task-index-progress.mjs';
import { validateExecutionHandoff } from '../../../lib/execution-handoff.mjs';
import { validateExecutionConsumerContextBinding, validateExecutionSource } from '../../../lib/execution-consumer.mjs';

const fail = message => { throw new Error(message); };
const clone = value => structuredClone(value);
const hash = value => /^[a-f0-9]{64}$/.test(value ?? '');
const bytesHash = value => createHash('sha256').update(value).digest('hex');
const fileHash = file => fs.existsSync(file) ? bytesHash(fs.readFileSync(file)) : null;
const same = (left, right) => digest(left) === digest(right);
const exactKeys = (value, keys) => value && typeof value === 'object' &&
  Object.keys(value).sort().join() === [...keys].sort().join();

export function validateProductAttributions({ journal, ledger, source, root, initialInventory }) {
  const allowed = ['actor','session','role','taskId','attempt','phase','path','sequence','beforeSha256','afterSha256','beforeBytes','afterBytes','assignment'];
  const expected = [], attempts = {};
  for (const entry of journal.events) {
    const event = entry.event;
    if (event.type !== 'dispatch' || !event.taskId || !['executor','integrator'].includes(event.role)) continue;
    const task = source.find(item => item.id === event.taskId);
    if (!task) fail('attribution task missing');
    if (event.role === 'executor') attempts[event.taskId] = (attempts[event.taskId] ?? 0) + 1;
    const attempt = attempts[event.taskId];
    for (const path of task.write) expected.push({
      taskId:event.taskId, attempt, phase:event.role === 'executor' ? 'candidate' : 'integration', path,
      actor:event.context.reservedActor, session:event.session, role:event.role,
      operationToolCallDigest:digest(event.role === 'executor' ? event.context.startRequest.operationToolCall : event.context.integrationRequest.operationToolCall),
    });
  }
  const items = ledger.attributions, snapshots = ledger.attributionSnapshots;
  if (!Array.isArray(items) || !items.length || items.length !== expected.length || !snapshots || Object.keys(snapshots).length !== items.length) fail('attribution coverage mismatch');
  const prior = new Map(Object.entries(initialInventory)), identities = new Set();
  items.forEach((item, index) => {
    const wanted = expected[index], identity = `${item.taskId}:${item.attempt}:${item.phase}:${item.path}`;
    if (identities.has(identity)) fail('duplicate attribution identity');
    identities.add(identity);
    if (!exactKeys(item, allowed) || !exactKeys(item.assignment,['actor','session','role','taskId','operationToolCallDigest'])) fail('attribution schema mismatch');
    if (item.sequence !== index + 1 || item.actor === 'root' || item.role !== (item.phase === 'candidate' ? 'executor' : 'integrator') || !wanted ||
      ['taskId','attempt','phase','path','actor','session','role'].some(key => item[key] !== wanted[key]) ||
      item.assignment.operationToolCallDigest !== wanted.operationToolCallDigest || item.assignment.actor !== item.actor ||
      item.assignment.session !== item.session || item.assignment.role !== item.role || item.assignment.taskId !== item.taskId) fail('attribution assignment/order mismatch');
    const snapshotRef = snapshots[item.sequence], snapshotPath = snapshotRef?.path;
    if (!snapshotPath?.startsWith('.asds/evidence/attribution-') || !hash(snapshotRef.sha256)) fail('attribution snapshot reference invalid');
    const snapshotBytes = fs.readFileSync(`${root}/${snapshotPath}`), snapshot = JSON.parse(snapshotBytes);
    if (!exactKeys(snapshotRef,['path','sha256']) || !exactKeys(snapshot,['schemaVersion','actor','session','role','taskId','attempt','phase','path','sequence','beforeSha256','afterSha256','beforeBytes','afterBytes']) ||
      bytesHash(snapshotBytes) !== snapshotRef.sha256 || snapshot.schemaVersion !== 'asds.product-write-snapshot/1' || snapshot.sequence !== item.sequence ||
      ['actor','session','role','taskId','attempt','phase','path','beforeSha256','afterSha256','beforeBytes','afterBytes'].some(key => snapshot[key] !== item[key])) fail('independent attribution snapshot mismatch');
    if (item.beforeSha256 !== (prior.get(item.path) ?? null) || item.beforeSha256 !== (item.beforeBytes === null ? null : bytesHash(Buffer.from(item.beforeBytes,'base64'))) ||
      item.afterSha256 !== bytesHash(Buffer.from(item.afterBytes,'base64')) || !hash(item.afterSha256)) fail('attribution snapshot/hash chain mismatch');
    prior.set(item.path, item.afterSha256);
  });
  for (const path of new Set(items.map(item => item.path))) if (fileHash(`${root}/${path}`) !== prior.get(path)) fail('attribution final bytes mismatch');
  return true;
}

function acceptedBaseline({ journal, ledger, evidence }, receipt) {
  const taskId = receipt.provenance.taskId;
  const boundary = replay({...journal,events:journal.events.slice(0,receipt.provenance.journalSequence)});
  const delivery = [...journal.events].reverse().find(entry => entry.event.type === 'deliver' && entry.event.taskId === taskId && entry.event.receipt.revision === boundary.tasks[taskId].receipt.revision)?.event;
  const dispatches = journal.events.filter(entry => entry.event.type === 'dispatch' && entry.event.taskId === taskId && entry.event.role === 'executor');
  const acceptedAttempt = dispatches.findIndex(entry => entry.event.session === delivery?.session) + 1;
  const writes = ledger.attributions.filter(item => item.taskId === taskId && item.phase === 'candidate' && item.attempt === acceptedAttempt);
  const candidateChanges = writes.map(item => ({path:item.path,beforeSha256:item.beforeSha256,afterSha256:item.afterSha256}));
  const preexistingDirty = writes.filter(item => item.beforeSha256 !== null).map(item => ({path:item.path,sha256:item.beforeSha256}));
  const expected = {
    candidateChanges, preexistingDirty, candidateFingerprint:digest(candidateChanges), deltaDigest:digest(candidateChanges),
    snapshotDigest:digest(writes.map(item => ledger.attributionSnapshots[item.sequence])),
    workspaceIdentityDigest:digest(evidence.contract.workspaceIdentity),
  };
  const baseline = receipt.provenance.baselineLedger;
  if (!acceptedAttempt || writes.length !== evidence.canonicalTask.write.length || !same(baseline.candidateChanges, expected.candidateChanges) ||
    !same(baseline.preexistingDirty, expected.preexistingDirty) ||
    ['candidateFingerprint','deltaDigest','snapshotDigest','workspaceIdentityDigest'].some(field => baseline[field] !== expected[field])) fail('baseline ledger is not anchored to accepted write snapshots');
  const identity = evidence.contract.workspaceIdentity;
  if (!identity || identity.packageRootRealpath !== evidence.root || identity.projectRootRealpath !== evidence.root ||
    !['packageRootRealpath','projectRootRealpath','workspaceId','repoIdentity','planningFingerprint','workspaceBaselineFingerprint','writeScope'].every(field => same(identity[field], ledger.workspace[field]))) fail('workspace identity contract mismatch');
}

function validationHost(ledger) {
  let generation = 0;
  const matrix = Object.fromEntries(['verifyHostObservation','observeWorkspace','enforceCoordinatorBoundary','observeStartState','observeIntegrationState','observeProgressState']
    .map(name => [name,{state:'observed',source:'host'}]));
  matrix.snapshot = {state:'unavailable',source:'host'};
  return {
    verifyHostObservation:async({observation}) => observation?.source !== 'caller',
    observeCapabilities:async() => ({runtime:clone(ledger.capabilities),matrix:clone(matrix),lease:{generation:++generation,token:`reopen-validation-${generation}`,source:'host'},source:'host'}),
    observeWorkspace:async() => clone(ledger.workspace),
    enforceCoordinatorBoundary:async({coordinator}) => ({enforced:true,projectReadOnly:true,brokers:['journal','evidence','progress'],coordinator,violations:[],source:'host'}),
    observeStartState:async({requestId}) => clone(ledger.starts?.[requestId]),
    observeIntegrationState:async({requestId}) => clone(ledger.integrations?.[requestId]),
    observeProgressState:async({requestId}) => clone(ledger.progress?.[requestId]),
  };
}

function latestWorkspaceBefore(journal, sequence, ledger) {
  const entries = journal.events.slice(0,sequence - 1);
  const latest = [...entries].reverse().find(entry => entry.event.type === 'progressRequested' || entry.event.context?.integrationRequest || entry.event.context?.startRequest);
  if (!latest) return replay(journal).context.workspaceBinding;
  if (latest.event.type === 'progressRequested') {
    const fields = ['type','taskId','planningRevision','contractRevision','integrationRevision','receiptDigest','indexBeforeHash','expectedChange'];
    const request = Object.fromEntries(fields.map(key => [key,latest.event[key]]));
    return Object.values(ledger.progress ?? {}).find(proof => same(proof.progressRequested,request))?.workspace;
  }
  const request = latest.event.context.integrationRequest ?? latest.event.context.startRequest;
  return (latest.event.context.integrationRequest ? ledger.integrations : ledger.starts)?.[request.requestId]?.workspace;
}

function validateDurableLedgers(journal, ledger) {
  const startKeys = ['requestId','status','actor','session','role','taskId','writeScope','operationToolCall','workspaceBeforeDigest','workspace','source'];
  const integrationKeys = [...startKeys,'workspaceTransition'];
  const progressKeys = ['requestId','status','actor','session','role','taskId','projectRootRealpath','canonicalIndex','progressRequested','workspaceBeforeDigest','workspace','workspaceTransition','indexAfterHash','source'];
  const transitionKeys = ['operation','beforeFingerprint','afterFingerprint','beforeToolCalls','afterToolCalls','writeScope','changedPaths','source'];
  const identityFields = ['packageRootRealpath','projectRootRealpath','workspaceId','repoIdentity','planningFingerprint','workspaceBaselineFingerprint','writeScope'];
  const workspaceKeys = ['packageRootRealpath','projectRootRealpath','workspaceId','repoIdentity','planningFingerprint','workspaceBaselineFingerprint','currentFingerprint','writeScope','toolCalls','source'];
  const toolKeys = ['id','operation','actor','session','role','source'], expectedStarts = [], expectedIntegrations = [], expectedProgress = [];
  const validateWorkspace = (workspace,label) => {
    if (!exactKeys(workspace,workspaceKeys) || !workspace.source?.trim() || workspace.source === 'caller' || !hash(workspace.currentFingerprint) ||
      !exactKeys(workspace.repoIdentity,['vcs','rootRealpath','commonDirRealpath','baseRevision']) || !Array.isArray(workspace.toolCalls)) fail(`${label} workspace schema invalid`);
    for (const tool of workspace.toolCalls) if (!exactKeys(tool,toolKeys) || !tool.source?.trim() || tool.source === 'caller') fail(`${label} toolCalls invalid`);
  };
  validateWorkspace(ledger.workspace,'current');
  for (const entry of journal.events) {
    const event = entry.event, start = event.context?.startRequest, integration = event.context?.integrationRequest;
    if (start) {
      expectedStarts.push(start.requestId);
      const proof = ledger.starts?.[start.requestId], before = event.context.workspaceSnapshotBefore;
      if (!exactKeys(proof,startKeys) || proof.status !== 'observed' || !proof.source?.trim() || proof.source === 'caller' || proof.requestId !== start.requestId ||
        proof.actor !== start.actor || proof.session !== event.session || proof.role !== event.role || proof.taskId !== (event.taskId ?? `objective:${event.objectiveRevision}`) ||
        !same(proof.writeScope,start.writeScope) || !same(proof.operationToolCall,start.operationToolCall) || proof.workspaceBeforeDigest !== digest(before) ||
        !proof.workspace || proof.workspace.currentFingerprint !== before.currentFingerprint ||
        identityFields.some(field => !same(proof.workspace[field],before[field])) ||
        !same(proof.workspace.toolCalls,[...before.toolCalls,start.operationToolCall])) fail('start proof mismatch');
      validateWorkspace(proof.workspace,'start');
    }
    if (integration) {
      expectedIntegrations.push(integration.requestId);
      const proof = ledger.integrations?.[integration.requestId], before = event.context.workspaceSnapshotBefore, transition = proof?.workspaceTransition;
      if (!exactKeys(proof,integrationKeys) || proof.status !== 'observed' || !proof.source?.trim() || proof.source === 'caller' || proof.requestId !== integration.requestId ||
        proof.actor !== integration.actor || proof.session !== event.session || proof.role !== 'integrator' || proof.taskId !== event.taskId ||
        !same(proof.writeScope,integration.writeScope) || !same(proof.operationToolCall,integration.operationToolCall) || proof.workspaceBeforeDigest !== digest(before) ||
        !proof.workspace || !exactKeys(transition,transitionKeys) || transition?.operation !== 'integrate' || transition.beforeFingerprint !== before.currentFingerprint ||
        transition.afterFingerprint !== proof.workspace.currentFingerprint || !same(transition.beforeToolCalls,before.toolCalls) ||
        !same(transition.afterToolCalls,proof.workspace.toolCalls) || !same(transition.afterToolCalls,[...before.toolCalls,integration.operationToolCall]) ||
        !same(transition.writeScope,proof.writeScope) || !same(transition.changedPaths,proof.writeScope) || !transition.source?.trim() || transition.source === 'caller' ||
        identityFields.some(field => !same(proof.workspace[field],before[field]))) fail('integration proof mismatch');
      validateWorkspace(proof.workspace,'integration');
    }
  }
  for (const entry of journal.events.filter(item => item.event.type === 'progressRequested')) {
    const event = entry.event, fields = ['type','taskId','planningRevision','contractRevision','integrationRevision','receiptDigest','indexBeforeHash','expectedChange'];
    const request = Object.fromEntries(fields.map(key => [key,event[key]])), before = latestWorkspaceBefore(journal,entry.sequence,ledger);
    const proof = Object.values(ledger.progress ?? {}).find(item => same(item.progressRequested,request)), transition = proof?.workspaceTransition;
    const requestId = before && `progress:${digest({projectRootRealpath:before.projectRootRealpath,canonicalIndex:'tasks.md',progressRequested:request})}`;
    expectedProgress.push(requestId);
    if (!exactKeys(proof,progressKeys) || proof.status !== 'observed' || !proof.source?.trim() || proof.source === 'caller' || proof.requestId !== requestId || proof.actor !== 'progress-broker' ||
      proof.session !== 'progress-broker' || proof.role !== 'progress-broker' || proof.taskId !== request.taskId ||
      proof.projectRootRealpath !== before?.projectRootRealpath || proof.canonicalIndex !== 'tasks.md' || proof.workspaceBeforeDigest !== digest(before) ||
      !proof.workspace || !hash(proof.indexAfterHash) || !exactKeys(transition,transitionKeys) || transition?.operation !== 'progress' || transition.beforeFingerprint !== before.currentFingerprint ||
      transition.afterFingerprint !== proof.workspace.currentFingerprint || !same(transition.beforeToolCalls,before.toolCalls) ||
      !same(transition.afterToolCalls,proof.workspace.toolCalls) || !same(transition.writeScope,['tasks.md']) ||
      !same(transition.changedPaths,['tasks.md']) || !same(proof.workspace.toolCalls,before.toolCalls) || !transition.source?.trim() || transition.source === 'caller' ||
      identityFields.some(field => !same(proof.workspace[field],before[field]))) fail('progress proof mismatch');
    validateWorkspace(proof.workspace,'progress');
  }
  if (!same(Object.keys(ledger.starts).sort(),expectedStarts.sort()) || !same(Object.keys(ledger.integrations).sort(),expectedIntegrations.sort()) ||
    !same(Object.keys(ledger.progress).sort(),expectedProgress.sort())) fail('durable proof inventory differs from journal requests');
  const current = latestWorkspaceBefore(journal,journal.events.length + 1,ledger);
  if (!current || !same(current,ledger.workspace)) fail('current workspace does not match latest durable proof');
}

export async function validateReopenBundle(bundle) {
  const { journal, ledger, evidence } = bundle, state = replay(journal), receipt = evidence?.receipt, provenance = receipt?.provenance;
  const evidenceKeys = ['schemaVersion','source','root','canonicalSource','canonicalTask','progressTask','receipt','initialInventory','finalInventory','contract','handoff','current'];
  const contractKeys = ['taskId','contractRevision','workspaceBaselineFingerprint','workspaceIdentity'];
  const identityKeys = ['packageRootRealpath','projectRootRealpath','workspaceId','repoIdentity','planningFingerprint','workspaceBaselineFingerprint','writeScope'];
  const ledgerKeys = ['workspace','starts','integrations','progress','counter','attributions','attributionSnapshots','capabilities','verifierResult'];
  const verifierResultKeys = ['verdict','outcome','checks','evidence','limitations','remainingWork'];
  if (!exactKeys(evidence,evidenceKeys) || !exactKeys(evidence.contract,contractKeys) || !exactKeys(evidence.contract.workspaceIdentity,identityKeys) ||
    !exactKeys(evidence.current,['packageRoot','workspace','now']) || !evidence.current.workspace?.source?.trim() || evidence.current.workspace.source === 'caller' || !exactKeys(ledger,ledgerKeys) ||
    !exactKeys(ledger.verifierResult,verifierResultKeys) || !['pass','fail'].includes(ledger.verifierResult.verdict) ||
    !ledger.verifierResult.outcome?.trim() || !exactKeys(ledger.verifierResult.checks,['originalRequest','taskCoverage','integratedBehavior','authority']) ||
    !['evidence','limitations','remainingWork'].every(key => Array.isArray(ledger.verifierResult[key]) && ledger.verifierResult[key].every(item => typeof item === 'string' && item.trim())) ||
    journal.version !== 3 || !provenance || evidence.source !== 'execution-consumer-fixture' || evidence.schemaVersion !== 'asds.execution-consumer-reopen/1' ||
    !Array.isArray(evidence.canonicalSource) || !evidence.canonicalTask || !evidence.progressTask || !evidence.contract || !evidence.initialInventory || !evidence.finalInventory) fail('reopen evidence envelope invalid');
  const handoffValidation = validateExecutionHandoff(evidence.handoff,evidence.current);
  if (!handoffValidation.valid) fail(`reopened handoff invalid: ${handoffValidation.errors.join('; ')}`);
  validateExecutionSource(evidence.handoff,evidence.canonicalSource);
  const journalSource = state.plan.tasks.map(task => {const {tier:ignoredTier,readinessErrors:ignoredErrors,...source}=task;return source;});
  if (!same(evidence.canonicalSource,journalSource)) fail('canonical source differs from journal-bound source');
  const projectedProgress = evidence.handoff.taskManager.tasks.find(task => task.id === evidence.contract.taskId);
  if (!same(evidence.canonicalTask,evidence.canonicalSource.find(task => task.id === evidence.contract.taskId)) ||
    !exactKeys(evidence.progressTask,['id','title','wave']) || !same(evidence.progressTask,{id:projectedProgress?.id,title:projectedProgress?.title,wave:projectedProgress?.wave})) fail('canonical task or progress task envelope mismatch');
  if (digest(evidence.handoff) !== state.context.consumerBinding?.handoffDigest) fail('reopened handoff digest differs from journal consumer binding');
  validateExecutionConsumerContextBinding(evidence.handoff,journal);
  if (evidence.root !== evidence.handoff.packageRootRealpath || evidence.current.packageRoot !== evidence.root ||
    evidence.contract.workspaceBaselineFingerprint !== evidence.handoff.workspaceBaselineFingerprint ||
    provenance.baselineLedger?.workspaceBaselineFingerprint !== evidence.handoff.workspaceBaselineFingerprint ||
    evidence.contract.workspaceIdentity.planningFingerprint !== evidence.handoff.planningFingerprint ||
    evidence.contract.workspaceIdentity.workspaceId !== evidence.handoff.workspaceId ||
    !same(evidence.contract.workspaceIdentity.repoIdentity,evidence.handoff.repoIdentity) ||
    identityKeys.some(field => !same(evidence.contract.workspaceIdentity[field],state.context.workspaceBinding[field]))) fail('reopen authority roots or workspace identity mismatch');
  const productPaths = [...new Set(evidence.canonicalSource.flatMap(task => task.write))].sort();
  if (!same(Object.keys(evidence.initialInventory).sort(),productPaths) ||
    !same(Object.keys(evidence.finalInventory).sort(),[...productPaths,'tasks.md'].sort())) fail('evidence inventory keys differ from canonical product scope');
  const boundaryEntry = journal.events[provenance.journalSequence - 1];
  if (!boundaryEntry || boundaryEntry.digest !== provenance.journalEventDigest) fail('receipt journal boundary mismatch');
  const prefix = {...journal,events:journal.events.slice(0,provenance.journalSequence)}, prefixState = replay(prefix), runtime = prefixState.tasks[provenance.taskId];
  const context = {hostAttestation:receipt.hostAttestation,baselineObservation:receipt.baselineObservation,projectionRevision:provenance.projectionRevision,
    planningRevision:prefixState.plan.revision,runtimeRevision:digest(runtime),journalSequence:provenance.journalSequence,journalEventDigest:provenance.journalEventDigest,
    runtimeReceiptDigest:digest(runtime.receipt),workspaceBaselineFingerprint:evidence.handoff.workspaceBaselineFingerprint,progressRevision:provenance.progressRevision};
  const errors = validateCanonicalReceipt(evidence.canonicalTask,receipt,context);
  if (errors.length) fail(`canonical receipt invalid: ${errors.join('; ')}`);
  if (provenance.runtimeReceiptDigest !== digest(runtime.receipt) || evidence.contract.taskId !== provenance.taskId || evidence.contract.contractRevision !== evidence.canonicalTask.contractRevision) fail('receipt runtime/contract mismatch');
  acceptedBaseline(bundle,receipt);
  validateProductAttributions({journal,ledger,source:evidence.canonicalSource,root:evidence.root,initialInventory:evidence.initialInventory});
  validateDurableLedgers(journal,ledger);
  const requested = journal.events.filter(entry => entry.event.type === 'progressRequested').at(-1)?.event,
    fields = ['type','taskId','planningRevision','contractRevision','integrationRevision','receiptDigest','indexBeforeHash','expectedChange'],
    canonicalRequest = requested && Object.fromEntries(fields.map(key => [key,requested[key]])),
    progress = Object.values(ledger.progress ?? {}).find(proof => proof.status === 'observed' && digest(proof.progressRequested) === digest(canonicalRequest));
  if (!progress) fail('progress proof missing');
  const inspection = inspectTaskIndexProgress({root:evidence.root,indexPath:'tasks.md',task:evidence.progressTask,progressRequested:canonicalRequest}), taskBytes = fs.readFileSync(`${evidence.root}/tasks.md`);
  if (inspection.status !== 'already_committed' || inspection.readback.sha256 !== progress.indexAfterHash || inspection.event.indexAfterHash !== progress.indexAfterHash ||
    inspection.event.indexBeforeHash !== requested.indexBeforeHash || bytesHash(taskBytes) !== progress.indexAfterHash || evidence.finalInventory['tasks.md'] !== progress.indexAfterHash ||
    requested.indexReadback.indexBeforeHash !== requested.indexBeforeHash) fail('progress index/readback mismatch');
  for (const [path,value] of Object.entries(evidence.finalInventory)) if (fileHash(`${evidence.root}/${path}`) !== value) fail('final inventory mismatch');
  if (Object.values(state.tasks).every(value => ['completed','excluded'].includes(value.status))) {
    const store = {read:() => journal,append:() => fail('validation-only host cannot append')};
    const result = await hostDispatchVerifier({store,loadTasks:() => evidence.canonicalSource,host:validationHost(ledger)});
    if (result.status !== 'manual_handoff_required' || result.capability !== 'snapshot') fail('official workspace replay did not stop exclusively at unavailable snapshot');
  }
  return {journal,ledger,evidence,state};
}

async function main() {
  const [journalPath,ledgerPath,evidencePath,outputPath] = process.argv.slice(2);
  if (![journalPath,ledgerPath,evidencePath].every(file => file && fs.statSync(file).isFile())) fail('durable reopen proof missing');
  const result = await validateReopenBundle({journal:JSON.parse(fs.readFileSync(journalPath)),ledger:JSON.parse(fs.readFileSync(ledgerPath)),evidence:JSON.parse(fs.readFileSync(evidencePath))});
  const bytes = JSON.stringify({journal:result.journal,ledger:result.ledger,evidence:result.evidence});
  if (outputPath) fs.writeFileSync(outputPath,bytes,{flag:'wx'}); else process.stdout.write(bytes);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
