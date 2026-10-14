import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { safePath, validateTasks } from './contracts.mjs';
import { digest } from './orchestration.mjs';

const clone = value => structuredClone(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const texts = value => Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const sorted = values => [...values].sort();
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const norm = value => value.normalize('NFC').toLowerCase();
const overlaps = (left, right) => left===right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
const validRelationId = value => typeof value==='string' && /^[A-Za-z0-9_-]+$/.test(value);

function assertCanonicalRelations(value, label, known) {
  if(!Array.isArray(value)||value.some(id=>!validRelationId(id))||new Set(value).size!==value.length||!equal(value,sorted(value))||
      known&&value.some(id=>!known.has(id))) throw new Error(`${label} relation IDs must be valid, unique, known where applicable and canonically ordered`);
}

// Only canonical index checkbox state is progress. Text/order/IDs remain material.
export function canonicalIndexContent(text, anchors = []) {
  // Conservative documented subset: HTML-bearing indexes are exact sources.
  // Never interpret their literal blocks as progress or implement an HTML parser.
  if (/^ {0,3}<[A-Za-z!/?]/m.test(text) || /^---\r?\n/.test(text) || /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+(?:`{3,}|~{3,})/m.test(text)) return text;
  let fence = null;
  return text.split(/(?<=\n)/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)(?:\r?\n)?$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return line;
    }
    if (marker) { fence = { char: marker[1][0], length: marker[1].length }; return line; }
    // Four-space indentation and blockquote prefixes remain material. Only a
    // declared task anchor or a canonical task-shaped entry owns mutable progress.
    const eol=line.endsWith('\r\n')?'\r\n':line.endsWith('\n')?'\n':'';
    const content=eol?line.slice(0,-eol.length):line;
    const entry=content.match(/^( {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+\[)([ xX])(\](?:[ \t]|$)(.*))$/);
    if (!entry) return line;
    const taskShaped=anchors.length ? anchors.some(anchor=>entry[4].includes(anchor)) :
      /^(?:\[Task [A-Za-z0-9_-]+\]\(tasks\/task-[A-Za-z0-9_-]+\.md\)|[A-Za-z0-9_-]+[ \t]+(?:—|:|-)[ \t]+)/.test(entry[4].trimStart());
    return taskShaped ? `${entry[1]} ${entry[3]}${eol}` : line;
  }).join('');
}
export const projectionSourceDigest = (text, isIndex = false, anchors = []) => createHash('sha256').update(isIndex ? canonicalIndexContent(text, anchors) : text).digest('hex');

function assertPlanningProjection(projection) {
  if (!projection || projection.version !== 'asds.task-manager-projection/1' || !Array.isArray(projection.tasks) ||
      !Array.isArray(projection.plannedWaves) || !Array.isArray(projection.conflicts)) throw new Error('invalid planning projection');
  const ids=projection.tasks.map(task=>task?.id);
  if (!texts(ids)||ids.some(id=>!validRelationId(id))||!equal(ids,sorted(ids))) throw new Error('invalid planning projection task inventory');
  if(projection.tasks.some(task=>task.status==='completed') || projection.completedTaskIds?.length) throw new Error('planning projection cannot contain runtime progress');
  const known=new Set(ids), byId=new Map(projection.tasks.map(task=>[task.id,task]));
  if(projection.excludedTaskIds!==undefined) assertCanonicalRelations(projection.excludedTaskIds,'excludedTaskIds',known);
  const excludedIds=projection.excludedTaskIds??[], excluded=new Set(excludedIds);
  const statusExcluded=projection.tasks.filter(task=>task.status==='excluded').map(task=>task.id);
  if(!equal(statusExcluded,excludedIds)) throw new Error('planning projection excluded status and excludedTaskIds differ');
  const consumable=ids.filter(id=>!excluded.has(id)), waveOccurrences=new Map(consumable.map(id=>[id,0]));
  for(const wave of projection.plannedWaves) {
    if(!Array.isArray(wave)||!wave.length) throw new Error('planning projection wave must be nonempty and unique');
    assertCanonicalRelations(wave,'plannedWaves',known);
    for(const id of wave) {
      if(!known.has(id)||excluded.has(id)) throw new Error(`planning projection wave contains unknown or excluded task ${id}`);
      waveOccurrences.set(id,waveOccurrences.get(id)+1);
    }
  }
  for(const [id,count] of waveOccurrences) if(count!==1) throw new Error(`planning projection wave coverage for ${id} must be exactly once`);
  const expectedConflicts=[];
  for(let leftIndex=0;leftIndex<projection.tasks.length;leftIndex++) for(let rightIndex=leftIndex+1;rightIndex<projection.tasks.length;rightIndex++) {
    const left=projection.tasks[leftIndex],right=projection.tasks[rightIndex];
    if(!texts(left.write)||!texts(right.write)||!texts(left.resources)||!texts(right.resources)) throw new Error('planning projection task scope is invalid');
    if(left.write.some(a=>right.write.some(b=>overlaps(norm(a),norm(b))))) expectedConflicts.push({tasks:[left.id,right.id],reason:'Overlapping write scope; sequential recommendation, not fusion'});
    else if(left.resources.some(a=>right.resources.some(b=>norm(a)===norm(b)))) expectedConflicts.push({tasks:[left.id,right.id],reason:'Shared resource; sequential recommendation, not fusion'});
  }
  if(!equal(projection.conflicts,expectedConflicts)) throw new Error('planning projection conflicts differ from canonical write/resource overlap');
  const conflictPeers=new Map(ids.map(id=>[id,[]]));
  for(const conflict of expectedConflicts) {
    conflictPeers.get(conflict.tasks[0]).push(conflict.tasks[1]);conflictPeers.get(conflict.tasks[1]).push(conflict.tasks[0]);
    if(!excluded.has(conflict.tasks[0])&&!excluded.has(conflict.tasks[1])&&byId.get(conflict.tasks[0]).wave===byId.get(conflict.tasks[1]).wave)
      throw new Error(`planning projection conflict shares wave: ${conflict.tasks.join(', ')}`);
  }
  for(const task of projection.tasks) {
    if(!['ready','waiting','blocked','excluded'].includes(task.status)) throw new Error(`planning projection invalid task status ${task.status}`);
    if (!text(task.title) || !Array.isArray(task.waitingOn) || !Array.isArray(task.blockedBy) || !Array.isArray(task.blocks) ||
        !Array.isArray(task.serializesWith) || !Array.isArray(task.parallelWith) ||
        [...task.waitingOn,...task.blocks,...task.serializesWith,...task.parallelWith].some(id=>!known.has(id))) throw new Error('invalid planning projection task relation');
    for(const field of ['waitingOn','blocks','serializesWith','parallelWith']) assertCanonicalRelations(task[field],`${task.id}.${field}`,known);
    assertCanonicalRelations(task.blockedBy,`${task.id}.blockedBy`);
    for(const field of ['decisionInputs','resolvesDecisions']) assertCanonicalRelations(task[field],`${task.id}.${field}`);
    if(excluded.has(task.id)&&(task.waitingOn.length||task.blockedBy.length)) throw new Error(`${task.id}: excluded task must clear waitingOn and blockedBy`);
    const expectedStatus=excluded.has(task.id)?'excluded':task.blockedBy.length?'blocked':task.waitingOn.length?'waiting':'ready';
    if(task.status!==expectedStatus) throw new Error(`${task.id}: planning status ${task.status} differs from derived status ${expectedStatus}`);
    if(!equal(task.serializesWith,sorted(conflictPeers.get(task.id)))) throw new Error(`${task.id}: serializesWith differs from canonical conflicts`);
    for(const dependency of task.waitingOn) if(!byId.get(dependency).blocks.includes(task.id)) throw new Error('planning projection relation reverse edge drift');
    for(const dependent of task.blocks) if(!excluded.has(dependent)&&!byId.get(dependent).waitingOn.includes(task.id)) throw new Error('planning projection relation reverse edge drift');
    const expectedWave=projection.plannedWaves.findIndex(wave=>wave.includes(task.id))+1;
    if(!excluded.has(task.id)&&(!expectedWave || task.wave!==expectedWave)) throw new Error('planning projection wave drift');
    const expectedParallel=excluded.has(task.id)?[]:sorted(projection.plannedWaves[expectedWave-1].filter(id=>id!==task.id));
    if(!equal(task.parallelWith,expectedParallel)) throw new Error(`${task.id}: parallelWith differs from canonical wave peers`);
    for(const dependency of task.waitingOn) if(!excluded.has(task.id)&&byId.get(dependency).wave>=task.wave) throw new Error(`${task.id}: dependency wave must precede consumer wave`);
  }
  const statuses=['ready','waiting','blocked','completed'];
  for(const status of statuses) {
    const key=`${status}TaskIds`, expected=projection.tasks.filter(task=>task.status===status).map(task=>task.id);
    if(!Array.isArray(projection[key]) || !equal(projection[key],expected)) throw new Error(`planning projection ${key} drift`);
  }
}

function runtimeScope(projection, scope) {
  const ids=projection.tasks.map(task=>task.id), known=new Set(ids);
  const fallbackExcluded=Array.isArray(projection.excludedTaskIds) ? projection.excludedTaskIds : [];
  const selected=scope ?? {consumableTaskIds:ids.filter(id=>!fallbackExcluded.includes(id)),excludedTaskIds:fallbackExcluded};
  if(!selected || !texts(selected.consumableTaskIds) || !Array.isArray(selected.excludedTaskIds) ||
      !texts(selected.excludedTaskIds) || [...selected.consumableTaskIds,...selected.excludedTaskIds].some(id=>!known.has(id)) ||
      new Set([...selected.consumableTaskIds,...selected.excludedTaskIds]).size!==ids.length) throw new Error('runtime scope must be an exact task partition');
  const declaredConsumable=ids.filter(id=>!fallbackExcluded.includes(id));
  if(!equal(selected.consumableTaskIds,declaredConsumable)||!equal(selected.excludedTaskIds,fallbackExcluded)) throw new Error('runtime scope does not match planning projection exclusions');
  const consumable=new Set(selected.consumableTaskIds), excluded=new Set(selected.excludedTaskIds);
  for(const task of projection.tasks) if(consumable.has(task.id)) {
    const unavailable=task.waitingOn.filter(id=>excluded.has(id));
    if(unavailable.length) throw new Error(`${task.id}: consumable task depends on excluded task ${unavailable.join(', ')}`);
  }
  return {consumable,excluded};
}

export function scopePlanningProjection(planningProjection, executionScope, exclusionProvenance = {}) {
  assertPlanningProjection(planningProjection);
  if(planningProjection.excludedTaskIds?.length) throw new Error('planning projection is already scoped');
  const ids=planningProjection.tasks.map(task=>task.id), known=new Set(ids);
  if(!executionScope || !texts(executionScope.consumableTaskIds) || !texts(executionScope.excludedTaskIds) ||
      [...executionScope.consumableTaskIds,...executionScope.excludedTaskIds].some(id=>!known.has(id)) ||
      new Set([...executionScope.consumableTaskIds,...executionScope.excludedTaskIds]).size!==ids.length) throw new Error('runtime scope must be an exact task partition');
  const consumable=new Set(executionScope.consumableTaskIds), excluded=new Set(executionScope.excludedTaskIds);
  if(!equal(executionScope.consumableTaskIds,ids.filter(id=>consumable.has(id)))||!equal(executionScope.excludedTaskIds,ids.filter(id=>excluded.has(id))))
    throw new Error('runtime scope relation IDs must be canonically ordered');
  for(const task of planningProjection.tasks) if(consumable.has(task.id)) {
    const unavailable=task.waitingOn.filter(id=>excluded.has(id));
    if(unavailable.length) throw new Error(`${task.id}: consumable task depends on excluded task ${unavailable.join(', ')}`);
  }
  for(const id of excluded) if(!Array.isArray(exclusionProvenance[id]) || !exclusionProvenance[id].length ||
      exclusionProvenance[id].some(item=>!item || typeof item!=='object' || Array.isArray(item))) throw new Error(`${id}: excluded task requires planning provenance`);
  const plannedWaves=planningProjection.plannedWaves.map(wave=>wave.filter(id=>consumable.has(id))).filter(wave=>wave.length);
  const waveById=new Map(plannedWaves.flatMap((wave,index)=>wave.map(id=>[id,index+1])));
  const tasks=planningProjection.tasks.map(task=>excluded.has(task.id)
    ? {...clone(task),status:'excluded',waitingOn:[],blockedBy:[],parallelWith:[],exclusionProvenance:clone(exclusionProvenance[task.id])}
    : {...clone(task),wave:waveById.get(task.id),parallelWith:sorted(plannedWaves[waveById.get(task.id)-1].filter(id=>id!==task.id))});
  return {...clone(planningProjection),tasks,
    readyTaskIds:planningProjection.readyTaskIds.filter(id=>consumable.has(id)),
    waitingTaskIds:planningProjection.waitingTaskIds.filter(id=>consumable.has(id)),
    blockedTaskIds:planningProjection.blockedTaskIds.filter(id=>consumable.has(id)),
    completedTaskIds:[],excludedTaskIds:planningProjection.tasks.filter(task=>excluded.has(task.id)).map(task=>task.id),plannedWaves};
}

// Runtime state is a replayable view over the immutable planning projection. It
// deliberately has no checkbox/materialized-progress input.
export function projectRuntimeProjection(planningProjection, journal, executionScope) {
  assertPlanningProjection(planningProjection);
  if(!journal || journal.version!==3 || !Array.isArray(journal.events)) throw new Error('runtime projection requires journal v3');
  for(const key of ['checkboxes','materializedProgress','completedTaskIds']) if(Object.hasOwn(journal,key)) throw new Error(`unknown runtime input: ${key}`);
  const {consumable,excluded}=runtimeScope(planningProjection,executionScope);
  const byId=new Map(planningProjection.tasks.map(task=>[task.id,task]));
  const state=new Map(planningProjection.tasks.map(task=>[task.id,{assignments:[],receipts:[],reviews:[],acceptances:[],blockers:new Map(),progress:null}]));
  const taskEvents=new Set(['dispatch','deliver','review','integrate','decide','acceptPackage','block','unblock','operationBlock','operationUnblock','reopen',
    'receiptReconciled','reviewRecorded','accepted','blocked','unblocked','progressRequested','progressCommitted']);
  const neutralEvents=new Set(['pause','resume','verifyObjective']);
  for(let index=0;index<journal.events.length;index++) {
    const entry=journal.events[index];
    if(!entry || typeof entry!=='object' || Array.isArray(entry) || entry.sequence!==index+1) throw new Error('journal v3 event sequence is invalid');
    const event=entry.event === undefined ? entry : entry.event;
    if(!event || typeof event!=='object' || Array.isArray(event) || !text(event.type)) throw new Error('journal v3 event is invalid');
    if(!taskEvents.has(event.type) && !neutralEvents.has(event.type)) throw new Error(`unsupported journal v3 event ${event.type}`);
    if(neutralEvents.has(event.type)) continue;
    if(!text(event.taskId) || !byId.has(event.taskId)) throw new Error(`journal v3 event references unknown task ${event.taskId ?? ''}`);
    if(excluded.has(event.taskId)) throw new Error(`${event.taskId}: excluded task cannot have runtime events`);
    const current=state.get(event.taskId);
    if(event.type==='dispatch') {
      const assignment=event.assignment ?? {role:event.role,session:event.session};
      if(!assignment || typeof assignment!=='object' || !text(assignment.role) || !text(assignment.session)) throw new Error(`${event.taskId}: invalid runtime assignment`);
      current.assignments.push(clone(assignment));
    } else if(event.type==='receiptReconciled') {
      if(!event.receipt || typeof event.receipt!=='object' || !text(event.receipt.digest)) throw new Error(`${event.taskId}: invalid reconciled receipt`);
      current.receipts.push(clone(event.receipt));
    } else if(event.type==='reviewRecorded') {
      if(!event.review || typeof event.review!=='object' || !text(event.review.stage) || !text(event.review.verdict) || !text(event.review.revision)) throw new Error(`${event.taskId}: invalid runtime review`);
      current.reviews.push(clone(event.review));
    } else if(event.type==='accepted' || event.type==='acceptPackage' || event.type==='decide') {
      const acceptance=event.acceptance ?? event.decision ?? event;
      if(!acceptance || typeof acceptance!=='object') throw new Error(`${event.taskId}: invalid runtime acceptance`);
      current.acceptances.push(clone(acceptance));
    } else if(event.type==='blocked' || event.type==='block' || event.type==='operationBlock') {
      const blocker=event.blocker ?? {id:event.blockerId ?? `${event.type}:${entry.sequence}`,owner:event.owner,reason:event.reason};
      if(!blocker || !text(blocker.id) || !text(blocker.owner) || !text(blocker.reason)) throw new Error(`${event.taskId}: invalid runtime blocker`);
      current.blockers.set(blocker.id,clone(blocker));
    } else if(event.type==='unblocked' || event.type==='unblock' || event.type==='operationUnblock') {
      const id=event.blockerId ?? event.blocker?.id;
      if(!text(id) || !current.blockers.has(id)) throw new Error(`${event.taskId}: runtime blocker is not active`);
      current.blockers.delete(id);
    } else if(event.type==='progressRequested') {
      if(!text(event.receiptDigest)) throw new Error(`${event.taskId}: progressRequested requires receipt digest`);
      if(current.progress?.status==='committed' || current.progress?.receiptDigest && current.progress.receiptDigest!==event.receiptDigest) throw new Error(`${event.taskId}: conflicting progress request`);
      current.progress={status:'pending',receiptDigest:event.receiptDigest,sequence:entry.sequence};
    } else if(event.type==='progressCommitted') {
      if(!text(event.receiptDigest) || current.progress?.status!=='pending' || current.progress.receiptDigest!==event.receiptDigest) throw new Error(`${event.taskId}: progressCommitted requires matching progressRequested`);
      current.progress={...current.progress,status:'committed',committedSequence:entry.sequence};
    }
  }
  const completed=new Set([...state].filter(([,value])=>value.progress?.status==='committed').map(([id])=>id));
  const pending=new Set([...state].filter(([,value])=>value.progress?.status==='pending').map(([id])=>id));
  for(const id of completed) {
    const missing=byId.get(id).waitingOn.filter(dependency=>!completed.has(dependency));
    if(missing.length) throw new Error(`${id}: completed task has incomplete dependency ${missing.join(', ')}`);
  }
  const runtimeBlockers=new Map(planningProjection.tasks.map(task=>[task.id,new Map(state.get(task.id).blockers)]));
  let changed=true;
  while(changed) { changed=false; for(const task of planningProjection.tasks) for(const dependency of task.waitingOn) {
    for(const [id,blocker] of runtimeBlockers.get(dependency)) if(!runtimeBlockers.get(task.id).has(id)) {runtimeBlockers.get(task.id).set(id,blocker);changed=true;}
  }}
  const tasks=planningProjection.tasks.map(task=>{
    const runtime=state.get(task.id), waitingOn=task.waitingOn.filter(id=>!completed.has(id));
    const planningBlocked=[...task.blockedBy], operational=sorted(runtimeBlockers.get(task.id).keys()), blockedBy=sorted(new Set([...planningBlocked,...operational]));
    const status=excluded.has(task.id)?'excluded':completed.has(task.id)?'completed':pending.has(task.id)?'progress_pending':blockedBy.length?'blocked':waitingOn.length?'waiting':'ready';
    return {...clone(task),status,waitingOn,blockedBy,assignments:runtime.assignments,receipts:runtime.receipts,reviews:runtime.reviews,acceptances:runtime.acceptances};
  });
  return {version:'asds.runtime-task-manager-projection/1',planningVersion:planningProjection.version,tasks,
    readyTaskIds:tasks.filter(task=>task.status==='ready').map(task=>task.id),waitingTaskIds:tasks.filter(task=>task.status==='waiting').map(task=>task.id),
    blockedTaskIds:tasks.filter(task=>task.status==='blocked').map(task=>task.id),progressPendingTaskIds:tasks.filter(task=>task.status==='progress_pending').map(task=>task.id),
    completedTaskIds:tasks.filter(task=>task.status==='completed').map(task=>task.id),excludedTaskIds:tasks.filter(task=>task.status==='excluded').map(task=>task.id),
    plannedWaves:clone(planningProjection.plannedWaves),conflicts:clone(planningProjection.conflicts),journalVersion:3,journalSequence:journal.events.length};
}

// Explicit, reviewed extraction of a pre-existing plan. No Markdown heuristics,
// rewriting the original index, imported completion, or implicit OpenSpec init.
export function loadProjection(file) {
  const input=JSON.parse(fs.readFileSync(file,'utf8'));
  if (input.version !== 1 || !path.isAbsolute(input.root ?? '') || !safePath(input.canonicalIndex) || !Array.isArray(input.sources) || !input.sources.length) throw new Error('invalid plan projection');
  const sources=new Map();
  for (const source of input.sources) {
    if (!safePath(source.path) || sources.has(source.path)) throw new Error('invalid/duplicate projection source');
    let location=path.resolve(input.root);
    for (const part of source.path.split('/')) {
      location=path.join(location,part);
      if (fs.lstatSync(location).isSymbolicLink()) throw new Error('projection source symlink refused');
    }
    const bytes=fs.readFileSync(location, 'utf8');
    const anchors=input.tasks.filter(task=>task.source?.path===source.path).map(task=>task.source?.anchor).filter(anchor=>typeof anchor==='string'&&anchor.trim());
    if (projectionSourceDigest(bytes, source.path === input.canonicalIndex, anchors) !== source.sha256) throw new Error(`projection source changed: ${source.path}`);
    sources.set(source.path, source.path === input.canonicalIndex ? canonicalIndexContent(bytes, anchors) : bytes);
  }
  if (!sources.has(input.canonicalIndex)) throw new Error('canonical index must be a bound source');
  const errors=validateTasks(input.tasks); if (errors.length) throw new Error(errors.join('; '));
  return input.tasks.map(task=>{
    const source=sources.get(task.source?.path), anchor=task.source?.anchor;
    if (!source || typeof anchor !== 'string' || !anchor.trim() || source.split(anchor).length !== 2) throw new Error(`${task.id}: unique source anchor required`);
    // Bind extraction itself and every supplied source: editing either invalidates old receipts.
    const { contractRevision: ignored, ...contract }=task;
    return {...contract,contractRevision:digest({sources:input.sources,canonicalIndex:input.canonicalIndex,tasks:input.tasks.map(({contractRevision,...rest})=>rest)}),
      planningSource:{kind:'projection',root:input.root,canonicalIndex:input.canonicalIndex}};
  });
}
