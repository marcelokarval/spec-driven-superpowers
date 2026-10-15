import { boundaryErrors, prerequisites } from './decomposition.mjs';
import { structuralGraph } from './planning-graph.mjs';
import { createHash } from 'node:crypto';
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim();

import { safePath } from './planning-paths.mjs';
export { safePath } from './planning-paths.mjs';

export function validateTasks(tasks, options = {}) {
  if (!Array.isArray(tasks) || !tasks.length) return ['tasks must be a nonempty array'];
  const errors = [];
  const ids = new Map();
  for (const task of tasks) {
    if (!object(task)) { errors.push('task must be an object'); continue; }
    if (typeof task.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(task.id)) errors.push('invalid task id');
    if (ids.has(task.id)) errors.push(`duplicate task ${task.id}`);
    ids.set(task.id, task);
    if (task.requirements !== undefined && !strings(task.requirements)) errors.push(`${task.id}: requirements must be a string array`);
    if (task.parentId !== undefined && (typeof task.parentId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(task.parentId))) errors.push(`${task.id}: invalid parentId`);
    for (const field of ['dependsOn', 'write', 'resources', 'scenarios', 'verification']) {
      if (!strings(task[field])) errors.push(`${task.id}: ${field} must be a string array`);
      else if (new Set(task[field]).size !== task[field].length) errors.push(`${task.id}: duplicate ${field}`);
    }
    for (const field of ['scenarios', 'verification']) {
      if (!task[field]?.length) errors.push(`${task.id}: ${field} cannot be empty`);
    }
    for (const file of Array.isArray(task.write) ? task.write : []) {
      if (!safePath(file)) errors.push(`${task.id}: unsafe write path ${file}`);
    }
  }
  if (errors.length) return errors;
  errors.push(...structuralGraph(tasks, options).errors);
  return errors;
}

export function chooseExecution(tasks, capabilities = {}) {
  const sequential = reason => ({ mode: 'sequential', reason });
  const errors = validateTasks(tasks);
  if (errors.length) return { mode: 'blocked', reason: errors.join('; ') };
  const readiness = tasks.flatMap(validateReadiness);
  if (readiness.length) return { mode: 'blocked', reason: readiness.join('; ') };
  if (tasks.length < 2) return sequential('Only one task');
  if (capabilities?.spawn !== true || capabilities?.isolatedWrites !== true ||
      !Number.isInteger(capabilities?.maxParallel) || capabilities.maxParallel < tasks.length) {
    return sequential('Session capabilities or concurrency budget are insufficient');
  }
  if (tasks.some(task => task.dependsOn.length)) return sequential('Resolve dependencies before forming a ready wave');
  const writes = [], resources = new Set();
  for (const task of tasks) {
    for (const file of task.write) {
      const normalized = file.normalize('NFC').toLowerCase();
      if (writes.some(other => other === normalized || other.startsWith(`${normalized}/`) || normalized.startsWith(`${other}/`))) {
        return sequential(`Overlapping write scope: ${file}`);
      }
      writes.push(normalized);
    }
    for (const resource of task.resources) {
      if (resources.has(resource)) return sequential(`Shared resource: ${resource}`);
      resources.add(resource);
    }
  }
  return { mode: 'parallel', reason: 'Independent scopes and declared live capabilities' };
}

const OBSERVED_EVIDENCE_FIELDS = new Set(['invocation', 'scope', 'targets', 'source']);

function validateObservedEvidence(items, label, required) {
  const errors = [];
  for (const item of items ?? []) {
    if (item?.observed === undefined) {
      if (required) errors.push(`${label} lacks observed execution metadata`);
      continue;
    }
    const observed = item.observed;
    if (!object(observed) || Object.keys(observed).some(key => !OBSERVED_EVIDENCE_FIELDS.has(key)) || observed.invocation !== item.command ||
        !['declared','broader','full-suite','unknown'].includes(observed.scope) ||
        (required && observed.scope === 'unknown') || !strings(observed.targets) || !observed.targets.length ||
        typeof observed.source !== 'string' || !observed.source.trim() || (required && ['caller','claim'].includes(observed.source.trim().toLowerCase()))) {
      errors.push(`${label} has invalid observed execution metadata`);
    }
  }
  return errors;
}

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const valueDigest = value => { const encoded=JSON.stringify(canonical(value)); return createHash('sha256').update(encoded===undefined?'undefined':encoded).digest('hex'); };

