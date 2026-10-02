#!/usr/bin/env node
// Read-only cross-project check. No checkout copy, installation or Python bytecode.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { receiveHandoff, acceptWork, continueWork, createReturn } from '../lib/handoff.mjs';

const { values } = parseArgs({ options: { accelerate: { type: 'string' } } });
if (!values.accelerate) throw new Error('Explicit --accelerate /existing/checkout required');
const producer = spawnSync('python3', ['-B', '-c', `
import json, runpy, sys
from pathlib import Path
routing = runpy.run_path(str(Path(sys.argv[1]) / 'core/routing.py'))
route = routing['classify'](dict(engineering=True, bounded=True, reversible=True,
    uncertainty=True, multi_step=True, explicit_asds=False, risks=[]))
assert route['route'] == 'asds'
packets = []
for decision in ('granted', 'denied'):
    packets.append(routing['validate_handoff'](dict(objective='Exportar dados', project='/project',
        scope=['exportação'], constraints=['sem publicação'], risks=['formato indefinido'],
        references=[], authorizations=[dict(action='openspec.init', scope='/project',
        decision=decision, source='user turn 2')])) )
print(json.dumps(packets, ensure_ascii=False))
`, values.accelerate], { encoding: 'utf8' });
if (producer.status !== 0) throw new Error(producer.stderr || producer.error?.message || 'Accelerate producer failed');
for (const packet of JSON.parse(producer.stdout)) {
  const forwarded = acceptWork(receiveHandoff(packet), { gaps: ['formato'] });
  const direct = acceptWork(receiveHandoff(packet, { source: 'direct' }), { gaps: ['formato'] });
  assert.deepEqual(forwarded.context, packet);
  assert.deepEqual(forwarded.context, direct.context);
  assert.equal(forwarded.executionAuthorized, false);
  assert.deepEqual(continueWork(forwarded), forwarded);
  const result = { status: 'blocked', outcome: 'Aguardando formato', evidence: [], remainingWork: ['Definir formato'], limitations: ['Não executado'] };
  assert.deepEqual(createReturn(forwarded, result), createReturn(direct, result));
}
console.log('Accelerate producer → ASDS receiver passed: grants, refusals, gaps, resumption and direct-entry parity. Structural adapter proof; not a model/harness end-to-end evaluation.');
