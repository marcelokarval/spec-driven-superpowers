// Portable data contracts. No model calls, permission grants or automatic writes.
import { verifyPlanningReceipt } from './planning-store.mjs';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const texts = value => Array.isArray(value) && value.every(text);
const fields = ['objective', 'project', 'scope', 'constraints', 'risks', 'references', 'authorizations'];

export function receiveHandoff(packet, { source = 'accelerate' } = {}) {
  if (!['accelerate', 'direct'].includes(source)) throw new Error('Unknown source');
  if (!object(packet) || fields.some(key => !Object.hasOwn(packet, key)) ||
      Object.keys(packet).some(key => ![...fields, 'protocolVersion'].includes(key))) {
    throw new Error('Invalid v1 handoff fields');
  }
  if (packet.protocolVersion !== undefined && packet.protocolVersion !== 1) throw new Error('Unsupported protocol version');
  if (!text(packet.objective) || !text(packet.project) || !texts(packet.scope) || !packet.scope.length ||
      ['constraints', 'risks', 'references'].some(key => !texts(packet[key]))) throw new Error('Invalid handoff context');
  if (!Array.isArray(packet.authorizations) || packet.authorizations.some(item =>
    !object(item) || Object.keys(item).sort().join(',') !== 'action,decision,scope,source' ||
    !['action', 'scope', 'source'].every(key => text(item[key])) || !['granted', 'denied'].includes(item.decision))) {
    throw new Error('Invalid authorization records');
  }
  return { source, state: 'received', owner: null, executionAuthorized: false, context: structuredClone(packet), gaps: [] };
}

function validateState(work, accepted = false) {
  if (!object(work)) throw new Error('Invalid work state');
  receiveHandoff(work.context, { source: work.source });
  if (!['received', 'accepted', 'needs-reassessment'].includes(work.state) || !texts(work.gaps) ||
      work.executionAuthorized !== false || (work.state !== 'received' && work.owner !== 'asds')) {
    throw new Error('Invalid work state');
  }
  if (accepted && work.state === 'received') throw new Error('Work must be accepted before continuation or return');
}

export function acceptWork(work, { gaps = work?.gaps ?? [] } = {}) {
  validateState(work);
  if (!texts(gaps)) throw new Error('Invalid gaps');
  // Acceptance assigns lifecycle ownership, never tool authorization.
  return { ...structuredClone(work), state: 'accepted', owner: 'asds', gaps: [...gaps] };
}

export function declineWork(work, reason) {
  validateState(work);
  if (work.state !== 'received' || !text(reason)) throw new Error('Declining received work requires a concrete reason');
  return { ...structuredClone(work), state: 'declined', reason, owner: null };
}

export function continueWork(work, change) {
  validateState(work, true);
  if (change === undefined) return structuredClone(work);
  if (!object(change) || !text(change.reason) || !texts(change.affectedTasks) || !change.affectedTasks.length) {
    throw new Error('Material changes need a reason and explicit affected tasks');
  }
  return { ...structuredClone(work), state: 'needs-reassessment', reason: change.reason, affectedTasks: [...change.affectedTasks] };
}

export function createReturn(work, result) {
  validateState(work, true);
  if (!object(result) || !['completed', 'partial', 'blocked', 'cancelled'].includes(result.status) ||
      !text(result.outcome) || !['evidence', 'remainingWork', 'limitations'].every(key => texts(result[key]))) {
    throw new Error('Invalid return: outcome, evidence, remainingWork and limitations required');
  }
  if (result.status === 'completed' && (result.remainingWork.length || work.gaps.length || work.state === 'needs-reassessment')) {
    throw new Error('Cannot complete with gaps, reassessment or remaining work');
  }
  if (result.status === 'completed' && !result.evidence.length) throw new Error('Completion requires evidence references');
  // A structured report is not certification of referenced evidence or deployment.
  return structuredClone({ protocolVersion: 1, owner: 'asds', status: result.status,
    outcome: result.outcome, evidence: result.evidence, remainingWork: result.remainingWork, limitations: result.limitations });
}

// Planning return v2 is additive. It ends ASDS planning ownership without claiming
// that an originally requested implementation was performed.
export async function createPlanningReturn(work, result, { reviewAuthority = null } = {}) {
  validateState(work, true);
  if (!object(result) || !['delivered', 'partial', 'blocked', 'cancelled'].includes(result.status) ||
      !text(result.outcome) || !text(result.revision) || !text(result.manifest) ||
      !texts(result.evidence) || !texts(result.remainingPlanningWork) || !texts(result.limitations) ||
      !object(result.originalRequest) || !['planning', 'implementation'].includes(result.originalRequest.product) ||
      !['fulfilled', 'not_fulfilled'].includes(result.originalRequest.status)) {
    throw new Error('Invalid planning return');
  }
  if (result.status === 'delivered' && (result.remainingPlanningWork.length || work.gaps.length || work.state === 'needs-reassessment')) {
    throw new Error('Cannot deliver planning with gaps, reassessment or remaining planning work');
  }
  if (result.originalRequest.product === 'implementation' && result.originalRequest.status !== 'not_fulfilled') {
    throw new Error('ASDS planning cannot fulfill implementation');
  }
  let status = result.status, outcome = result.outcome;
  let remainingPlanningWork = [...result.remainingPlanningWork], limitations = [...result.limitations];
  let verification = { persistence: 'not_applicable', review: 'not_delivered', semanticCertification: false,
    proofLevel: 'none', authorityLimit: 'No planning delivery verification was performed.' };
  if (['delivered', 'partial'].includes(status)) {
    const checked = await verifyPlanningReceipt(result.persistenceReceipt, {
      revision: result.revision, manifest: result.manifest, status,
    });
    if (!result.evidence.length || !checked.matched) {
      status = 'blocked';
      outcome = 'Planning package not delivered: current persistence/review verification failed';
      remainingPlanningWork.push('Persist and read back the current planning revision with the required review receipt');
      limitations.push(...(!result.evidence.length ? ['Planning delivery evidence is absent'] : checked.errors));
      verification = { persistence: 'failed-current-readback', review: checked.sensitive ? 'independent-receipt-required' : 'not-delivered', semanticCertification: false,
        proofLevel: checked.proofLevel, authorityLimit: checked.authorityLimit };
    } else {
      verification = { persistence: 'current-store-bytes-matched',
        review: 'harness-review-records-matched', semanticCertification: false,
        proofLevel: checked.proofLevel, authorityLimit: checked.authorityLimit };
    }
  }
  const delivered = status === 'delivered';
  return structuredClone({ protocolVersion: 2, owner: delivered ? null : 'asds', contribution: 'planning', status,
    outcome, revision: result.revision, manifest: result.manifest, evidence: result.evidence,
    remainingPlanningWork, limitations, verification,
    originalRequest: result.originalRequest,
    nextOwner: delivered && result.originalRequest.product === 'implementation' ? 'caller-selects-consumer' : null });
}
