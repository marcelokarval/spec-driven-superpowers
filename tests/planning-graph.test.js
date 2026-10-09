import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { safePath, validateTasks } from '../lib/contracts.mjs';
import { safePath as planningSafePath } from '../lib/planning-paths.mjs';
import { validateRefinement } from '../lib/decomposition.mjs';
import { compilePlanningPlan, projectTaskManager, renderPlanningDag, structuralGraph, validateDecisionRouting } from '../lib/planning-graph.mjs';
const node=(id,extra={})=>({id,nodeType:'task',dependsOn:[],write:['a.js'],resources:[],scenarios:['s'],requirements:['r'],verification:['future check'],dependencyDetails:(extra.dependsOn??[]).map(id=>({id,reason:'Needs verified prerequisite',requiredOutput:'Verified result'})),...extra});
const nested=()=>[node('P',{nodeType:'package'}),node('Q',{nodeType:'package',parentId:'P'}),node('R',{nodeType:'package',parentId:'Q'}),node('A',{parentId:'R'})];
test('four-level composition is a valid forest without inherited duplication',()=>assert.deepEqual(validateTasks(nested()),[]));
test('aggregate dependencies expand nested terminals and ancestor declarations',()=>{
 const tasks=[...nested(),node('S',{nodeType:'package',dependsOn:['P']}),node('T',{nodeType:'package',parentId:'S'}),node('B',{parentId:'T'})];
 const plan=compilePlanningPlan(tasks);
 assert.deepEqual(plan.dependencies.B,['A']); assert.deepEqual(plan.parallelism.waves,[['A'],['B']]);
 assert.match(renderPlanningDag(plan),/composition/);assert.ok(!('profile' in plan));
});
test('graph validators directly detect effective cycles, composition cycles and missing IDs',()=>{
 const effective=[...nested().map(t=>t.id==='P'?{...t,dependsOn:['B']}:t),node('B',{dependsOn:['Q']})];
 assert.ok(validateTasks(effective).some(e=>e.includes('effective dependency cycle')));
 const cycle=nested().map(t=>t.id==='P'?{...t,parentId:'R'}:t);
 assert.ok(validateTasks(cycle).some(e=>e.includes('composition cycle')));
 assert.ok(validateTasks([node('A',{dependsOn:['absent']})]).some(e=>e.includes('missing dependency')));
 assert.ok(validateTasks([node('A',{parentId:'absent'})]).some(e=>e.includes('orphan')));
 assert.ok(validateTasks([node('P'),node('A',{parentId:'P'})]).some(e=>e.includes('leaf-with-children')));
});
test('scope escape and lost requirements, scenarios, paths are rejected recursively',()=>{
 for(const key of ['write','resources','scenarios','requirements']) {
  assert.ok(validateTasks(nested().map(t=>t.id==='A'?{...t,[key]:['escape']}:t)).some(e=>e.includes('escapes')));
 }
 for(const key of ['write','scenarios','requirements']) assert.ok(structuralGraph(nested().map(t=>t.id==='A'?{...t,[key]:[]}:t)).errors.some(e=>e.includes('coverage')));
});
test('same-file results remain independent tasks with sequential recommendation',()=>{
 const plan=compilePlanningPlan([node('A'),node('B')]);
 assert.equal(plan.tasks.length,2);assert.deepEqual(plan.parallelism.waves,[['A'],['B']]);assert.match(plan.parallelism.conflicts[0].reason,/not fusion/);
 assert.deepEqual(compilePlanningPlan([node('B',{write:['b.js']}),node('A')]).parallelism.waves,[['A','B']]);
});
test('task-manager projection distinguishes ready, waiting, blocked and completed work',()=>{
 const tasks=[node('A',{title:'Decide contract',write:['a.js']}),
  node('B',{title:'Implement',dependsOn:['A'],write:['b.js']}),
  node('C',{title:'Document',dependsOn:['B'],write:['c.js']})];
 const initial=projectTaskManager(tasks);
 assert.deepEqual(initial.readyTaskIds,['A']);assert.deepEqual(initial.waitingTaskIds,['B','C']);
 assert.deepEqual(initial.tasks.find(task=>task.id==='A').blocks,['B']);
 assert.deepEqual(initial.tasks.find(task=>task.id==='B').waitingOn,['A']);
 assert.deepEqual(initial.tasks.find(task=>task.id==='A').serializesWith,[]);
 const blocked=projectTaskManager(tasks,{blockers:[{id:'D1',affectedTasks:['A']} ]});
 assert.deepEqual(blocked.blockedTaskIds,['A','B','C']);
 assert.deepEqual(blocked.tasks.find(task=>task.id==='C').blockedBy,['D1']);
 const advanced=projectTaskManager(tasks,{completedTaskIds:['A']});
 assert.deepEqual(advanced.readyTaskIds,['B']);assert.deepEqual(advanced.completedTaskIds,['A']);
 assert.deepEqual(advanced.tasks.find(task=>task.id==='B').waitingOn,[]);
 assert.throws(()=>projectTaskManager(tasks,{completedTaskIds:['B']}),/incomplete dependency/);
});
test('decision routing keeps resolver executable and makes consumers depend on its output',()=>{
 const decision={id:'D1',material:true,status:'proposed'};
 const resolver=node('A',{owner:'Auth owner',resolvesDecisions:['D1'],decisionInputs:[],write:['decision.md']});
 const consumer=node('B',{owner:'Frontend owner',decisionInputs:['D1'],resolvesDecisions:[],dependsOn:['A'],write:['form.tsx']});
 const blocker={id:'BD1',decisionId:'D1',affectedTasks:['B']};
 assert.deepEqual(validateDecisionRouting([resolver,consumer],[decision],[blocker]),[]);
 assert.ok(validateDecisionRouting([{...resolver,resolvesDecisions:['D1','D2']},consumer],[decision,{id:'D2',material:true,status:'proposed'}],[blocker])
  .some(error=>error.includes('decisionBundleReason')));
 assert.ok(validateDecisionRouting([resolver,{...consumer,dependsOn:[],dependencyDetails:[]}],[decision],[blocker])
  .some(error=>error.includes('not a prerequisite')));
 assert.ok(validateDecisionRouting([resolver,consumer],[decision],[{...blocker,affectedTasks:['A','B']}])
  .some(error=>error.includes('cannot block its resolver')));
 assert.ok(validateDecisionRouting([resolver,consumer],[decision],[blocker,{...blocker,id:'BD2'}])
  .some(error=>error.includes('exactly one blocker')));
 assert.ok(validateDecisionRouting([resolver,consumer,node('C',{owner:'Other',decisionInputs:[],resolvesDecisions:[],write:['c.ts']})],[decision],[{...blocker,affectedTasks:['C']}])
  .some(error=>error.includes('does not affect its consumer')));
 assert.ok(validateDecisionRouting([node('P',{nodeType:'package',write:['decision.md']}),{...resolver,parentId:'P'},consumer],[decision],[{...blocker,affectedTasks:['P','B']}])
  .some(error=>error.includes('cannot block its resolver')));
 assert.ok(validateDecisionRouting([resolver,consumer],[null],[]).some(error=>error.includes('valid decision objects')));
 assert.ok(validateDecisionRouting([resolver,consumer],[decision,decision],[blocker]).some(error=>error.includes('duplicate decision id')));
});
test('task-manager exposes conflicts to simple queues without inventing precedence',()=>{
 const projection=projectTaskManager([node('A',{write:['same.ts']}),node('B',{write:['same.ts']})]);
 assert.deepEqual(projection.tasks.find(task=>task.id==='A').serializesWith,['B']);
 assert.deepEqual(projection.tasks.find(task=>task.id==='B').serializesWith,['A']);
 assert.deepEqual(projection.tasks.find(task=>task.id==='B').waitingOn,[]);
});
test('auth decisions split into parallel resolvers before client, server, integration and reconciliation',()=>{
 const decisions=['D1','D2','D3'].map(id=>({id,material:true,status:'proposed'}));
 const make=(id,extra)=>node(id,{owner:'Auth team',decisionInputs:[],resolvesDecisions:[],...extra});
 const tasks=[
  make('D1R',{title:'Credential compatibility',resolvesDecisions:['D1'],write:['d1.md']}),
  make('D2R',{title:'Progressive enhancement',resolvesDecisions:['D2'],write:['d2.md']}),
  make('D3R',{title:'Server boundary',resolvesDecisions:['D3'],write:['d3.md']}),
  make('CLIENT',{decisionInputs:['D1','D2'],dependsOn:['D1R','D2R'],write:['form.tsx']}),
  make('SERVER',{decisionInputs:['D3'],dependsOn:['D3R'],write:['action.ts']}),
  make('PROOF',{decisionInputs:['D1','D2','D3'],dependsOn:['CLIENT','SERVER'],write:['auth.spec.ts']}),
  make('DOCS',{decisionInputs:['D1','D2','D3'],dependsOn:['PROOF'],write:['auth.md']}),
 ];
 const blockers=decisions.map(({id})=>({id:`B${id}`,decisionId:id,affectedTasks:
  id==='D1'?['CLIENT','PROOF','DOCS']:id==='D2'?['CLIENT','PROOF','DOCS']:['SERVER','PROOF','DOCS']}));
 assert.deepEqual(validateDecisionRouting(tasks,decisions,blockers),[]);
 const projection=projectTaskManager(tasks,{blockers});
 assert.deepEqual(projection.readyTaskIds,['D1R','D2R','D3R']);
 assert.deepEqual(projection.plannedWaves,[['D1R','D2R','D3R'],['CLIENT','SERVER'],['PROOF'],['DOCS']]);
 assert.deepEqual(projection.blockedTaskIds,['CLIENT','DOCS','PROOF','SERVER']);
});
test('recursive refinement conserves identities, criteria and dependent aggregate redirection',()=>{
 const criteria=[{id:'c',criterion:'keep',source:'user',verification:'future'}];
 const before=[node('A',{approvalCriteria:criteria}),node('B',{dependsOn:['A']})];
 const after=[{...before[0],nodeType:'package'},before[1],node('Q',{parentId:'A',nodeType:'package'}),node('C',{parentId:'Q'})];
 assert.deepEqual(validateRefinement(before,after,'A'),[]);
 assert.deepEqual(compilePlanningPlan(after).dependencies.B,['C']);
 assert.ok(validateRefinement(before,after.map(t=>t.id==='C'?{...t,requirements:[]}:t),'A').some(e=>e.includes('coverage')));
 assert.ok(validateTasks(after.map(t=>t.id==='C'?{...t,requirements:[]}:t)).some(e=>e.includes('coverage')));
 assert.ok(validateRefinement(before,after.map(t=>t.id==='A'?{...t,approvalCriteria:[]}:t),'A').some(e=>e.includes('preserve')));
});
test('flat refinement extends only authorized dependency explanations and compiles the same candidate',()=>{
 const before=[node('A'),node('D'),node('B',{dependsOn:['A','D']})];
 const after=[before[0],before[1],node('C'),node('E'),{...before[2],dependsOn:['A','D','C','E'],
  dependencyDetails:[...before[2].dependencyDetails,{id:'C',reason:'Needs C',requiredOutput:'C result'},
   {id:'E',reason:'Needs E',requiredOutput:'E result'}]}];
 assert.deepEqual(validateRefinement(before,after,'A'),[]);
 const compiled=compilePlanningPlan(after);
 assert.deepEqual(compiled.dependencies.B,['A','C','D','E']);
 assert.deepEqual(validateRefinement(before,compiled.tasks,'A'),[]);
 // Exact reviewer reproducer: metadata absent on independent leaves is legal.
 const n=(id,extra={})=>({id,nodeType:'task',dependsOn:[],write:['x.js'],resources:[],scenarios:['s'],requirements:['r'],...extra});
 const A=n('A'),B=n('B',{dependsOn:['A'],dependencyDetails:[{id:'A',reason:'Needs A',requiredOutput:'A result'}]});
 const split=[A,n('C'),{...B,dependsOn:['A','C'],dependencyDetails:[...B.dependencyDetails,{id:'C',reason:'Needs C',requiredOutput:'C result'}]}];
 assert.deepEqual(validateRefinement([A,B],split,'A'),[]);
 assert.deepEqual(compilePlanningPlan(split).dependencies.B,['A','C']);
 const b=after.at(-1),details=b.dependencyDetails;
 const invalid=[
  {...b,dependencyDetails:details.map(d=>d.id==='A'?{...d,reason:'rewritten'}:d)},
  {...b,dependencyDetails:details.map(d=>d.id==='D'?{...d,requiredOutput:'rewritten'}:d)},
  {...b,dependencyDetails:details.filter(d=>d.id!=='A')},
  {...b,dependencyDetails:undefined},
  {...b,dependencyDetails:[...details,details[0]]},
  {...b,dependencyDetails:[details[0],details[1],details[0],details[3]]},
  {...b,dependencyDetails:before[2].dependencyDetails},
  ...[null,42,[],{id:42,reason:'why',requiredOutput:'result'},{id:'bad/id',reason:'why',requiredOutput:'result'}].map(detail=>
   ({...b,dependencyDetails:[details[0],details[1],detail,details[3]]})),
  {...b,dependencyDetails:details.map(d=>d.id==='C'?{...d,requiredOutput:' '}:d)},
  {...b,dependencyDetails:details.map(d=>d.id==='E'?{id:'E',requiredOutput:'result'}:d)},
  {...b,dependencyDetails:[...details,{id:'D2',reason:'outside',requiredOutput:'result'}]},
  {...b,dependsOn:['A','C','E'],dependencyDetails:details.filter(d=>d.id!=='D')},
  {...b,dependsOn:['A','D','C','C','E']},
  {...b,body:'unrelated contract rewrite'}
 ];
 for(const candidate of invalid) assert.ok(validateRefinement(before,[...after.slice(0,-1),candidate],'A').length);
 // Existing nondependents cannot gain explanations even for an added replacement.
 const unrelated=[before[0],{...before[1],dependsOn:['C'],dependencyDetails:[details[2]]},...after.slice(2)];
 assert.ok(validateRefinement(before,unrelated,'A').length);
});
test('recursive refinement keeps declarations unchanged while terminals expand',()=>{
 const before=[node('A'),node('B',{dependsOn:['A']})];
 const after=[{...before[0],nodeType:'package'},before[1],node('C',{parentId:'A'})];
 assert.deepEqual(validateRefinement(before,after,'A'),[]);
 assert.deepEqual(compilePlanningPlan(after).dependencies.B,['C']);
 for(const replacement of [{...before[1],dependencyDetails:[{id:'A',reason:'changed',requiredOutput:'changed'}]},
  node('B',{dependsOn:['A','C']})])
  assert.ok(validateRefinement(before,[after[0],replacement,after[2]],'A').length);
});
test('flat refinement without dependency metadata retains legacy compatibility',()=>{
 const withoutDetails=task=>{const {dependencyDetails,...legacy}=task;return legacy;};
 const before=[node('A'),node('B',{dependsOn:['A']})].map(withoutDetails);
 const after=[before[0],withoutDetails(node('C')),{...before[1],dependsOn:['A','C']}];
 assert.deepEqual(validateRefinement(before,after,'A'),[]);
});
test('refinement rejects malformed metadata on newly added replacement tasks',()=>{
 const before=[node('A'),node('D'),node('B',{dependsOn:['A']})];
 const after=[...before.slice(0,2),node('B',{dependsOn:['A','C']}),node('C',{dependsOn:['D']})];
 assert.deepEqual(validateRefinement(before,after,'A'),[]);
 for(const dependencyDetails of [[],null,[{id:'D',reason:'why'}],[{id:'X',reason:'why',requiredOutput:'result'}]])
  assert.ok(validateRefinement(before,after.map(t=>t.id==='C'?{...t,dependencyDetails}:t),'A').length);
});
test('planning paths fail closed using the exact portable contract',()=>{
 assert.equal(safePath,planningSafePath);
 for(const file of ['../outside.js','','a/../shared.js','/root.js','a\\b.js','a//b.js','a/./b.js','CON.txt','a?.js','a.','a '])
  assert.throws(()=>compilePlanningPlan([node('A',{write:[file]})]),/unsafe write path|Invalid planning tasks/);
 assert.throws(()=>compilePlanningPlan([node('A',{write:['a/../shared.js']}),node('B',{write:['shared.js']})]),/unsafe write path/);
 for(const [a,b] of [['Shared.js','shared.js'],['café.js','cafe\u0301.js'],['src','src/a.js']]) {
  const plan=compilePlanningPlan([node('A',{write:[a]}),node('B',{write:[b]})]);
  assert.deepEqual(plan.parallelism.waves,[['A'],['B']]);
 }
 for(const field of ['dependsOn','resources','scenarios','requirements']) for(const value of ['', '   '])
  assert.throws(()=>compilePlanningPlan([node('A',{[field]:[value]})]),/Invalid planning tasks/);
 for(const value of ['', ' ', 'a/b']) assert.throws(()=>compilePlanningPlan([node(value)]),/Invalid planning tasks/);
});
test('finalized planning requires exact justified dependency outputs',()=>{
 const base=[node('A'),node('B',{dependsOn:['A']})];
 for(const details of [undefined,[],[{id:'A',reason:'why'}],[{id:'A',reason:' ',requiredOutput:'result'}],
  [{id:'A',reason:'why',requiredOutput:''}],[{id:'X',reason:'why',requiredOutput:'result'}],
  [{id:'A',reason:'why',requiredOutput:'result'},{id:'A',reason:'why',requiredOutput:'result'}],null])
  assert.throws(()=>compilePlanningPlan([base[0],{...base[1],dependencyDetails:details}]),/dependencyDetails/);
 assert.throws(()=>compilePlanningPlan([node('A',{dependencyDetails:[{id:'B',reason:'why',requiredOutput:'result'}]})]),/dependencyDetails/);
 assert.throws(()=>compilePlanningPlan([base[0],{...base[1],dependsOn:['A','A']}]),/duplicate dependsOn/);
 // Execution compatibility does not require new planning metadata.
 const legacy=base.map(({dependencyDetails,...task})=>task);
 assert.deepEqual(validateTasks(legacy,{legacyExecution:true}),[]);
 assert.deepEqual(structuralGraph(legacy,{legacyExecution:true}).dependencies.B,['A']);
});
test('expanded dependency explanations preserve all declaring relations and escape Mermaid',()=>{
 const details={id:'P',reason:'Needs list "checked" ] --> evil[<script>',requiredOutput:'Verified export & list\nresults'};
 const tasks=[node('P',{nodeType:'package'}),node('A',{parentId:'P'}),
  node('S',{nodeType:'package',dependsOn:['P'],dependencyDetails:[details]}),
  node('B',{parentId:'S',dependsOn:['A']})];
 const plan=compilePlanningPlan(tasks);
 assert.deepEqual(plan.dependencyRelations.filter(edge=>edge.to==='B'),[
  {from:'A',to:'B',declaredBy:'B',dependencyId:'A',reason:'Needs verified prerequisite',requiredOutput:'Verified result'},
  {from:'A',to:'B',declaredBy:'S',dependencyId:'P',reason:details.reason,requiredOutput:details.requiredOutput}
 ]);
 const dag=renderPlanningDag(plan);
 assert.match(dag,/Needs verified prerequisite/); assert.match(dag,/Verified result/);
 assert.match(dag,/S requires P/); assert.match(dag,/Verified export/);
 assert.doesNotMatch(dag,/evil\[<script>/);assert.match(dag,/#34;checked#34;/);
 assert.equal(dag,renderPlanningDag(compilePlanningPlan([...tasks].reverse())));
});
test('planning CLI deterministic without models, dispatch, journal or code receipts',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'asds-plan-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'tasks.json');fs.writeFileSync(file,JSON.stringify(nested()));
 const run=command=>spawnSync(process.execPath,['scripts/plan.mjs',command,file],{encoding:'utf8'});
 const first=run('validate'),second=run('validate');assert.equal(first.status,0,first.stderr);assert.equal(second.stdout,first.stdout);
 assert.equal(run('dag').status,0);assert.equal(run('recommend').status,0);assert.deepEqual(fs.readdirSync(dir),['tasks.json']);
 for(const invalid of [[node('A',{write:['a/../shared.js']}),node('B',{write:['shared.js']})],
  [node('A'),node('B',{dependsOn:['A'],dependencyDetails:undefined})]]) {
  fs.writeFileSync(file,JSON.stringify(invalid));
  for(const command of ['validate','dag','recommend']) {
   const rejected=run(command);assert.equal(rejected.status,1);assert.equal(rejected.stdout,'');
   assert.match(rejected.stderr,/unsafe write path|dependencyDetails/);
  }
 }
 const model=spawnSync(process.execPath,['scripts/plan.mjs','dag','examples/planning-delivery/complete'],{encoding:'utf8'});assert.equal(model.status,0,model.stderr);assert.match(model.stdout,/P01 · package/);
 const source=fs.readFileSync('scripts/plan.mjs','utf8');assert.doesNotMatch(source,/host-bridge|orchestration|createJournal|dispatch\(/);
});
