import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { commitTaskIndexProgress, inspectTaskIndexProgress, verifyTaskIndexProgressReadback } from '../lib/task-index-progress.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const source = '# Tasks\n- [ ] [Task A](tasks/task-A.md): First\n- [ ] [Task B](tasks/task-B.md): Second\n- Wave 1: A\n- Wave 2: B\n';

function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'asds-task-progress-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'tasks.md'), source);
  return root;
}

function request(root, overrides = {}) {
  return {
    root,
    indexPath: 'tasks.md',
    task: { id: 'A', title: 'First', wave: 1 },
    progressRequested: {
      type: 'progressRequested', taskId: 'A', planningRevision: 'plan',
      contractRevision: 'contract', integrationRevision: 'integration',
      receiptDigest: 'receipt', indexBeforeHash: sha256(source),
      expectedChange: { from: '[ ]', to: '[x]' },
    },
    ...overrides,
  };
}

test('commits exactly one checkbox and returns a matching progressCommitted event', t => {
  const root = fixture(t), index=path.join(root,'tasks.md');
  fs.chmodSync(index,0o640);
  const result = commitTaskIndexProgress(request(root));
  const after = fs.readFileSync(path.join(root, 'tasks.md'), 'utf8');
  assert.equal(after, source.replace('- [ ] [Task A]', '- [x] [Task A]'));
  assert.equal(result.status, 'committed');
  if (process.platform !== 'win32') assert.equal(fs.statSync(index).mode&0o777,0o640);
  assert.deepEqual(result.event, {
    type: 'progressCommitted', taskId: 'A', receiptDigest: 'receipt',
    indexBeforeHash: sha256(source), indexAfterHash: sha256(after),
  });
  assert.equal(fs.readdirSync(root).some(name => name.includes('.asds-progress.')), false);
});

test('recovers idempotently after write and before event append', t => {
  const root = fixture(t), first = commitTaskIndexProgress(request(root));
  const second = commitTaskIndexProgress(request(root, { progressCommitted:first.event }));
  assert.deepEqual(second.event, first.event);
  assert.equal(second.status, 'already_committed');
  assert.equal(fs.readFileSync(path.join(root, 'tasks.md'), 'utf8'), source.replace('- [ ] [Task A]', '- [x] [Task A]'));
});

test('fails closed on different hash, receipt, title, wave and prose drift', t => {
  const root = fixture(t);
  assert.throws(() => commitTaskIndexProgress(request(root, { progressRequested: { ...request(root).progressRequested, indexBeforeHash: sha256('other') } })), /hash|CAS/i);
  assert.throws(() => commitTaskIndexProgress(request(root, { task: { id: 'A', title: 'Wrong', wave: 1 } })), /title/i);
  assert.throws(() => commitTaskIndexProgress(request(root, { task: { id: 'A', title: 'First', wave: 2 } })), /wave/i);
  fs.writeFileSync(path.join(root, 'tasks.md'), source.replace('# Tasks', '# Changed'));
  assert.throws(() => commitTaskIndexProgress(request(root)), /hash|drift|CAS/i);
  fs.writeFileSync(path.join(root, 'tasks.md'), source);
  const committed=commitTaskIndexProgress(request(root));
  assert.throws(() => commitTaskIndexProgress(request(root, { progressCommitted:committed.event,progressRequested: { ...request(root).progressRequested, receiptDigest: 'other' } })), /receipt|operation|conflict/i);
});

test('lock serializes concurrent callers and an existing lock is preserved', t => {
  const root = fixture(t), lock = path.join(root, '.tasks.md.asds-progress.lock');
  fs.writeFileSync(lock, 'other writer');
  assert.throws(() => commitTaskIndexProgress(request(root)), /lock|busy|lease/i);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'other writer');
  fs.unlinkSync(lock);
  assert.equal(commitTaskIndexProgress(request(root)).status, 'committed');
});

test('rejects symlinked index, symlinked ancestors and hardlinks', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t), index = path.join(root, 'tasks.md'), target = path.join(root, 'real.md');
  fs.renameSync(index, target); fs.symlinkSync('real.md', index);
  assert.throws(() => commitTaskIndexProgress(request(root)), /symlink/i);
  fs.unlinkSync(index); fs.linkSync(target, index);
  assert.throws(() => commitTaskIndexProgress(request(root)), /hardlink/i);
  fs.unlinkSync(index); fs.mkdirSync(path.join(root, 'nested')); fs.writeFileSync(path.join(root, 'nested', 'tasks.md'), source);
  const outside = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'asds-progress-outside-')));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.renameSync(path.join(root, 'nested'), path.join(outside, 'nested'));
  fs.symlinkSync(path.join(outside, 'nested'), path.join(root, 'nested'));
  assert.throws(() => commitTaskIndexProgress(request(root, { indexPath: 'nested/tasks.md' })), /symlink/i);
  const rootLink=`${root}-link`;fs.symlinkSync(root,rootLink);t.after(()=>fs.rmSync(rootLink,{force:true}));
  assert.throws(()=>commitTaskIndexProgress(request(rootLink)),/realpath/i);
});

