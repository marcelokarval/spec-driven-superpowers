#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { loadTasks, validateChange } from '../lib/validation.mjs';
import { compilePlan, createJournal, replay, readyWave, renderDag, packetFor, assertCurrentPlan, continuation } from '../lib/orchestration.mjs';
import { reconcileProjectionReceipt } from '../lib/receipt-reconciliation.mjs';
import { loadProjection } from '../lib/plan-projection.mjs';
import { preflight } from '../lib/runtime-preflight.mjs';
import { initializeStore, readStore, updateStore } from '../lib/orchestration-store.mjs';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: Object.fromEntries(
    ['change','profile','context','state','capabilities','role','task','event','expected-sequence','receipts','projection','request'].map(key => [key,{type:'string'}])) });
  const [command, ...extra] = positionals;
  if (!process.env.ASDS_SUPPRESS_LEGACY_CLI_NOTICE) process.stderr.write('NOTICE: scripts/orchestrate.mjs is the legacy journal CLI; new execution-consumer runs use scripts/consume.mjs.\n');
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
  } else if (command === 'reconcile') {
    if (!values.state || !values.change || !values.projection || !values.task) throw new Error('reconcile requires --state, --change, --projection and --task');
    result = reconcileProjectionReceipt({ journal:readStore(values.state), projectionTasks:loadProjection(values.projection),
      canonicalTasks:loadTasks(values.change), taskId:values.task, equivalence:values.request ? json('request') : null });
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
        if (journal.version === 3 && journal.context?.consumerBinding?.schemaVersion === 'asds.execution-consumer-binding/1') {
          if (['decompose', 'refine'].includes(event.type)) {
            if (values.change || values.projection) {
              const expected = compilePlan(sourceTasks(), replay(journal).plan.profile, { allowUnready: true });
              if (expected.revision !== event.plan?.revision) throw new Error('decomposition plan must match current sources');
            }
          }
          result = { ...replay(journal), ...(event.plan ? {plan:event.plan,proposedPlan:event.plan} : {}), persisted:false,
            status:'manual_handoff_required', disposition:'manual_handoff_required', reasonCode:'rebind_required',
            reason:`journal v3 ${event.type} requires scripts/consume.mjs with a current validated handoff and explicit rebind; legacy CLI did not persist the event` };
          break;
        }
        if (['dispatch', 'deliver', 'reviewResult', 'beginIntegration', 'integrate', 'decide', 'acceptPackage', 'verifyObjective'].includes(event.type)) {
          assertCurrentPlan(journal, sourceTasks());
        }
        if (['decompose', 'refine'].includes(event.type)) {
          const expected = compilePlan(sourceTasks(), replay(journal).plan.profile, { allowUnready: true });
          if (expected.revision !== event.plan?.revision) throw new Error('decomposition plan must match current sources');
        }
        result = replay(updateStore(values.state, event, Number(values['expected-sequence']))); break;
      }
      default: throw new Error('Commands: preflight, init, status, next, dag, wave, packet, event, reconcile. Legacy API; new execution-consumer runs use scripts/consume.mjs. See references/orchestration.md.');
    }
  }
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
