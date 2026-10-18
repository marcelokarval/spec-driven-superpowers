// Synthetic consistency fixtures only: no real author, reviewer, evidence or grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { harnessCandidate, createHarnessPlanningReview, validateHarnessReview, HARNESS_REVIEW_VERSION, reviewDigest } from '../lib/harness-planning-review.mjs';
import { planningCandidateSha256 } from '../lib/planning-lifecycle.mjs';

const json = relative => JSON.parse(readFileSync(new URL(relative,import.meta.url),'utf8'));
const template = () => json('../schemas/superpowers-bridge/templates/planning-manifest.json');

test('planning manifest template is an unapproved /1 draft with explicit identity placeholders',()=>{
  const m=template();
  assert.equal(m.schemaVersion,'asds.planning-delivery/1');
  assert.equal(m.returnVersion,'asds.planning-return/1');
  assert.deepEqual(Object.keys(m.author).sort(),['actorId','sessionId']);
  for(const value of Object.values(m.author))assert.match(value,/^replace-with-/);
  assert.equal(m.state,'draft');
  assert.equal(m.originalRequestedProduct.status,'not_fulfilled');
  assert.equal(m.reviewPolicy.independentRequired,true);
  assert.equal(m.reviewPolicy.mode,'independent');
  assert.equal(m.authority.persistenceGranted,false);
  assert.deepEqual(m.reviews,[]);
  assert.equal(m.readback,null);
  assert.equal(m.planningContribution.executionPerformed,false);
});

test('review schema description permits a non-author coordinator, not author review',()=>{
  const schema=json('../schemas/harness-planning-review.schema.json');
  assert.doesNotMatch(schema.description,/distinct from author, coordinator/);
  assert.match(schema.description,/non-author coordinator may review/i);
});

test('synthetic template identity binds /1 F/Q; coordinator eligible, author and reused reviewers denied',()=>{
  const m=template();
  assert.equal(typeof m.author,'object','template identity must bind without replacing its shape');
  // Explicit synthetic substitutions, not claims of observed sessions or files.
  m.author.actorId='synthetic-author';m.author.sessionId='synthetic-author-session';
  m.packageId='synthetic-template';m.revision='synthetic-r1';
  m.synthetic=true;
  m.reviewPolicy.domains=['general'];m.reviewPolicy.risk='elevated';
  m.references=[{id:'synthetic-brief',path:'synthetic-brief.md',role:'source',sha256:reviewDigest('synthetic brief')}];
  m.tasks=[{id:'synthetic-task'}];
  m.candidateSha256=planningCandidateSha256(m);
  const candidate=harnessCandidate(m);
  const review=(kind,reviewer,prior=null)=>createHarnessPlanningReview({
    schemaVersion:HARNESS_REVIEW_VERSION,...candidate,kind,reviewer:{...reviewer,agentRole:'synthetic-fixture'},
    assignment:{id:`synthetic-${kind}`,requestedBySessionId:'synthetic-coordinator',kind,candidateSha256:candidate.candidateSha256,scopeTaskIds:candidate.taskIds},
    priorReviewDigest:prior?.envelopeDigest??null,verdict:'pass',findings:[],limitations:[],
    evidence:{harness:'SYNTHETIC fixture; not real evidence',sessionId:reviewer.sessionId,messageIds:[`synthetic-${kind}`],requestDigest:reviewDigest('synthetic request'),resultDigest:reviewDigest('synthetic result'),persistedResultPath:`synthetic/${kind}.json`,observedBySessionId:'synthetic-coordinator'},
  });
  const coordinator={actorId:'synthetic-coordinator',sessionId:'synthetic-coordinator'};
  const f=review('fidelity',coordinator);
  assert.deepEqual(validateHarnessReview(f,candidate),[]);
  const q=review('quality',{actorId:'synthetic-q',sessionId:'synthetic-q-session'},f);
  assert.deepEqual(validateHarnessReview(q,candidate,f),[]);
  assert.ok(validateHarnessReview(review('fidelity',m.author),candidate).some(e=>/distinct from author/.test(e)));
  assert.ok(validateHarnessReview(review('quality',coordinator,f),candidate,f).some(e=>/distinct reviewer/.test(e)));
  assert.ok(validateHarnessReview(q,{...candidate,author:{...m.author,sessionId:'synthetic-other'}} ,f).some(e=>/author binding/.test(e)));
  assert.deepEqual(m.reviews,[],'test envelopes never become template approvals');
  assert.notEqual(m.authority.persistenceGranted,true);
});