test('ordinary injected failures preserve the prior file and clean owned temp and lock', t => {
  const root = fixture(t);
  assert.throws(() => commitTaskIndexProgress(request(root),{fault:'beforeWrite'}), /injected/i);
  assert.equal(fs.readFileSync(path.join(root, 'tasks.md'), 'utf8'), source);
  assert.deepEqual(fs.readdirSync(root), ['tasks.md']);
  assert.throws(() => commitTaskIndexProgress(request(root),{fault:'beforeRename'}), /injected/i);
  assert.equal(fs.readFileSync(path.join(root, 'tasks.md'), 'utf8'), source);
  assert.deepEqual(fs.readdirSync(root), ['tasks.md']);
  assert.throws(() => commitTaskIndexProgress(request(root),{fault:'afterRename'}), /injected/i);
  const committed = commitTaskIndexProgress(request(root));
  assert.equal(committed.status, 'already_committed');
  assert.deepEqual(fs.readdirSync(root), ['tasks.md']);
});

test('recovers after readback and after event append without releasing a premature event', t => {
  const root=fixture(t);
  assert.equal(inspectTaskIndexProgress(request(root)).event,undefined);
  assert.throws(()=>commitTaskIndexProgress(request(root),{fault:'afterReadback'}),/injected/i);
  const recovered=commitTaskIndexProgress(request(root));
  assert.equal(recovered.status,'already_committed');
  assert.equal(commitTaskIndexProgress(request(root,{progressCommitted:recovered.event})).status,'already_committed');
  assert.throws(()=>{
    fs.writeFileSync(path.join(root,'tasks.md'),source);
    commitTaskIndexProgress(request(root,{progressCommitted:recovered.event}));
  },/still open|conflict/i);
});

test('inspection exposes open, progress_pending recovery and conflict without writing', t => {
  const root = fixture(t);
  assert.equal(inspectTaskIndexProgress(request(root)).status, 'progress_pending');
  const committed=commitTaskIndexProgress(request(root));
  assert.equal(inspectTaskIndexProgress(request(root)).status, 'already_committed');
  assert.throws(() => inspectTaskIndexProgress(request(root, { progressCommitted:committed.event,progressRequested: { ...request(root).progressRequested, receiptDigest: 'other' } })), /receipt|operation|conflict/i);
});

test('rejects unknown broker options without touching the index',t=>{
  const root=fixture(t);
  assert.throws(()=>commitTaskIndexProgress(request(root),{fault:'unknown'}),/options/i);
  assert.throws(()=>commitTaskIndexProgress(request(root,{progressRequested:{...request(root).progressRequested,unexpected:true}})),/binding/i);
  const missing={...request(root).progressRequested};delete missing.planningRevision;
  assert.throws(()=>commitTaskIndexProgress(request(root,{progressRequested:missing})),/binding/i);
  assert.equal(fs.readFileSync(path.join(root,'tasks.md'),'utf8'),source);
});

test('invalid UTF-8 fails closed and cleans the broker lock',t=>{
  const root=fixture(t),bytes=Buffer.from([0xff,0xfe,0xfd]);
  fs.writeFileSync(path.join(root,'tasks.md'),bytes);
  const progressRequested={...request(root).progressRequested,indexBeforeHash:sha256(bytes)};
  assert.throws(()=>commitTaskIndexProgress(request(root,{progressRequested})),/encoded|utf-8|valid/i);
  assert.deepEqual(fs.readdirSync(root),['tasks.md']);
});

