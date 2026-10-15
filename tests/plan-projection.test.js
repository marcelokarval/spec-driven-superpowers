import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjection, projectRuntimeProjection, scopePlanningProjection } from '../lib/plan-projection.mjs';
import { projectTaskManager } from '../lib/planning-graph.mjs';
import { createHash } from 'node:crypto';
test('existing plan projection binds IDs and approval references to canonical sources; drift rejected',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-plan-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'TASKS.md'),'# Work\n- [ ] T01 — component\n');
 const hash=()=>createHash('sha256').update(fs.readFileSync(path.join(root,'TASKS.md'))).digest('hex');
 const projection={version:1,root,canonicalIndex:'TASKS.md',sources:[{path:'TASKS.md',sha256:hash()}],tasks:[{id:'T01',source:{path:'TASKS.md',anchor:'T01 — component'},dependsOn:[],write:[],resources:[],scenarios:['ui/pill'],verification:['test']}]};
 const file=path.join(root,'projection.json');fs.writeFileSync(file,JSON.stringify(projection));
 assert.equal(loadProjection(file)[0].id,'T01'); assert.ok(loadProjection(file)[0].contractRevision);
 fs.appendFileSync(path.join(root,'TASKS.md'),'changed criterion');
 assert.throws(()=>loadProjection(file),/source changed/);
 fs.writeFileSync(file,JSON.stringify({...projection,sources:[{path:'TASKS.md',sha256:hash()}],tasks:[{...projection.tasks[0],source:{path:'TASKS.md',anchor:'missing'}}]}));
 assert.throws(()=>loadProjection(file),/anchor/);
});

const task=(id,dependsOn=[],write=[`${id}.js`])=>({id,title:id,owner:`owner-${id}`,nodeType:'task',dependsOn,
 dependencyDetails:dependsOn.map(dependency=>({id:dependency,reason:'required',requiredOutput:'accepted output'})),
 write,resources:[],scenarios:[`scenario-${id}`],requirements:[`requirement-${id}`],verification:[`verify-${id}`],
 decisionInputs:[],resolvesDecisions:[]});
const event=(sequence,type,taskId,extra={})=>({sequence,type,taskId,...extra});

test('runtime projection is derived from journal v3 without mutating planning bytes',()=>{
 const planning=projectTaskManager([task('A'),task('B',['A']),task('C')]);
 const before=JSON.stringify(planning);
 const requested=projectRuntimeProjection(planning,{version:3,events:[
  event(1,'dispatch','A',{assignment:{role:'executor',session:'worker-a'}}),
  event(2,'receiptReconciled','A',{receipt:{digest:'r-a',integrationRevision:'i-a'}}),
  event(3,'reviewRecorded','A',{review:{stage:'integration',verdict:'pass',revision:'i-a'}}),
  event(4,'accepted','A',{acceptance:{receiptDigest:'r-a',revision:'i-a'}}),
  event(5,'progressRequested','A',{receiptDigest:'r-a'}),
 ]});
 assert.equal(JSON.stringify(planning),before);
 assert.equal(requested.version,'asds.runtime-task-manager-projection/1');
 assert.deepEqual(requested.progressPendingTaskIds,['A']);
 assert.deepEqual(requested.waitingTaskIds,['B']);
 assert.deepEqual(requested.readyTaskIds,['C']);
 assert.deepEqual(requested.tasks.find(item=>item.id==='A').assignments,[{role:'executor',session:'worker-a'}]);
 assert.deepEqual(requested.tasks.find(item=>item.id==='A').receipts,[{digest:'r-a',integrationRevision:'i-a'}]);
 const committed=projectRuntimeProjection(planning,{version:3,events:[
  event(1,'progressRequested','A',{receiptDigest:'r-a'}),event(2,'progressCommitted','A',{receiptDigest:'r-a'}),
 ]});
 assert.deepEqual(committed.completedTaskIds,['A']);
 assert.deepEqual(committed.readyTaskIds,['B','C']);
 assert.deepEqual(committed.tasks.find(item=>item.id==='B').waitingOn,[]);
});

test('runtime projection accepts journal envelope entries produced by append-only replay',()=>{
 const planning=projectTaskManager([task('A')]);
 const runtime=projectRuntimeProjection(planning,{version:3,events:[
  {sequence:1,previous:'header',digest:'entry-1',event:{type:'progressRequested',taskId:'A',receiptDigest:'r-a'}},
  {sequence:2,previous:'entry-1',digest:'entry-2',event:{type:'progressCommitted',taskId:'A',receiptDigest:'r-a'}},
 ]});
 assert.deepEqual(runtime.completedTaskIds,['A']);
 assert.equal(runtime.journalSequence,2);
});

