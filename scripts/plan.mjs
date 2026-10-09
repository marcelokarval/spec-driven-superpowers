#!/usr/bin/env node
// Pure planning entry: reads contracts, never imports host dispatch or execution.
import fs from 'node:fs';
import path from 'node:path';
import { compilePlanningPlan, projectTaskManager, renderPlanningDag } from '../lib/planning-graph.mjs';
import { loadTasks, validateTaskIndex } from '../lib/validation.mjs';
try {
  const [command, input, ...extra] = process.argv.slice(2);
  if (!['validate','dag','recommend','manager'].includes(command) || !input || extra.length) throw new Error('Usage: plan.mjs <validate|dag|recommend|manager> <tasks.json|change-directory>');
  let tasks, managerOptions = {};
  if(fs.statSync(input).isDirectory()) {
    tasks=loadTasks(input);
    const canonicalErrors=validateTaskIndex(input,tasks).errors;
    if(canonicalErrors.length) throw new Error(canonicalErrors.join('; '));
    const manifest=path.join(input,'planning-manifest.json');
    if(command==='manager' && fs.existsSync(manifest)) managerOptions={blockers:JSON.parse(fs.readFileSync(manifest,'utf8')).blockers??[]};
  } else {
    const value=JSON.parse(fs.readFileSync(input,'utf8')); tasks=Array.isArray(value)?value:value.tasks;
  }
  const plan=compilePlanningPlan(tasks);
  console.log(command==='dag'?renderPlanningDag(plan):JSON.stringify(command==='recommend'?plan.parallelism:command==='manager'?projectTaskManager(tasks,managerOptions):plan,null,2));
} catch(error) { console.error(error.message); process.exitCode=1; }