test('concurrent prose drift during the final CAS is preserved and emits no commit',t=>{
  const root=fixture(t),index=path.join(root,'tasks.md'),originalRename=fs.renameSync;
  let raced=false;
  fs.renameSync=function(from,to){
    if(!raced&&path.basename(String(from))==='tasks.md'&&String(to).includes('.displaced')) {
      raced=true;
      fs.writeFileSync(index,source.replace('# Tasks','# External writer'));
    }
    return originalRename.call(this,from,to);
  };
  try { assert.throws(()=>commitTaskIndexProgress(request(root)),/drift|CAS|readback/i); }
  finally { fs.renameSync=originalRename; }
  assert.equal(raced,true);
  assert.match(fs.readFileSync(index,'utf8'),/^# External writer/m);
  assert.equal(fs.existsSync(path.join(root,'.tasks.md.asds-progress.lock')),false);
});

test('ancestor swap cannot redirect the broker outside the canonical root', {skip:process.platform==='win32'},t=>{
  const root=fixture(t),outside=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'asds-progress-swap-')));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.writeFileSync(path.join(outside,'tasks.md'),source.replace('# Tasks','# Outside'));
  const parked=`${root}-parked`,originalRename=fs.renameSync;let raced=false;
  fs.renameSync=function(from,to){
    if(!raced&&path.basename(String(from))==='tasks.md'&&String(to).includes('.displaced')) {
      raced=true;originalRename.call(this,root,parked);fs.symlinkSync(outside,root);
    }
    return originalRename.call(this,from,to);
  };
  try { assert.throws(()=>commitTaskIndexProgress(request(root)),/identity|realpath|anchor|CAS/i); }
  finally {
    fs.renameSync=originalRename;
    if(fs.lstatSync(root).isSymbolicLink()) fs.unlinkSync(root);
    if(fs.existsSync(parked)) fs.renameSync(parked,root);
  }
  assert.equal(raced,true);
  assert.equal(fs.readFileSync(path.join(outside,'tasks.md'),'utf8'),source.replace('# Tasks','# Outside'));
});

test('writer racing after displacement is restored as canonical drift with no commit',t=>{
  const root=fixture(t),originalLink=fs.linkSync;let raced=false;
  fs.linkSync=function(from,to){
    if(!raced&&String(from).includes('.asds-progress.')&&String(from).endsWith('.tmp')&&path.basename(String(to))==='tasks.md') {
      raced=true;const displaced=fs.readdirSync(root).find(name=>name.endsWith('.displaced'));
      fs.writeFileSync(path.join(root,displaced),source.replace('# Tasks','# Late writer'));
    }
    return originalLink.call(this,from,to);
  };
  try{assert.throws(()=>commitTaskIndexProgress(request(root)),/drift|restored|CAS/i);}finally{fs.linkSync=originalLink;}
  assert.equal(raced,true);
  assert.equal(fs.readFileSync(path.join(root,'tasks.md'),'utf8'),source.replace('# Tasks','# Late writer'));
  assert.deepEqual(fs.readdirSync(root),['tasks.md']);
});

test('dead-process leases recover at every crash boundary for the same task and receipt', {skip:process.platform==='win32'},t=>{
  const moduleUrl=pathToFileURL(path.resolve('lib/task-index-progress.mjs')).href;
  for(const fault of ['crashBeforeWrite','crashAfterDisplace','crashAfterLink','crashAfterPublish','crashAfterWrite','crashAfterReadback']) {
    const root=fixture(t),script=path.join(root,'crash.mjs');
    fs.writeFileSync(script,`import {commitTaskIndexProgress} from ${JSON.stringify(moduleUrl)};\ncommitTaskIndexProgress(${JSON.stringify(request(root))},{fault:${JSON.stringify(fault)}});\n`);
    const child=spawnSync(process.execPath,[script],{encoding:'utf8'});
    assert.equal(child.signal,'SIGKILL',`${fault}: child must die at the injected boundary`);
    fs.unlinkSync(script);
    const recovered=commitTaskIndexProgress(request(root));
    assert.ok(['committed','already_committed'].includes(recovered.status));
    assert.equal(recovered.event.receiptDigest,'receipt');
    assert.deepEqual(fs.readdirSync(root),['tasks.md']);
  }
});

test('dead lease cannot be reclaimed by a different receipt', {skip:process.platform==='win32'},t=>{
  const root=fixture(t),moduleUrl=pathToFileURL(path.resolve('lib/task-index-progress.mjs')).href,script=path.join(root,'crash.mjs');
  fs.writeFileSync(script,`import {commitTaskIndexProgress} from ${JSON.stringify(moduleUrl)};\ncommitTaskIndexProgress(${JSON.stringify(request(root))},{fault:'crashBeforeWrite'});\n`);
  assert.equal(spawnSync(process.execPath,[script]).signal,'SIGKILL');fs.unlinkSync(script);
  const other={...request(root).progressRequested,receiptDigest:'other'};
  assert.throws(()=>commitTaskIndexProgress(request(root,{progressRequested:other})),/lease|receipt|binding/i);
});