test('runtime projection handles partial exclusion, blockers and conflicts from one canonical DAG',()=>{
 const scope={consumableTaskIds:['A','B','C'],excludedTaskIds:['D']};
 const planning=scopePlanningProjection(projectTaskManager([task('A'),task('B',['A']),task('C',[],['same.ts']),task('D',[],['same.ts'])]),scope,
  {D:[{kind:'blocker',id:'PB-D'}]});
 const blocked=projectRuntimeProjection(planning,{version:3,events:[
  event(1,'blocked','A',{blocker:{id:'OP1',owner:'operator',reason:'service unavailable'}}),
 ]},scope);
 assert.deepEqual(blocked.excludedTaskIds,['D']);
 assert.deepEqual(blocked.blockedTaskIds,['A','B']);
 assert.equal(blocked.tasks.find(item=>item.id==='D').status,'excluded');
 assert.deepEqual(blocked.tasks.find(item=>item.id==='C').serializesWith,['D']);
 assert.deepEqual(blocked.tasks.find(item=>item.id==='A').blocks,['B']);
 assert.throws(()=>projectRuntimeProjection(planning,{version:3,events:[]},{consumableTaskIds:['A','B','D'],excludedTaskIds:['C']}),/does not match planning projection/);
});

test('runtime projection consumes the approved EC-01 restricted partial manager',()=>{
 const full=projectTaskManager([task('A'),task('B',['A'])]);
 const partial=scopePlanningProjection(full,{consumableTaskIds:['A'],excludedTaskIds:['B']},{B:[{kind:'blocker',id:'PB1',owner:'planner',resolution:'revise'}]});
 const runtime=projectRuntimeProjection(partial,{version:3,events:[]});
 assert.deepEqual(runtime.readyTaskIds,['A']);
 assert.deepEqual(runtime.excludedTaskIds,['B']);
 assert.deepEqual(runtime.tasks.find(item=>item.id==='A').blocks,['B']);
});

test('partial scope compacts empty waves and renumbers remaining consumable tasks deterministically',()=>{
 const full=projectTaskManager([task('A',[],['same.js']),task('B',[],['same.js'])]);
 const scoped=scopePlanningProjection(full,{consumableTaskIds:['B'],excludedTaskIds:['A']},{A:[{kind:'blocker',id:'PB-A'}]});
 assert.deepEqual(scoped.plannedWaves,[['B']]);
 assert.equal(scoped.tasks.find(item=>item.id==='B').wave,1);
 assert.equal(scoped.tasks.find(item=>item.id==='A').status,'excluded');
});

test('planning projection requires exact excluded bijection and complete wave coverage',()=>{
 const full=projectTaskManager([task('A'),task('B')]);
 const scope={consumableTaskIds:['A'],excludedTaskIds:['B']};
 const scoped=scopePlanningProjection(full,scope,{B:[{kind:'blocker',id:'PB-B'}]});
 for(const mutate of [
  value=>{value.tasks.find(item=>item.id==='B').status='ready';},
  value=>{value.excludedTaskIds=[];},
  value=>{value.tasks.find(item=>item.id==='A').status='excluded';},
 ]) {
  const drift=structuredClone(scoped);mutate(drift);
  assert.throws(()=>projectRuntimeProjection(drift,{version:3,events:[]},scope),/excluded|status/i);
 }
 for(const mutate of [
  value=>{value.plannedWaves=[['A','missing']];},
  value=>{value.plannedWaves=[['A'],['A']];},
  value=>{value.plannedWaves=[];},
  value=>{value.tasks.find(item=>item.id==='A').wave=2;},
 ]) {
  const drift=structuredClone(scoped);mutate(drift);
  assert.throws(()=>projectRuntimeProjection(drift,{version:3,events:[]},scope),/wave/i);
 }
 assert.throws(()=>projectRuntimeProjection(scoped,{version:3,events:[]},{consumableTaskIds:['A','B'],excludedTaskIds:[]}),/does not match planning projection/);
});