function validateHostAttestation(task, delivery, attestation, expected = {}) {
  const errors=[];
  const fields=['schemaVersion','token','source','authorityGeneration','taskId','planningRevision','candidateRevision','integrationRevision','reviewRevision','journalVersion','journalSequence','journalEventDigest','evidence','reviews'];
  if(!exact(attestation,fields))return ['delivery host attestation has unknown or missing fields'];
  if(attestation.schemaVersion!=='asds.delivery-host-attestation/1'||!hash(attestation.token)||!nonempty(attestation.source)||
      ['caller','claim','host'].includes(attestation.source.trim().toLowerCase())||!Number.isInteger(attestation.authorityGeneration)||attestation.authorityGeneration<1||
      attestation.taskId!==task.id||attestation.candidateRevision!==delivery.revision||attestation.integrationRevision!==delivery.integrationRevision||
      attestation.reviewRevision!==delivery.integrationRevision||attestation.journalVersion!==3||
      !Number.isInteger(attestation.journalSequence)||attestation.journalSequence<0||!hash(attestation.journalEventDigest)||!nonempty(attestation.planningRevision)) {
    errors.push('delivery host attestation identity is invalid');
  }
  for(const [field,value] of Object.entries(expected))if(value!==undefined&&attestation[field]!==value)errors.push(`delivery host attestation ${field} mismatch`);
  const phases=[['candidate',delivery.evidence,delivery.revision],...(delivery.status==='integrated'?[['integration',delivery.integrationEvidence,delivery.integrationRevision]]:[])];
  const evidenceFields=['phase','command','revision','scope','targets','evidenceDigest','toolCallDigest','eventSequence','eventDigest'];
  if(!Array.isArray(attestation.evidence)||attestation.evidence.length!==phases.reduce((count,[,items])=>count+(items?.length??0),0))errors.push('delivery host attestation evidence coverage is incomplete');
  else for(const [phase,items,revision] of phases)for(const item of items??[]){
    const matches=attestation.evidence.filter(entry=>entry?.phase===phase&&entry.command===item.command);
    const entry=matches[0];
    if(matches.length!==1||!exact(entry,evidenceFields)||entry.revision!==revision||entry.scope!==item.observed?.scope||
        JSON.stringify(entry.targets)!==JSON.stringify(item.observed?.targets)||entry.evidenceDigest!==valueDigest(item)||!hash(entry.toolCallDigest)||
        !Number.isInteger(entry.eventSequence)||entry.eventSequence<1||!hash(entry.eventDigest))errors.push(`delivery host attestation does not bind ${phase} evidence: ${item.command}`);
  }
  const reviewFields=['phase','revision','reviewerSession','eventSequence','eventDigest'];
  const reviewPhases=delivery.status==='integrated'?[['candidate',delivery.revision],['integration',delivery.integrationRevision]]:delivery.status==='reviewed'?[['candidate',delivery.revision]]:[];
  if(!Array.isArray(attestation.reviews)||attestation.reviews.length!==reviewPhases.length)errors.push('delivery host attestation review coverage is incomplete');
  else for(const [phase,revision] of reviewPhases){
    const matches=attestation.reviews.filter(entry=>entry?.phase===phase),entry=matches[0];
    if(matches.length!==1||!exact(entry,reviewFields)||entry.revision!==revision||!nonempty(entry.reviewerSession)||
        !Number.isInteger(entry.eventSequence)||entry.eventSequence<1||!hash(entry.eventDigest))errors.push(`delivery host attestation does not bind ${phase} review`);
  }
  return errors;
}