test('dead lease with same task and receipt but divergent provenance is untouched', {skip:process.platform==='win32'},t=>{
  const root=fixture(t),moduleUrl=pathToFileURL(path.resolve('lib/task-index-progress.mjs')).href,script=path.join(root,'crash.mjs');
  fs.writeFileSync(script,`import {commitTaskIndexProgress} from ${JSON.stringify(moduleUrl)};\ncommitTaskIndexProgress(${JSON.stringify(request(root))},{fault:'crashBeforeWrite'});\n`);
  assert.equal(spawnSync(process.execPath,[script]).signal,'SIGKILL');fs.unlinkSync(script);
  const artifacts=fs.readdirSync(root).filter(name=>name.includes('.asds-progress.')).sort();
  const divergent={...request(root).progressRequested,indexBeforeHash:'b'.repeat(64)};
  assert.throws(()=>commitTaskIndexProgress(request(root,{progressRequested:divergent})),/binding|provenance/i);
  assert.deepEqual(fs.readdirSync(root).filter(name=>name.includes('.asds-progress.')).sort(),artifacts);
});

test('direct and idempotent readback APIs reject unknown event fields',t=>{
  const root=fixture(t),committed=commitTaskIndexProgress(request(root)),closed=fs.readFileSync(path.join(root,'tasks.md'),'utf8');
  const extraCommit={...committed.event,unexpected:true};
  const missingCommit={...committed.event};delete missingCommit.indexAfterHash;
  assert.throws(()=>commitTaskIndexProgress(request(root,{progressCommitted:extraCommit})),/progressCommitted|conflict/i);
  assert.throws(()=>verifyTaskIndexProgressReadback({source:closed,task:{id:'A',title:'First',wave:1},progressRequested:request(root).progressRequested,progressCommitted:extraCommit}),/progressCommitted|conflict/i);
  assert.throws(()=>commitTaskIndexProgress(request(root,{progressCommitted:missingCommit})),/progressCommitted|conflict/i);
  assert.throws(()=>verifyTaskIndexProgressReadback({source:closed,task:{id:'A',title:'First',wave:1},progressRequested:request(root).progressRequested,progressCommitted:missingCommit}),/progressCommitted|conflict/i);
});

test('simultaneous cooperative callers honor the active lease and retry idempotently', {skip:process.platform==='win32'},async t=>{
  const root=fixture(t),moduleUrl=pathToFileURL(path.resolve('lib/task-index-progress.mjs')).href;
  const ready=path.join(root,'holder.ready'),release=path.join(root,'holder.release'),script=path.join(root,'holder.mjs');
  fs.writeFileSync(script,`import fs from 'node:fs';\nimport {commitTaskIndexProgress} from ${JSON.stringify(moduleUrl)};\nconst original=fs.openSync;let held=false;fs.openSync=function(file,...args){if(!held&&String(file).endsWith('.tmp')){held=true;fs.writeFileSync(${JSON.stringify(ready)},'ready');while(!fs.existsSync(${JSON.stringify(release)}))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}return original.call(this,file,...args);};\nconsole.log(JSON.stringify(commitTaskIndexProgress(${JSON.stringify(request(root))})));\n`);
  const holder=spawn(process.execPath,[script],{stdio:['ignore','pipe','pipe']});let stderr='';holder.stderr.on('data',chunk=>{stderr+=chunk;});
  for(let attempt=0;attempt<200&&!fs.existsSync(ready);attempt++) await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(fs.existsSync(ready),true,'holder must own the lease before contender starts');
  const contenderCode=`import fs from 'node:fs';import {commitTaskIndexProgress} from ${JSON.stringify(moduleUrl)};try{commitTaskIndexProgress(${JSON.stringify(request(root))});}catch(error){fs.writeSync(2,error.message);process.exitCode=2;}`;
  const contender=spawnSync(process.execPath,['--input-type=module','-e',contenderCode],{encoding:'utf8'});
  fs.writeFileSync(release,'release');
  const exit=await new Promise(resolve=>holder.on('close',(code,signal)=>resolve({code,signal})));
  assert.equal(contender.status,2);assert.match(contender.stderr,/lease.*active/i);
  assert.deepEqual(exit,{code:0,signal:null},stderr);
  for(const file of [ready,release,script])fs.unlinkSync(file);
  assert.equal(commitTaskIndexProgress(request(root)).status,'already_committed');
});