test('planning projection rejects conflict, serialization and parallelism drift',()=>{
 const conflict=projectTaskManager([task('A',[],['shared.ts']),task('B',[],['shared.ts']),task('C',[],['c.ts'])]);
 const probes=[
  [value=>{value.conflicts=[];},/conflict/i],
  [value=>{value.tasks.find(item=>item.id==='A').serializesWith=[];},/serializesWith/],
  [value=>{value.tasks.find(item=>item.id==='A').serializesWith.push('C');value.tasks.find(item=>item.id==='C').serializesWith.push('A');},/serializesWith/],
  [value=>{value.tasks.find(item=>item.id==='A').parallelWith=['B'];value.tasks.find(item=>item.id==='B').parallelWith=['A'];},/parallelWith/],
  [value=>{value.plannedWaves=[['A','B','C']];for(const item of value.tasks)item.wave=1;value.tasks.find(item=>item.id==='A').parallelWith=['B','C'];value.tasks.find(item=>item.id==='B').parallelWith=['A','C'];value.tasks.find(item=>item.id==='C').parallelWith=['A','B'];},/conflict|parallelWith/],
  [value=>{value.tasks.find(item=>item.id==='B').write=['b.ts'];},/conflict/],
 ];
 for(const [mutate,pattern] of probes) {const drift=structuredClone(conflict);mutate(drift);assert.throws(()=>projectRuntimeProjection(drift,{version:3,events:[]}),pattern);}
 const dependent=projectTaskManager([task('A'),task('B',['A'])]);
 const reversed=structuredClone(dependent);reversed.plannedWaves=[['B'],['A']];reversed.tasks.find(item=>item.id==='A').wave=2;reversed.tasks.find(item=>item.id==='B').wave=1;
 assert.throws(()=>projectRuntimeProjection(reversed,{version:3,events:[]}),/dependency.*wave/i);
 const crossWave=structuredClone(dependent);crossWave.tasks.find(item=>item.id==='A').parallelWith=['B'];crossWave.tasks.find(item=>item.id==='B').parallelWith=['A'];
 assert.throws(()=>projectRuntimeProjection(crossWave,{version:3,events:[]}),/parallelWith/);
 const resourceTasks=[task('R1',[],['r1.ts']),task('R2',[],['r2.ts'])];resourceTasks[0].resources=['database'];resourceTasks[1].resources=['DATABASE'];
 const resourceConflict=projectTaskManager(resourceTasks),missingResourceConflict=structuredClone(resourceConflict);missingResourceConflict.conflicts=[];
 assert.throws(()=>projectRuntimeProjection(missingResourceConflict,{version:3,events:[]}),/conflict/i);
});

test('planning status is derived exactly from exclusions, blockers and waiting dependencies',()=>{
 const planning=projectTaskManager([task('A'),task('B',['A']),task('C')],{blockers:[{id:'PB-C',affectedTasks:['C']}]});
 const probes=[
  ['ready with waitingOn',value=>{value.tasks.find(item=>item.id==='B').status='ready';value.waitingTaskIds=[];value.readyTaskIds.push('B');}],
  ['blocked without blocker',value=>{const item=value.tasks.find(taskItem=>taskItem.id==='A');item.status='blocked';value.readyTaskIds=[];value.blockedTaskIds.unshift('A');}],
  ['waiting without dependency',value=>{const item=value.tasks.find(taskItem=>taskItem.id==='A');item.status='waiting';value.readyTaskIds=[];value.waitingTaskIds.unshift('A');}],
  ['ready with blocker',value=>{const item=value.tasks.find(taskItem=>taskItem.id==='C');item.status='ready';value.blockedTaskIds=[];value.readyTaskIds.push('C');}],
  ['waiting with blocker',value=>{const item=value.tasks.find(taskItem=>taskItem.id==='C');item.status='waiting';value.blockedTaskIds=[];value.waitingTaskIds.push('C');}],
 ];
 for(const [label,mutate] of probes) {const drift=structuredClone(planning);mutate(drift);assert.throws(()=>projectRuntimeProjection(drift,{version:3,events:[]}),new RegExp(`status.*${label.split(' ')[0]}|${label.split(' ')[0]}.*status`,'i'));}
 const scoped=scopePlanningProjection(projectTaskManager([task('X'),task('Y')]),{consumableTaskIds:['X'],excludedTaskIds:['Y']},{Y:[{kind:'blocker',id:'PB-Y'}]});
 for(const field of ['waitingOn','blockedBy']) {const drift=structuredClone(scoped);drift.tasks.find(item=>item.id==='Y')[field]=['X'];assert.throws(()=>projectRuntimeProjection(drift,{version:3,events:[]}),/excluded.*waitingOn.*blockedBy/i);}
});

