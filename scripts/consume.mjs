#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { loadProjection } from '../lib/plan-projection.mjs';
import { initializeStore, readStore, updateStore } from '../lib/orchestration-store.mjs';
import { createHostAuthorityCapability } from '../lib/receipt-reconciliation.mjs';
import {
  initExecutionConsumer, nextExecutionConsumer, packetExecutionConsumer, eventExecutionConsumer,
  reconcileExecutionConsumer, progressExecutionConsumer, verifyExecutionConsumer, statusExecutionConsumer,
  objectivePacketExecutionConsumer,
} from '../lib/execution-consumer.mjs';

const optionNames = ['state','handoff','current','source','profile','context','capabilities','task','event','expected-sequence',
  'canonical','equivalence','reconciliation-context','receipt','request','committed','readback','authority','broker','predecessor','reconciliation','workspace-binding'];
const { values, positionals } = parseArgs({ strict:true, allowPositionals:true,
  options:Object.fromEntries([...optionNames.map(name => [name,{type:'string'}]),['help',{type:'boolean'}]]) });

const usage = 'Usage: node scripts/consume.mjs <init|next|packet|event|reconcile|progress|verify|status> --state FILE [command options]; init requires --workspace-binding FILE';
const json = (name, required = true) => {
  if (!values[name]) { if (required) throw new Error(`--${name} is required`); return null; }
  return JSON.parse(fs.readFileSync(values[name], 'utf8'));
};
const source = () => loadProjection(values.source ?? (() => { throw new Error('--source is required'); })());
const bound = journal => ({ journal, handoff:json('handoff'), current:json('current'), source:source() });
const persistOne = (file, prior, next, expected) => {
  const event = next.events.at(-1)?.event;
  if (next.events.length !== prior.events.length + 1 || !event) throw new Error('consumer mutation must append exactly one event');
  return updateStore(file, event, expected);
};

try {
  if (values.help) { process.stdout.write(`${usage}\n`); }
  else {
    if (positionals.length !== 1) throw new Error(usage);
    const [command] = positionals;
    if (!values.state) throw new Error('--state is required');
    let result;
    if (command === 'init') {
      const workspaceBinding=json('workspace-binding'),handoff=json('handoff'), current=json('current'), tasks=source(), profile=json('profile');
      const initialized=initExecutionConsumer({ handoff,current,source:tasks,profile,context:json('context',false) ?? {},
        workspaceBinding,
        predecessor:json('predecessor',false),reconciliation:json('reconciliation',false) ?? [] });
      if (initialized.journal) initializeStore(values.state, initialized.journal);
      result=initialized;
    } else {
      const journal=readStore(values.state);
      if (command === 'status') {
        const handoff=json('handoff',false),current=json('current',false),tasks=values.source?source():null;
        result=statusExecutionConsumer({journal,handoff,current,source:tasks,capabilities:json('capabilities',false)});
      }
      else if (command === 'next') result=nextExecutionConsumer({...bound(journal),capabilities:json('capabilities')});
      else if (command === 'packet') result=packetExecutionConsumer({...bound(journal),taskId:values.task});
      else if (command === 'event' || command === 'verify') {
        if (command==='verify'&&!values.event) result=verifyExecutionConsumer({...bound(journal),event:undefined});
        else {
          if (!/^\d+$/.test(values['expected-sequence'] ?? '')) throw new Error('--expected-sequence is required');
          const expected=Number(values['expected-sequence']), event=json('event');
          const mutation=command==='verify'?verifyExecutionConsumer({...bound(journal),event,expectedSequence:expected})
            :eventExecutionConsumer({...bound(journal),event,expectedSequence:expected});
          if(mutation.journal.events.length===journal.events.length+1) mutation.journal=persistOne(values.state,journal,mutation.journal,expected);
          result=mutation;
        }
      } else if (command === 'reconcile') {
        const reconciliationContext=json('reconciliation-context',false) ?? {};
        if (reconciliationContext.hostAuthorityLedger) {
          reconciliationContext.hostAuthority=createHostAuthorityCapability(reconciliationContext.hostAuthorityLedger);
          delete reconciliationContext.hostAuthorityLedger;
        }
        result=reconcileExecutionConsumer({...bound(journal),canonicalTasks:loadProjection(values.canonical ?? (()=>{throw new Error('--canonical is required');})()),
          taskId:values.task,equivalence:json('equivalence',false),context:reconciliationContext});
      } else if (command === 'progress') {
        const authority=createHostAuthorityCapability(json('authority'));
        const mutation=progressExecutionConsumer({...bound(journal),canonicalTasks:loadProjection(values.canonical ?? (()=>{throw new Error('--canonical is required');})()),
          canonicalReceipt:json('receipt'),taskId:values.task,progressRequested:json('request'),progressCommitted:json('committed',false),
          indexReadback:json('readback'),hostAuthority:authority,broker:json('broker',false)});
        if (mutation.journal.events.length === journal.events.length + 1) mutation.journal=persistOne(values.state,journal,mutation.journal,journal.events.length);
        result=mutation;
      } else if (command === 'objective-packet') result=objectivePacketExecutionConsumer(bound(journal));
      else throw new Error(usage);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`ASDS_EXECUTION_CONSUMER_ERROR: ${error.message}\n`);
  process.exitCode=1;
}
