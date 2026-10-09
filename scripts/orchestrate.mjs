#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { loadTasks, validateChange } from '../lib/validation.mjs';
import { compilePlan, createJournal, replay, readyWave, renderDag, packetFor, assertCurrentPlan, continuation } from '../lib/orchestration.mjs';
import { loadProjection } from '../lib/plan-projection.mjs';
import { preflight } from '../lib/runtime-preflight.mjs';
import { initializeStore, readStore, updateStore } from '../lib/orchestration-store.mjs';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: Object.fromEntries(
    ['change','profile','context','state','capabilities','role','task','event','expected-sequence','receipts','projection','request'].map(key => [key,{type:'string'}])) });
  const [command, ...extra] = positionals;
  if (extra.length) throw new Error('Only one command is accepted');
  const json = key => { if (!values[key]) throw new Error(`--${key} is required`); return JSON.parse(fs.readFileSync(values[key], 'utf8')); };
  const sourceTasks = () => {
    if (Boolean(values.change) === Boolean(values.projection)) throw new Error('choose exactly one --change or --projection source');
    return values.projection ? loadProjection(values.projection) : loadTasks(values.change);
  };
  let result;
  if (command === 'preflight') { result = preflight(json('request')); }
  else if (command === 'init') {
    if (!values.state) throw new Error('init requires --state');
    const tasks = sourceTasks();
    const errors = values.change ? validateChange(values.change, { receipts: values.receipts ? json('receipts') : {}, allowUnready: true }) : [];
    if (errors.length) throw new Error(errors.join('; '));
    const journal = createJournal(compilePlan(tasks, json('profile'), { allowUnready: true }), json('context'));
    initializeStore(values.state, journal); result = replay(journal);
  } else {
    if (!values.state) throw new Error('--state is required');
    const journal = readStore(values.state);
    if (['wave', 'packet', 'next'].includes(command)) {
      assertCurrentPlan(journal, sourceTasks());
    }
    switch (command) {
      case 'next': result = continuation(journal, json('capabilities')); break;
      case 'status': result = replay(journal); break;
      case 'dag': result = renderDag(replay(journal).plan); break;
      case 'wave': result = readyWave(journal, json('capabilities'), values.role ?? 'executor'); break;
      case 'packet': result = packetFor(journal, values.task); break;
      case 'event': {
        if (!/^\d+$/.test(values['expected-sequence'] ?? '')) throw new Error('--expected-sequence is required');
        const event = json('event');
        if (['dispatch', 'deliver', 'reviewResult', 'beginIntegration', 'integrate', 'decide', 'acceptPackage'].includes(event.type)) {
          assertCurrentPlan(journal, sourceTasks());
        }
        if (['decompose', 'refine'].includes(event.type)) {
          const expected = compilePlan(sourceTasks(), replay(journal).plan.profile, { allowUnready: true });
          if (expected.revision !== event.plan?.revision) throw new Error('decomposition plan must match current sources');
        }
        result = replay(updateStore(values.state, event, Number(values['expected-sequence']))); break;
      }
      default: throw new Error('Commands: preflight, init, status, next, dag, wave, packet, event. See references/orchestration.md.');
    }
  }
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
