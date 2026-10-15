import test from 'node:test';
import assert from 'node:assert/strict';
import {hostCompleteReview,hostDispatch,hostIntegrate,hostCommitProgress,observeHostContract} from '../lib/host-bridge.mjs';
import {compilePlan,createJournal,appendEvent,replay,digest} from '../lib/orchestration.mjs';
const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nConcrete.\n`).join('');
const task={id:'a',kind:'implementation',openDecisions:[],body,dependsOn:[],write:['a'],resources:[],scenarios:['a/b'],verification:['test'],contractRevision:'original',orchestration:{complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'bounded',skills:['tdd'],references:['source'],claims:[]}};
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const caps={spawn:true,isolatedWrites:true,maxAgents:2,externalActive:0,models:[{model:'e',efforts:['high']}]};
const workspace={projectRootRealpath:'/project',workspaceId:'continuity',repoIdentity:{vcs:'git',rootRealpath:'/project',commonDirRealpath:'/repo/.git',baseRevision:'B'},currentFingerprint:'F',source:'fixture'};
const boundary={enforced:true,projectReadOnly:true,brokers:['journal','evidence','progress'],coordinator:'root',violations:[],source:'fixture'};
const matrix=Object.fromEntries(['verifyHostObservation','withCapabilityLease','observeCapabilities','observeWorkspace','enforceCoordinatorBoundary','authorize','prepareIntent','prepare','start','observeStop','snapshot','interrupt','integrate','persistEvidence','commitProgress','cancelPrepared','persistStartState','observeStartState','persistIntegrationState','observeIntegrationState','persistProgressState','observeProgressState'].map(name=>[name,{state:'observed',source:'fixture'}]));
const bindingEcho=request=>({operation:request.operation,actor:request.actor,session:request.session,role:request.role,projectRootRealpath:request.projectRootRealpath,taskId:request.taskId,requestedRole:request.requestedRole,writeScope:request.writeScope,intent:request.intent,...(request.operationToolCall?{operationToolCall:request.operationToolCall}:{})});
const grant=request=>({granted:true,source:'user',scope:request.projectRootRealpath,...bindingEcho(request)});
const host=overrides=>{
 let generation=0,startCounter=0;const startStates=new Map(),customObserve=overrides.observeCapabilities,customLease=overrides.withCapabilityLease;
 const result={
  verifyHostObservation:async({observation})=>typeof observation?.source==='string'&&observation.source!=='caller',observeWorkspace:async()=>workspace,enforceCoordinatorBoundary:async()=>boundary,
  prepareIntent:async request=>({intent:`intent:${request.taskId}:${request.requestedRole}`,actor:'fresh',session:'fresh',role:request.requestedRole,...request,operationToolCall:{id:'call',operation:request.toolOperation,actor:'fresh',session:'fresh',role:request.requestedRole,source:'host'},source:'host'}),
  cancelPrepared:async()=>({cancelled:true,source:'host'}),
  persistStartState:async request=>{if(request.status==='requested'){const state={...request,requestId:`start-${++startCounter}`,source:'host'};startStates.set(state.requestId,state);return state;}const prior=startStates.get(request.requestId),state={...prior,status:request.status,...(request.workspace?{workspace:request.workspace}:{}),source:'host'};startStates.set(state.requestId,state);return state;},
  observeStartState:async({requestId})=>startStates.get(requestId),...overrides,
 };
 result.observeCapabilities=async args=>{const raw=customObserve?await customObserve(args):{runtime:caps,matrix,source:'fixture'};return {...raw,lease:raw.lease??{generation:++generation,token:`fixture-${generation}`,source:'fixture'}};};
 result.withCapabilityLease=customLease??(async(request,operation)=>({status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'}));return result;
};
test('host refuses source drift during awaited authorization before appending dispatch',async()=>{
 let tasks=[task],j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'},workspaceBinding:workspace}),calls=0,started=false,cancelled=false;
 const store={read:()=>j,append:(e,n)=>{j=appendEvent(j,e,n);return j;}};
 await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host:host({authorize:async request=>{if(++calls===2) tasks=[{...task,contractRevision:'changed'}];return grant(request);},prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'standby'},preparedOnly:true}),cancelPrepared:async()=>{cancelled=true;return {cancelled:true,source:'host'};},start:async()=>{started=true;return {session:'fresh',toolCall:'call',source:'host'};}})}),/contracts/);
 assert.equal(started,false);assert.equal(cancelled,false);assert.equal(replay(j).tasks.a.active.session,'fresh');
});
test('pause persisted after dispatch but before start retains reservation without starting',async()=>{
 let j=createJournal(compilePlan([task],profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'},workspaceBinding:workspace}),started=false;
 const store={read:()=>j,append:(e,n)=>{j=appendEvent(j,e,n);j=appendEvent(j,{type:'pause',source:'user',reason:'stop execution'},j.events.length);return j;}};
 await assert.rejects(hostDispatch({store,loadTasks:()=>[task],taskId:'a',role:'executor',host:host({authorize:async request=>grant(request),prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'standby'},preparedOnly:true}),start:async()=>{started=true;return {session:'fresh',toolCall:'call',source:'host'};}})}),/paused/);
 assert.equal(started,false);assert.equal(replay(j).tasks.a.active.session,'fresh');
});
test('canonical checkbox progress preserves projected contracts; changed wording invalidates',async t=>{
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const {createHash}=await import('node:crypto');const {loadProjection}=await import('../lib/plan-projection.mjs');
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'asds-progress-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source='- [ ] a — deliver\n';const index=path.join(root,'TASKS.md');fs.writeFileSync(index,source);
 const file=path.join(root,'projection.json');fs.writeFileSync(file,JSON.stringify({version:1,root,canonicalIndex:'TASKS.md',sources:[{path:'TASKS.md',sha256:createHash('sha256').update(source).digest('hex')}],tasks:[{...task,source:{path:'TASKS.md',anchor:'a — deliver'}}]}));
 const revision=loadProjection(file)[0].contractRevision;
 fs.writeFileSync(index,source.replace('[ ]','[x]'));
 assert.equal(loadProjection(file)[0].contractRevision,revision);
 fs.writeFileSync(index,source.replace('deliver','different outcome'));
 assert.throws(()=>loadProjection(file),/source changed/);
});
test('pending stop after reservation must not start its worker',async()=>{
 let j=createJournal(compilePlan([task],profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'},workspaceBinding:workspace}),started=false;
 const store={read:()=>j,append:(e,n)=>{j=appendEvent(j,e,n);j=appendEvent(j,{type:'stop',taskId:'a',session:'fresh',stopped:false,reason:'cancel requested'},j.events.length);return j;}};
 await assert.rejects(hostDispatch({store,loadTasks:()=>[task],taskId:'a',role:'executor',host:host({authorize:async request=>grant(request),prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'standby'},preparedOnly:true}),start:async()=>{started=true;return {session:'fresh',toolCall:'call',source:'host'};}})}),/state/);
 assert.equal(started,false);assert.equal(replay(j).tasks.a.active.session,'fresh');
});

test('realpath/repository swap and coordinator mutation are fail-closed',async()=>{
 for(const observation of [
  {...workspace,projectRootRealpath:'/other',repoIdentity:{...workspace.repoIdentity,rootRealpath:'/other'}},
  {...workspace,repoIdentity:{...workspace.repoIdentity,commonDirRealpath:'/other/.git'}},
 ]) await assert.rejects(observeHostContract(host({observeWorkspace:async()=>observation}),{expectedWorkspace:workspace,coordinator:'root'}),/workspace.*drift/i);
 const result=await observeHostContract(host({enforceCoordinatorBoundary:async()=>({...boundary,violations:[{kind:'project_write',path:'product.js'}]})}),{expectedWorkspace:workspace,coordinator:'root'});
 assert.equal(result.status,'manual_handoff_required');
});

test('review snapshot drift is rejected even when reviewer prose says pass',async()=>{
 const reviewTask={...task,write:['a.js']};let j=createJournal(compilePlan([reviewTask],profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'},workspaceBinding:workspace});
 const store={read:()=>j,append:(e,n)=>{j=appendEvent(j,e,n);return j;}};
 const before={revision:'D',changedFiles:['a.js'],scopeFingerprint:'S'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'original',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 store.append({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:before}},2);
 await assert.rejects(hostCompleteReview({store,loadTasks:()=>[reviewTask],taskId:'a',result:{revision:'D',verdict:'pass',findings:[],evidence:['prose']},host:host({observeStop:async()=>({session:'r',stopped:true,outcome:'completed',source:'host'}),snapshot:async()=>({...before,scopeFingerprint:'DRIFT',source:'host'})})}),/drift/i);
});
test('progress normalization preserves code literals and supports declared list markers',async()=>{
 const {projectionSourceDigest}=await import('../lib/plan-projection.mjs');
 for(const marker of ['-','*','+','1.','2)']) {
  assert.equal(projectionSourceDigest(`${marker} [ ] T01 — task\n`,true),projectionSourceDigest(`${marker} [x] T01 — task\n`,true));
 }
 assert.notEqual(projectionSourceDigest('- [ ] SECURITY APPROVAL REVOKED\n',true),projectionSourceDigest('- [x] SECURITY APPROVAL REVOKED\n',true));
 for(const literal of ['```md\n- [ ] literal\n```\n','~~~md\n- [ ] literal\n~~~\n','    - [ ] literal\n','<pre>\n- [ ] literal\n</pre>\n']) {
  assert.notEqual(projectionSourceDigest(literal,true),projectionSourceDigest(literal.replace('[ ]','[x]'),true));
 }
});
test('new Node processes resolve integration and real checkbox progress from the reopened journal and host ledgers',async t=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{spawnSync}=await import('node:child_process');
 const {initializeStore,readStore,updateStore}=await import('../lib/orchestration-store.mjs');
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'asds-integration-restart-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const journalFile=path.join(root,'journal.json'),ledgerFile=path.join(root,'host-ledger.json'),reviewTask={...task,write:['a.js']};
 let live={...workspace,writeScope:['a.js'],toolCalls:[]},proof;
 let journal=createJournal(compilePlan([reviewTask],profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'},workspaceBinding:live});
 const event=value=>journal=appendEvent(journal,value,replay(journal).sequence),snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 event({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}});
 const evidence=revision=>[{command:'test',exitCode:0,revision,observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}];
 event({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'original',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:evidence('D')}});
 event({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snapshot}});
 event({type:'reviewResult',taskId:'a',session:'r',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot});
 initializeStore(journalFile,journal);
 const store={read:()=>readStore(journalFile),append:(value,sequence)=>updateStore(journalFile,value,sequence)};
 const integrated=await hostIntegrate({store,loadTasks:()=>[reviewTask],taskId:'a',host:host({
  observeWorkspace:async()=>live,authorize:async request=>grant(request),
  prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  persistIntegrationState:async request=>{if(request.status==='requested')assert.equal(request.workspaceBeforeDigest,digest(live));else if(request.status==='observed')assert.deepEqual(request.workspace,live);proof={...request,requestId:'durable-integration',source:'host'};fs.writeFileSync(ledgerFile,JSON.stringify({workspace:live,proof,task:reviewTask,matrix,caps,boundary}));return structuredClone(proof);},
  observeIntegrationState:async()=>proof,
  integrate:async(prepared,packet)=>{const before=structuredClone(live),call=packet.assignment.context.integrationRequest.operationToolCall;live={...live,currentFingerprint:'I',toolCalls:[...before.toolCalls,call]};return {session:prepared.session,role:'integrator',toolCall:call.id,workspaceTransition:{operation:'integrate',beforeFingerprint:'F',afterFingerprint:'I',beforeToolCalls:before.toolCalls,afterToolCalls:live.toolCalls,writeScope:['a.js'],changedPaths:['a.js'],source:'host'},source:'host'};},
 })});
 assert.equal(integrated.status,'integrated_observed');assert.equal(proof.status,'observed');
 store.append({type:'integrate',taskId:'a',session:'fresh',stopped:true,integrationRevision:'I',integrationEvidence:evidence('I')},replay(store.read()).sequence);
 const child=`
  import fs from 'node:fs';import path from 'node:path';
  import {hostDispatch,hostDispatchVerifier} from ${JSON.stringify(new URL('../lib/host-bridge.mjs',import.meta.url).href)};
  import {readStore,updateStore} from ${JSON.stringify(new URL('../lib/orchestration-store.mjs',import.meta.url).href)};
  const root=process.argv[1],file=path.join(root,'host-ledger.json'),journalFile=path.join(root,'journal.json'),data=JSON.parse(fs.readFileSync(file,'utf8')),role=data.mode==='verifier'?'verifier':'reviewer',actor=role==='verifier'?'v1':'r2';let generation=0,startState;
  const echo=request=>({operation:request.operation,actor:request.actor,session:request.session,role:request.role,projectRootRealpath:request.projectRootRealpath,taskId:request.taskId,requestedRole:request.requestedRole,writeScope:request.writeScope,intent:request.intent,operationToolCall:request.operationToolCall});
  const host={
   verifyHostObservation:async({observation})=>['host','fixture','progress-broker-host'].includes(observation?.source),
   observeCapabilities:async()=>({runtime:{...data.caps,models:[...data.caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'I'}},matrix:data.matrix,lease:{generation:++generation,token:'restart-'+generation,source:'host'},source:'host'}),
   observeWorkspace:async()=>structuredClone(data.workspace),enforceCoordinatorBoundary:async()=>data.boundary,
   observeIntegrationState:async({requestId})=>requestId===data.proof?.requestId?structuredClone(data.proof):null,
   observeStartState:async({requestId})=>structuredClone(data.starts?.[requestId]),
   observeProgressState:async({requestId})=>requestId===data.progressProof?.requestId?structuredClone(data.progressProof):null,
   authorize:async request=>({granted:true,scope:request.projectRootRealpath,...echo(request),source:'host'}),
   withCapabilityLease:async(request,operation)=>({status:'consumed',...echo(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'}),
   snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'I-scope',source:'host'}),
   prepareIntent:async request=>({intent:'restart-'+role,actor,session:actor,role,...request,operationToolCall:{id:'restart-call-'+actor,operation:'start',actor,session:actor,role,source:'host'},source:'host'}),
   prepare:async()=>({session:actor,context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
   persistStartState:async request=>{startState={...request,requestId:'restart-start-'+actor,source:'host'};data.starts??={};data.starts[startState.requestId]=startState;fs.writeFileSync(file,JSON.stringify(data));return structuredClone(startState);},
   start:async(prepared,packet)=>{const before=structuredClone(data.workspace),call=packet.assignment.context?.startRequest?.operationToolCall??startState.operationToolCall;data.workspace.toolCalls.push(call);return {session:prepared.session,toolCall:call.id,workspaceTransition:{operation:'start',beforeFingerprint:before.currentFingerprint,afterFingerprint:before.currentFingerprint,beforeToolCalls:before.toolCalls,afterToolCalls:structuredClone(data.workspace.toolCalls),writeScope:[],changedPaths:[],source:'host'},source:'host'};},
  };
  const store={read:()=>readStore(journalFile),append:(event,sequence)=>updateStore(journalFile,event,sequence)};
  const result=role==='verifier'?await hostDispatchVerifier({store,loadTasks:()=>[data.task],host}):await hostDispatch({store,loadTasks:()=>[data.task],host,taskId:'a',role});console.log(JSON.stringify({status:result.status,fingerprint:result.workspace?.currentFingerprint}));
 `;
 // First restart has a ledger whose observed proof was lost: it must not prepare.
 const saved=fs.readFileSync(ledgerFile,'utf8'),missing=JSON.parse(saved);delete missing.proof;fs.writeFileSync(ledgerFile,JSON.stringify(missing));
 const blocked=spawnSync(process.execPath,['--input-type=module','--eval',child,root],{encoding:'utf8'});
 assert.equal(blocked.status,0,blocked.stderr);assert.equal(JSON.parse(blocked.stdout).status,'manual_handoff_required');
 fs.writeFileSync(ledgerFile,saved);
 const resumed=spawnSync(process.execPath,['--input-type=module','--eval',child,root],{encoding:'utf8'});
 assert.equal(resumed.status,0,resumed.stderr);assert.deepEqual(JSON.parse(resumed.stdout),{status:'started',fingerprint:'I'});assert.equal(replay(readStore(journalFile)).tasks.a.active.session,'r2');
 const data=JSON.parse(fs.readFileSync(ledgerFile,'utf8'));live=data.workspace;
 const recoveryHost=host({
  observeWorkspace:async()=>structuredClone(live),authorize:async request=>grant(request),
  observeStartState:async({requestId})=>structuredClone(data.starts[requestId]),
  observeStop:async({session})=>({session,stopped:true,outcome:'completed',source:'host'}),
  snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'I-scope',source:'host'}),
  observeProgressState:async()=>data.progressProof?structuredClone(data.progressProof):null,
  persistProgressState:async request=>{if(request.status==='requested')assert.equal(request.workspaceBeforeDigest,digest(live));if(request.status==='observed')assert.deepEqual(request.workspace,live);data.progressProof={...request,source:'host'};data.workspace=live;fs.writeFileSync(ledgerFile,JSON.stringify(data));return structuredClone(data.progressProof);},
  commitProgress:async request=>{const {commitTaskIndexProgress}=await import('../lib/task-index-progress.mjs'),before=structuredClone(live),{canonicalIndex,taskId,indexBeforeHash,...broker}=request,result=commitTaskIndexProgress(broker);live={...live,currentFingerprint:'P'};return {beforeHash:result.event.indexBeforeHash,afterHash:result.event.indexAfterHash,changedPaths:[canonicalIndex],workspaceTransition:{operation:'progress',beforeFingerprint:before.currentFingerprint,afterFingerprint:'P',beforeToolCalls:before.toolCalls,afterToolCalls:before.toolCalls,writeScope:[canonicalIndex],changedPaths:[canonicalIndex],source:'host'},source:'host'};},
 });
 const reviewed=await hostCompleteReview({store,loadTasks:()=>[reviewTask],host:recoveryHost,taskId:'a',result:{revision:'I',verdict:'pass',findings:[],evidence:['integration review']}});assert.equal(reviewed.tasks.a.status,'forensic_pending');
 store.append({type:'decide',taskId:'a',disposition:'accepted',reason:'passed',checks:{scope:'ok',behavior:'ok',independence:'ok',integration:'ok',authority:'ok'},limitations:[]},replay(store.read()).sequence);
 const beforeIndex='- [ ] [Task a](tasks/task-a.md): deliver\n\nWave 1: a\n',index=path.join(root,'tasks.md');fs.writeFileSync(index,beforeIndex);
 const {createHash}=await import('node:crypto'),indexBeforeHash=createHash('sha256').update(beforeIndex).digest('hex'),state=replay(store.read()),progressRequested={type:'progressRequested',taskId:'a',planningRevision:state.plan.revision,contractRevision:'original',integrationRevision:'I',receiptDigest:digest(state.tasks.a.receipt),indexBeforeHash,expectedChange:{from:'[ ]',to:'[x]'}};
 const appendProgress=(event,status)=>{
  const current=store.read(),sequence=replay(current).sequence,source='progress-broker-host',indexReadback={schemaVersion:'asds.index-readback/1',token:digest(`readback:${sequence}`),source,authorityGeneration:1,journalVersion:3,journalSequence:sequence,journalEventDigest:current.events.at(-1).digest,planningRevision:progressRequested.planningRevision,candidateRevision:'D',integrationRevision:'I',reviewRevision:'I',brokerEventDigest:digest(`broker:${status}`),status,indexBeforeHash,...(status==='closed'?{indexAfterHash:event.indexAfterHash}:{})};
  const binding={kind:'progress-readback',token:indexReadback.token,source,authorityGeneration:1,journalVersion:3,journalSequence:sequence,journalEventDigest:indexReadback.journalEventDigest,planningRevision:indexReadback.planningRevision,candidateRevision:'D',integrationRevision:'I',reviewRevision:'I',payloadDigest:digest(indexReadback)},authorityConsumption={schemaVersion:'asds.host-authority-consumption/1',kind:'progress-readback',handle:digest({generation:1,token:binding.token,binding}),token:binding.token,source,authorityGeneration:1,binding};
  store.append({...event,indexReadback,authorityConsumption},sequence);
 };
 appendProgress(progressRequested,'open');
 const committed=await hostCommitProgress({host:recoveryHost,expectedWorkspace:structuredClone(live),coordinator:'root',request:{root,indexPath:'tasks.md',canonicalIndex:'tasks.md',taskId:'a',task:{id:'a',title:'deliver',wave:1},indexBeforeHash,progressRequested}});assert.equal(committed.status,'progress_committed');assert.equal(fs.readFileSync(index,'utf8'),beforeIndex.replace('[ ]','[x]'));
 appendProgress({type:'progressCommitted',taskId:'a',receiptDigest:progressRequested.receiptDigest,indexBeforeHash,indexAfterHash:committed.afterHash},'closed');
 data.mode='verifier';fs.writeFileSync(ledgerFile,JSON.stringify(data));const savedProgress=fs.readFileSync(ledgerFile,'utf8');delete data.progressProof;fs.writeFileSync(ledgerFile,JSON.stringify(data));
 const blockedVerifier=spawnSync(process.execPath,['--input-type=module','--eval',child,root],{encoding:'utf8'});assert.equal(blockedVerifier.status,0,blockedVerifier.stderr);assert.equal(JSON.parse(blockedVerifier.stdout).status,'manual_handoff_required');
 fs.writeFileSync(ledgerFile,savedProgress);
 const verifier=spawnSync(process.execPath,['--input-type=module','--eval',child,root],{encoding:'utf8'});assert.equal(verifier.status,0,verifier.stderr);assert.deepEqual(JSON.parse(verifier.stdout),{status:'started',fingerprint:'P'});assert.equal(replay(readStore(journalFile)).objectiveVerifier.session,'v1');
});
test('retained lease mutation during a progress gate leaves real canonical checkbox bytes untouched after reopen',async t=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{createHash}=await import('node:crypto');
 const {commitTaskIndexProgress}=await import('../lib/task-index-progress.mjs');
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'asds-progress-lease-gate-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const index=path.join(root,'tasks.md'),ledger=path.join(root,'host-ledger.json'),source='- [ ] [Task a](tasks/task-a.md): deliver\n\nWave 1: a\n';fs.writeFileSync(index,source);
 const indexBeforeHash=createHash('sha256').update(source).digest('hex'),progressRequested={type:'progressRequested',taskId:'a',planningRevision:'plan',contractRevision:'contract',integrationRevision:'I',receiptDigest:'receipt',indexBeforeHash,expectedChange:{from:'[ ]',to:'[x]'}};
 const request={root,indexPath:'tasks.md',canonicalIndex:'tasks.md',taskId:'a',task:{id:'a',title:'deliver',wave:1},indexBeforeHash,progressRequested};
 let live={...workspace,projectRootRealpath:root,repoIdentity:{vcs:'none',rootRealpath:root,baseRevision:'B'},toolCalls:[]},brokerCalls=0,attacked=false;
 const reopenHost=()=>{
  let retained;
  return host({
   observeWorkspace:async()=>structuredClone(live),authorize:async request=>grant(request),
   observeProgressState:async()=>fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):null,
   persistProgressState:async request=>{const state={...structuredClone(request),source:'host'};fs.writeFileSync(ledger,JSON.stringify(state));return state;},
   withCapabilityLease:async(request,operation)=>{retained=request;try{return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'};}finally{retained=undefined;}},
   verifyHostObservation:async({kind,observation})=>{if(retained&&!attacked&&kind==='workspace observation'){await Promise.resolve();retained.lease.token='forged-during-gate';attacked=true;}return typeof observation?.source==='string'&&observation.source!=='caller';},
   commitProgress:async request=>{brokerCalls++;const before=structuredClone(live),{canonicalIndex,taskId,indexBeforeHash,...broker}=request,result=commitTaskIndexProgress(broker);live={...live,currentFingerprint:'P'};return {beforeHash:result.event.indexBeforeHash,afterHash:result.event.indexAfterHash,changedPaths:[canonicalIndex],workspaceTransition:{operation:'progress',beforeFingerprint:before.currentFingerprint,afterFingerprint:'P',beforeToolCalls:before.toolCalls,afterToolCalls:before.toolCalls,writeScope:[canonicalIndex],changedPaths:[canonicalIndex],source:'host'},source:'host'};},
  });
 };
 const before=structuredClone(live),result=await hostCommitProgress({host:reopenHost(),expectedWorkspace:before,coordinator:'root',request});
 assert.equal(attacked,true);assert.equal(result.status,'transport_error');assert.match(result.error,/withCapabilityLease.*mutat.*request/i);assert.equal(brokerCalls,0);
 assert.equal(fs.readFileSync(index,'utf8'),source);assert.deepEqual(live,before);assert.equal(fs.readdirSync(root).some(name=>name.includes('.asds-progress.')),false);
 const proof=JSON.parse(fs.readFileSync(ledger,'utf8'));assert.equal(proof.status,'ambiguous');assert.equal(proof.workspace,undefined);assert.equal(proof.indexAfterHash,undefined);
 const retry=await hostCommitProgress({host:reopenHost(),expectedWorkspace:before,coordinator:'root',request});assert.equal(retry.status,'manual_handoff_required');assert.equal(brokerCalls,0);assert.equal(fs.readFileSync(index,'utf8'),source);assert.deepEqual(JSON.parse(fs.readFileSync(ledger,'utf8')),proof);
});
