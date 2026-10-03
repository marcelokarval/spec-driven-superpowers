import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTasks } from '../lib/contracts.mjs';
import { compilePlan, createJournal, appendEvent, replay, readyWave, continuation } from '../lib/orchestration.mjs';
const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nObservable result.\n`).join('\n');
const boundary={change:'Change button color',target:'Button X normal state',exclusions:['Other states'],review:{source:'coordinator inspection',verdict:'ready'}};
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const caps={spawn:true,isolatedWrites:true,maxAgents:4,externalActive:0,models:[{model:'e',efforts:['high']},{model:'r',efforts:['medium']}]};
const task=(id,extra={})=>({id,dependsOn:[],write:['button.js'],resources:[],scenarios:['ui/color'],verification:['check'],kind:'implementation',openDecisions:[],body,contractRevision:id,orchestration:{complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'one behavior',skills:['review'],references:['spec'],claims:[]},...extra});
const plan=tasks=>compilePlan(tasks,profile,{allowUnready:true});
const journal=tasks=>createJournal(plan(tasks),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'button'}});
const emit=(j,e)=>appendEvent(j,e,j.events.length);
const pkg=()=>task('P',{nodeType:'package'});
const child=(id='A',extra={})=>task(id,{nodeType:'task',parentId:'P',boundary,...extra});
const receipt=t=>({status:'integrated',contractRevision:t.contractRevision,baseRevision:'base',revision:'D',changedFiles:[],evidence:[{command:'check',exitCode:0,revision:'D'}],reviews:{spec:'D',quality:'D',independent:true},integrationRevision:'I',integrationEvidence:[{command:'check',exitCode:0,revision:'I'}],integrationReviews:{spec:'I',quality:'I',independent:true}});
function finish(j,id){
 const t=replay(j).plan.tasks.find(t=>t.id===id),r=receipt(t),ctx={fresh:true,inheritedHistory:false,source:'fixture'};
 for(const e of [
 {type:'dispatch',role:'executor',session:`e-${id}`,context:ctx,capabilities:caps},
 {type:'deliver',session:`e-${id}`,stopped:true,receipt:{...r,status:'delivered'}},
 {type:'dispatch',role:'reviewer',session:`r-${id}`,context:ctx,capabilities:caps},
 {type:'reviewResult',session:`r-${id}`,stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['candidate checked']},
 {type:'beginIntegration',capabilities:caps},
 {type:'integrate',integrationRevision:'I',integrationEvidence:r.integrationEvidence},
 {type:'dispatch',role:'reviewer',session:`i-${id}`,context:ctx,capabilities:caps},
 {type:'reviewResult',session:`i-${id}`,stopped:true,revision:'I',verdict:'pass',findings:[],evidence:['integration checked']},
 {type:'decide',disposition:'accepted',reason:'matches contract',checks:{scope:'yes',behavior:'yes',independence:'yes',integration:'yes',authority:'yes'},limitations:[]}
 ])j=emit(j,{taskId:id,...e});return j;
}
test('legacy plans still compile; explicit task needs reviewed boundary and package is never dispatched',()=>{
 assert.equal(compilePlan([task('old')],profile).version,1);
 const j=journal([pkg(),child()]);assert.equal(replay(j).plan.version,3);
 assert.deepEqual(readyWave(j,caps).selected,['A']);
 assert.throws(()=>compilePlan([child('A',{parentId:undefined,boundary:undefined})],profile),/bounded/);
 assert.equal(replay(createJournal(compilePlan([pkg(),child()],profile),{coordinator:'r',readScope:['project'],authorization:{source:'u',scope:'x'}})).plan.version,3);
});
test('coverage, inherited dependencies, nesting, scope and effective dependency cycles fail closed',()=>{
 for(const tasks of [[pkg()],[pkg(),child('A',{scenarios:['ui/other']})],[pkg(),child('A',{write:['else.js']})],[pkg(),child('A',{dependsOn:['P']})],[pkg(),child('A',{nodeType:'package'})],[pkg(),child('A',{parentId:'missing'})]])assert.ok(validateTasks(tasks).length);
 assert.ok(validateTasks([task('before'),pkgWithDependency(),child()]).some(x=>x.includes('inherited')));
 function pkgWithDependency(){return task('P',{nodeType:'package',dependsOn:['before']});}
});
test('decomposition preserves independent acceptance, original contract and historical events',()=>{
 let j=finish(createJournal(compilePlan([task('P'),task('independent')],profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'button'}}),'independent');
 const proposed=plan([pkg(),child(),task('independent')]);
 j=emit(j,{type:'decompose',taskId:'P',plan:proposed,reason:'multiple separable outcomes',authorization:{source:'existing user grant',scope:'button'}});
 assert.equal(replay(j).tasks.independent.status,'accepted');assert.equal(replay(j).tasks.P.status,'pending');
 assert.ok(j.events.length>1);assert.deepEqual(readyWave(j,caps).selected,['A']);
 assert.throws(()=>emit(j,{type:'acceptPackage',taskId:'P',receipt:receipt(pkg()),reason:'count',limitations:[]}),/children/);
});
test('decomposition refuses scope expansion and active workers',()=>{
 let j=journal([task('P')]);
 assert.throws(()=>emit(j,{type:'decompose',taskId:'P',plan:plan([task('P',{nodeType:'package',body:body+'NEW REQUIREMENT'}),child()]),reason:'split',authorization:{source:'u',scope:'button'}}),/preserve/);
 j=emit(j,{type:'dispatch',taskId:'P',role:'executor',session:'worker',context:{fresh:true,inheritedHistory:false,source:'fixture'},capabilities:caps});
 assert.throws(()=>emit(j,{type:'decompose',taskId:'P',plan:plan([pkg(),child()]),reason:'split',authorization:{source:'u',scope:'button'}}),/stop worker/);
});
test('children complete is not package complete; integrated evidence gates acceptance and downstream work',()=>{
 let j=journal([pkg(),child(),task('next',{dependsOn:['P']})]);j=finish(j,'A');
 assert.equal(replay(j).tasks.P.status,'pending');assert.ok(!readyWave(j,caps).selected.includes('next'));
 assert.ok(continuation(j,caps).actions.some(a=>a.operation==='packageAcceptance'));
 assert.throws(()=>emit(j,{type:'acceptPackage',taskId:'P',receipt:{...receipt(pkg()),integrationReviews:undefined},reason:'done',limitations:[]}),/independent/);
 j=emit(j,{type:'acceptPackage',taskId:'P',receipt:receipt(pkg()),reason:'combined behavior checked',limitations:[]});
 assert.deepEqual(readyWave(j,caps).selected,['next']);
 j=emit(j,{type:'reopen',taskId:'A',reason:'new counterexample'});
 assert.notEqual(replay(j).tasks.P.status,'accepted');assert.notEqual(replay(j).tasks.next.status,'accepted');
});
test('refining a child creates siblings, redirects dependents and preserves independent acceptance',()=>{
 const before=[pkg(),child(),child('B',{dependsOn:['A']}),task('independent')];
 let j=finish(journal(before),'independent');
 const next=[pkg(),child('A',{body:body+'Narrowed color token.',contractRevision:'new-A'}),child('A2',{body:body+'Narrowed hover preservation.'}),child('B',{dependsOn:['A','A2']}),task('independent')];
 j=emit(j,{type:'refine',taskId:'A',plan:plan(next),reason:'two separable changes',coverageReview:'all original requirements mapped to A and A2',authorization:{source:'existing grant',scope:'button'}});
 assert.equal(replay(j).tasks.independent.status,'accepted');
 assert.equal(replay(j).plan.tasks.filter(t=>t.parentId==='P').length,3);
 assert.ok(!readyWave(j,caps).selected.includes('B'));
 const wrong=next.map(t=>t.id==='B'?{...t,dependsOn:['A']}:t);
 assert.throws(()=>emit(journal(before),{type:'refine',taskId:'A',plan:plan(wrong),reason:'split',coverageReview:'checked',authorization:{source:'u',scope:'button'}}),/redirect/);
});
test('unready package never offers impossible acceptance and DAG includes completion edges',async()=>{
 const {renderDag}=await import('../lib/orchestration.mjs');
 let j=journal([task('P',{nodeType:'package',openDecisions:['integration environment']}),child()]);j=finish(j,'A');
 assert.ok(!continuation(j,caps).actions.some(a=>a.operation==='packageAcceptance'));
 assert.equal(continuation(j,caps).disposition,'blocked');
 assert.match(renderDag(replay(j).plan),/P · package/);assert.match(renderDag(replay(j).plan),/t0 --> t1/);
});
test('decomposition cannot erase boundary requirements on an unrelated task',()=>{
 const j=journal([task('P'),task('other',{nodeType:'task'})]);
 assert.throws(()=>emit(j,{type:'decompose',taskId:'P',plan:plan([pkg(),child(),task('other')]),reason:'split',authorization:{source:'u',scope:'button'}}),/sibling/);
});
test('20 leaves can become 50 under the existing grant without nesting or losing identities',()=>{
 const leaves=Array.from({length:20},(_,i)=>child(`A${i}`));const j=journal([pkg(),...leaves]);
 const added=Array.from({length:30},(_,i)=>child(`part${i}`));
 const next=plan([pkg(),...leaves,...added]);
 const result=emit(j,{type:'refine',taskId:'A0',plan:next,reason:'separate independently verifiable results',coverageReview:'original scenarios conserved',authorization:{source:'original user grant',scope:'button'}});
 assert.equal(replay(result).plan.tasks.filter(t=>t.nodeType==='task').length,50);
 assert.ok(leaves.every(t=>replay(result).tasks[t.id]));
});
test('package approval criteria and paused coordination cannot be bypassed at closure',()=>{
 const p=task('P',{nodeType:'package',approvalCriteria:[{id:'color',source:'user',criterion:'approved color',verification:'visual'}]});
 let j=finish(journal([p,child()]),'A');const accept={type:'acceptPackage',taskId:'P',receipt:receipt(p),reason:'integrated',limitations:[]};
 assert.throws(()=>emit(j,accept),/approval criterion/);
 accept.approvalEvidence=[{id:'color',source:'user',contractRevision:p.contractRevision,revision:'I',verdict:'pass',evidence:'comparison'}];
 assert.equal(replay(emit(j,accept)).tasks.P.status,'accepted');
 j=emit(j,{type:'pause',source:'user',reason:'stop'});assert.throws(()=>emit(j,accept),/unavailable/);
});