export function validateBaselineLedger(task, delivery, ledger, { expectedBaselineFingerprint, baselineObservation } = {}) {
  const errors = [];
  const fields = ['schemaVersion','workspaceBaselineFingerprint','candidateFingerprint','workspaceIdentityDigest','snapshotDigest','deltaDigest','observationToken','preexistingDirty','candidateChanges','source'];
  if (!exact(ledger, fields)) return ['baseline ledger has unknown or missing fields'];
  if (ledger.schemaVersion !== 'asds.workspace-baseline-ledger/1' || !hash(ledger.workspaceBaselineFingerprint) ||
      !hash(ledger.candidateFingerprint) || !['workspaceIdentityDigest','snapshotDigest','deltaDigest','observationToken'].every(field=>hash(ledger[field])) ||
      typeof ledger.source !== 'string' || !ledger.source.trim() || ['caller','claim','host'].includes(ledger.source.trim().toLowerCase())) {
    errors.push('baseline ledger provenance is invalid');
  }
  if (expectedBaselineFingerprint && ledger.workspaceBaselineFingerprint !== expectedBaselineFingerprint) errors.push('baseline ledger fingerprint mismatch');
  const validateEntries = (entries, candidate) => Array.isArray(entries) && entries.every(entry => {
    const keys = candidate ? ['path','beforeSha256','afterSha256'] : ['path','sha256'];
    return exact(entry, keys) && safePath(entry.path) && (candidate
      ? [entry.beforeSha256, entry.afterSha256].every(value => value === null || hash(value)) && (entry.beforeSha256 !== null || entry.afterSha256 !== null) && entry.beforeSha256 !== entry.afterSha256
      : hash(entry.sha256));
  });
  if (!validateEntries(ledger.preexistingDirty, false) || (Array.isArray(ledger.preexistingDirty) && new Set(ledger.preexistingDirty.map(item => item.path)).size !== ledger.preexistingDirty.length)) errors.push('preexisting dirty ledger entries are invalid');
  if (!validateEntries(ledger.candidateChanges, true) || (Array.isArray(ledger.candidateChanges) && new Set(ledger.candidateChanges.map(item => item.path)).size !== ledger.candidateChanges.length)) errors.push('candidate change ledger entries are invalid');
  const candidatePaths = Array.isArray(ledger.candidateChanges) ? ledger.candidateChanges.map(item => item.path).sort() : [];
  if (!Array.isArray(delivery?.changedFiles) || JSON.stringify(candidatePaths) !== JSON.stringify([...delivery.changedFiles].sort())) errors.push('candidate changes differ from receipt changedFiles');
  for (const entry of Array.isArray(ledger.candidateChanges) ? ledger.candidateChanges : []) {
    if (!Array.isArray(task?.write) || !task.write.includes(entry.path)) errors.push(`baseline ledger scope escape: ${entry.path}`);
    const prior = (Array.isArray(ledger.preexistingDirty) ? ledger.preexistingDirty : []).find(item => item.path === entry.path);
    if (prior && entry.beforeSha256 !== prior.sha256) errors.push(`candidate change does not preserve preexisting baseline: ${entry.path}`);
  }
  if ((delivery?.changedFiles?.length ?? 0) > 0 && ledger.candidateFingerprint === ledger.workspaceBaselineFingerprint) errors.push('candidate fingerprint does not record receipt changes');
  const observationFields=['schemaVersion','token','source','authorityGeneration','journalVersion','journalSequence','journalEventDigest','planningRevision','candidateRevision','integrationRevision','reviewRevision','workspaceIdentityDigest','snapshotDigest','deltaDigest','ledgerDigest','preexistingDirty','candidateChanges'];
  if(!exact(baselineObservation,observationFields)||baselineObservation.schemaVersion!=='asds.workspace-baseline-observation/1'||
      !['token','workspaceIdentityDigest','snapshotDigest','deltaDigest','ledgerDigest'].every(field=>hash(baselineObservation[field]))||
      !nonempty(baselineObservation.source)||['caller','claim','host'].includes(baselineObservation.source.trim().toLowerCase())||
      !Number.isInteger(baselineObservation.authorityGeneration)||baselineObservation.authorityGeneration<1||baselineObservation.journalVersion!==3||
      !Number.isInteger(baselineObservation.journalSequence)||baselineObservation.journalSequence<0||!hash(baselineObservation.journalEventDigest)||
      ![baselineObservation.planningRevision,baselineObservation.candidateRevision,baselineObservation.integrationRevision,baselineObservation.reviewRevision].every(nonempty))errors.push('baseline observation is missing or invalid');
  else if(baselineObservation.token!==ledger.observationToken||baselineObservation.workspaceIdentityDigest!==ledger.workspaceIdentityDigest||
      baselineObservation.snapshotDigest!==ledger.snapshotDigest||baselineObservation.deltaDigest!==ledger.deltaDigest||
      baselineObservation.ledgerDigest!==valueDigest(ledger)||JSON.stringify(baselineObservation.preexistingDirty)!==JSON.stringify(ledger.preexistingDirty)||
      JSON.stringify(baselineObservation.candidateChanges)!==JSON.stringify(ledger.candidateChanges))errors.push('baseline ledger is incomplete or differs from observed snapshot/delta');
  return errors;
}

