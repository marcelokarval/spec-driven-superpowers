import test from 'node:test';
import assert from 'node:assert/strict';
import {
 hostCommitProgress, hostCompleteReview, hostDispatch, hostIntegrate,
 hostObserveStop, hostDispatchVerifier, hostCompleteVerifier, hostReobserveObjectiveCompletion, authoritativeObjectiveStatus, observeHostContract,
} from '../lib/host-bridge.mjs';
import { compilePlan, createJournal, appendEvent, replay, digest, objectiveSnapshot, continuation } from '../lib/orchestration.mjs';
const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nConcrete.\n`).join('');
const tasks=[{id:'a',kind:'implementation',openDecisions:[],body,dependsOn:[],write:['a.js'],resources:[],scenarios:['a/b'],verification:['test'],contractRevision:'a',orchestration:{complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'known',skills:['tdd'],references:['source'],claims:[]}}];
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const caps={spawn:true,isolatedWrites:true,maxAgents:2,externalActive:0,models:[{model:'e',efforts:['high']}]};
const workspace={projectRootRealpath:'/project',workspaceId:'workspace-1',repoIdentity:{vcs:'git',rootRealpath:'/project',commonDirRealpath:'/repo/.git',baseRevision:'B'},currentFingerprint:'F',writeScope:['a.js'],toolCalls:[],source:'fixture'};
const boundary={enforced:true,projectReadOnly:true,brokers:['journal','evidence','progress'],coordinator:'root',violations:[],source:'fixture'};
const matrix=Object.fromEntries(['verifyHostObservation','withCapabilityLease','observeCapabilities','observeWorkspace','enforceCoordinatorBoundary','authorize','prepareIntent','prepare','start','observeStop','snapshot','interrupt','integrate','observeVerifierResult','persistEvidence','observeObjectiveVerificationReceipt','commitProgress','cancelPrepared','persistStartState','observeStartState','persistIntegrationState','observeIntegrationState','persistProgressState','observeProgressState'].map(name=>[name,{state:'observed',source:'fixture'}]));
const reservedCall=(request,actor,session,id=request.toolOperation==='integrate'?'integrate-1':'call-1')=>({id,operation:request.toolOperation,actor,session,role:request.requestedRole,source:'host'});
const bindingEcho=request=>({operation:request.operation,actor:request.actor,session:request.session,role:request.role,projectRootRealpath:request.projectRootRealpath,taskId:request.taskId,requestedRole:request.requestedRole,writeScope:request.writeScope,intent:request.intent,...(request.operationToolCall?{operationToolCall:request.operationToolCall}:{})});
const granted=request=>({granted:true,source:'actual grant',scope:request.projectRootRealpath,...bindingEcho(request)});
function adapter(overrides={}) {
 let generation=0,currentWorkspace=workspace,startCounter=0,integrationCounter=0,objectiveReceipt=null,verifierResult={verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'grant'},evidence:['host proof'],limitations:[],remainingWork:[]};const startStates=new Map(),integrationStates=new Map(),progressStates=new Map();const customObserve=overrides.observeCapabilities,customLease=overrides.withCapabilityLease,customWorkspace=overrides.observeWorkspace,customStart=overrides.start;
 const result={
  verifyHostObservation:async({observation})=>typeof observation?.source==='string'&&observation.source!=='caller',
  observeWorkspace:async()=>workspace,enforceCoordinatorBoundary:async()=>boundary,
  authorize:async request=>granted(request),
  prepareIntent:async request=>{const actor=request.requestedRole==='integrator'?'i':'fresh',session=actor;return {intent:`intent:${request.taskId}:${request.requestedRole}`,actor,session,role:request.requestedRole,...request,operationToolCall:reservedCall(request,actor,session),source:'host'};},
  prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  start:async()=>({session:'fresh',toolCall:'call-1',source:'host'}),cancelPrepared:async()=>({cancelled:true,source:'host'}),
  persistStartState:async request=>{if(request.status==='requested'){const state={...request,requestId:`start-${++startCounter}`,source:'host'};startStates.set(state.requestId,state);return state;}const prior=startStates.get(request.requestId);if(!prior)throw new Error('unknown start request');if(request.status==='observed'){const actual=await result.observeWorkspace({phase:'fake-persist-start'});if(digest(actual)!==digest(request.workspace))throw new Error('bridge did not persist the independently observed fake-host workspace');const state={...prior,status:'observed',workspace:actual,source:'host'};startStates.set(state.requestId,state);return state;}const state={...prior,status:'ambiguous',source:'host'};startStates.set(state.requestId,state);return state;},
  observeStartState:async({requestId})=>startStates.get(requestId),
  persistIntegrationState:async request=>{const requestId=request.requestId??`integration-${++integrationCounter}`;if(request.status==='observed'&&digest(await result.observeWorkspace({phase:'fake-persist-integration'}))!==digest(request.workspace))throw new Error('integration baseline was not independently observed');const state={...request,requestId,source:'host'};integrationStates.set(requestId,state);return state;},
  observeIntegrationState:async({requestId})=>integrationStates.get(requestId),
  persistProgressState:async request=>{const state={...structuredClone(request),source:'host'};progressStates.set(state.requestId,state);return state;},
   observeProgressState:async({requestId})=>progressStates.get(requestId),
   observeVerifierResult:async request=>({...structuredClone(request),result:structuredClone(verifierResult),source:'host'}),
  persistEvidence:async request=>(objectiveReceipt={...structuredClone(request),schemaVersion:'asds.objective-verification-receipt/1',token:digest(request),source:'host'}),
  observeObjectiveVerificationReceipt:async request=>({...structuredClone(objectiveReceipt),receiptDigest:request.receiptDigest}),
 snapshot:async()=>({revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope',source:'host'}),...overrides,
 };
 result.observeWorkspace=customWorkspace??(async()=>currentWorkspace);
 result.start=async(prepared,packet)=>{
  const reserved=packet.assignment.context?.startRequest?.operationToolCall;
  const raw=customStart?await customStart(prepared,packet):{session:prepared.session,toolCall:reserved?.id??'call-1',source:'host'};
  if(raw?.workspaceTransition||customWorkspace)return raw;
  const before=currentWorkspace.toolCalls??[],role=packet.assignment.role,call={id:raw.toolCall,operation:'start',actor:reserved?.actor??prepared.session,session:prepared.session,role,source:raw.source};
  const writeScope=['reviewer','verifier'].includes(role)?[]:packet.task.write;
  currentWorkspace={...currentWorkspace,toolCalls:[...before,call]};
  return {...raw,workspaceTransition:{operation:'start',beforeFingerprint:workspace.currentFingerprint,afterFingerprint:currentWorkspace.currentFingerprint,beforeToolCalls:before,afterToolCalls:currentWorkspace.toolCalls,writeScope,changedPaths:[],source:'host'}};
 };
 result.observeCapabilities=async args=>{const raw=customObserve?await customObserve(args):{runtime:caps,matrix,source:'fixture'};return {...raw,lease:raw.lease??{generation:++generation,token:`fixture-${generation}`,source:'fixture'}};};
 result.withCapabilityLease=customLease??(async(request,operation)=>({status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'}));
 result.setVerifierResult=value=>{verifierResult=structuredClone(value);};
 return result;
}
function setup(){let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'},workspaceBinding:workspace});return {read:()=>j,append:(e,n)=>j=appendEvent(j,e,n),persistHostJournal:(next,{expectedSequence,expectedDigest})=>{assert.equal(replay(j).sequence,expectedSequence);assert.equal(digest(j),expectedDigest);j=structuredClone(next);return j;}};}
function progressAuthorityEvent(journal,event,request=event) {
 const state=replay(journal),status=event.type==='progressCommitted'?'closed':'open',source='progress-broker-host',indexReadback={schemaVersion:'asds.index-readback/1',token:digest(`readback:${state.sequence}:${status}`),source,authorityGeneration:1,journalVersion:3,journalSequence:state.sequence,journalEventDigest:journal.events.at(-1)?.digest??journal.digest,planningRevision:request.planningRevision,candidateRevision:state.tasks[event.taskId].receipt.revision,integrationRevision:request.integrationRevision,reviewRevision:request.integrationRevision,brokerEventDigest:digest(`broker:${status}`),status,indexBeforeHash:event.indexBeforeHash,...(status==='closed'?{indexAfterHash:event.indexAfterHash}:{})};
 const binding={kind:'progress-readback',token:indexReadback.token,source,authorityGeneration:1,journalVersion:3,journalSequence:state.sequence,journalEventDigest:indexReadback.journalEventDigest,planningRevision:indexReadback.planningRevision,candidateRevision:indexReadback.candidateRevision,integrationRevision:indexReadback.integrationRevision,reviewRevision:indexReadback.reviewRevision,payloadDigest:digest(indexReadback)};
 const authorityConsumption={schemaVersion:'asds.host-authority-consumption/1',kind:'progress-readback',handle:digest({generation:1,token:binding.token,binding}),token:binding.token,source,authorityGeneration:1,binding};
 return {...event,indexReadback,authorityConsumption};
}
// Reopen creates a fresh adapter from serialized host records, with no bridge cache.
async function integratedFlow(overrides={},decorateHost=host=>host) {
 let journal=setup().read(),durable={workspace:structuredClone(workspace),starts:{},integrations:{},progress:{},counter:0};
 const store={read:()=>journal,append:(event,sequence)=>journal=appendEvent(journal,event,sequence),persistHostJournal:(next,{expectedSequence,expectedDigest})=>{assert.equal(replay(journal).sequence,expectedSequence);assert.equal(digest(journal),expectedDigest);journal=structuredClone(next);return journal;}};
 const buildHost=()=>decorateHost(adapter({
  observeWorkspace:async()=>structuredClone(durable.workspace),
  observeCapabilities:async()=>({runtime:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:replay(journal).tasks.a.receipt?.integrationRevision??'D'}},matrix,source:'fixture'}),
  prepareIntent:async request=>{const actor=`${request.requestedRole}-${++durable.counter}`;return {intent:`intent:${actor}`,actor,session:actor,role:request.requestedRole,...request,operationToolCall:reservedCall(request,actor,actor,`call:${actor}`),source:'host'};},
  prepare:async request=>({session:request.intent.session,context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  start:async(prepared,packet)=>{const before=structuredClone(durable.workspace),call=packet.assignment.context?.startRequest?.operationToolCall??Object.values(durable.starts).find(state=>state.session===prepared.session).operationToolCall;durable.workspace.toolCalls.push(call);return {session:prepared.session,toolCall:call.id,workspaceTransition:{operation:'start',beforeFingerprint:before.currentFingerprint,afterFingerprint:before.currentFingerprint,beforeToolCalls:before.toolCalls,afterToolCalls:structuredClone(durable.workspace.toolCalls),writeScope:['reviewer','verifier'].includes(packet.assignment.role)?[]:packet.task.write,changedPaths:[],source:'host'},source:'host'};},
  observeStop:async({session})=>({session,stopped:true,outcome:'completed',source:'host'}),
  snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:`${request.revision}-scope`,source:'host'}),
  persistStartState:async request=>{const requestId=request.requestId??`start:${request.session}`,state={...structuredClone(request),requestId,source:'host'};if(request.status==='observed')assert.deepEqual(request.workspace,durable.workspace);durable.starts[requestId]=state;return structuredClone(state);},
  observeStartState:async({requestId})=>structuredClone(durable.starts[requestId]),
  persistIntegrationState:async request=>{const requestId=request.requestId??`integration:${request.session}`,state={...structuredClone(request),requestId,source:'host'};if(request.status==='observed')assert.deepEqual(request.workspace,durable.workspace);durable.integrations[requestId]=state;return structuredClone(state);},
  observeIntegrationState:async({requestId})=>structuredClone(durable.integrations[requestId]),
  persistProgressState:async request=>{if(request.status==='requested')assert.equal(request.workspaceBeforeDigest,digest(durable.workspace));if(request.status==='observed')assert.deepEqual(request.workspace,durable.workspace);const state={...structuredClone(request),source:'host'};durable.progress[request.requestId]=state;return structuredClone(state);},
  observeProgressState:async({requestId})=>structuredClone(durable.progress[requestId]),
  commitProgress:async request=>{const before=structuredClone(durable.workspace);durable.workspace.currentFingerprint='P';return {beforeHash:request.indexBeforeHash,afterHash:digest('closed index'),changedPaths:['tasks.md'],workspaceTransition:{operation:'progress',beforeFingerprint:before.currentFingerprint,afterFingerprint:'P',beforeToolCalls:before.toolCalls,afterToolCalls:before.toolCalls,writeScope:['tasks.md'],changedPaths:['tasks.md'],source:'host'},source:'host'};},
  integrate:async(prepared,packet)=>{const before=structuredClone(durable.workspace),call=packet.assignment.context.integrationRequest?.operationToolCall??reservedCall({toolOperation:'integrate',requestedRole:'integrator'},prepared.session,prepared.session,`call:${prepared.session}`);durable.workspace.currentFingerprint='I';durable.workspace.toolCalls.push(call);return {session:prepared.session,role:'integrator',toolCall:call.id,workspaceTransition:{operation:'integrate',beforeFingerprint:before.currentFingerprint,afterFingerprint:'I',beforeToolCalls:before.toolCalls,afterToolCalls:structuredClone(durable.workspace.toolCalls),writeScope:packet.task.write,changedPaths:['a.js'],source:'host'},source:'host'};},
  ...overrides,
 }));
 let host=buildHost();const executor=await hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:'executor'});assert.equal(executor.status,'started');
 const stopped=await hostObserveStop({host,session:executor.session,expectedWorkspace:executor.workspace,coordinator:'root',assignment:{actor:executor.session,session:executor.session,role:'executor',writeScope:['a.js']}});assert.equal(stopped.status,'stopped');
 const evidence=revision=>[{command:'test',exitCode:0,revision,observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}];
 store.append({type:'deliver',taskId:'a',session:executor.session,stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:evidence('D')}},replay(journal).sequence);
 const reviewer=await hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:'reviewer'});assert.equal(reviewer.status,'started');
 const reviewed=await hostCompleteReview({store,loadTasks:()=>tasks,host,taskId:'a',result:{revision:'D',verdict:'pass',findings:[],evidence:['independent review']}});assert.equal(reviewed.tasks.a.status,'reviewed');
 const integrated=await hostIntegrate({store,loadTasks:()=>tasks,host,taskId:'a'});
 const recordIntegration=()=>store.append({type:'integrate',taskId:'a',session:replay(journal).tasks.a.active.session,stopped:true,integrationRevision:'I',integrationEvidence:evidence('I')},replay(journal).sequence);
 const reopen=()=>{journal=JSON.parse(JSON.stringify(journal));durable=JSON.parse(JSON.stringify(durable));host=buildHost();return host;};
 return {store,host,integrated,recordIntegration,reopen,get durable(){return durable;}};
}
async function progressedFlow(overrides={},decorateHost) {
 const flow=await integratedFlow(overrides,decorateHost);assert.equal(flow.integrated.status,'integrated_observed');flow.recordIntegration();
 const {store,host}=flow,append=event=>store.append(event,replay(store.read()).sequence);
 await hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:'reviewer'});
 await hostCompleteReview({store,loadTasks:()=>tasks,host,taskId:'a',result:{revision:'I',verdict:'pass',findings:[],evidence:['integration review']}});
 append({type:'decide',taskId:'a',disposition:'accepted',reason:'passed',checks:{scope:'ok',behavior:'ok',independence:'ok',integration:'ok',authority:'ok'},limitations:[]});
 const state=replay(store.read()),request={type:'progressRequested',taskId:'a',planningRevision:state.plan.revision,contractRevision:'a',integrationRevision:'I',receiptDigest:digest(state.tasks.a.receipt),indexBeforeHash:digest('open index'),expectedChange:{from:'[ ]',to:'[x]'}};
 append(progressAuthorityEvent(store.read(),request));
 const committed=await hostCommitProgress({host,expectedWorkspace:structuredClone(flow.durable.workspace),coordinator:'root',request:{canonicalIndex:'tasks.md',taskId:'a',indexBeforeHash:request.indexBeforeHash,progressRequested:request}});
 const recordProgress=()=>append(progressAuthorityEvent(store.read(),{type:'progressCommitted',taskId:'a',receiptDigest:request.receiptDigest,indexBeforeHash:request.indexBeforeHash,indexAfterHash:digest('closed index')},request));
 return {flow,request,committed,recordProgress};
}
test('hostCompleteVerifier derives the only completable objective event from stop, snapshot and a closed host receipt',async()=>{
 const {flow,recordProgress}=await progressedFlow();recordProgress();const {store}=flow,host=flow.reopen();
 const started=await hostDispatchVerifier({store,loadTasks:()=>tasks,host});assert.equal(started.status,'started');
 const state=await hostCompleteVerifier({store,loadTasks:()=>tasks,host});
 assert.equal(state.objectiveVerification.verdict,'pass');assert.equal(state.objectiveVerification.attestation.status,'closed');
 assert.equal(state.objectiveVerification.attestation.objectiveRevision,started.objectiveRevision);
 assert.equal(state.objectiveVerification.attestation.resultDigest,digest({verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'grant'},evidence:['host proof'],limitations:[],remainingWork:[]}));
});
test('hostCompleteVerifier fails closed on running verifier, snapshot drift, missing brokers and forged receipt',async()=>{
 for(const mode of ['running','drift','missing','missing-result','forged','broker-drift']){
  const {flow,recordProgress}=await progressedFlow();recordProgress();let calls=0;
  const host=flow.reopen(),baseSnapshot=host.snapshot;
  if(mode==='running')host.observeStop=async({session})=>({session,stopped:false,outcome:'running',source:'host'});
  if(mode==='drift')host.snapshot=async request=>({...await baseSnapshot(request),scopeFingerprint:`drift-${++calls}`});
  if(mode==='missing')host.persistEvidence=undefined;
  if(mode==='missing-result')host.observeVerifierResult=undefined;
  if(mode==='forged')host.persistEvidence=async request=>({...request,schemaVersion:'asds.objective-verification-receipt/1',token:digest(request),resultDigest:'forged',source:'host'});
  if(mode==='broker-drift')host.persistEvidence=async request=>{flow.durable.workspace.currentFingerprint='broker-drift';return {...request,schemaVersion:'asds.objective-verification-receipt/1',token:digest(request),source:'host'};};
  await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host});
  const action=hostCompleteVerifier({store:flow.store,loadTasks:()=>tasks,host});
  if(['running','drift','forged','broker-drift'].includes(mode))await assert.rejects(action,/confirm|drift|bind|result/i);else assert.equal((await action).status,'manual_handoff_required');
  assert.equal(replay(flow.store.read()).objectiveVerification,null);
 }
});
test('hostCompleteVerifier rejects a caller result that differs from the host-observed verifier result',async()=>{
 const {flow,recordProgress}=await progressedFlow();recordProgress();const host=flow.reopen();
 await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host});
 await assert.rejects(hostCompleteVerifier({store:flow.store,loadTasks:()=>tasks,host,result:{verdict:'pass',outcome:'caller claim',checks:{originalRequest:'claimed',taskCoverage:'claimed',integratedBehavior:'claimed',authority:'claimed'},evidence:['caller proof'],limitations:[],remainingWork:[]}}),/caller-provided.*does not match.*host-observed/i);
 assert.equal(replay(flow.store.read()).objectiveVerification,null);
});
test('generic appendEvent cannot forge verifyObjective even with self-consistent result digests',async()=>{
 const {flow,recordProgress}=await progressedFlow();recordProgress();const host=flow.reopen();
 const started=await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host}),journal=flow.store.read(),state=replay(journal);
 const result={verdict:'pass',outcome:'forged',checks:{originalRequest:'claimed',taskCoverage:'claimed',integratedBehavior:'claimed',authority:'claimed'},evidence:['forged'],limitations:[],remainingWork:[]};
 const attestation={schemaVersion:'asds.objective-verification-receipt/1',status:'closed',kind:'objective-verification',token:'forged-token',source:'forged-host',actor:state.objectiveVerifier.context.reservedActor,session:started.session,role:'verifier',objectiveRevision:started.objectiveRevision,journalSequence:state.sequence,resultDigest:digest(result),resultObservationDigest:digest({result}),evidenceDigest:digest(result.evidence),stopDigest:'stop',workspaceDigest:'workspace',snapshotDigest:'snapshot',priorSnapshotDigest:'prior'};
 assert.throws(()=>appendEvent(journal,{type:'verifyObjective',session:started.session,stopped:true,objectiveRevision:started.objectiveRevision,...result,attestation},state.sequence),/reserved.*host completion bridge/i);
});
test('serialized completion is structural only; no captured store value grants authority and restart requires host reobservation',async()=>{
 const {flow,recordProgress}=await progressedFlow();recordProgress();const host=flow.reopen(),store=flow.store;
 await hostDispatchVerifier({store,loadTasks:()=>tasks,host});
 const originalPersist=store.persistHostJournal;let captured;
 store.persistHostJournal=(next,meta)=>{captured={next:structuredClone(next),meta:structuredClone(meta),arguments:[next,meta]};return originalPersist(next,meta);};
 const completed=await hostCompleteVerifier({store,loadTasks:()=>tasks,host});assert.equal(completed.disposition,'complete');
 assert.equal(captured.arguments.some(value=>typeof value==='function'),false);
 const serialized=JSON.parse(JSON.stringify(captured.next));
 assert.equal(replay(serialized).objectiveVerification.authorityStatus,'structural_only');
 assert.equal(continuation(serialized,caps).objectiveComplete,false);
 assert.equal(continuation(serialized,caps).disposition,'await_host_reobservation');
 const restarted=flow.reopen(),receipt=replay(serialized).objectiveVerification.attestation;
 assert.equal(authoritativeObjectiveStatus({journal:serialized,host:restarted}).disposition,'await_host_reobservation');
 restarted.observeObjectiveVerificationReceipt=async request=>({...structuredClone(receipt),receiptDigest:request.receiptDigest});
 const reobserved=await hostReobserveObjectiveCompletion({store,loadTasks:()=>tasks,host:restarted});
 assert.equal(reobserved.disposition,'complete');assert.equal(reobserved.objectiveComplete,true);
});
test('progress persistence rejects in-place scalar and nested request mutation without duplicate broker calls',async()=>{
 const cases=[
  ['observed',request=>{request.indexAfterHash=digest('forged after hash');}],
  ['observed',request=>{request.workspaceTransition.source='mutated-host';}],
  ['requested',request=>{request.workspaceBeforeDigest=digest('forged before workspace');}],
  ['requested',request=>{request.progressRequested.receiptDigest='forged receipt';request.requestId=`progress:${digest({projectRootRealpath:request.projectRootRealpath,canonicalIndex:request.canonicalIndex,progressRequested:request.progressRequested})}`;}],
 ];
 for(const [status,mutate] of cases){
  let saved,brokerCalls=0;
  const run=progressedFlow({
   persistProgressState:async request=>{if(request.status===status){await Promise.resolve();mutate(request);}saved={...structuredClone(request),source:'host'};return structuredClone(saved);},
   observeProgressState:async()=>structuredClone(saved),
   withCapabilityLease:async(request,operation)=>{if(request.operation==='commitProgress')brokerCalls++;return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'};},
  });
  if(status==='requested')await assert.rejects(run,/persistProgressState.*mutat.*request/i);
  else{
   const {flow,committed,request}=await run;
   assert.equal(committed.status,'transport_error');assert.match(committed.error,/persistProgressState.*mutat.*request/i);assert.equal(committed.reservationRetained,true);
   assert.equal(flow.store.read().events.some(entry=>entry.event.type==='progressCommitted'),false);
   const retry=await hostCommitProgress({host:flow.reopen(),expectedWorkspace:structuredClone(flow.durable.workspace),coordinator:'root',request:{canonicalIndex:'tasks.md',taskId:'a',indexBeforeHash:request.indexBeforeHash,progressRequested:request}});
   assert.equal(retry.status,'manual_handoff_required');
  }
  assert.equal(brokerCalls,status==='requested'?0:1);
 }
});
test('start persistence rejects in-place scalar and nested requested or observed mutation without restarting',async()=>{
 for(const status of ['requested','observed'])for(const nested of [false,true]){
  const store=setup();let saved,startCalls=0;
  const host=adapter({
   persistStartState:async request=>{
    if(request.status===status){await Promise.resolve();if(nested){if(status==='requested')request.writeScope[0]='other.js';else request.workspace.repoIdentity.commonDirRealpath='/other/.git';}else if(status==='requested')request.workspaceBeforeDigest=digest('forged before workspace');else request.workspace.currentFingerprint='forged after workspace';}
    saved={...structuredClone(request),requestId:request.requestId??'mutation-start',source:'host'};return structuredClone(saved);
   },
   observeStartState:async()=>structuredClone(saved),
   withCapabilityLease:async(request,operation)=>{if(request.operation==='start')startCalls++;return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'};},
  });
  const run=hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:'executor'});
  if(status==='requested'){await assert.rejects(run,/persistStartState.*mutat.*request/i);assert.equal(store.read().events.length,0);}
  else{
   const result=await run;assert.equal(result.status,'transport_error');assert.match(result.error,/persistStartState.*mutat.*request/i);assert.equal(result.reservationRetained,true);
   const before=digest(store.read());await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:'executor'}),/drift|not ready|bind/i);assert.equal(digest(store.read()),before);
  }
  assert.equal(startCalls,status==='requested'?0:1);
 }
});
test('integration persistence rejects in-place scalar and nested requested or observed mutation without reintegrating',async()=>{
 for(const status of ['requested','observed'])for(const nested of [false,true]){
  let saved,integrateCalls=0;
  const run=integratedFlow({
   persistIntegrationState:async request=>{
    if(request.status===status){await Promise.resolve();if(nested){if(status==='requested')request.operationToolCall.source='mutated-host';else request.workspaceTransition.source='mutated-host';}else if(status==='requested')request.workspaceBeforeDigest=digest('forged before workspace');else request.taskId='other';}
    saved={...structuredClone(request),requestId:request.requestId??'mutation-integration',source:'host'};return structuredClone(saved);
   },
   observeIntegrationState:async()=>structuredClone(saved),
   withCapabilityLease:async(request,operation)=>{if(request.operation==='integrate')integrateCalls++;return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'};},
  });
  if(status==='requested')await assert.rejects(run,/persistIntegrationState.*mutat.*request/i);
  else{
   const flow=await run;assert.equal(flow.integrated.status,'transport_error');assert.match(flow.integrated.error,/persistIntegrationState.*mutat.*request/i);assert.equal(flow.integrated.reservationRetained,true);
   const before=digest(flow.store.read());await assert.rejects(hostIntegrate({store:flow.store,loadTasks:()=>tasks,host:flow.reopen(),taskId:'a'}),/not ready|reviewed|bind|integration/i);assert.equal(digest(flow.store.read()),before);
  }
  assert.equal(integrateCalls,status==='requested'?0:1);
 }
});
test('all ledger persistence calls detect retained argument mutation during receipt attestation',async()=>{
 for(const operation of ['persistStartState','persistIntegrationState','persistProgressState'])for(const status of ['requested','observed']){
  let argument,calls=0;
  const label={persistStartState:'persisted start state',persistIntegrationState:'persisted integration state',persistProgressState:'persisted progress state'}[operation];
  const overrides={
   [operation]:async request=>{argument=request;return {...structuredClone(request),requestId:request.requestId??`${operation}:${request.session}`,source:'host'};},
   verifyHostObservation:async({kind})=>{if(kind===label&&argument.status===status){await Promise.resolve();argument.taskId='mutated';if(argument.operationToolCall)argument.operationToolCall.source='mutated-host';else argument.progressRequested.receiptDigest='mutated';}return true;},
   withCapabilityLease:async(request,operationCallback)=>{if(request.operation==={persistStartState:'start',persistIntegrationState:'integrate',persistProgressState:'commitProgress'}[operation])calls++;return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operationCallback(),source:'host'};},
  };
  const run=operation==='persistStartState'?hostDispatch({store:setup(),loadTasks:()=>tasks,host:adapter(overrides),taskId:'a',role:'executor'}):operation==='persistIntegrationState'?integratedFlow(overrides):progressedFlow(overrides);
  if(status==='requested')await assert.rejects(run,new RegExp(`${operation}.*mutat.*request`,'i'));
  else{const flow=await run,result=operation==='persistStartState'?flow:operation==='persistIntegrationState'?flow.integrated:flow.committed;assert.equal(result.status,'transport_error');assert.match(result.error,new RegExp(`${operation}.*mutat.*request`,'i'));}
  assert.equal(calls,status==='requested'?0:1);
 }
});
test('ledger observation cannot rewrite its lookup argument before or during attestation',async()=>{
 for(const operation of ['observeStartState','observeIntegrationState','observeProgressState'])for(const duringAttestation of [false,true]){
  const progressed=operation!=='observeIntegrationState'?await progressedFlow():null,flow=progressed?.flow??await integratedFlow();
  if(progressed)progressed.recordProgress();else flow.recordIntegration();
  const host=flow.reopen(),observe=host[operation],verify=host.verifyHostObservation;let argument,prepared=0;
  host[operation]=async request=>{argument=request;const state=await observe(request);if(!duringAttestation){request.requestId='forged-lookup';request.extra={writeScope:['outside.js']};}return state;};
  host.verifyHostObservation=async request=>{if(duringAttestation&&request.kind===`observed ${operation.slice(7,-5).toLowerCase()} state`){argument.requestId='forged-lookup';argument.extra={writeScope:['outside.js']};}return verify(request);};
  host.prepare=async()=>{prepared++;throw new Error('must not prepare');};
  const before=digest(flow.store.read()),run=operation==='observeIntegrationState'?hostDispatch({store:flow.store,loadTasks:()=>tasks,host,taskId:'a',role:'reviewer'}):hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host});
  await assert.rejects(run,new RegExp(`${operation}.*mutat.*request`,'i'));assert.equal(prepared,0);assert.equal(digest(flow.store.read()),before);
 }
});
test('pre-broker progress lookup mutation fails closed even when it returns missing',async()=>{
 let brokerCalls=0;
 await assert.rejects(progressedFlow({observeProgressState:async request=>{request.requestId='forged-lookup';request.extra={scope:['outside.js']};return null;},withCapabilityLease:async(request,operation)=>{if(request.operation==='commitProgress')brokerCalls++;return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'};}}),/observeProgressState.*mutat.*request/i);
 assert.equal(brokerCalls,0);
});
test('preparation authorization and snapshot helpers reject scalar or nested input mutation before dispatch',async()=>{
 for(const operation of ['prepareIntent','authorize','snapshot'])for(const nested of [false,true]){
  const flow=operation==='snapshot'?await integratedFlow():null;if(flow)flow.recordIntegration();
  const store=flow?.store??setup(),host=flow?flow.reopen():adapter(),original=host[operation];let prepared=0;
  host[operation]=async request=>{const result=await original(request);await Promise.resolve();if(nested)request.writeScope.push('outside.js');else request.taskId='forged';return result;};
  host.prepare=async()=>{prepared++;throw new Error('must not prepare');};
  const before=digest(store.read());await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:flow?'reviewer':'executor'}),new RegExp(`${operation}.*mutat.*request`,'i'));
  assert.equal(prepared,0);assert.equal(digest(store.read()),before);
 }
});
test('capability lease arguments cannot mutate before or after their callback or during attestation',async()=>{
 for(const when of ['before','after','attestation'])for(const nested of [false,true]){
  const store=setup();let calls=0,argument;
  const mutate=request=>{if(nested)request.lease.token='forged';else request.taskId='forged';};
  const host=adapter({
   withCapabilityLease:async(request,operation)=>{
    if(request.operation==='start'){argument=request;if(when==='before')mutate(request);}
    const value=await operation();
    if(request.operation==='start'&&when==='after')mutate(request);
    return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value,source:'host'};
   },
   verifyHostObservation:async({kind})=>{if(when==='attestation'&&kind==='capability lease consumption'&&argument){await Promise.resolve();mutate(argument);}return true;},
  });
  const start=host.start;host.start=async(...args)=>{calls++;return start(...args);};
  const result=await hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:'executor'});
  assert.equal(result.status,'transport_error');assert.match(result.error,/withCapabilityLease.*mutat.*request/i);assert.equal(result.reservationRetained,true);
  const reserved=replay(store.read()).tasks.a.active.context.startRequest;
  assert.equal(reserved.taskId,'a');assert.equal(reserved.operationToolCall.source,'host');
  const before=digest(store.read()),retry=await hostDispatch({store,loadTasks:()=>tasks,host,taskId:'a',role:'executor'});
  assert.equal(retry.status,'manual_handoff_required');assert.equal(digest(store.read()),before);assert.equal(calls,when==='before'?0:1);
 }
});
function attackAwaitedLeaseGate(operation,role,nested) {
 let retained,attacked=false,effectCalls=0;
 const decorate=host=>{
  const lease=host.withCapabilityLease,verify=host.verifyHostObservation,effect=host[operation];
  host.withCapabilityLease=async(request,callback)=>{
   if(request.operation===operation&&request.role===role)retained=request;
   try{return await lease(request,callback);}finally{retained=undefined;}
  };
  host.verifyHostObservation=async request=>{
   const verified=await verify(request);
   if(retained&&!attacked&&request.kind==='workspace observation'){
    await Promise.resolve();if(nested)retained.lease.token='forged-during-gate';else retained.taskId='forged-during-gate';attacked=true;
   }
   return verified;
  };
  host[operation]=async(...args)=>{if(operation!=='start'||args[1].assignment.role===role)effectCalls++;return effect(...args);};
  return host;
 };
 return {decorate,get attacked(){return attacked;},get effectCalls(){return effectCalls;}};
}
test('native integration never mutates durable workspace when its retained lease changes during an awaited gate',async()=>{
 for(const nested of [false,true]){
  const attack=attackAwaitedLeaseGate('integrate','integrator',nested),flow=await integratedFlow({},attack.decorate);
  assert.equal(attack.attacked,true);assert.equal(flow.integrated.status,'transport_error');assert.match(flow.integrated.error,/withCapabilityLease.*mutat.*request/i);
  assert.equal(attack.effectCalls,0);assert.equal(flow.durable.workspace.currentFingerprint,'F');assert.equal(flow.durable.workspace.toolCalls.some(call=>call.operation==='integrate'),false);
  const proof=Object.values(flow.durable.integrations)[0];assert.equal(proof.status,'ambiguous');assert.equal(proof.workspace,undefined);
  assert.equal(flow.store.read().events.some(entry=>entry.event.type==='integrate'),false);
 }
});
test('progress never mutates durable workspace when its retained lease changes during an awaited gate',async()=>{
 for(const nested of [false,true]){
  const attack=attackAwaitedLeaseGate('commitProgress','progress-broker',nested),{flow,committed}=await progressedFlow({},attack.decorate);
  assert.equal(attack.attacked,true);assert.equal(committed.status,'transport_error');assert.match(committed.error,/withCapabilityLease.*mutat.*request/i);
  assert.equal(attack.effectCalls,0);assert.equal(flow.durable.workspace.currentFingerprint,'I');
  const proof=Object.values(flow.durable.progress)[0];assert.equal(proof.status,'ambiguous');assert.equal(proof.workspace,undefined);assert.equal(proof.indexAfterHash,undefined);
  assert.equal(flow.store.read().events.some(entry=>entry.event.type==='progressCommitted'),false);
 }
});
test('verifier never starts or mutates durable workspace when its retained lease changes during an awaited gate',async()=>{
 for(const nested of [false,true]){
  const attack=attackAwaitedLeaseGate('start','verifier',nested),{flow,recordProgress}=await progressedFlow({},attack.decorate);recordProgress();
  const before=structuredClone(flow.durable.workspace),result=await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host:flow.host});
  assert.equal(attack.attacked,true);assert.equal(result.status,'transport_error');assert.match(result.error,/withCapabilityLease.*mutat.*request/i);
  assert.equal(attack.effectCalls,0);assert.deepEqual(flow.durable.workspace,before);
  const proof=Object.values(flow.durable.starts).find(state=>state.role==='verifier');assert.equal(proof.status,'ambiguous');assert.equal(proof.workspace,undefined);
  const retry=await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host:flow.reopen()});assert.equal(retry.status,'manual_handoff_required');assert.equal(attack.effectCalls,0);assert.deepEqual(flow.durable.workspace,before);
 }
});
test('progress establishes a durable causal baseline for verifier dispatch after reopen',async()=>{
 const {flow,committed,recordProgress}=await progressedFlow();assert.equal(committed.status,'progress_committed');recordProgress();
 const verifier=await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host:flow.reopen()});
 assert.equal(verifier.status,'started');assert.equal(verifier.workspace.currentFingerprint,'P');
 assert.equal(Object.values(flow.durable.progress)[0].status,'observed');
});
test('missing pending or ambiguous progress proof blocks verifier before preparation after reopen',async()=>{
 for(const status of ['missing','requested','ambiguous']){
  const {flow,recordProgress}=await progressedFlow();recordProgress();const id=Object.keys(flow.durable.progress)[0];
  if(status==='missing')delete flow.durable.progress[id];else{const proof=flow.durable.progress[id];proof.status=status;delete proof.workspace;delete proof.workspaceTransition;delete proof.indexAfterHash;}
  const host=flow.reopen();let prepared=0;host.prepare=async()=>{prepared++;throw new Error('must not prepare');};
  const result=await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host});
  assert.equal(result.status,'manual_handoff_required');assert.equal(result.progressState,status);assert.equal(result.reservationRetained,true);assert.equal(prepared,0);
 }
});
test('progress ledger cannot forge its causal baseline request hashes scope or tool calls',async()=>{
 for(const mutate of [
  proof=>{proof.workspaceBeforeDigest=digest('invented baseline');},
  proof=>{proof.progressRequested.receiptDigest='forged';},
  proof=>{proof.indexAfterHash=digest('other checkbox');},
  proof=>{proof.actor='root';},
  proof=>{proof.source='caller';},
  proof=>{proof.workspace.projectRootRealpath='/other';},
  proof=>{proof.workspace.repoIdentity.commonDirRealpath='/other/.git';},
  proof=>{proof.workspace.workspaceId='other';},
  proof=>{proof.workspaceTransition.changedPaths=['outside.js'];},
  proof=>{proof.workspaceTransition.afterToolCalls.push({id:'rogue',operation:'write',actor:'root',session:'root',role:'coordinator',source:'host'});},
  proof=>{delete proof.workspaceTransition;},
 ]){
  const {flow,recordProgress}=await progressedFlow();recordProgress();mutate(Object.values(flow.durable.progress)[0]);const host=flow.reopen();let prepared=0;host.prepare=async()=>{prepared++;throw new Error('must not prepare');};
  await assert.rejects(hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host}),/bind|baseline|hash|identity|provenance|host-owned|drift|scope|tool calls|transition/i);assert.equal(prepared,0);
 }
});
test('post-progress workspace drift cannot be adopted as the verifier baseline',async()=>{
 for(const mutate of [value=>{value.currentFingerprint='drift';},value=>{value.repoIdentity.rootRealpath='/other';},value=>{value.toolCalls.push({id:'rogue',operation:'write',actor:'root',session:'root',role:'coordinator',source:'host'});}]){
  const {flow,recordProgress}=await progressedFlow();recordProgress();mutate(flow.durable.workspace);
  await assert.rejects(hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host:flow.reopen()}),/workspace drift/i);
 }
});
test('persisted progress readback and authority must bind the exact journal boundary',async()=>{
 for(const mutate of [
  event=>{delete event.indexReadback;},
  event=>{event.indexReadback.journalSequence--;},
  event=>{event.authorityConsumption.handle=digest('forged handle');},
  event=>{event.authorityConsumption.binding.payloadDigest=digest('forged payload');},
 ]){
  const {flow,recordProgress}=await progressedFlow();recordProgress();const original=flow.store.read();let journal={...structuredClone(original),events:[]};
  for(const entry of original.events){const event=structuredClone(entry.event);if(event.type==='progressCommitted')mutate(event);journal=appendEvent(journal,event,replay(journal).sequence);}
   const store={read:()=>journal,append:(event,sequence,hostDerive)=>journal=hostDerive?hostDerive(journal,event,sequence):appendEvent(journal,event,sequence)};
  await assert.rejects(hostDispatchVerifier({store,loadTasks:()=>tasks,host:flow.reopen()}),/readback|authority|schema|bind/i);
 }
});
test('crash after checkbox mutation keeps progress pending until independently recovered host proof',async()=>{
 let requested,brokerCalls=0;
 const {flow,committed,recordProgress}=await progressedFlow({persistProgressState:async request=>{if(request.status==='observed')throw new Error('crash before observed progress receipt');requested={...structuredClone(request),source:'host'};return requested;},observeProgressState:async()=>structuredClone(requested),withCapabilityLease:async(request,operation)=>{if(request.operation==='commitProgress')brokerCalls++;return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'};}});
 assert.equal(committed.status,'transport_error');assert.equal(requested.status,'requested');assert.equal(requested.workspace,undefined);recordProgress();
 assert.equal((await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host:flow.reopen()})).status,'manual_handoff_required');
 const before=Object.values(flow.durable.starts).at(-1).workspace,after=structuredClone(flow.durable.workspace);
 // This fake host independently recovers the actual broker operation; the bridge
 // never derives this observation from a closed checkbox or current workspace.
 requested={...requested,status:'observed',workspace:after,workspaceTransition:{operation:'progress',beforeFingerprint:before.currentFingerprint,afterFingerprint:after.currentFingerprint,beforeToolCalls:before.toolCalls,afterToolCalls:after.toolCalls,writeScope:['tasks.md'],changedPaths:['tasks.md'],source:'host'},indexAfterHash:digest('closed index')};
 assert.equal((await hostDispatchVerifier({store:flow.store,loadTasks:()=>tasks,host:flow.reopen()})).status,'started');assert.equal(brokerCalls,1);
});
test('durable progress capabilities and the final in-lease workspace gate precede broker side effects',async()=>{
 const progressRequested={type:'progressRequested',taskId:'a',planningRevision:'plan',contractRevision:'a',integrationRevision:'I',receiptDigest:'receipt',indexBeforeHash:digest('before'),expectedChange:{from:'[ ]',to:'[x]'}},request={taskId:'a',indexBeforeHash:progressRequested.indexBeforeHash,progressRequested};
 for(const operation of ['persistProgressState','observeProgressState'])for(const state of ['unknown','documented','unavailable']){
  let calls=0;const host=adapter({observeCapabilities:async()=>({runtime:caps,matrix:{...matrix,[operation]:{state,source:'host'}},source:'host'}),commitProgress:async()=>{calls++;}});
  const result=await hostCommitProgress({host,request,expectedWorkspace:workspace,coordinator:'root'});assert.equal(result.status,'manual_handoff_required');assert.equal(result.capability,operation);assert.equal(calls,0);
 }
 let changed=false,calls=0;
 const host=adapter({observeWorkspace:async()=>changed?{...workspace,currentFingerprint:'rogue'}:workspace,withCapabilityLease:async(request,operation)=>{if(request.operation==='commitProgress')changed=true;return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'};},commitProgress:async()=>{calls++;}});
 const result=await hostCommitProgress({host,request,expectedWorkspace:workspace,coordinator:'root'});assert.equal(result.status,'transport_error');assert.equal(result.progressState,'ambiguous');assert.equal(calls,0);
});
test('a repeated progress request preserves the original durable proof without rerunning the broker',async()=>{
 const {flow,request,recordProgress}=await progressedFlow();recordProgress();const saved=structuredClone(flow.durable.progress);let brokerCalls=0;
 const host=flow.reopen();host.commitProgress=async()=>{brokerCalls++;throw new Error('must not rerun');};
 const result=await hostCommitProgress({host,expectedWorkspace:structuredClone(flow.durable.workspace),coordinator:'root',request:{taskId:'a',indexBeforeHash:request.indexBeforeHash,progressRequested:request}});
 assert.equal(result.status,'manual_handoff_required');assert.equal(result.progressState,'observed');assert.equal(brokerCalls,0);assert.deepEqual(flow.durable.progress,saved);
});
test('native integration establishes the next reviewer baseline through the official flow and reopen',async()=>{
 const flow=await integratedFlow();assert.equal(flow.integrated.status,'integrated_observed');flow.recordIntegration();
 const host=flow.reopen(),reviewer=await hostDispatch({store:flow.store,loadTasks:()=>tasks,host,taskId:'a',role:'reviewer'});
 assert.equal(reviewer.status,'started');assert.equal(reviewer.workspace.currentFingerprint,'I');assert.deepEqual(reviewer.workspace.toolCalls.slice(0,-1),flow.integrated.workspace.toolCalls);
 const request=flow.store.read().events.find(entry=>entry.event.context?.integrationRequest)?.event.context.integrationRequest;
 assert.equal(request.status,'requested');assert.equal(request.workspace,undefined);
 assert.equal(flow.durable.integrations[request.requestId].status,'observed');
 const reviewed=await hostCompleteReview({store:flow.store,loadTasks:()=>tasks,host,taskId:'a',result:{revision:'I',verdict:'pass',findings:[],evidence:['integration review']}});
 assert.equal(reviewed.tasks.a.status,'forensic_pending');
});
test('reopened integration requests never fall back to an earlier start when proof is missing or incomplete',async()=>{
 const original=await integratedFlow();assert.equal(original.integrated.status,'integrated_observed');original.recordIntegration();
 const requestId=Object.keys(original.durable.integrations)[0],journal=structuredClone(original.store.read()),records=structuredClone(original.durable);
 for(const status of ['missing','requested','ambiguous']){
  const flow=await integratedFlow();flow.recordIntegration();
  // Restore the same persisted journal/host data for each recovery boundary.
  assert.deepEqual(flow.store.read(),journal);Object.assign(flow.durable,structuredClone(records));
  if(status==='missing')delete flow.durable.integrations[requestId];
  else{const state=flow.durable.integrations[requestId];state.status=status;delete state.workspace;delete state.workspaceTransition;}
  const host=flow.reopen();let prepared=0;host.prepare=async()=>{prepared++;throw new Error('must not prepare');};
  const result=await hostDispatch({store:flow.store,loadTasks:()=>tasks,host,taskId:'a',role:'reviewer'});
  assert.equal(result.status,'manual_handoff_required');assert.equal(result.integrationState,status);assert.equal(result.reservationRetained,true);assert.equal(prepared,0);
 }
});
test('persisted native integration proof binds exact identity scope transition and workspace after reopen',async()=>{
 const changes=[
  proof=>{delete proof.workspaceTransition;},
  proof=>{proof.source='caller';},
  proof=>{proof.actor='rogue';},
  proof=>{proof.workspaceBeforeDigest='forged';},
  proof=>{proof.writeScope=['outside.js'];},
  proof=>{proof.workspace.projectRootRealpath='/other';},
  proof=>{proof.workspace.workspaceId='other';},
  proof=>{proof.workspace.repoIdentity.commonDirRealpath='/other/.git';},
  proof=>{proof.workspace.currentFingerprint='FORGED';},
  proof=>{proof.workspaceTransition.changedPaths=['outside.js'];},
  proof=>{proof.workspaceTransition.afterToolCalls.at(-1).actor='rogue';},
  proof=>{proof.workspaceTransition.afterToolCalls.push({...proof.operationToolCall,id:'rogue'});},
  proof=>{proof.forged=true;},
 ];
 for(const mutate of changes){
  const flow=await integratedFlow();flow.recordIntegration();mutate(Object.values(flow.durable.integrations)[0]);
  const host=flow.reopen();let prepared=0;host.prepare=async()=>{prepared++;throw new Error('must not prepare');};
  await assert.rejects(hostDispatch({store:flow.store,loadTasks:()=>tasks,host,taskId:'a',role:'reviewer'}),/provenance|host-owned|schema|unknown|bind|baseline|transition|tool call|drift|scope/i);
  assert.equal(prepared,0);
 }
});
test('a valid persisted integration baseline does not authorize later workspace or tool-call drift',async()=>{
 for(const mutate of [
  value=>{value.currentFingerprint='unattributed';},
  value=>{value.projectRootRealpath='/other';},
  value=>{value.workspaceId='other';},
  value=>{value.repoIdentity.commonDirRealpath='/other/.git';},
  value=>{value.toolCalls.push({id:'rogue',operation:'write',actor:'root',session:'root',role:'coordinator',source:'host'});},
 ]){
  const flow=await integratedFlow();flow.recordIntegration();mutate(flow.durable.workspace);
  const host=flow.reopen();let prepared=0;host.prepare=async()=>{prepared++;throw new Error('must not prepare');};
  await assert.rejects(hostDispatch({store:flow.store,loadTasks:()=>tasks,host,taskId:'a',role:'reviewer'}),/workspace drift/i);assert.equal(prepared,0);
 }
});
test('integration lease or observed persistence failures retain a recoverable request without fabricating a baseline',async()=>{
 const invalid=await integratedFlow({withCapabilityLease:async(request,operation)=>({status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.operation==='integrate'?'invalid':request.lease.token,value:await operation(),source:'host'})});
 assert.equal(invalid.integrated.status,'transport_error');assert.equal(invalid.integrated.reservationRetained,true);assert.equal(invalid.integrated.integrationState,'ambiguous');
 assert.equal(Object.values(invalid.durable.integrations)[0].status,'ambiguous');assert.equal(Object.values(invalid.durable.integrations)[0].workspace,undefined);
 let persisted;
 const crashed=await integratedFlow({persistIntegrationState:async request=>{if(request.status==='observed')throw new Error('crash before observed integration receipt');persisted={...structuredClone(request),requestId:'crash-integration',source:'host'};return persisted;},observeIntegrationState:async()=>persisted});
 assert.equal(crashed.integrated.status,'transport_error');assert.equal(crashed.integrated.reservationRetained,true);assert.equal(persisted.status,'requested');assert.equal(persisted.workspace,undefined);
 // Even a journal integration claim does not replace the missing host proof.
 for(const flow of [invalid,crashed]){flow.recordIntegration();const result=await hostDispatch({store:flow.store,loadTasks:()=>tasks,host:flow.reopen(),taskId:'a',role:'reviewer'});assert.equal(result.status,'manual_handoff_required');assert.equal(result.reservationRetained,true);}
});
test('native integration requires observed durable ledger capabilities before preparing or mutating',async()=>{
 for(const operation of ['persistIntegrationState','observeIntegrationState'])for(const state of ['unknown','documented','unavailable']){
  const flow=await integratedFlow({observeCapabilities:async()=>({runtime:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},matrix:{...matrix,[operation]:{state,source:'host'}},source:'host'})});
  assert.equal(flow.integrated.status,'manual_handoff_required');assert.equal(flow.integrated.capability,operation);assert.deepEqual(flow.durable.integrations,{});assert.equal(replay(flow.store.read()).tasks.a.status,'reviewed');
 }
});
test('host verifies source and authorization and persists reservation before starting worker',async()=>{
 const store=setup();const calls=[];
 const result=await hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host:adapter({
 start:async (prepared,packet)=>{assert.equal(prepared.preparedOnly,true);assert.equal(replay(store.read()).tasks.a.active.session,'fresh');assert.equal(packet.executionAuthorized,false);calls.push('start');return {session:'fresh',toolCall:'call-1',source:'host'};}
 })});
 assert.equal(result.started,true);assert.deepEqual(calls,['start']);
});
test('denied permission and source drift do not start host; start transport error retains reservation',async()=>{
 const store=setup();let prepared=false;
 const host=adapter({authorize:async request=>({...granted(request),granted:false}),prepare:async()=>{prepared=true;return {session:'fresh',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}},start:async()=>{throw new Error('transport uncertain');}});
 await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/authorization/);assert.equal(prepared,false);
 host.authorize=async request=>granted(request);
 await assert.rejects(hostDispatch({store,loadTasks:()=>[{...tasks[0],contractRevision:'changed'}],taskId:'a',role:'executor',host}),/contracts/);
 const transport=await hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host});
 assert.equal(transport.status,'transport_error');assert.equal(transport.outcome,'transport_error');assert.equal(transport.reservationRetained,true);assert.equal(transport.session,'fresh');
 assert.equal(replay(store.read()).tasks.a.active.session,'fresh');
 const startRequest=replay(store.read()).tasks.a.active.context.startRequest;
 assert.equal(startRequest.status,'requested');assert.equal((await host.observeStartState({requestId:startRequest.requestId})).status,'ambiguous');
});
test('host completes review only with matching stop and unchanged canonical snapshot',async()=>{
 const store=setup(),snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],
   evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 const reviewerCaps={...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}};
 store.append({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:reviewerCaps,
   context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snapshot}},2);
 const result={revision:'D',verdict:'pass',findings:[],evidence:['independent review']};
 await assert.rejects(hostCompleteReview({store,loadTasks:()=>tasks,taskId:'a',result,host:adapter({observeStop:async()=>({session:'r',stopped:false,outcome:'cancel_requested',source:'host'}),snapshot:async()=>({...snapshot,source:'host'})})}),/confirm/);
 let postSnapshotRequest=null;
 const state=await hostCompleteReview({store,loadTasks:()=>tasks,taskId:'a',result,host:adapter({observeStop:async()=>({session:'r',stopped:true,outcome:'completed',source:'host'}),snapshot:async request=>{postSnapshotRequest=request;return {...snapshot,source:'host'};}})});
 assert.equal(state.tasks.a.status,'reviewed');
 assert.deepEqual(postSnapshotRequest.writeScope,[]);
});

test('official reviewer dispatch persists its attributed post-start baseline for completion',async()=>{
 const store=setup(),snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 const reviewerCaps={...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}};
 let live=workspace;
 const host=adapter({
  observeCapabilities:async()=>({runtime:reviewerCaps,matrix,source:'fixture'}),
  observeWorkspace:async()=>live,
  snapshot:async()=>({...snapshot,source:'host'}),
  observeStop:async()=>({session:'fresh',stopped:true,outcome:'completed',source:'host'}),
  prepare:async request=>({session:request.role==='integrator'?'i':'fresh',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  start:async(prepared,packet)=>{assert.equal(packet.assignment.context.workspaceSnapshotAfterStart,undefined);assert.equal(packet.assignment.context.startRequest.status,'requested');const before=live.toolCalls,reserved=packet.assignment.context.startRequest.operationToolCall;live={...live,toolCalls:[...before,reserved]};return {session:prepared.session,toolCall:reserved.id,workspaceTransition:{operation:'start',beforeFingerprint:'F',afterFingerprint:'F',beforeToolCalls:before,afterToolCalls:live.toolCalls,writeScope:[],changedPaths:[],source:'host'},source:'host'};},
  integrate:async(prepared)=>{const before=live.toolCalls,call={id:'integrate-1',operation:'integrate',actor:'i',session:'i',role:'integrator',source:'host'};live={...live,currentFingerprint:'I',toolCalls:[...before,call]};return {session:prepared.session,role:'integrator',toolCall:'integrate-1',workspaceTransition:{operation:'integrate',beforeFingerprint:'F',afterFingerprint:'I',beforeToolCalls:before,afterToolCalls:live.toolCalls,writeScope:['a.js'],changedPaths:['a.js'],source:'host'},source:'host'};},
 });
 const dispatched=await hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'reviewer',host});
 assert.equal(dispatched.status,'started');
 assert.equal(replay(store.read()).tasks.a.active.context.workspaceSnapshotAfterStart,undefined);
 assert.equal((await host.observeStartState({requestId:replay(store.read()).tasks.a.active.context.startRequest.requestId})).status,'observed');
 const completed=await hostCompleteReview({store,loadTasks:()=>tasks,taskId:'a',result:{revision:'D',verdict:'pass',findings:[],evidence:['independent review']},host});
 assert.equal(completed.tasks.a.status,'reviewed');
 const integrated=await hostIntegrate({store,loadTasks:()=>tasks,taskId:'a',host});
 assert.equal(integrated.status,'integrated_observed');
});

test('missing or unknown coordinator enforcement returns manual handoff before authorization or prepare',async()=>{
 let touched=false;
 for (const host of [
  {observeCapabilities:async()=>({runtime:caps,matrix,source:'fixture'}),observeWorkspace:async()=>workspace},
  adapter({enforceCoordinatorBoundary:async()=>({...boundary,enforced:'unknown'})}),
 ]) {
  host.authorize=async()=>{touched=true;return {granted:true,source:'user'};};
  host.prepare=async()=>{touched=true;return {};};
  const result=await hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host});
  assert.equal(result.status,'manual_handoff_required');
 }
 assert.equal(touched,false);
});

test('prepare is standby-only and workspace drift after prepare blocks start and cancels standby',async()=>{
 let observations=0,started=false,cancelled=false;
 const drift={...workspace,currentFingerprint:'DRIFT'};
 const host=adapter({
  observeWorkspace:async()=>++observations>=3?drift:workspace,
  prepareIntent:async request=>({intent:'intent:standby',actor:'standby',session:'standby',role:request.requestedRole,...request,operationToolCall:reservedCall(request,'standby','standby'),source:'host'}),
  prepare:async()=>({session:'standby',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  cancelPrepared:async()=>{cancelled=true;return {cancelled:true,source:'host'};},start:async()=>{started=true;},
 });
 await assert.rejects(hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/workspace.*drift/i);
 assert.equal(started,false);assert.equal(cancelled,true);
});

test('capability matrix never upgrades unavailable or unknown tools and native integration never falls back to root',async()=>{
 const unavailable={...matrix,integrate:{state:'unavailable',source:'fixture'}};
 const observed=await observeHostContract(adapter({observeCapabilities:async()=>({runtime:caps,matrix:unavailable,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'});
 assert.equal(observed.status,'ready');assert.equal(observed.capabilities.matrix.integrate.state,'unavailable');
 const store=setup(),snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 store.append({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snapshot}},2);
 store.append({type:'reviewResult',taskId:'a',session:'r',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot},3);
 const result=await hostIntegrate({store,loadTasks:()=>tasks,taskId:'a',host:adapter({observeCapabilities:async()=>({runtime:caps,matrix:unavailable,source:'fixture'}),prepare:async()=>({session:'i',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),start:async()=>({session:'i',toolCall:'call-1',source:'host'})})});
 assert.equal(result.operation,'dispatch_integrator');assert.notEqual(result.session,'root');
});

test('unknown or merely documented worker capability requires manual handoff',async()=>{
 for (const state of ['unknown','documented','unavailable']) {
  const constrained={...matrix,prepare:{state,source:'fixture'}};
  const result=await hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host:adapter({observeCapabilities:async()=>({runtime:caps,matrix:constrained,source:'fixture'})})});
  assert.equal(result.status,'manual_handoff_required');assert.equal(result.capability,'prepare');
 }
});

test('prompt claims cannot replace standby-only host attestation',async()=>{
 let started=false;
 const host=adapter({
  prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'prompt'},preparedOnly:false,toolCall:'already-running'}),
  start:async()=>{started=true;return {session:'fresh',toolCall:'call',source:'host'};},
 });
 await assert.rejects(hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/standby-only/);
 assert.equal(started,false);
});

test('stop observation, progress broker and native integration require host evidence',async()=>{
 const stop=await hostObserveStop({host:adapter({interrupt:async()=>({requested:true,source:'host'}),observeStop:async()=>({session:'s',stopped:false,outcome:'cancel_requested',source:'host'})}),session:'s',expectedWorkspace:workspace,coordinator:'root',assignment:{actor:'s',session:'s',role:'executor',writeScope:['a.js']},interrupt:true});
 assert.equal(stop.stopped,false);assert.equal(stop.outcome,'cancel_requested');
 const progressRequested={type:'progressRequested',taskId:'a',planningRevision:'plan',contractRevision:'a',integrationRevision:'I',receiptDigest:'receipt',indexBeforeHash:digest('before'),expectedChange:{from:'[ ]',to:'[x]'}};
 await assert.rejects(hostCommitProgress({host:adapter({commitProgress:async()=>({beforeHash:progressRequested.indexBeforeHash,afterHash:progressRequested.indexBeforeHash,changedPaths:['tasks.md'],source:'host'})}),request:{taskId:'a',indexBeforeHash:progressRequested.indexBeforeHash,progressRequested},expectedWorkspace:workspace,coordinator:'root'}),/after hash/i);
});

test('cancel request, confirmed stop and transport failure remain distinct',async()=>{
 const requested=await hostObserveStop({host:adapter({interrupt:async()=>({requested:true,source:'host'}),observeStop:async()=>({session:'s',stopped:false,outcome:'cancel_requested',source:'host'})}),session:'s',expectedWorkspace:workspace,coordinator:'root',assignment:{actor:'s',session:'s',role:'executor',writeScope:['a.js']},interrupt:true});
 assert.equal(requested.status,'cancel_requested');assert.equal(requested.stopped,false);
 const stopped=await hostObserveStop({host:adapter({observeStop:async()=>({session:'s',stopped:true,outcome:'cancelled',source:'host'})}),session:'s',expectedWorkspace:workspace,coordinator:'root',assignment:{actor:'s',session:'s',role:'executor',writeScope:['a.js']}});
 assert.equal(stopped.status,'stopped');assert.equal(stopped.outcome,'cancelled');
 const transport=await hostObserveStop({host:adapter({observeStop:async()=>{throw new Error('link down');}}),session:'s',expectedWorkspace:workspace,coordinator:'root',assignment:{actor:'s',session:'s',role:'executor',writeScope:['a.js']}});
 assert.equal(transport.status,'transport_error');assert.equal(transport.stopped,false);
});
test('stop rejects incomplete identity before authorization or interrupt side effects',async()=>{
 let authorized=0,interrupted=0;
 const host=adapter({
  authorize:async()=>{authorized++;return {granted:true,source:'host'};},
  interrupt:async()=>{interrupted++;return {requested:true,source:'host'};},
 });
 await assert.rejects(hostObserveStop({host,session:undefined,expectedWorkspace:workspace,coordinator:'root',assignment:{role:'executor',writeScope:['a.js']},interrupt:true}),/identity|session/i);
 assert.equal(authorized,0);assert.equal(interrupted,0);
 await assert.rejects(hostObserveStop({host,session:'s',expectedWorkspace:workspace,coordinator:'root',assignment:{actor:'s',session:'s',role:'executor',writeScope:['a.js']},interrupt:true}),/bind.*exact|authorization/i);
 assert.equal(authorized,1);assert.equal(interrupted,0);
});

test('capabilities are reobserved and revocation between awaits prevents start',async()=>{
 let observations=0,started=false;
 const host=adapter({
  observeCapabilities:async()=>({runtime:caps,matrix:observations++?{...matrix,start:{state:'unknown',source:'fixture'}}:matrix,source:'fixture'}),
  start:async()=>{started=true;return {session:'fresh',toolCall:'call',source:'host'};},
 });
 const result=await hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host});
 assert.equal(result.status,'manual_handoff_required');assert.equal(result.capability,'start');assert.equal(started,false);
});

test('host observations reject caller provenance and unknown fields',async()=>{
 await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:caps,matrix,source:'caller'})}),{expectedWorkspace:workspace,coordinator:'root'}),/provenance|source|host-owned/i);
 await assert.rejects(observeHostContract(adapter({verifyHostObservation:async()=>false}),{expectedWorkspace:workspace,coordinator:'root'}),/provenance|verified/i);
 await assert.rejects(observeHostContract(adapter({observeWorkspace:async()=>({...workspace,source:'fixture',forged:true})}),{expectedWorkspace:workspace,coordinator:'root'}),/unknown|schema/i);
 await assert.rejects(observeHostContract(adapter({observeWorkspace:async()=>({...workspace,repoIdentity:{...workspace.repoIdentity,forged:true}})}),{expectedWorkspace:workspace,coordinator:'root'}),/unknown|schema/i);
 await assert.rejects(observeHostContract(adapter({enforceCoordinatorBoundary:async()=>({...boundary,source:'fixture',promptClaim:'read-only'})}),{expectedWorkspace:workspace,coordinator:'root'}),/unknown|schema/i);
});

test('workspace bindings and every tool call use exact recursive schemas',async()=>{
 await assert.rejects(observeHostContract(adapter({observeWorkspace:async()=>({...workspace,packageRootRealpath:{forged:true}})}),{expectedWorkspace:workspace,coordinator:'root'}),/packageRootRealpath|string|schema/i);
 await assert.rejects(observeHostContract(adapter({observeWorkspace:async()=>({...workspace,planningFingerprint:7})}),{expectedWorkspace:workspace,coordinator:'root'}),/planningFingerprint|string|schema/i);
 await assert.rejects(observeHostContract(adapter({observeWorkspace:async()=>({...workspace,workspaceBaselineFingerprint:[]})}),{expectedWorkspace:workspace,coordinator:'root'}),/workspaceBaselineFingerprint|string|schema/i);
 await assert.rejects(observeHostContract(adapter({observeWorkspace:async()=>({...workspace,toolCalls:[{id:'call-1',operation:'start',actor:'fresh',session:'fresh',role:'executor',source:'host',forged:true}]})}),{expectedWorkspace:workspace,coordinator:'root'}),/tool call|unknown|schema/i);
});

test('workspace paths reject non-canonical or ambiguous spellings',async()=>{
 for(const path of ['/absolute.js','../escape.js','a/../b.js','./a.js','a\\b.js','']){
  await assert.rejects(observeHostContract(adapter({observeWorkspace:async()=>({...workspace,writeScope:[path]})}),{expectedWorkspace:workspace,coordinator:'root'}),/path|canonical|scope/i);
 }
});

test('runtime path claims reject escape, ambiguity and duplicates',async()=>{
 const runtime=name=>({...caps,externalActive:1,externalReservations:[{actor:'external',role:'executor',claims:[{type:'path',name,mode:'write'}]}]});
 for(const name of ['/absolute.js','../escape.js','a/../b.js','./a.js','a\\b.js','']){
  await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:runtime(name),matrix,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'}),/path|canonical|claim/i);
 }
 const duplicate={...caps,externalActive:1,externalReservations:[{actor:'external',role:'executor',claims:[{type:'path',name:'a.js',mode:'write'},{type:'path',name:'a.js',mode:'write'}]}]};
 await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:duplicate,matrix,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'}),/duplicate|unique|claim/i);
 const conflicting={...caps,externalActive:1,externalReservations:[{actor:'external',role:'executor',claims:[{type:'path',name:'a.js',mode:'read'},{type:'path',name:'a.js',mode:'write'}]}]};
 await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:conflicting,matrix,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'}),/duplicate|conflict|unique|claim/i);
 const semanticConflict={...caps,externalActive:1,externalReservations:[{actor:'external',role:'executor',claims:[{type:'path',name:'A.js',mode:'read'},{type:'path',name:'a.js',mode:'write'}]}]};
 await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:semanticConflict,matrix,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'}),/duplicate|conflict|unique|claim/i);
});

test('exported host observations are deeply immutable',async()=>{
 const result=await observeHostContract(adapter(),{expectedWorkspace:workspace,coordinator:'root'});
 assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.capabilities),true);assert.equal(Object.isFrozen(result.capabilities.runtime.models[0]),true);
 assert.throws(()=>{result.capabilities.runtime.models[0].model='mutated';},TypeError);
});

test('authorized workspace transition accepts attributed tool call and rejects out-of-scope drift',async()=>{
 const expected={...workspace,toolCalls:[],writeScope:['a.js']};let started=false;
 const startToolCall={id:'call-1',operation:'start',actor:'fresh',session:'fresh',role:'executor',source:'host'};
 const after={...expected,toolCalls:[startToolCall]};
 const transition={operation:'start',beforeFingerprint:'F',afterFingerprint:'F',beforeToolCalls:[],afterToolCalls:[startToolCall],writeScope:['a.js'],changedPaths:[],source:'host'};
 const store=(()=>{let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'},workspaceBinding:expected});return {read:()=>j,append:(e,n,hostDerive)=>j=hostDerive?hostDerive(j,e,n):appendEvent(j,e,n)};})();
 const host=adapter({observeWorkspace:async()=>started?after:expected,start:async()=>{started=true;return {session:'fresh',toolCall:'call-1',source:'host',workspaceTransition:transition};}});
 const result=await hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host});
 assert.equal(result.status,'started');

 const badStore=(()=>{let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'},workspaceBinding:expected});return {read:()=>j,append:(e,n,hostDerive)=>j=hostDerive?hostDerive(j,e,n):appendEvent(j,e,n)};})();
 let badStarted=false;const badAfter={...expected,currentFingerprint:'BAD'};
 await assert.rejects(hostDispatch({store:badStore,loadTasks:()=>tasks,taskId:'a',role:'executor',host:adapter({observeWorkspace:async()=>badStarted?badAfter:expected,start:async()=>{badStarted=true;return {session:'fresh',toolCall:'call-1',source:'host',workspaceTransition:{...transition,afterFingerprint:'BAD',changedPaths:['outside.js']}};}})}),/scope|transition|drift/i);

 const rogueStore=(()=>{let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'},workspaceBinding:expected});return {read:()=>j,append:(e,n,hostDerive)=>j=hostDerive?hostDerive(j,e,n):appendEvent(j,e,n)};})();
 let rogueStarted=false;const rogueCall={...startToolCall,id:'rogue-call',actor:'rogue'};const rogueAfter={...expected,toolCalls:[rogueCall]};
 await assert.rejects(hostDispatch({store:rogueStore,loadTasks:()=>tasks,taskId:'a',role:'executor',host:adapter({observeWorkspace:async()=>rogueStarted?rogueAfter:expected,start:async()=>{rogueStarted=true;return {session:'fresh',toolCall:'call-1',source:'host',workspaceTransition:{...transition,afterToolCalls:[rogueCall]}};}})}),/tool.?call|actor|session|transition/i);
});

test('start mutation requires a workspace transition even when the host reports stable workspace',async()=>{
 const host=adapter();host.start=async()=>({session:'fresh',toolCall:'call-without-transition',source:'host'});
 await assert.rejects(hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/transition.*required|requires.*transition/i);
});

test('review snapshot, preparation intent, grants and leases always use zero write scope',async()=>{
 const reviewWorkspace={...workspace,writeScope:['a.js'],toolCalls:[]},reviewCall={id:'review-call',operation:'start',actor:'fresh',session:'fresh',role:'reviewer',source:'host'};
 const afterReview={...reviewWorkspace,toolCalls:[reviewCall]};let currentWorkspace=reviewWorkspace;
 let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'},workspaceBinding:reviewWorkspace});
 const store={read:()=>j,append:(e,n,hostDerive)=>j=hostDerive?hostDerive(j,e,n):appendEvent(j,e,n)};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 const reviewerCaps={...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}};
 const observed={snapshot:null,intent:null,grants:[],leases:[]};
 const host=adapter({
  observeCapabilities:async()=>({runtime:reviewerCaps,matrix,source:'fixture'}),observeWorkspace:async()=>currentWorkspace,
  snapshot:async request=>{observed.snapshot=request;return {revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope',source:'host'};},
  prepareIntent:async request=>{observed.intent=request;return {intent:'review-intent',actor:'fresh',session:'fresh',role:'reviewer',...request,operationToolCall:reservedCall(request,'fresh','fresh','review-call'),source:'host'};},
  authorize:async request=>{observed.grants.push(request);return granted(request);},
  withCapabilityLease:async(request,operation)=>{observed.leases.push(request);const value=await operation();return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value,source:'host'};},
  start:async()=>{currentWorkspace=afterReview;return {session:'fresh',toolCall:'review-call',workspaceTransition:{operation:'start',beforeFingerprint:'F',afterFingerprint:'F',beforeToolCalls:[],afterToolCalls:[reviewCall],writeScope:[],changedPaths:[],source:'host'},source:'host'};},
 });
 const result=await hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'reviewer',host});assert.equal(result.status,'started');
 assert.deepEqual(observed.snapshot.writeScope,[]);assert.deepEqual(observed.intent.writeScope,[]);
 for(const request of [...observed.grants,...observed.leases])assert.deepEqual(request.writeScope,[]);
});

test('objective verifier has an official distinct host-owned dispatch with zero write scope',async()=>{
 let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'},workspaceBinding:workspace});
 const ev=event=>j=appendEvent(j,event,replay(j).sequence),snap=revision=>({revision,changedFiles:['a.js'],scopeFingerprint:`${revision}-scope`});
 ev({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host',reservedActor:'executor-actor'}});
 ev({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}});
 const reviewerCaps={...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}};
 ev({type:'dispatch',taskId:'a',role:'reviewer',session:'r1',capabilities:reviewerCaps,context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snap('D')}});
 ev({type:'reviewResult',taskId:'a',session:'r1',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snap('D')});
 ev({type:'dispatch',taskId:'a',role:'integrator',session:'i',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}});
 ev({type:'integrate',taskId:'a',session:'i',stopped:true,integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]});
 const integrationReviewerCaps={...reviewerCaps,reviewIsolation:{...reviewerCaps.reviewIsolation,targetRevision:'I'}};
 ev({type:'dispatch',taskId:'a',role:'reviewer',session:'r2',capabilities:integrationReviewerCaps,context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snap('I')}});
 ev({type:'reviewResult',taskId:'a',session:'r2',stopped:true,revision:'I',verdict:'pass',findings:[],evidence:['integration review'],snapshotAfter:snap('I')});
 ev({type:'decide',taskId:'a',disposition:'accepted',reason:'accepted',checks:{scope:'checked',behavior:'checked',independence:'checked',integration:'checked',authority:'grant'},limitations:[]});
 const receiptDigest=digest(replay(j).tasks.a.receipt);
 const progressRequested={type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'a',integrationRevision:'I',receiptDigest,indexBeforeHash:digest('before'),expectedChange:{from:'[ ]',to:'[x]'}};
 ev(progressAuthorityEvent(j,progressRequested));
 ev(progressAuthorityEvent(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:progressRequested.indexBeforeHash,indexAfterHash:digest('after')},progressRequested));
 const objective=objectiveSnapshot(j),completedJournal=JSON.parse(JSON.stringify(j)),store={read:()=>j,append:(event,sequence,hostDerive)=>j=hostDerive?hostDerive(j,event,sequence):appendEvent(j,event,sequence)};
 // This fake observer fingerprints implementation scope; checkbox bytes have
 // their separate broker hashes, so this fixture's project fingerprint is stable.
 const progressProof={requestId:`progress:${digest({projectRootRealpath:'/project',canonicalIndex:'tasks.md',progressRequested})}`,status:'observed',actor:'progress-broker',session:'progress-broker',role:'progress-broker',taskId:'a',projectRootRealpath:'/project',canonicalIndex:'tasks.md',progressRequested,workspaceBeforeDigest:digest(workspace),workspace,workspaceTransition:{operation:'progress',beforeFingerprint:'F',afterFingerprint:'F',beforeToolCalls:[],afterToolCalls:[],writeScope:['tasks.md'],changedPaths:[],source:'host'},indexAfterHash:digest('after'),source:'host'};
 const verifierHost=overrides=>adapter({observeProgressState:async()=>structuredClone(progressProof),...overrides});
 const observed={snapshot:null,intent:null,grants:[],leases:[]};
 const host=verifierHost({
  snapshot:async request=>{observed.snapshot=request;return {revision:objective.objectiveRevision,changedFiles:['a.js'],scopeFingerprint:'objective-scope',source:'host'};},
  prepareIntent:async request=>{observed.intent=request;return {intent:'objective-intent',actor:'objective-verifier',session:'objective-verifier',role:'verifier',...request,operationToolCall:reservedCall(request,'objective-verifier','objective-verifier'),source:'host'};},
  prepare:async()=>({session:'objective-verifier',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  authorize:async request=>{observed.grants.push(request);return granted(request);},
  withCapabilityLease:async(request,operation)=>{observed.leases.push(request);const value=await operation();return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value,source:'host'};},
 });
 const result=await hostDispatchVerifier({store,loadTasks:()=>tasks,host});
 assert.equal(result.status,'started',JSON.stringify(result));assert.equal(result.role,'verifier');assert.equal(replay(store.read()).objectiveVerifier.session,'objective-verifier');
 assert.deepEqual(observed.snapshot.writeScope,[]);assert.deepEqual(observed.intent.writeScope,[]);
 for(const request of [...observed.grants,...observed.leases])assert.deepEqual(request.writeScope,[]);

 host.observeStop=async()=>({session:'objective-verifier',stopped:true,outcome:'completed',source:'host'});
 const stopped=await hostObserveStop({host,session:'objective-verifier',expectedWorkspace:result.workspace,coordinator:'root',assignment:{actor:'objective-verifier',session:'objective-verifier',role:'verifier',writeScope:[]}});
 assert.equal(stopped.status,'stopped');assert.equal(stopped.outcome,'completed');
 host.observeStop=async()=>{throw new Error('verifier transport down');};
 const transportStop=await hostObserveStop({host,session:'objective-verifier',expectedWorkspace:result.workspace,coordinator:'root',assignment:{actor:'objective-verifier',session:'objective-verifier',role:'verifier',writeScope:[]}});
 assert.equal(transportStop.status,'transport_error');assert.equal(transportStop.stopped,false);

 let transportJournal=JSON.parse(JSON.stringify(completedJournal));const transportStore={read:()=>transportJournal,append:(event,sequence,hostDerive)=>transportJournal=hostDerive?hostDerive(transportJournal,event,sequence):appendEvent(transportJournal,event,sequence)};
 const transportStart=await hostDispatchVerifier({store:transportStore,loadTasks:()=>tasks,host:verifierHost({snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'objective-scope',source:'host'}),prepareIntent:async request=>({intent:'transport-intent',actor:'transport-verifier',session:'transport-verifier',role:'verifier',...request,operationToolCall:reservedCall(request,'transport-verifier','transport-verifier'),source:'host'}),prepare:async()=>({session:'transport-verifier',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),start:async()=>{throw new Error('start down');}})});
 assert.equal(transportStart.status,'transport_error');assert.equal(transportStart.reservationRetained,true);assert.equal(transportStart.session,'transport-verifier');

 let staleJournal=JSON.parse(JSON.stringify(completedJournal));const staleStore={read:()=>staleJournal,append:(event,sequence,hostDerive)=>staleJournal=hostDerive?hostDerive(staleJournal,event,sequence):appendEvent(staleJournal,event,sequence)};
 await assert.rejects(hostDispatchVerifier({store:staleStore,loadTasks:()=>tasks,host:verifierHost({snapshot:async()=>({revision:'stale-objective',changedFiles:['a.js'],scopeFingerprint:'stale',source:'host'})})}),/snapshot.*revision|objective.*revision|stale/i);

 let reusedJournal=JSON.parse(JSON.stringify(completedJournal));const reusedStore={read:()=>reusedJournal,append:(event,sequence,hostDerive)=>reusedJournal=hostDerive?hostDerive(reusedJournal,event,sequence):appendEvent(reusedJournal,event,sequence)};
 await assert.rejects(hostDispatchVerifier({store:reusedStore,loadTasks:()=>tasks,host:verifierHost({snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'objective-scope',source:'host'}),prepareIntent:async request=>({intent:'reused-intent',actor:'r2',session:'r2',role:'verifier',...request,operationToolCall:reservedCall(request,'r2','r2'),source:'host'})})}),/fresh|distinct|reuse/i);
 let reusedActorJournal=JSON.parse(JSON.stringify(completedJournal));const reusedActorStore={read:()=>reusedActorJournal,append:(event,sequence,hostDerive)=>reusedActorJournal=hostDerive?hostDerive(reusedActorJournal,event,sequence):appendEvent(reusedActorJournal,event,sequence)};
 await assert.rejects(hostDispatchVerifier({store:reusedActorStore,loadTasks:()=>tasks,host:verifierHost({snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'objective-scope',source:'host'}),prepareIntent:async request=>({intent:'reused-actor',actor:'executor-actor',session:'new-verifier-session',role:'verifier',...request,operationToolCall:reservedCall(request,'executor-actor','new-verifier-session'),source:'host'})})}),/fresh|distinct|reuse/i);

 let pausedJournal=JSON.parse(JSON.stringify(completedJournal)),startedAfterPause=false;const pausedStore={read:()=>pausedJournal,append:(event,sequence,hostDerive)=>pausedJournal=hostDerive?hostDerive(pausedJournal,event,sequence):appendEvent(pausedJournal,event,sequence)};
 const pausedResult=await hostDispatchVerifier({store:pausedStore,loadTasks:()=>tasks,host:verifierHost({
  snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'objective-scope',source:'host'}),
  prepareIntent:async request=>({intent:'paused-verifier',actor:'paused-verifier',session:'paused-verifier',role:'verifier',...request,operationToolCall:reservedCall(request,'paused-verifier','paused-verifier'),source:'host'}),
  prepare:async()=>({session:'paused-verifier',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  authorize:async request=>{if(request.operation==='startVerifier')pausedStore.append({type:'pause',source:'user',reason:'pause during authorization'},replay(pausedStore.read()).sequence);return granted(request);},
  start:async()=>{startedAfterPause=true;return {session:'paused-verifier',toolCall:'call-1',source:'host'};},
 })});
 assert.equal(pausedResult.status,'transport_error');assert.equal(startedAfterPause,false);

 let driftJournal=JSON.parse(JSON.stringify(completedJournal)),drifted=false,startedAfterDrift=false;const driftStore={read:()=>driftJournal,append:(event,sequence,hostDerive)=>driftJournal=hostDerive?hostDerive(driftJournal,event,sequence):appendEvent(driftJournal,event,sequence)};
 const driftResult=await hostDispatchVerifier({store:driftStore,loadTasks:()=>tasks,host:verifierHost({
  observeWorkspace:async()=>drifted?{...workspace,currentFingerprint:'DRIFT'}:workspace,
  snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'objective-scope',source:'host'}),
  prepareIntent:async request=>({intent:'drift-verifier',actor:'drift-verifier',session:'drift-verifier',role:'verifier',...request,operationToolCall:reservedCall(request,'drift-verifier','drift-verifier'),source:'host'}),
  prepare:async()=>({session:'drift-verifier',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  withCapabilityLease:async(request,operation)=>{if(request.operation==='start')drifted=true;const value=await operation();return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value,source:'host'};},
  start:async()=>{startedAfterDrift=true;},
 })});
 assert.equal(driftResult.status,'transport_error');assert.equal(startedAfterDrift,false);

 let revokedJournal=JSON.parse(JSON.stringify(completedJournal)),revoked=false,startedAfterRevoke=false;const revokedStore={read:()=>revokedJournal,append:(event,sequence,hostDerive)=>revokedJournal=hostDerive?hostDerive(revokedJournal,event,sequence):appendEvent(revokedJournal,event,sequence)};
 const unavailableStart={...matrix,start:{state:'unavailable',source:'fixture'}};
 const revokedResult=await hostDispatchVerifier({store:revokedStore,loadTasks:()=>tasks,host:verifierHost({
  observeCapabilities:async()=>({runtime:caps,matrix:revoked?unavailableStart:matrix,source:'fixture'}),
  snapshot:async request=>({revision:request.revision,changedFiles:['a.js'],scopeFingerprint:'objective-scope',source:'host'}),
  prepareIntent:async request=>({intent:'revoked-verifier',actor:'revoked-verifier',session:'revoked-verifier',role:'verifier',...request,operationToolCall:reservedCall(request,'revoked-verifier','revoked-verifier'),source:'host'}),
  prepare:async()=>({session:'revoked-verifier',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  withCapabilityLease:async(request,operation)=>{if(request.operation==='start')revoked=true;const value=await operation();return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value,source:'host'};},
  start:async()=>{startedAfterRevoke=true;},
 })});
 assert.equal(revokedResult.status,'transport_error');assert.equal(startedAfterRevoke,false);
});

test('dispatch authorization and prepare lease bind exact project task role scope and reserved identity',async()=>{
 const store=setup();let prepared=false,leaseRequest=null;
 const host=adapter({
  authorize:async request=>({granted:true,source:'host',operation:request.operation,actor:request.actor,session:request.session,role:request.role}),
  withCapabilityLease:async(request,operation)=>{if(request.operation==='prepare')leaseRequest=request;const value=await operation();return {status:'consumed',operation:request.operation,actor:request.actor,session:request.session,role:request.role,generation:request.lease.generation,token:request.lease.token,value,source:'host'};},
  prepare:async()=>{prepared=true;return {session:'fresh',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true,source:'host'};},
 });
 await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/scope|project|task|requestedRole|writeScope|schema/i);
 assert.equal(prepared,false);

 const boundStore=setup();
 const boundHost=adapter({withCapabilityLease:async(request,operation)=>{if(request.operation==='prepare')leaseRequest=request;const value=await operation();return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value,source:'host'};}});
 await hostDispatch({store:boundStore,loadTasks:()=>tasks,taskId:'a',role:'executor',host:boundHost});
 assert.equal(leaseRequest.actor,'fresh');assert.equal(leaseRequest.session,'fresh');assert.equal(leaseRequest.taskId,'a');assert.equal(leaseRequest.requestedRole,'executor');assert.deepEqual(leaseRequest.writeScope,['a.js']);assert.equal(leaseRequest.projectRootRealpath,'/project');
});

test('actor and session are independently reserved and tool calls bind the real actor',async()=>{
 let touched=false;
 await assert.rejects(hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host:adapter({
  prepareIntent:async request=>({intent:'root-actor',actor:'root',session:'fresh',role:'executor',...request,operationToolCall:reservedCall(request,'root','fresh'),source:'host'}),
  prepare:async()=>{touched=true;return {session:'fresh',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true};},
  start:async()=>{touched=true;},
 })}),/actor|coordinator|fresh|distinct/i);
 assert.equal(touched,false);

 const split=await hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host:adapter({
  prepareIntent:async request=>({intent:'split-identity',actor:'worker-actor',session:'fresh',role:'executor',...request,operationToolCall:reservedCall(request,'worker-actor','fresh'),source:'host'}),
 })});
 assert.equal(split.status,'started');
 assert.equal(split.workspace.toolCalls.at(-1).actor,'worker-actor');
});

test('native integration authorization binds a fresh integrator actor and rejects reviewer reuse',async()=>{
 const store=setup(),snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 store.append({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snapshot}},2);
 store.append({type:'reviewResult',taskId:'a',session:'r',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot},3);
 let authorization=null;
 await assert.rejects(hostIntegrate({store,loadTasks:()=>tasks,taskId:'a',host:adapter({
  prepareIntent:async request=>({intent:'intent:r',actor:'r',session:'r',role:'integrator',...request,operationToolCall:reservedCall(request,'r','r'),source:'host'}),
  authorize:async request=>{authorization=request;return granted(request);},
  integrate:async()=>({session:'r',role:'integrator',toolCall:'integrate',source:'host'}),
 })}),/fresh|reviewer|session reuse|distinct/i);
 assert.equal(authorization,null);
});

test('native integration reserves its actor and accepts only its attributed scoped transition',async()=>{
 const integrationToolCall={id:'integrate-1',operation:'integrate',actor:'i',session:'i',role:'integrator',source:'host'};
 const expected={...workspace,toolCalls:[],writeScope:['a.js']},after={...workspace,currentFingerprint:'I',toolCalls:[integrationToolCall],writeScope:['a.js']};
 let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'},workspaceBinding:expected});
 const store={read:()=>j,append:(e,n,hostDerive)=>j=hostDerive?hostDerive(j,e,n):appendEvent(j,e,n)};const snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 store.append({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snapshot}},2);
 store.append({type:'reviewResult',taskId:'a',session:'r',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot},3);
 const reviewedJournal=JSON.parse(JSON.stringify(j));
 let integrated=false;
 const result=await hostIntegrate({store,loadTasks:()=>tasks,taskId:'a',host:adapter({
  observeWorkspace:async()=>integrated?after:expected,
  prepare:async()=>({session:'i',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  authorize:async request=>granted(request),
  integrate:async(prepared,packet)=>{assert.equal(prepared.session,'i');assert.equal(packet.assignment.role,'integrator');integrated=true;return {session:'i',role:'integrator',toolCall:'integrate-1',source:'host',workspaceTransition:{operation:'integrate',beforeFingerprint:'F',afterFingerprint:'I',beforeToolCalls:[],afterToolCalls:[integrationToolCall],writeScope:['a.js'],changedPaths:['a.js'],source:'host'}};},
 })});
 assert.equal(result.status,'integrated_observed');assert.equal(replay(store.read()).tasks.a.active.session,'i');

 let pausedJournal=JSON.parse(JSON.stringify(reviewedJournal)),integratedAfterPause=false;const pausedStore={read:()=>pausedJournal,append:(event,sequence,hostDerive)=>pausedJournal=hostDerive?hostDerive(pausedJournal,event,sequence):appendEvent(pausedJournal,event,sequence)};
 const paused=await hostIntegrate({store:pausedStore,loadTasks:()=>tasks,taskId:'a',host:adapter({
  prepare:async()=>({session:'i',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  authorize:async request=>{if(request.operation==='integrate')pausedStore.append({type:'pause',source:'user',reason:'pause during integration authorization'},replay(pausedStore.read()).sequence);return granted(request);},
  integrate:async()=>{integratedAfterPause=true;},
 })});
 assert.equal(paused.status,'transport_error');assert.equal(integratedAfterPause,false);
});

test('capability revocation during attestation cannot race into start side effects',async()=>{
 let revoked=false,started=false,checks=0;
 const host=adapter({
  verifyHostObservation:async({kind,observation})=>{if(kind==='capability observation'&&++checks===12) revoked=true;return observation?.source!=='caller';},
  start:async()=>{started=true;return {session:'fresh',toolCall:'call',source:'host'};},
  withCapabilityLease:async(request,operation)=>revoked?{status:'revoked',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,source:'host'}:{status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value:await operation(),source:'host'},
 });
 const result=await hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host});
 assert.equal(result.status,'manual_handoff_required');assert.equal(started,false);
});

test('invalid prepare lease receipt preserves a known standby reservation as ambiguous',async()=>{
 const store=setup();let prepared=false,cancelled=false;
 const host=adapter({
  withCapabilityLease:async(request,operation)=>{
   const value=await operation();
   if(request.operation==='prepare')return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:'wrong-token',value,source:'host'};
   return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.lease.token,value,source:'host'};
  },
  prepareIntent:async request=>({intent:'intent:ambiguous',actor:'standby-ambiguous',session:'standby-ambiguous',role:request.requestedRole,...request,operationToolCall:reservedCall(request,'standby-ambiguous','standby-ambiguous'),source:'host'}),
  prepare:async()=>{prepared=true;return {session:'standby-ambiguous',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true,source:'host'};},
  cancelPrepared:async()=>{cancelled=true;return {cancelled:true,source:'host'};},
 });
 const result=await hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host});
 assert.equal(prepared,true);assert.equal(cancelled,false);
 assert.equal(result.status,'manual_handoff_required');assert.equal(result.outcome,'ambiguous_prepare');assert.equal(result.reservationRetained,true);assert.equal(result.session,'standby-ambiguous');
 assert.equal(replay(store.read()).tasks.a.active.session,'standby-ambiguous');
});

test('invalid start receipt and post-start persistence crash never establish a baseline',async()=>{
 const invalidStore=setup();
 const invalidHost=adapter({withCapabilityLease:async(request,operation)=>{const value=await operation();return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.operation==='start'?'invalid':request.lease.token,value,source:'host'};}});
 const invalid=await hostDispatch({store:invalidStore,loadTasks:()=>tasks,taskId:'a',role:'executor',host:invalidHost});
 assert.equal(invalid.status,'transport_error');assert.equal(invalid.startState,'ambiguous');
 const invalidRequest=replay(invalidStore.read()).tasks.a.active.context.startRequest;
 assert.equal(invalidRequest.workspace,undefined);assert.equal((await invalidHost.observeStartState({requestId:invalidRequest.requestId})).status,'ambiguous');

 let persisted=null;const crashStore=setup();
 const crashHost=adapter({
  persistStartState:async request=>{if(request.status==='requested'){persisted={...request,requestId:'crash-start',source:'host'};return persisted;}if(request.status==='observed')throw new Error('crash before observed receipt');persisted={...persisted,status:'ambiguous',source:'host'};return persisted;},
  observeStartState:async()=>persisted,
 });
 const crashed=await hostDispatch({store:crashStore,loadTasks:()=>tasks,taskId:'a',role:'executor',host:crashHost});
 assert.equal(crashed.status,'transport_error');assert.equal(crashed.startState,'pending');
 const crashRequest=replay(crashStore.read()).tasks.a.active.context.startRequest;
 assert.equal(crashRequest.workspace,undefined);assert.equal((await crashHost.observeStartState({requestId:crashRequest.requestId})).status,'requested');
});

test('start identity is reserved before authorization and grant must echo its full binding',async()=>{
 const store=setup();let started=false,seenReserved=false;
 const host=adapter({
  authorize:async request=>{
   if(request.operation==='start') seenReserved=replay(store.read()).tasks.a.active?.session===request.session;
   return request.operation==='start'?{granted:true,source:'host'}:granted(request);
  },
  start:async()=>{started=true;return {session:'fresh',toolCall:'call',source:'host'};},
 });
 await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/bind.*actor.*session.*role|authorization.*schema/i);
 assert.equal(seenReserved,true);assert.equal(started,false);
});

test('stop transition uses exact assignment scope and reviewers have zero write scope',async()=>{
 const expected={...workspace,currentFingerprint:'F',toolCalls:[],writeScope:['a.js','b.js']};
 const changed={...expected,currentFingerprint:'B'};
 const transition={operation:'stop',beforeFingerprint:'F',afterFingerprint:'B',beforeToolCalls:[],afterToolCalls:[],writeScope:['a.js','b.js'],changedPaths:['b.js'],source:'host'};
 let stopped=false;
 await assert.rejects(hostObserveStop({host:adapter({observeWorkspace:async()=>stopped?changed:expected,observeStop:async()=>{stopped=true;return {session:'s',stopped:true,outcome:'completed',workspaceTransition:transition,source:'host'};}}),session:'s',expectedWorkspace:expected,coordinator:'root',assignment:{actor:'s',session:'s',role:'executor',writeScope:['a.js']}}),/scope|drift/i);
 stopped=false;
 await assert.rejects(hostObserveStop({host:adapter({observeWorkspace:async()=>stopped?changed:expected,observeStop:async()=>{stopped=true;return {session:'r',stopped:true,outcome:'completed',workspaceTransition:{...transition,changedPaths:['a.js']},source:'host'};}}),session:'r',expectedWorkspace:expected,coordinator:'root',assignment:{actor:'r',session:'r',role:'reviewer',writeScope:[]}}),/scope|review/i);
});

test('attestation cannot mutate a value after its closed-schema check',async()=>{
 const host=adapter({observeWorkspace:async()=>({...workspace,repoIdentity:{...workspace.repoIdentity}}),verifyHostObservation:async({kind,observation})=>{if(kind==='workspace observation') observation.forged=true;return true;}});
 await assert.rejects(observeHostContract(host,{expectedWorkspace:workspace,coordinator:'root'}),/mutat|unknown|schema|digest/i);
});

test('nested capability and stop schemas enforce types and enums',async()=>{
 await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:{...caps,maxAgents:'2'},matrix,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'}),/maxAgents|integer|runtime/i);
 await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:{...caps,models:[{model:'e',efforts:'high'}]},matrix,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'}),/efforts|array|runtime/i);
 await assert.rejects(observeHostContract(adapter({observeCapabilities:async()=>({runtime:{...caps,externalActive:1,externalReservations:[{claims:'forged'}]},matrix,source:'fixture'})}),{expectedWorkspace:workspace,coordinator:'root'}),/reservation|claims|array/i);
 await assert.rejects(hostObserveStop({host:adapter({observeStop:async()=>({session:'s',stopped:true,outcome:'invented',source:'host'})}),session:'s',expectedWorkspace:workspace,coordinator:'root',assignment:{actor:'s',session:'s',role:'executor',writeScope:['a.js']}}),/outcome|enum|invalid/i);
});

test('cancelPrepared is never called without an observed capability',async()=>{
 let cancelled=false;
 const constrained={...matrix,cancelPrepared:{state:'unavailable',source:'fixture'}};
 const result=await hostDispatch({store:setup(),loadTasks:()=>tasks,taskId:'a',role:'executor',host:adapter({
  observeCapabilities:async()=>({runtime:caps,matrix:constrained,source:'fixture'}),
  prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:false}),
  cancelPrepared:async()=>{cancelled=true;},
 })});
 assert.equal(result.status,'manual_handoff_required');assert.equal(result.reservationRetained,true);assert.equal(cancelled,false);
});

test('native integration transport failure is explicit and retains its reservation',async()=>{
 const store=setup(),snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 store.append({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snapshot}},2);
 store.append({type:'reviewResult',taskId:'a',session:'r',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot},3);
 const result=await hostIntegrate({store,loadTasks:()=>tasks,taskId:'a',host:adapter({
  prepare:async()=>({session:'i',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true}),
  authorize:async request=>granted(request),
  integrate:async()=>{throw new Error('link down');},
 })});
 assert.equal(result.status,'transport_error');assert.equal(result.reservationRetained,true);assert.equal(replay(store.read()).tasks.a.active.session,'i');
});

test('invalid native integrator prepare receipt preserves its known reservation as ambiguous',async()=>{
 const store=setup(),snapshot={revision:'D',changedFiles:['a.js'],scopeFingerprint:'D-scope'};
 store.append({type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}},0);
 store.append({type:'deliver',taskId:'a',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:'a',baseRevision:'B',revision:'D',changedFiles:['a.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed:{invocation:'test',scope:'declared',targets:['a.js'],source:'host'}}]}},1);
 store.append({type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:{...caps,models:[...caps.models,{model:'r',efforts:['medium']}],reviewIsolation:{enforced:true,mode:'read-only',provider:'fixture',projectScope:'project',targetRevision:'D'}},context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snapshot}},2);
 store.append({type:'reviewResult',taskId:'a',session:'r',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot},3);
 let cancelled=false;
 const result=await hostIntegrate({store,loadTasks:()=>tasks,taskId:'a',host:adapter({
  prepare:async()=>({session:'i',context:{fresh:true,inheritedHistory:false,source:'host'},preparedOnly:true,source:'host'}),
  withCapabilityLease:async(request,operation)=>{const value=await operation();return {status:'consumed',...bindingEcho(request),generation:request.lease.generation,token:request.operation==='prepare'?'invalid':request.lease.token,value,source:'host'};},
  cancelPrepared:async()=>{cancelled=true;return {cancelled:true,source:'host'};},
 })});
 assert.equal(result.status,'manual_handoff_required');assert.equal(result.outcome,'ambiguous_prepare');assert.equal(result.reservationRetained,true);assert.equal(result.session,'i');assert.equal(cancelled,false);
 assert.equal(replay(store.read()).tasks.a.active.session,'i');
});
