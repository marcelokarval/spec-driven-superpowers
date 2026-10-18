import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { safePath } from './planning-paths.mjs';
export const HARNESS_REVIEW_VERSION='asds.harness-planning-review/1';
export const reviewDigest=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const text=v=>typeof v==='string'&&v.trim().length>0;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ids=v=>Array.isArray(v)&&v.length>0&&v.every(text)&&new Set(v).size===v.length;
export function createHarnessPlanningReview(input) {
  const r=structuredClone(input);delete r.envelopeDigest;
  return {...r,envelopeDigest:reviewDigest(r)};
}
export function harnessCandidate(m) {
  return {packageId:m.packageId,revision:m.revision,candidateSha256:m.candidateSha256,author:m.author,
    policyDigest:reviewDigest(m.reviewPolicy),inventoryDigest:reviewDigest(m.references.filter(r=>!['review','review-evidence'].includes(r.role))),
    taskIds:m.tasks.map(t=>t.id),sourceReferenceIds:m.references.filter(r=>!['review','review-evidence'].includes(r.role)).map(r=>r.id)};
}
/** Consistency, not authentication of a malicious harness or semantic judgment. */
export function validateHarnessReview(r,c,prior=null) {
  const errors=[];
  if(!object(r)||r.schemaVersion!==HARNESS_REVIEW_VERSION)return ['explicit harness review schema/object required'];
  const closed=(v,keys,label)=>{if(!object(v)||Object.keys(v).some(k=>!keys.includes(k)))errors.push(`unknown ${label} fields`);};
  closed(r,['schemaVersion','packageId','revision','candidateSha256','inventoryDigest','policyDigest','author','reviewer','assignment','kind','priorReviewDigest','verdict','findings','limitations','sourceReferenceIds','taskIds','evidence','envelopeDigest'],'review');
  closed(r.author,['actorId','sessionId'],'author');closed(r.reviewer,['actorId','sessionId','agentRole','parentSessionId'],'reviewer');
  if(object(r.reviewer)&&Object.hasOwn(r.reviewer,'parentSessionId')&&!text(r.reviewer.parentSessionId))errors.push('reviewer parentSessionId must be nonempty text when present');
  closed(r.assignment,['id','requestedBySessionId','kind','candidateSha256','scopeTaskIds'],'assignment');
  closed(r.evidence,['harness','sessionId','messageIds','requestDigest','resultDigest','persistedResultPath','observedBySessionId'],'evidence');
  for(const k of ['packageId','revision','candidateSha256','inventoryDigest','policyDigest'])if(!text(r[k])||r[k]!==c[k])errors.push(`review ${k} mismatch`);
  for(const k of ['author','reviewer'])if(!object(r[k])||!text(r[k].actorId)||!text(r[k].sessionId))errors.push(`explicit ${k} actor/session required`);
  if(!same(r.author,c.author))errors.push('author binding differs');
  const coordinator=r.assignment?.requestedBySessionId;
   const nonReviewerIdentities=[r.author?.actorId,r.author?.sessionId];
   if(!text(r.reviewer?.agentRole)||nonReviewerIdentities.includes(r.reviewer?.actorId)||nonReviewerIdentities.includes(r.reviewer?.sessionId))errors.push('independent reviewer actor/session required (distinct from author)');
  if(!['fidelity','quality'].includes(r.kind)||!object(r.assignment)||!text(r.assignment.id)||!text(coordinator)||r.assignment.kind!==r.kind||r.assignment.candidateSha256!==c.candidateSha256||!same(r.assignment.scopeTaskIds,c.taskIds))errors.push('assignment binding mismatch');
  if(r.kind==='fidelity'&&r.priorReviewDigest!==null)errors.push('fidelity prior must be null');
  if(r.kind==='quality'&&(!prior||prior.verdict!=='pass'||r.priorReviewDigest!==prior.envelopeDigest||r.reviewer?.sessionId===prior.reviewer?.sessionId||r.reviewer?.actorId===prior.reviewer?.actorId))errors.push('quality requires exact prior fidelity and distinct reviewer session/actor');
  if(r.kind==='quality'&&prior&&(coordinator!==prior.assignment?.requestedBySessionId||r.evidence?.observedBySessionId!==prior.evidence?.observedBySessionId))errors.push('quality coordinator must match fidelity requester/observer');
  for(const k of ['taskIds','sourceReferenceIds'])if(!ids(r[k])||!same([...r[k]].sort(),[...(c[k]??[])].sort()))errors.push(`${k} inventory mismatch`);
  const e=r.evidence;
  if(!object(e)||!text(e.harness)||e.sessionId!==r.reviewer?.sessionId||!ids(e.messageIds)||!hash(e.requestDigest)||!hash(e.resultDigest)||!safePath(e.persistedResultPath)||!text(e.observedBySessionId)||e.observedBySessionId!==coordinator)errors.push('explicit observed evidence required (same coordinator as assignment requester)');
  if(!['pass','fail','blocked'].includes(r.verdict)||!Array.isArray(r.findings)||!Array.isArray(r.limitations))errors.push('explicit verdict/findings/limitations required');
  for(const f of Array.isArray(r.findings)?r.findings:[]) {
    closed(f,['id','severity','status','evidence','expectedCorrection','disposition'],'finding');
    if(!object(f)||!text(f.id)||!['material','non-material'].includes(f.severity)||!['open','resolved','rejected'].includes(f.status)||!text(f.evidence)||!text(f.expectedCorrection)||!text(f.disposition))errors.push('invalid finding');
  }
  for(const l of Array.isArray(r.limitations)?r.limitations:[]) {
    closed(l,['description','blocksCoverage'],'limitation');
    if(!object(l)||!text(l.description)||typeof l.blocksCoverage!=='boolean')errors.push('invalid explicit limitation');
  }
  if(r.verdict==='pass'&&((Array.isArray(r.findings)?r.findings:[]).some(f=>f?.severity==='material'&&f.status!=='resolved')||(Array.isArray(r.limitations)?r.limitations:[]).some(l=>l?.blocksCoverage)))errors.push('PASS conflicts with material finding/limitation');
  const {envelopeDigest,...unsigned}=r;
  if(!hash(envelopeDigest)||envelopeDigest!==reviewDigest(unsigned))errors.push('envelope digest mismatch');
  return errors;
}
export function harnessReviewSequence(m) {
  const rs=m.reviews??[],errors=[];
  if(rs.length!==2||rs[0]?.kind!=='fidelity'||rs[1]?.kind!=='quality')return {status:'blocked',errors:['explicit ordered fidelity and quality required']};
  const c=harnessCandidate(m);
  rs.forEach((r,i)=>errors.push(...validateHarnessReview(r,c,i?rs[0]:null)));
  if(rs.some(r=>r.verdict!=='pass'))errors.push('review sequence did not pass');
  return {status:errors.length?'blocked':'passed',errors};
}
export function readReviewEvidence(root,relative) {
  if(!safePath(relative))throw Error('unsafe evidence path');
  let current=path.resolve(root);
  for(const part of relative.split('/')) {current=path.join(current,part);const st=fs.lstatSync(current);if(st.isSymbolicLink())throw Error('evidence symlink refused');}
  const stat=fs.statSync(current);if(!stat.isFile()||stat.nlink!==1)throw Error('unsafe evidence file');
  return fs.readFileSync(current);
}
export function verifyHarnessReviewFiles(root,m) {
  const errors=[...harnessReviewSequence(m).errors];
  for(const r of m.reviews??[])try{
    const ref=m.references.find(x=>x.id===`review:${r.kind}`);
    const bytes=readReviewEvidence(root,ref.path);
    if(reviewDigest(bytes)!==ref.sha256||!same(JSON.parse(bytes),r))errors.push('review bytes differ');
    if(reviewDigest(readReviewEvidence(root,r.evidence.persistedResultPath))!==r.evidence.resultDigest)errors.push('review evidence bytes differ');
  }catch(e){errors.push(`review evidence readback: ${e.message}`);}
  return errors;
}