export function validateCanonicalReceipt(task, receipt, context = {}) {
  const errors = validateDelivery(task, receipt, { requireObservedExecution: true, requireHostAttestation:true, hostAttestation:context.hostAttestation,
    planningRevision:context.planningRevision,journalVersion:3,journalSequence:context.journalSequence,journalEventDigest:context.journalEventDigest });
  if (!object(receipt) || receipt.schemaVersion !== 'asds.canonical-receipt/1') errors.push('canonical receipt schema is missing');
  const allowedReceiptFields = new Set(['schemaVersion','status','contractRevision','baseRevision','revision','changedFiles','preexistingChangedFiles','evidence','reviews','integrationRevision','integrationEvidence','integrationReviews','hostAttestation','baselineObservation','authorityConsumptions','provenance','reconciliation']);
  if (object(receipt) && Object.keys(receipt).some(field => !allowedReceiptFields.has(field))) errors.push('canonical receipt has unknown fields');
  if(valueDigest(receipt?.hostAttestation)!==valueDigest(context.hostAttestation))errors.push('canonical receipt host attestation differs from consumed host provenance');
  if(valueDigest(receipt?.baselineObservation)!==valueDigest(context.baselineObservation))errors.push('canonical receipt baseline observation differs from consumed host provenance');
  const consumptionFields=['schemaVersion','kind','handle','token','source','authorityGeneration','binding'];
  const consumptionBindingFields=['kind','token','source','authorityGeneration','journalVersion','journalSequence','journalEventDigest','planningRevision','candidateRevision','integrationRevision','reviewRevision','payloadDigest'];
  const consumptions=receipt?.authorityConsumptions;
  const requiredConsumptions=[['delivery-attestation',receipt?.hostAttestation?.token,valueDigest(receipt?.hostAttestation)],
    ['baseline-observation',receipt?.baselineObservation?.token,valueDigest(receipt?.baselineObservation)]];
  if(!Array.isArray(consumptions)||consumptions.some(item=>!exact(item,consumptionFields)||item.schemaVersion!=='asds.host-authority-consumption/1'||
      !hash(item.handle)||!hash(item.token)||!nonempty(item.source)||['caller','claim','host'].includes(item.source.trim().toLowerCase())||
      !Number.isInteger(item.authorityGeneration)||item.authorityGeneration<1||!exact(item.binding,consumptionBindingFields)||
      item.binding.kind!==item.kind||item.binding.token!==item.token||item.binding.source!==item.source||item.binding.authorityGeneration!==item.authorityGeneration||
      !['delivery-attestation','baseline-observation','equivalence-attestation','progress-readback'].includes(item.kind)||!hash(item.binding.payloadDigest)||
      item.handle!==valueDigest({generation:item.authorityGeneration,token:item.token,binding:item.binding})))
    errors.push('canonical receipt host authority consumptions are invalid');
  else for(const [kind,token,artifactDigest] of requiredConsumptions){
    const matches=consumptions.filter(item=>item.kind===kind&&item.token===token&&item.binding.payloadDigest===artifactDigest);
    if(matches.length!==1)errors.push(`canonical receipt lacks unique consumed ${kind}`);
  }
  if (receipt?.status !== 'integrated') errors.push('canonical receipt must be integrated');
  const provenance = receipt?.provenance;
  const provenanceFields = ['schemaVersion','taskId','projectionRevision','canonicalRevision','planningRevision','runtimeRevision','candidateRevision','integrationRevision','reviewRevision','progressRevision','journalVersion','journalSequence','journalEventDigest','runtimeReceiptDigest','baselineLedger'];
  if (!exact(provenance, provenanceFields) || provenance.schemaVersion !== 'asds.receipt-provenance/1') errors.push('canonical receipt provenance has unknown or missing fields');
  else {
    if (provenance.taskId !== task.id || provenance.canonicalRevision !== task.contractRevision || provenance.candidateRevision !== receipt.revision ||
        provenance.integrationRevision !== receipt.integrationRevision || provenance.reviewRevision !== receipt.integrationRevision || provenance.journalVersion !== 3 ||
        !Number.isInteger(provenance.journalSequence) || provenance.journalSequence < 0 ||
        !['projectionRevision','planningRevision','runtimeRevision'].every(field => typeof provenance[field] === 'string' && provenance[field].trim()) ||
        !['progressRevision','journalEventDigest','runtimeReceiptDigest'].every(field => hash(provenance[field]))) {
      errors.push('canonical receipt provenance revision mismatch');
    }
    const expected = {
      projectionRevision: context.projectionRevision,
      planningRevision: context.planningRevision,
      runtimeRevision: context.runtimeRevision,
      progressRevision: context.progressRevision,
      journalSequence: context.journalSequence,
      journalEventDigest: context.journalEventDigest,
      runtimeReceiptDigest: context.runtimeReceiptDigest,
    };
    for (const [field, value] of Object.entries(expected)) if (value !== undefined && provenance[field] !== value) errors.push(`canonical receipt provenance ${field} mismatch`);
    const baseline=receipt?.baselineObservation;
    if(baseline?.journalVersion!==3||baseline?.journalSequence!==provenance.journalSequence||baseline?.journalEventDigest!==provenance.journalEventDigest||
        baseline?.planningRevision!==provenance.planningRevision||baseline?.candidateRevision!==provenance.candidateRevision||
        baseline?.integrationRevision!==provenance.integrationRevision||baseline?.reviewRevision!==provenance.reviewRevision)
      errors.push('baseline observation revision/journal binding mismatch');
    if(Array.isArray(consumptions))for(const item of consumptions){
      const binding=item.binding;
      if(binding?.journalVersion!==3||binding?.journalSequence!==provenance.journalSequence||binding?.journalEventDigest!==provenance.journalEventDigest||
          binding?.planningRevision!==provenance.planningRevision||binding?.candidateRevision!==provenance.candidateRevision||
          binding?.integrationRevision!==provenance.integrationRevision||binding?.reviewRevision!==provenance.reviewRevision)
        errors.push(`canonical receipt consumed ${item.kind} has stale revision/journal binding`);
    }
    errors.push(...validateBaselineLedger(task, receipt, provenance.baselineLedger, { expectedBaselineFingerprint: context.workspaceBaselineFingerprint, baselineObservation:context.baselineObservation }));
  }
  const reconciliation = receipt?.reconciliation;
  const reconciliationFields = ['schemaVersion','taskId','projectionContractRevision','canonicalContractRevision','projectedContractDigest','canonicalContractDigest','differences','equivalence','planRevision','journalSequence','journalEventDigest'];
  if (!exact(reconciliation,reconciliationFields) || reconciliation.schemaVersion !== 'asds.receipt-reconciliation/1') errors.push('canonical receipt reconciliation has unknown or missing fields');
  else {
    const equivalence = reconciliation.equivalence;
    if (reconciliation.taskId !== task.id || reconciliation.projectionContractRevision !== provenance?.projectionRevision ||
        reconciliation.canonicalContractRevision !== provenance?.canonicalRevision || reconciliation.planRevision !== provenance?.planningRevision ||
        reconciliation.journalSequence !== provenance?.journalSequence || reconciliation.journalEventDigest !== provenance?.journalEventDigest ||
        !hash(reconciliation.projectedContractDigest) || !hash(reconciliation.canonicalContractDigest) ||
        !strings(reconciliation.differences) || new Set(reconciliation.differences).size !== reconciliation.differences.length ||
        reconciliation.differences.some(field => field !== 'owner') ||
        (reconciliation.differences.length === 0 ? reconciliation.equivalence !== null : !object(reconciliation.equivalence))) {
      errors.push('canonical receipt reconciliation provenance mismatch');
    }
    if (reconciliation.differences.length) {
      const equivalenceFields = ['schemaVersion','verdict','independent','reviewer','source','evidence','limitations','mappings','projectionContractRevision','canonicalContractRevision','projectedDigest','canonicalDigest','differences','attestation'];
      const attestationFields=['schemaVersion','token','source','authorityGeneration','reviewerSession','planningRevision','candidateRevision','integrationRevision','reviewRevision','journalVersion','journalSequence','journalEventDigest','eventSequence','eventDigest','mappingDigest'];
      const attestation=equivalence?.attestation;
      const validMappings = Array.isArray(equivalence?.mappings) && equivalence.mappings.length === reconciliation.differences.length &&
        equivalence.mappings.every(mapping => exact(mapping,['field','rationale','evidence']) && reconciliation.differences.includes(mapping.field) &&
          typeof mapping.rationale === 'string' && mapping.rationale.trim() && strings(mapping.evidence) && mapping.evidence.length);
      if (!exact(equivalence,equivalenceFields) || equivalence.schemaVersion !== 'asds.contract-equivalence/1' || equivalence.verdict !== 'pass' ||
          equivalence.independent !== true || typeof equivalence.reviewer !== 'string' || !equivalence.reviewer.trim() || equivalence.reviewer === task.owner ||
          typeof equivalence.source !== 'string' || !equivalence.source.trim() || ['caller','claim'].includes(equivalence.source.trim().toLowerCase()) ||
          !strings(equivalence.evidence) || !equivalence.evidence.length || !strings(equivalence.limitations) || !validMappings ||
          equivalence.projectionContractRevision !== reconciliation.projectionContractRevision || equivalence.canonicalContractRevision !== reconciliation.canonicalContractRevision ||
          equivalence.projectedDigest !== reconciliation.projectedContractDigest || equivalence.canonicalDigest !== reconciliation.canonicalContractDigest ||
          JSON.stringify(equivalence.differences) !== JSON.stringify(reconciliation.differences) || !exact(attestation,attestationFields) ||
          attestation.schemaVersion!=='asds.equivalence-attestation/1'||!hash(attestation.token)||!nonempty(attestation.source)||
          ['caller','claim','host'].includes(attestation.source.trim().toLowerCase())||attestation.reviewerSession!==equivalence.reviewer||
          !Number.isInteger(attestation.authorityGeneration)||attestation.authorityGeneration<1||attestation.planningRevision!==provenance?.planningRevision||
          attestation.candidateRevision!==provenance?.candidateRevision||attestation.integrationRevision!==provenance?.integrationRevision||
          attestation.reviewRevision!==provenance?.reviewRevision||attestation.journalVersion!==3||attestation.journalSequence!==provenance?.journalSequence||
          attestation.journalEventDigest!==provenance?.journalEventDigest||!Number.isInteger(attestation.eventSequence)||
          attestation.eventSequence<1||!hash(attestation.eventDigest)||attestation.mappingDigest!==valueDigest(equivalence.mappings)) errors.push('canonical receipt equivalence review is invalid');
      if(Array.isArray(consumptions)&&consumptions.filter(item=>item.kind==='equivalence-attestation'&&item.token===attestation?.token&&item.binding?.payloadDigest===valueDigest(attestation)).length!==1)
        errors.push('canonical receipt equivalence attestation was not consumed by host authority');
    }
    if(Array.isArray(consumptions)){
      const expectedKinds=['delivery-attestation','baseline-observation',...(reconciliation.differences.length?['equivalence-attestation']:[])];
      if(consumptions.length!==expectedKinds.length||expectedKinds.some(kind=>consumptions.filter(item=>item.kind===kind).length!==1)||
          consumptions.some(item=>!expectedKinds.includes(item.kind)))
        errors.push('canonical receipt has missing, duplicate or cross-kind authority consumptions');
    }
  }
  return errors;
}

