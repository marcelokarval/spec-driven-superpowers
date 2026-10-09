import test from 'node:test';
import assert from 'node:assert/strict';
import { receiveHandoff, acceptWork, declineWork, continueWork, createReturn, createPlanningReturn } from '../lib/handoff.mjs';

export const packet = () => ({
  objective: 'Adicionar exportação', project: '/project', scope: ['exportação'],
  constraints: ['sem publicação'], risks: ['formato indefinido'], references: [],
  authorizations: [{ action: 'openspec.init', scope: '/project', decision: 'denied', source: 'user turn 2' }],
});

test('legacy Accelerate packet is received without granting execution or losing refusal', () => {
  const input = packet();
  const received = receiveHandoff(input);
  assert.equal(received.state, 'received');
  assert.equal(received.executionAuthorized, false);
  assert.deepEqual(received.context, input);
  input.authorizations[0].decision = 'granted';
  assert.equal(received.context.authorizations[0].decision, 'denied');
});

test('acceptance can retain a blocker; resumption retains ownership and context', () => {
  const accepted = acceptWork(receiveHandoff(packet()), { gaps: ['Qual formato?'] });
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.owner, 'asds');
  assert.equal(accepted.executionAuthorized, false);
  assert.deepEqual(continueWork(accepted), accepted);
  assert.deepEqual(acceptWork(accepted).gaps, accepted.gaps);
  const changed = continueWork(accepted, { affectedTasks: ['0002'], reason: 'Formato mudou' });
  assert.equal(changed.state, 'needs-reassessment');
  assert.deepEqual(changed.affectedTasks, ['0002']);
  assert.deepEqual(changed.context, accepted.context);
});

test('declining differs from accepting gaps, and return cannot override authority metadata', () => {
  const received = receiveHandoff(packet());
  assert.throws(() => declineWork(received, ''), /reason/);
  assert.equal(declineWork(received, 'Target conflicts with user request').state, 'declined');
  const accepted = acceptWork(received);
  const result = createReturn(accepted, { status: 'completed', outcome: 'Done', evidence: ['test log'], remainingWork: [], limitations: [], owner: 'accelerate', protocolVersion: 99 });
  assert.equal(result.owner, 'asds');
  assert.equal(result.protocolVersion, 1);
});

test('invalid packets and unknown protocol versions fail explicitly', () => {
  for (const input of [{}, { ...packet(), scope: [] }, { ...packet(), protocolVersion: 2 },
    { ...packet(), authorizations: [{ action: 'init', scope: '/p', decision: 'maybe', source: 'x' }] }]) {
    assert.throws(() => receiveHandoff(input));
  }
});

test('direct and forwarded entries preserve the same constraints and outcome', () => {
  const forwarded = acceptWork(receiveHandoff(packet()));
  const direct = acceptWork(receiveHandoff(packet(), { source: 'direct' }));
  const result = { status: 'blocked', outcome: 'Formato pendente', evidence: [], remainingWork: ['Definir formato'], limitations: ['Sem execução'] };
  assert.deepEqual(forwarded.context, direct.context);
  assert.deepEqual(createReturn(forwarded, result), createReturn(direct, result));
  assert.throws(() => createReturn(receiveHandoff(packet()), result), /accepted/);
  assert.throws(() => createReturn(forwarded, { ...result, status: 'completed' }), /remaining/);
});

test('planning return v2 releases ownership and never claims implementation completion', () => {
  const accepted = acceptWork(receiveHandoff(packet()));
  const result = createPlanningReturn(accepted, { status: 'delivered', outcome: 'Planning package delivered',
    revision: 'plan-r1', manifest: 'planning-manifest.json', evidence: ['readback receipt'],
    remainingPlanningWork: [], limitations: [], storeVerified: true,
    originalRequest: { product: 'implementation', status: 'not_fulfilled' } });
  assert.equal(result.protocolVersion, 2);
  assert.equal(result.owner, null);
  assert.equal(result.nextOwner, 'caller-selects-consumer');
  assert.throws(() => createPlanningReturn(accepted, { ...result, owner: null, nextOwner: null,
    storeVerified: true, originalRequest: { product: 'implementation', status: 'fulfilled' } }), /cannot fulfill/);
  assert.throws(() => createPlanningReturn(accepted, { ...result, owner: null, nextOwner: null,
    storeVerified: false }), /persistence/);
});