test('planning relation arrays require valid unique canonical string IDs',()=>{
 const tasks=[task('A'),task('B'),task('C',['A','B'])];tasks[2].decisionInputs=['D1','D2'];tasks[2].resolvesDecisions=['D3','D4'];
 const planning=projectTaskManager(tasks,{blockers:[{id:'BL1',affectedTasks:['C']},{id:'BL2',affectedTasks:['C']}]});
 const probes=[
  value=>{value.tasks.find(item=>item.id==='C').waitingOn=['A','A'];},
  value=>{value.tasks.find(item=>item.id==='C').waitingOn=['B','A'];},
  value=>{value.tasks.find(item=>item.id==='C').waitingOn=['A',42];},
  value=>{value.tasks.find(item=>item.id==='C').waitingOn=['A','missing'];},
  value=>{value.tasks.find(item=>item.id==='A').blocks=['C','C'];},
  value=>{value.tasks.find(item=>item.id==='A').blocks=[null];},
  value=>{value.tasks.find(item=>item.id==='A').blocks=['missing'];},
  value=>{value.tasks.find(item=>item.id==='C').blockedBy=['BL2','BL1'];},
  value=>{value.tasks.find(item=>item.id==='C').blockedBy=['BL1','BL1'];},
  value=>{value.tasks.find(item=>item.id==='C').blockedBy=['BL1',{}];},
  value=>{value.tasks.find(item=>item.id==='C').decisionInputs=['D2','D1'];},
  value=>{value.tasks.find(item=>item.id==='C').decisionInputs=['D1','D1'];},
  value=>{value.tasks.find(item=>item.id==='C').decisionInputs=['D1',false];},
  value=>{value.tasks.find(item=>item.id==='C').resolvesDecisions=['D4','D3'];},
  value=>{value.tasks.find(item=>item.id==='C').resolvesDecisions=['bad/id'];},
 ];
 for(const mutate of probes) {const drift=structuredClone(planning);mutate(drift);assert.throws(()=>projectRuntimeProjection(drift,{version:3,events:[]}),/relation|waitingOn|blockedBy|blocks|decision/i);}
 assert.throws(()=>scopePlanningProjection(projectTaskManager([task('X'),task('Y'),task('Z')]),
  {consumableTaskIds:['Y','X'],excludedTaskIds:['Z']},{Z:[{kind:'blocker',id:'PB-Z'}]}),/canonically ordered/);
});

test('partial projection removes excluded parallel peers but preserves canonical conflicts symmetrically',()=>{
 const full=projectTaskManager([task('A',[],['a.ts']),task('B',[],['b.ts']),task('C',[],['shared.ts']),task('D',[],['shared.ts'])]);
 const scoped=scopePlanningProjection(full,{consumableTaskIds:['A','C'],excludedTaskIds:['B','D']},{B:[{kind:'blocker',id:'PB-B'}],D:[{kind:'blocker',id:'PB-D'}]});
 assert.deepEqual(scoped.tasks.find(item=>item.id==='A').parallelWith,['C']);
 assert.deepEqual(scoped.tasks.find(item=>item.id==='B').parallelWith,[]);
 assert.deepEqual(scoped.tasks.find(item=>item.id==='C').serializesWith,['D']);
 assert.deepEqual(scoped.tasks.find(item=>item.id==='D').serializesWith,['C']);
 const asymmetric=structuredClone(scoped);asymmetric.tasks.find(item=>item.id==='D').serializesWith=[];
 assert.throws(()=>projectRuntimeProjection(asymmetric,{version:3,events:[]}),/serializesWith/);
 const missingConflict=structuredClone(scoped);missingConflict.conflicts=[];
 assert.throws(()=>projectRuntimeProjection(missingConflict,{version:3,events:[]}),/conflict/);
});

test('runtime projection fails closed on drift and never infers completion from checkboxes',()=>{
 const planning=projectTaskManager([task('A'),task('B',['A'])]);
 assert.throws(()=>projectRuntimeProjection(planning,{version:2,events:[]}),/journal v3/);
 assert.throws(()=>projectRuntimeProjection(planning,{version:3,events:[],checkboxes:{A:true}}),/unknown runtime input/);
 assert.throws(()=>projectRuntimeProjection(planning,{version:3,events:[event(2,'progressRequested','A',{receiptDigest:'r'})]}),/sequence/);
 assert.throws(()=>projectRuntimeProjection(planning,{version:3,events:[event(1,'progressCommitted','A',{receiptDigest:'r'})]}),/progressRequested/);
 assert.throws(()=>projectRuntimeProjection(planning,{version:3,events:[event(1,'progressRequested','missing',{receiptDigest:'r'})]}),/unknown task/);
 assert.throws(()=>projectRuntimeProjection(projectTaskManager([task('A')],{completedTaskIds:['A']}),{version:3,events:[]}),/cannot contain runtime progress/);
 const pending=projectRuntimeProjection(planning,{version:3,events:[event(1,'progressRequested','A',{receiptDigest:'r'})]});
 assert.deepEqual(pending.completedTaskIds,[]);
 assert.equal(pending.tasks.find(item=>item.id==='B').status,'waiting');
 const drift=structuredClone(planning);drift.tasks[0].blocks=[];
 assert.throws(()=>projectRuntimeProjection(drift,{version:3,events:[]}),/planning projection/);
});