export function validateDelivery(task, delivery, { requireObservedExecution = false, requireHostAttestation = false, hostAttestation,
  planningRevision,journalVersion,journalSequence,journalEventDigest } = {}) {
  const errors = validateTasks([{ ...task, nodeType: undefined, parentId: undefined, dependsOn: [] }]);
  if (errors.length) return errors;
  if (!object(delivery)) return ['delivery must be an object'];
  if (task.contractRevision && delivery.contractRevision !== task.contractRevision) errors.push('stale or absent contract revision');
  if (!['delivered', 'reviewed', 'integrated'].includes(delivery.status)) errors.push('invalid delivery status');
  for (const field of ['baseRevision', 'revision']) {
    if (typeof delivery[field] !== 'string' || !delivery[field].trim()) errors.push(`missing ${field}`);
  }
  if (!strings(delivery.changedFiles)) errors.push('changedFiles must be a string array');
  else for (const file of delivery.changedFiles) {
    if (!safePath(file) || !task.write.includes(file)) errors.push(`scope escape: ${file}`);
  }
  if (!Array.isArray(delivery.evidence)) errors.push('missing verification evidence');
  else {
    for (const command of task.verification) {
      if (!delivery.evidence.some(item => item?.command === command && item.exitCode === 0 && item.revision === delivery.revision)) {
        errors.push(`missing passing evidence: ${command}`);
      }
    }
    if (delivery.evidence.some(item => !object(item) || item.exitCode !== 0 || item.revision !== delivery.revision)) errors.push('failing or stale evidence');
    errors.push(...validateObservedEvidence(delivery.evidence, 'verification evidence', requireObservedExecution));
  }
  if (['reviewed', 'integrated'].includes(delivery.status)) {
    if(requireHostAttestation&&(!exact(delivery.reviews,['spec','quality','independent'])))errors.push('candidate reviews have unknown or missing fields');
    if (delivery.reviews?.spec !== delivery.revision || delivery.reviews?.quality !== delivery.revision) errors.push('stale or absent reviews');
    if (delivery.reviews?.independent !== true) errors.push('independent review required');
  }
  if (delivery.status === 'integrated' && (typeof delivery.integrationRevision !== 'string' || !delivery.integrationRevision.trim())) errors.push('missing integration revision');
  if (delivery.status === 'integrated') {
    if(requireHostAttestation&&(!exact(delivery.integrationReviews,['spec','quality','independent'])))errors.push('integration reviews have unknown or missing fields');
    if (!Array.isArray(delivery.integrationEvidence) || task.verification.some(command =>
      !delivery.integrationEvidence.some(item => item?.command === command && item.exitCode === 0 && item.revision === delivery.integrationRevision))) {
      errors.push('missing passing integration evidence');
    } else if (delivery.integrationEvidence.some(item => !object(item) || item.exitCode !== 0 || item.revision !== delivery.integrationRevision)) {
      errors.push('failing or stale integration evidence');
    }
    if (Array.isArray(delivery.integrationEvidence)) errors.push(...validateObservedEvidence(delivery.integrationEvidence, 'integration evidence', requireObservedExecution));
    if (delivery.integrationReviews?.spec !== delivery.integrationRevision || delivery.integrationReviews?.quality !== delivery.integrationRevision ||
        delivery.integrationReviews?.independent !== true) errors.push('stale or absent independent integration reviews');
  }
  if(requireHostAttestation){
    const evidence=[...(Array.isArray(delivery.evidence)?delivery.evidence:[]),...(Array.isArray(delivery.integrationEvidence)?delivery.integrationEvidence:[])];
    if(evidence.some(item=>!exact(item,['command','exitCode','revision','observed'])))errors.push('delivery evidence has unknown or missing fields');
    errors.push(...validateHostAttestation(task,delivery,hostAttestation,{planningRevision,journalVersion,journalSequence,journalEventDigest}));
  }
  return errors;
}

