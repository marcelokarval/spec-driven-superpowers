#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compilePlan, digest, appendEvent, replay } from '../lib/orchestration.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: sanitize-pilot-journal.mjs INPUT OUTPUT_DIRECTORY');
const source = JSON.parse(fs.readFileSync(input, 'utf8'));
const replacements = new Map([
  ['/home/marcelo-karval/Backup/Projetos/prop4you/prop4you-platform/.worktrees/login-validation-observation','/fixture/project'],
  ['/home/marcelo-karval/.agents/skills','/fixture/skills'],
  ['/home/marcelo-karval/Backup/Projetos/spec-driven-superpowers','/fixture/asds'],
  ['root-codex-session','fixture-coordinator'],
  ['/root/asds_0007_executor','fixture-executor-0007-a'],
  ['/root/asds_0007_executor_retry','fixture-executor-0007-b'],
  ['/root/asds_0007_redelivery','fixture-executor-0007-c'],
  ['/root/asds_0007_reconstruct_tests','fixture-executor-0007-d'],
  ['/root/asds_0005_executor','fixture-executor-0005-a'],
  ['agy-0007-candidate-review-1','fixture-reviewer-0007-a'],
  ['agy-0007-candidate-review-2','fixture-reviewer-0007-b'],
  ['agy-0007-candidate-review-3','fixture-reviewer-0007-c'],
  ['agy-0007-integration-review-1','fixture-reviewer-0007-d'],
  ['agy-0005-candidate-review-1','fixture-reviewer-0005-a'],
  ['agy-0005-integration-review-1','fixture-reviewer-0005-b'],
]);
const sanitize = value => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,sanitize(item)]));
  if (typeof value !== 'string') return value;
  let result=value;
  for (const [from,to] of replacements) result=result.replaceAll(from,to);
  return result;
};
const cleaned=sanitize(source);
cleaned.context.authorization={
  source:'Fixture authorization for a bounded two-task execution pilot',
  scope:'Local fixture execution only; no publication, installation, deployment or external services',
};
const plan=compilePlan(cleaned.plan.tasks,cleaned.plan.profile,{allowUnready:cleaned.plan.version!==1});
const header={version:1,plan,context:cleaned.context};
let journal={...header,digest:digest(header),events:[]};
for(const entry of cleaned.events) journal=appendEvent(journal,entry.event,journal.events.length);
replay(journal);
const serialized=JSON.stringify(journal,null,2)+'\n';
if (/\/home\/|marcelo|root-codex|\/root\/asds_|agy-/.test(serialized)) throw new Error('sanitization left private identifiers');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'run-v1.json'),serialized);
const expected={
  schemaVersion:'asds.pilot-fixture/1',
  sourceSha256:createHash('sha256').update(fs.readFileSync(input)).digest('hex'),
  sequence:journal.events.length,
  eventTypes:journal.events.map(entry=>entry.event.type),
  acceptedTaskIds:Object.entries(replay(journal).tasks).filter(([,task])=>task.status==='accepted').map(([id])=>id).sort(),
};
fs.writeFileSync(path.join(output,'expected.json'),JSON.stringify(expected,null,2)+'\n');
fs.writeFileSync(path.join(output,'README.md'),`# Sanitized login execution pilot

This replayable journal is derived from an authorized local two-task pilot. It
preserves the 33-event topology, failures, rework, candidate and integration
reviews, dependency order and final task acceptance. Personal paths, coordinator
and worker identifiers, and literal authorization text were replaced; the plan
revision and complete hash chain were rebuilt.

The source digest is recorded in expected.json. This is a journal v1 compatibility
fixture: it does not pretend the historical run recorded v2 isolation attestations
or observed-command scope that did not exist at that time.
`);