// Semantic adequacy still needs review; these are minimum executable-contract gates.
export function validateReadiness(task, { candidate = false, allowOpenDecisions = false } = {}) {
  const errors = boundaryErrors(task, { candidate });
  if (!['implementation', 'investigation', 'documentation', 'operation'].includes(task.kind ?? 'implementation')) errors.push(`${task.id}: readiness invalid kind`);
  if (!Array.isArray(task.openDecisions) || ((candidate || allowOpenDecisions) ? !task.openDecisions.every(nonempty) : task.openDecisions.length)) errors.push(`${task.id}: readiness unresolved or undeclared material decisions`);
  const body = (task.body ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '');
  for (const heading of ['Outcome', 'Inputs', 'Acceptance', 'Verification', 'Definition of done']) {
    const section = body.match(new RegExp(`^## ${heading}\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
    if (!section?.[1]?.trim() || /\b(TBD|TODO)\b/.test(section[1])) errors.push(`${task.id}: readiness missing or unfinished ${heading}`);
  }
  return errors;
}

export function affectedTasks(tasks, changedIds) {
  const errors = validateTasks(tasks);
  if (errors.length) throw new Error(errors.join('; '));
  if (!strings(changedIds) || changedIds.some(id => !tasks.some(task => task.id === id))) throw new Error('Unknown changed task');
  const affected = new Set(changedIds);
  let size;
  do {
    size = affected.size;
    for (const task of tasks) if (prerequisites(tasks, task).some(id => affected.has(id))) affected.add(task.id);
  } while (size !== affected.size);
  return [...affected].sort();
}
