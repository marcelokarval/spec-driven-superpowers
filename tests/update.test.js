import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planInstall, planUninstall, applyInstall } from '../lib/install.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),cli=path.join(root,'scripts/install.mjs');
const childEnv=Object.fromEntries(['PATH','HOME','TMPDIR','TEMP','TMP'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
const spawnChecked=(command,args,options)=>{const result=spawnSync(command,args,options);assert.ifError(result.error);return result;};
const hash = data => createHash('sha256').update(data).digest('hex');
const ownership = file => ({path:file,sha256:hash(fs.readFileSync(file)),mode:fs.statSync(file).mode & 0o777,type:'file',nlinkPolicy:'exactly-one'});
const writeHistoricalTombstone = file => { fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'owned old payload\n');fs.chmodSync(file,0o644); };
const updateTemporaries = root => fs.readdirSync(root,{recursive:true}).filter(name=>path.basename(name).startsWith('.asds-update-'));
function oldInstall(t) {
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'project',target};applyInstall(planInstall(opts));
 const file=path.join(target,'.agents/skills/spec-driven-superpowers/SKILL.md');
 const manifest=path.join(target,'.asds/install-manifest.json');
 const data=JSON.parse(fs.readFileSync(manifest));fs.writeFileSync(file,'previous released skill\n');
 data.files.find(f=>f.path===file).sha256=hash(fs.readFileSync(file));fs.writeFileSync(manifest,JSON.stringify(data,null,2)+'\n');
 return {opts,file,manifest};
}
function legacyInstall(t, { stale = false } = {}) {
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-legacy-adopt-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'project',target};applyInstall(planInstall(opts));
 const manifest=path.join(target,'.asds/install-manifest.json'),agent=path.join(target,'.agents/agents/spec-driven-superpowers.md'),reviewer=path.join(target,'.agents/agents/spec-driven-superpowers-reviewer.md'),marker=path.join(target,'.asds/accelerate-handoff-capability.json'),dispatchContract=path.join(target,'.asds/agy-review-dispatch-contract.json');
 const current=JSON.parse(fs.readFileSync(manifest));
 const skill=path.join(target,'.agents/skills/spec-driven-superpowers/SKILL.md');fs.writeFileSync(skill,'legacy owned bytes\n');
 const files=current.files.filter(entry=>![agent,reviewer,marker,dispatchContract].includes(entry.path)).map(entry=>({path:entry.path,sha256:entry.path===skill?hash(fs.readFileSync(skill)):entry.sha256}));
 fs.unlinkSync(agent);fs.unlinkSync(reviewer);fs.unlinkSync(marker);fs.unlinkSync(dispatchContract);
 let staleFile;
 if(stale){staleFile=path.join(target,'.agents/skills/asds-execution-consumer/legacy/obsolete.mjs');writeHistoricalTombstone(staleFile);files.push({path:staleFile,sha256:hash(fs.readFileSync(staleFile))});}
 const legacy={format:1,scope:'project',target,schemaRoot:target,files};fs.writeFileSync(manifest,JSON.stringify(legacy,null,2)+'\n');
 return {opts,target,manifest,skill,agent,reviewer,marker,dispatchContract,staleFile,receiptSha256:hash(fs.readFileSync(manifest))};
}
const v110Shared=['schema.yaml','templates/summary.md','templates/task-template.md','templates/tasks.md'];
function legacyUserV110(t, { sibling = false, foreignSibling = false, mode = 0o644 } = {}) {
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-v110-user-'))),dataHome=path.join(target,'data');t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'user',target,dataHome};applyInstall(planInstall(opts));
 let siblingManifest;
 if(sibling){applyInstall(planInstall({...opts,skillsDir:'.gemini/config/skills'}));siblingManifest=path.join(target,'.asds/install-manifests',fs.readdirSync(path.join(target,'.asds/install-manifests'))[0]);}
 const manifest=path.join(target,'.asds/install-manifest.json'),receipt=JSON.parse(fs.readFileSync(manifest));
 for(const relative of v110Shared){const file=path.join(dataHome,'openspec/schemas/superpowers-bridge',relative),fixture=path.join(root,'tests/fixtures/install/v1.1.0-user/schemas/superpowers-bridge',relative);fs.copyFileSync(fixture,file);fs.chmodSync(file,mode);receipt.files.find(entry=>entry.path===file).sha256=hash(fs.readFileSync(file));if(sibling){const other=JSON.parse(fs.readFileSync(siblingManifest));other.files.find(entry=>entry.path===file).sha256=hash(fs.readFileSync(file));fs.writeFileSync(siblingManifest,JSON.stringify(other,null,2)+'\n');}}
 if(foreignSibling){const foreign=path.join(target,'.gemini/config/skills/owner-skill/SKILL.md');fs.mkdirSync(path.dirname(foreign),{recursive:true});fs.writeFileSync(foreign,'owner\n');const other=JSON.parse(fs.readFileSync(siblingManifest));other.files.push(ownership(foreign));fs.writeFileSync(siblingManifest,JSON.stringify(other,null,2)+'\n');}
 const legacy={format:1,scope:'user',target,schemaRoot:dataHome,files:receipt.files.map(({path,sha256})=>({path,sha256}))};fs.writeFileSync(manifest,JSON.stringify(legacy,null,2)+'\n');fs.chmodSync(manifest,mode);
 return {opts,target,dataHome,manifest,siblingManifest,receiptSha256:hash(fs.readFileSync(manifest))};
}
test('explicit update replaces only receipt-matching owned bytes and is idempotent',t=>{
 const {opts,file}=oldInstall(t);assert.throws(()=>planInstall(opts),/conflict/);
 const files=planInstall({...opts,update:true});assert.equal(fs.readFileSync(file,'utf8'),'previous released skill\n');
 applyInstall(files);assert.match(fs.readFileSync(file,'utf8'),/Autonomous Spec/);
 applyInstall(planInstall({...opts,update:true}));assert.equal(fs.readdirSync(path.dirname(file)).some(n=>n.startsWith('.asds-update-')),false);
});
test('update rejects modified owned bytes and absent manifests before writing',t=>{
 const {opts,file,manifest}=oldInstall(t);fs.writeFileSync(file,'user edit');
 assert.throws(()=>planInstall({...opts,update:true}),/modified|conflict/);assert.equal(fs.readFileSync(file,'utf8'),'user edit');
 fs.unlinkSync(manifest);assert.throws(()=>planInstall({...opts,update:true}),/manifest/);
});
test('update detects stale plans and restores successful writes on ordinary failure',t=>{
 const {opts,file,manifest}=oldInstall(t);const before=fs.readFileSync(file),receipt=fs.readFileSync(manifest);
 const files=planInstall({...opts,update:true});
 assert.throws(()=>applyInstall(files,{beforeWrite:p=>{if(p===manifest)throw Error('injected failure');}}),/injected/);
 assert.deepEqual(fs.readFileSync(file),before);assert.deepEqual(fs.readFileSync(manifest),receipt);
 fs.writeFileSync(file,'concurrent user edit');assert.throws(()=>applyInstall(files),/changed|conflict/);
 assert.equal(fs.readFileSync(file,'utf8'),'concurrent user edit');
});
test('update refuses hardlinks and malformed receipt entries',t=>{
 const {opts,file,manifest}=oldInstall(t);const other=path.join(opts.target,'linked');fs.linkSync(file,other);
 assert.throws(()=>planInstall({...opts,update:true}),/hardlink/);fs.unlinkSync(other);
 const data=JSON.parse(fs.readFileSync(manifest));data.files.push(data.files[0]);fs.writeFileSync(manifest,JSON.stringify(data));
 assert.throws(()=>planInstall({...opts,update:true}),/manifest|duplicate/);
});
test('update treats chmod as a user modification and rejects later mode changes',{skip:process.platform==='win32'},t=>{
 const {opts,file}=oldInstall(t);fs.chmodSync(file,0o600);
 assert.throws(()=>planInstall({...opts,update:true}),/mode|modified|ownership/);
 assert.equal(fs.statSync(file).mode & 0o777,0o600);
 const second=oldInstall(t);const stale=planInstall({...second.opts,update:true});fs.chmodSync(second.file,0o600);
 assert.throws(()=>applyInstall(stale),/changed/);assert.equal(fs.readFileSync(second.file,'utf8'),'previous released skill\n');
 assert.equal(fs.statSync(second.file).mode & 0o777,0o600);
});
test('idempotent preview detects chmod before apply without reclaiming the file',{skip:process.platform==='win32'},t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-preview-mode-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const opts={scope:'project',target};applyInstall(planInstall(opts));
 const file=path.join(target,'.agents/skills/asds-execution-consumer/SKILL.md'),files=planInstall({...opts,update:true});fs.chmodSync(file,0o600);
 assert.throws(()=>applyInstall(files),/changed since update preview/);assert.equal(fs.statSync(file).mode & 0o777,0o600);
});
test('legacy manifests without ownership metadata fail closed and preserve files',t=>{
 const {opts,file,manifest}=oldInstall(t),before=fs.readFileSync(file),legacy=JSON.parse(fs.readFileSync(manifest));
 legacy.format=1;for(const entry of legacy.files){delete entry.mode;delete entry.type;delete entry.nlinkPolicy;}fs.writeFileSync(manifest,JSON.stringify(legacy,null,2)+'\n');
 assert.throws(()=>planInstall({...opts,update:true}),/legacy|ownership|format/i);
 assert.deepEqual(fs.readFileSync(file),before);assert.equal(fs.existsSync(manifest),true);
});
test('explicit SHA-bound legacy adoption is preview-only, migrates payload, removes proven stale, and reads back',t=>{
 const legacy=legacyInstall(t,{stale:true});
 const options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 const preview=planInstall(options);
 assert.equal(fs.readFileSync(legacy.skill,'utf8'),'legacy owned bytes\n');assert.equal(fs.existsSync(legacy.staleFile),true);
 assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,1);
 applyInstall(preview);
 const migrated=JSON.parse(fs.readFileSync(legacy.manifest));assert.equal(migrated.format,3);
 assert.equal(fs.existsSync(legacy.agent),true);assert.equal(fs.existsSync(legacy.reviewer),true);
 assert.equal(fs.existsSync(legacy.marker),true);assert.equal(fs.existsSync(legacy.dispatchContract),true);
 assert.equal(fs.existsSync(legacy.staleFile),false);assert.match(fs.readFileSync(legacy.skill,'utf8'),/Autonomous Spec/);
 assert.doesNotThrow(()=>planInstall({...legacy.opts,update:true}));
});
test('CLI legacy adoption keeps preview separate from apply and forwards the exact receipt hash',t=>{
 const legacy=legacyInstall(t),args=[cli,'--scope','project','--target',legacy.target,'--update','--adopt-legacy-manifest-sha256',legacy.receiptSha256];
 const preview=spawnChecked(process.execPath,args,{encoding:'utf8',cwd:root,env:childEnv});assert.equal(preview.status,0,preview.stderr);
 assert.match(preview.stdout,/Preview only/);const planSha=preview.stdout.match(/Plan SHA-256: ([a-f0-9]{64})/)[1];assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,1);
 const direct=spawnChecked(process.execPath,[...args,'--apply'],{encoding:'utf8',cwd:root,env:childEnv});assert.notEqual(direct.status,0);assert.match(direct.stderr,/requires --expect-plan-sha256/);
 const wrong=spawnChecked(process.execPath,[...args,'--apply','--expect-plan-sha256','0'.repeat(64)],{encoding:'utf8',cwd:root,env:childEnv});assert.notEqual(wrong.status,0);assert.match(wrong.stderr,/plan SHA-256 mismatch/);
 const drift=spawnChecked(process.execPath,[...args,'--activate','--apply','--expect-plan-sha256',planSha],{encoding:'utf8',cwd:root,env:childEnv});assert.notEqual(drift.status,0);assert.match(drift.stderr,/plan SHA-256 mismatch/);
 const applied=spawnChecked(process.execPath,[...args,'--apply','--expect-plan-sha256',planSha],{encoding:'utf8',cwd:root,env:childEnv});assert.equal(applied.status,0,applied.stderr);
 assert.match(applied.stdout,/Installed\/verified/);assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,3);
});
test('legacy adoption requires its exact receipt hash and refuses foreign or ambiguous paths',t=>{
 const missing=legacyInstall(t);assert.throws(()=>planInstall({...missing.opts,update:true}),/exact receipt SHA-256/);
 assert.throws(()=>planInstall({...missing.opts,update:true,adoptLegacyManifestSha256:'0'.repeat(64)}),/does not match/);
 for(const kind of ['foreign','rules','duplicate']){
  const legacy=legacyInstall(t),receipt=JSON.parse(fs.readFileSync(legacy.manifest));
  if(kind==='foreign'){const file=path.join(legacy.target,'owner.txt');fs.writeFileSync(file,'owner\n');receipt.files.push({path:file,sha256:hash(fs.readFileSync(file))});}
  if(kind==='rules'){const file=path.join(legacy.target,'AGENTS.md');fs.writeFileSync(file,'rules\n');receipt.files.push({path:file,sha256:hash(fs.readFileSync(file))});}
  if(kind==='duplicate')receipt.files.push({...receipt.files[0]});
  fs.writeFileSync(legacy.manifest,JSON.stringify(receipt,null,2)+'\n');const sha=hash(fs.readFileSync(legacy.manifest));
  assert.throws(()=>planInstall({...legacy.opts,update:true,adoptLegacyManifestSha256:sha}),/not current official payload|optional ownership|ambiguous|duplicate/);
 }
});
test('legacy adoption never owns or deletes a self-consistent sibling skill or schema extension',t=>{
 for(const probe of [
  ['.agents/skills/owner-skill/SKILL.md','owner skill\n'],
  ['openspec/schemas/superpowers-bridge/owner-extension.yaml','owner: true\n'],
 ]){
  const legacy=legacyInstall(t),file=path.join(legacy.target,probe[0]);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,probe[1]);
  const receipt=JSON.parse(fs.readFileSync(legacy.manifest));receipt.files.push({path:file,sha256:hash(fs.readFileSync(file))});fs.writeFileSync(legacy.manifest,JSON.stringify(receipt,null,2)+'\n');
  const sha=hash(fs.readFileSync(legacy.manifest));assert.throws(()=>planInstall({...legacy.opts,update:true,adoptLegacyManifestSha256:sha}),/not current official payload/);
  assert.equal(fs.readFileSync(file,'utf8'),probe[1]);assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,1);
 }
});
test('real v1.1.0 user shared payload migrates without siblings and normalizes umask modes',{skip:process.platform==='win32'},t=>{
 const legacy=legacyUserV110(t,{mode:0o600}),options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 applyInstall(planInstall(options));assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,3);assert.equal(fs.statSync(legacy.manifest).mode & 0o777,0o644);
 for(const relative of v110Shared){const file=path.join(legacy.dataHome,'openspec/schemas/superpowers-bridge',relative);assert.equal(fs.statSync(file).mode & 0o777,0o644);assert.deepEqual(fs.readFileSync(file),fs.readFileSync(path.join(root,'schemas/superpowers-bridge',relative)));}
 assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
});
test('user legacy adoption requires explicit safe reconciliation when sibling manifests exist',t=>{
 const legacy=legacyUserV110(t,{sibling:true}),base={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 assert.throws(()=>planInstall(base),/sibling manifests.*--reconcile-shared/);
 applyInstall(planInstall({...base,reconcileShared:true}));assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,3);
 assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
});
test('user legacy sibling reconciliation rejects foreign receipt entries before writes',t=>{
 const legacy=legacyUserV110(t,{sibling:true,foreignSibling:true}),before=fs.readFileSync(legacy.manifest);
 assert.throws(()=>planInstall({...legacy.opts,update:true,reconcileShared:true,adoptLegacyManifestSha256:legacy.receiptSha256}),/foreign|extra|profile/);
 assert.deepEqual(fs.readFileSync(legacy.manifest),before);assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
});
test('legacy migration ordinary rollback restores v1 bytes and umask modes without journal residue',{skip:process.platform==='win32'},t=>{
 const legacy=legacyInstall(t),beforeSkill=fs.readFileSync(legacy.skill),beforeReceipt=fs.readFileSync(legacy.manifest);fs.chmodSync(legacy.skill,0o600);fs.chmodSync(legacy.manifest,0o600);
 const sha=hash(fs.readFileSync(legacy.manifest)),plan=planInstall({...legacy.opts,update:true,adoptLegacyManifestSha256:sha});
 assert.throws(()=>applyInstall(plan,{beforeWrite:file=>{if(file===legacy.manifest)throw new Error('injected migration failure');}}),/injected migration failure/);
 assert.deepEqual(fs.readFileSync(legacy.skill),beforeSkill);assert.deepEqual(fs.readFileSync(legacy.manifest),beforeReceipt);
 assert.equal(fs.statSync(legacy.skill).mode & 0o777,0o600);assert.equal(fs.statSync(legacy.manifest).mode & 0o777,0o600);
 assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
});
test('legacy migration resumes every SIGKILL write boundary and cleans its journal',{skip:process.platform==='win32'},t=>{
 let killed=0,completed=false;
 for(let boundary=1;boundary<=20;boundary++){
  const legacy=legacyInstall(t),options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};
  const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)};let writes=0;applyInstall(planInstall(options),{beforeWrite(){if(++writes===${boundary})process.kill(process.pid,'SIGKILL');}});`;
  const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});
  if(result.signal==='SIGKILL'){
   killed++;applyInstall(planInstall(options));assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,3);
   assert.equal(fs.existsSync(legacy.reviewer),true);assert.equal(fs.existsSync(legacy.dispatchContract),true);
   assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
  }else{assert.equal(result.status,0,result.stderr);completed=true;break;}
 }
 assert.equal(completed,true);assert.ok(killed>=5,`expected multiple durable write boundaries, observed ${killed}`);
});
test('legacy migration resume rejects a tampered published artifact and preserves its journal',{skip:process.platform==='win32'},t=>{
 const legacy=legacyInstall(t),options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)};let writes=0;applyInstall(planInstall(options),{beforeWrite(){if(++writes===3)process.kill(process.pid,'SIGKILL');}});`;
 const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});assert.equal(result.signal,'SIGKILL');
 fs.writeFileSync(legacy.agent,'tampered interrupted artifact\n');assert.throws(()=>planInstall(options),/modified|unreceipted|primary/);
 assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),true);
});
test('active legacy migration journal blocks fresh install, ordinary update, and uninstall',{skip:process.platform==='win32'},t=>{
 const legacy=legacyInstall(t),options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)};let writes=0;applyInstall(planInstall(options),{beforeWrite(){if(++writes===3)process.kill(process.pid,'SIGKILL');}});`;
 const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});assert.equal(result.signal,'SIGKILL');
 assert.throws(()=>planInstall(legacy.opts),/active legacy migration journal.*exact adoption resume/);
 assert.throws(()=>planInstall({...legacy.opts,update:true}),/active legacy migration journal.*exact adoption resume/);
 assert.throws(()=>planUninstall(legacy.opts),/active legacy migration journal.*before uninstall/);
 applyInstall(planInstall(options));assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
});
test('legacy migration resumes a deterministic exact replace temporary and leaves no residue',{skip:process.platform==='win32'},t=>{
 const legacy=legacyInstall(t),options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)};applyInstall(planInstall(options),{beforeWrite(file){if(file.includes('.asds-update-'))process.kill(process.pid,'SIGKILL');}});`;
 const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});assert.equal(result.signal,'SIGKILL');assert.ok(updateTemporaries(legacy.target).length>0);
 applyInstall(planInstall(options));assert.equal(updateTemporaries(legacy.target).length,0);assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
});
test('legacy migration refuses drifted or unknown update temporaries',{skip:process.platform==='win32'},t=>{
 const interrupted=()=>{const legacy=legacyInstall(t),options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256};const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)};applyInstall(planInstall(options),{beforeWrite(file){if(file.includes('.asds-update-'))process.kill(process.pid,'SIGKILL');}});`;const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});assert.equal(result.signal,'SIGKILL');const temporary=path.join(legacy.target,updateTemporaries(legacy.target)[0]);return {legacy,options,temporary};};
 const drift=interrupted();fs.writeFileSync(drift.temporary,'attacker bytes\n');assert.throws(()=>planInstall(drift.options),/migration temporary drift/);
 const unknown=interrupted(),foreign=path.join(path.dirname(unknown.temporary),'.asds-update-owner');fs.writeFileSync(foreign,'owner bytes\n');assert.throws(()=>planInstall(unknown.options),/unknown legacy migration temporary refused/);
});
test('legacy migration resumes SIGKILL at rollback rename boundaries without reverse temp residue',{skip:process.platform==='win32'},t=>{
 let killed=0;
 for(let boundary=1;boundary<=8;boundary++){
  const legacy=legacyUserV110(t),options={...legacy.opts,update:true,adoptLegacyManifestSha256:legacy.receiptSha256},journal=path.join(legacy.target,'.asds/install-migration.json');
  const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)},journal=${JSON.stringify(journal)};let journalWrites=0,rollbacks=0;applyInstall(planInstall(options),{beforeWrite(file){if(file===journal&&++journalWrites===2)throw new Error('enter rollback');},beforeRollbackWrite(){if(++rollbacks===${boundary})process.kill(process.pid,'SIGKILL');}});`;
  const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});
  if(result.signal!=='SIGKILL'){assert.notEqual(result.status,0);break;}
  killed++;assert.ok(updateTemporaries(legacy.target).length>0);applyInstall(planInstall(options));
  assert.equal(updateTemporaries(legacy.target).length,0);assert.equal(fs.existsSync(journal),false);
 }
 assert.ok(killed>=5,`expected multiple rollback rename boundaries, observed ${killed}`);
});
test('user legacy migration journal binds shared reconciliation through a primary-to-sibling crash',{skip:process.platform==='win32'},t=>{
 const legacy=legacyUserV110(t,{sibling:true}),options={...legacy.opts,update:true,reconcileShared:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)},sibling=${JSON.stringify(legacy.siblingManifest)};applyInstall(planInstall(options),{beforeWrite(file){if(file===sibling)process.kill(process.pid,'SIGKILL');}});`;
 const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});assert.equal(result.signal,'SIGKILL');
 assert.equal(JSON.parse(fs.readFileSync(legacy.manifest)).format,3);assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),true);
 assert.throws(()=>planInstall({...options,reconcileShared:false}),/journal identity, options|sibling manifests.*reconcile/);
 applyInstall(planInstall(options));assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),false);
});
test('user legacy migration resume rejects sibling receipt tamper after a primary-to-sibling crash',{skip:process.platform==='win32'},t=>{
 const legacy=legacyUserV110(t,{sibling:true}),options={...legacy.opts,update:true,reconcileShared:true,adoptLegacyManifestSha256:legacy.receiptSha256};
 const child=`import {planInstall,applyInstall} from ${JSON.stringify(path.join(root,'lib/install.mjs'))};const options=${JSON.stringify(options)},sibling=${JSON.stringify(legacy.siblingManifest)};applyInstall(planInstall(options),{beforeWrite(file){if(file===sibling)process.kill(process.pid,'SIGKILL');}});`;
 const result=spawnChecked(process.execPath,['--input-type=module','--eval',child],{encoding:'utf8',cwd:root,env:childEnv});assert.equal(result.signal,'SIGKILL');
 const receipt=JSON.parse(fs.readFileSync(legacy.siblingManifest));receipt.target=path.join(legacy.target,'foreign');fs.writeFileSync(legacy.siblingManifest,JSON.stringify(receipt,null,2)+'\n');
 assert.throws(()=>planInstall(options),/sibling receipt drift|invalid shared reconciliation|identity|profile/);
 assert.equal(fs.existsSync(path.join(legacy.target,'.asds/install-migration.json')),true);
});
test('legacy project adoption migrates explicitly verified activate and rules ownership',t=>{
 const make=()=>{const legacy=legacyInstall(t),receipt=JSON.parse(fs.readFileSync(legacy.manifest)),agents=path.join(legacy.target,'AGENTS.md'),config=path.join(legacy.target,'openspec/config.yaml');fs.writeFileSync(agents,fs.readFileSync(path.join(root,'rules/AGENTS.md')));fs.writeFileSync(config,'schema: superpowers-bridge\n');receipt.files.push({path:agents,sha256:hash(fs.readFileSync(agents))},{path:config,sha256:hash(fs.readFileSync(config))});fs.writeFileSync(legacy.manifest,JSON.stringify(receipt,null,2)+'\n');return {...legacy,receiptSha256:hash(fs.readFileSync(legacy.manifest)),agents,config};};
 const blocked=make();assert.throws(()=>planInstall({...blocked.opts,update:true,adoptLegacyManifestSha256:blocked.receiptSha256}),/matching explicit --rules or --activate/);
 const accepted=make();applyInstall(planInstall({...accepted.opts,update:true,rules:true,activate:true,adoptLegacyManifestSha256:accepted.receiptSha256}));
 const migrated=JSON.parse(fs.readFileSync(accepted.manifest));assert.deepEqual(migrated.features,{activate:true,rules:true});assert.equal(fs.existsSync(accepted.agents),true);assert.equal(fs.existsSync(accepted.config),true);
});
test('legacy adoption rejects identity, entry state, and flag misuse before mutation',{skip:process.platform==='win32'},t=>{
 for(const kind of ['identity','modified','hardlink','symlink','noncanonical']){
  const legacy=legacyInstall(t),receipt=JSON.parse(fs.readFileSync(legacy.manifest));
  if(kind==='identity')receipt.target=path.join(legacy.target,'other');
  if(kind==='modified')fs.writeFileSync(receipt.files[0].path,'changed after receipt\n');
  if(kind==='hardlink')fs.linkSync(receipt.files[0].path,path.join(legacy.target,'legacy-link'));
  if(kind==='symlink'){const original=receipt.files[0].path,outside=path.join(legacy.target,'symlink-target');fs.writeFileSync(outside,fs.readFileSync(original));fs.unlinkSync(original);fs.symlinkSync(outside,original);}
  if(kind==='noncanonical')receipt.files[0].path=`${legacy.target}/.agents/skills/../skills/spec-driven-superpowers/SKILL.md`;
  if(['identity','noncanonical'].includes(kind))fs.writeFileSync(legacy.manifest,JSON.stringify(receipt,null,2)+'\n');
  const sha=hash(fs.readFileSync(legacy.manifest));
  assert.throws(()=>planInstall({...legacy.opts,update:true,adoptLegacyManifestSha256:sha}),/identity|schema|modified|linked|non-file|symlink/);
 }
 const current=legacyInstall(t);const adopt={...current.opts,update:true,adoptLegacyManifestSha256:current.receiptSha256};applyInstall(planInstall(adopt));
 assert.throws(()=>planInstall({...current.opts,update:true,adoptLegacyManifestSha256:hash(fs.readFileSync(current.manifest))}),/matching resumable migration journal|format-1/);
 assert.throws(()=>planInstall({...current.opts,adoptLegacyManifestSha256:'0'.repeat(64)}),/requires --update/);
});
test('versioned manifest schemas reject unknown top-level and entry fields before mutation',t=>{
 for(const level of ['top','entry']) {
  const {opts,file,manifest}=oldInstall(t),before=fs.readFileSync(file),receipt=JSON.parse(fs.readFileSync(manifest));
  if(level==='top')receipt.untrusted=true;else receipt.files[0].untrusted=true;
  fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');
  assert.throws(()=>planInstall({...opts,update:true}),/invalid.*manifest/i);
  assert.deepEqual(fs.readFileSync(file),before);
 }
});
test('primary update requires every expected profile entry and never reclaims an unreceipted file',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-primary-bijection-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const opts={scope:'project',target};applyInstall(planInstall(opts));
 const file=path.join(target,'.agents/skills/asds-execution-consumer/SKILL.md'),manifest=path.join(target,'.asds/install-manifest.json'),before=fs.readFileSync(file),receipt=JSON.parse(fs.readFileSync(manifest));
 receipt.files=receipt.files.filter(entry=>entry.path!==file);fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');
 assert.throws(()=>planInstall({...opts,update:true}),/missing.*primary|primary.*missing/i);
 assert.deepEqual(fs.readFileSync(file),before);
 assert.equal(JSON.parse(fs.readFileSync(manifest)).files.some(entry=>entry.path===file),false);
});
test('user update refuses changing shared payload without reconciling other manifests',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-shared-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'user',target,dataHome:path.join(target,'data')};applyInstall(planInstall(opts));
 const file=path.join(target,'.asds/LICENSE'),manifest=path.join(target,'.asds/install-manifest.json');
 fs.writeFileSync(file,'old shared payload');const data=JSON.parse(fs.readFileSync(manifest));data.files.find(e=>e.path===file).sha256=hash(fs.readFileSync(file));fs.writeFileSync(manifest,JSON.stringify(data));
 assert.throws(()=>planInstall({...opts,update:true}),/shared payload/);
 assert.equal(fs.readFileSync(file,'utf8'),'old shared payload');
});
test('explicit shared reconciliation updates every verified user manifest',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-shared-all-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const base={scope:'user',target,dataHome:path.join(target,'data')};
 applyInstall(planInstall(base));applyInstall(planInstall({...base,skillsDir:'.gemini/config/skills'}));
 const shared=path.join(target,'.asds/LICENSE');
 const manifests=[path.join(target,'.asds/install-manifest.json'),...fs.readdirSync(path.join(target,'.asds/install-manifests')).map(name=>path.join(target,'.asds/install-manifests',name))];
 fs.writeFileSync(shared,'old shared payload');
 for(const manifest of manifests){const data=JSON.parse(fs.readFileSync(manifest));data.files.find(e=>e.path===shared).sha256=hash(fs.readFileSync(shared));fs.writeFileSync(manifest,JSON.stringify(data,null,2)+'\n');}
 assert.throws(()=>planInstall({...base,update:true}),/shared payload/);
 const files=planInstall({...base,update:true,reconcileShared:true});
 assert.equal(manifests.every(manifest=>files.some(file=>file.path===manifest)),true);
 applyInstall(files);
 const expected=hash(fs.readFileSync(shared));
 for(const manifest of manifests)assert.equal(JSON.parse(fs.readFileSync(manifest)).files.find(e=>e.path===shared).sha256,expected);
});
test('shared reconciliation rejects a stale secondary profile before writing',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-shared-stale-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const base={scope:'user',target,dataHome:path.join(target,'data')};
 applyInstall(planInstall(base));applyInstall(planInstall({...base,skillsDir:'.gemini/config/skills'}));
 const secondary=path.join(target,'.gemini/config/skills/spec-driven-superpowers/SKILL.md');
 fs.writeFileSync(secondary,'local edit');
 assert.throws(()=>planInstall({...base,update:true,reconcileShared:true}),/modified.*owned file/);
 assert.equal(fs.readFileSync(secondary,'utf8'),'local edit');
});
test('shared reconciliation safely restores a missing shared manifest entry and rejects divergent bytes',t=>{
 const make=()=>{const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-shared-bijection-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const base={scope:'user',target,dataHome:path.join(target,'data')};applyInstall(planInstall(base));applyInstall(planInstall({...base,skillsDir:'.gemini/config/skills'}));const profile=path.join(target,'.asds/install-manifests',fs.readdirSync(path.join(target,'.asds/install-manifests'))[0]),shared=path.join(target,'.asds/LICENSE');const receipt=JSON.parse(fs.readFileSync(profile));receipt.files=receipt.files.filter(entry=>entry.path!==shared);fs.writeFileSync(profile,JSON.stringify(receipt,null,2)+'\n');return {target,base,profile,shared};};
 const safe=make(),planned=planInstall({...safe.base,update:true,reconcileShared:true});applyInstall(planned);
 assert.equal(JSON.parse(fs.readFileSync(safe.profile)).files.some(entry=>entry.path===safe.shared),true);
 const divergent=make();fs.writeFileSync(divergent.shared,'user changed shared bytes\n');
 assert.throws(()=>planInstall({...divergent.base,update:true,reconcileShared:true}),/modified|missing|shared/i);
 assert.equal(fs.readFileSync(divergent.shared,'utf8'),'user changed shared bytes\n');
});
test('shared reconciliation requires the exact secondary profile payload',t=>{
 const make=()=>{const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-profile-exact-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const base={scope:'user',target,dataHome:path.join(target,'data')};applyInstall(planInstall(base));applyInstall(planInstall({...base,skillsDir:'.gemini/config/skills'}));const profile=path.join(target,'.asds/install-manifests',fs.readdirSync(path.join(target,'.asds/install-manifests'))[0]);return {target,base,profile};};
 const missing=make(),missingReceipt=JSON.parse(fs.readFileSync(missing.profile));
 const specific=path.join(missing.target,'.gemini/config/skills/asds-execution-consumer/SKILL.md');
 missingReceipt.files=missingReceipt.files.filter(entry=>entry.path!==specific);fs.writeFileSync(missing.profile,JSON.stringify(missingReceipt,null,2)+'\n');
 assert.throws(()=>planInstall({...missing.base,update:true,reconcileShared:true}),/missing.*profile|profile.*missing/i);
 assert.equal(fs.existsSync(specific),true);
 const absent=make(),absentSpecific=path.join(absent.target,'.gemini/config/skills/asds-execution-consumer/SKILL.md');fs.unlinkSync(absentSpecific);
 assert.throws(()=>planInstall({...absent.base,update:true,reconcileShared:true}),/missing.*owned|modified.*owned/i);
 assert.equal(fs.existsSync(absentSpecific),false);
 const extra=make(),extraReceipt=JSON.parse(fs.readFileSync(extra.profile)),foreign=path.join(extra.target,'.gemini/config/skills/foreign-skill/user.txt');
 fs.mkdirSync(path.dirname(foreign),{recursive:true});fs.writeFileSync(foreign,'user file\n');extraReceipt.files.push(ownership(foreign));fs.writeFileSync(extra.profile,JSON.stringify(extraReceipt,null,2)+'\n');
 assert.throws(()=>planInstall({...extra.base,update:true,reconcileShared:true}),/foreign|extra|profile/i);
 assert.equal(fs.readFileSync(foreign,'utf8'),'user file\n');
});
test('shared reconciliation rejects unknown secondary manifest fields',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-profile-schema-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const base={scope:'user',target,dataHome:path.join(target,'data')};
 applyInstall(planInstall(base));applyInstall(planInstall({...base,skillsDir:'.gemini/config/skills'}));
 const profile=path.join(target,'.asds/install-manifests',fs.readdirSync(path.join(target,'.asds/install-manifests'))[0]),receipt=JSON.parse(fs.readFileSync(profile));receipt.unknown=true;fs.writeFileSync(profile,JSON.stringify(receipt,null,2)+'\n');
 assert.throws(()=>planInstall({...base,update:true,reconcileShared:true}),/invalid.*manifest/i);
});

test('update removes only unchanged stale files owned by the current harness manifest',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-stale-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'project',target};applyInstall(planInstall(opts));
 const root=path.join(target,'.agents/skills/asds-execution-consumer'),stale=path.join(root,'legacy/obsolete.mjs'),user=path.join(root,'legacy/user-note.txt');
 writeHistoricalTombstone(stale);fs.writeFileSync(user,'preserve me\n');
 const manifest=path.join(target,'.asds/install-manifest.json'),receipt=JSON.parse(fs.readFileSync(manifest));
 receipt.files.push(ownership(stale));fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');
 const preview=planInstall({...opts,update:true});
 assert.equal(fs.existsSync(stale),true);assert.equal(fs.readFileSync(user,'utf8'),'preserve me\n');
 applyInstall(preview);
 assert.equal(fs.existsSync(stale),false);assert.equal(fs.readFileSync(user,'utf8'),'preserve me\n');
 assert.equal(JSON.parse(fs.readFileSync(manifest)).files.some(entry=>entry.path===stale),false);
 applyInstall(planInstall({...opts,update:true}));
});
test('chmod on a stale manifest-owned file preserves it as a user modification',{skip:process.platform==='win32'},t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-stale-mode-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const opts={scope:'project',target};applyInstall(planInstall(opts));
 const stale=path.join(target,'.agents/skills/asds-execution-consumer/legacy/obsolete.mjs'),manifest=path.join(target,'.asds/install-manifest.json');writeHistoricalTombstone(stale);
 const receipt=JSON.parse(fs.readFileSync(manifest));receipt.files.push(ownership(stale));fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');fs.chmodSync(stale,0o600);
 assert.throws(()=>planInstall({...opts,update:true}),/mode|modified|ownership/i);assert.equal(fs.existsSync(stale),true);assert.equal(fs.statSync(stale).mode & 0o777,0o600);
});

test('tampered stale entries for another skill or a user file are never deletion authority',t=>{
 for(const relative of ['.agents/skills/another-skill/owned.txt','.agents/skills/asds-execution-consumer/user-created.txt']) {
  const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-stale-unverified-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const opts={scope:'project',target};applyInstall(planInstall(opts));
  const file=path.join(target,relative),manifest=path.join(target,'.asds/install-manifest.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'user data\n');
  const receipt=JSON.parse(fs.readFileSync(manifest));receipt.files.push(ownership(file));fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');
  assert.throws(()=>planInstall({...opts,update:true}),/stale_unverified/);
  assert.equal(fs.readFileSync(file,'utf8'),'user data\n');
 }
});
test('an allowlisted stale path with invented self-consistent hash and mode is preserved',{skip:process.platform==='win32'},t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-stale-spoof-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const opts={scope:'project',target};applyInstall(planInstall(opts));
 const file=path.join(target,'.agents/skills/asds-execution-consumer/legacy/obsolete.mjs'),manifest=path.join(target,'.asds/install-manifest.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'spoofed arbitrary payload\n');fs.chmodSync(file,0o600);
 const receipt=JSON.parse(fs.readFileSync(manifest));receipt.files.push(ownership(file));fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');
 assert.throws(()=>planInstall({...opts,update:true}),/stale_unverified|tombstone/i);
 assert.equal(fs.readFileSync(file,'utf8'),'spoofed arbitrary payload\n');assert.equal(fs.statSync(file).mode & 0o777,0o600);
});

test('stale cleanup refuses modified, hardlinked, shared and foreign manifest entries',t=>{
 const make=()=>{const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-stale-safe-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));const opts={scope:'project',target};applyInstall(planInstall(opts));return {target,opts,manifest:path.join(target,'.asds/install-manifest.json')};};
 for(const mode of ['modified','hardlink','shared','foreign']) {
  const {target,opts,manifest}=make(),receipt=JSON.parse(fs.readFileSync(manifest));
  const stale=mode==='shared'?path.join(target,'.asds/old-shared.txt'):mode==='foreign'?path.join(target,'outside.txt'):path.join(target,'.agents/skills/asds-execution-consumer/old.mjs');
  fs.mkdirSync(path.dirname(stale),{recursive:true});fs.writeFileSync(stale,'owned\n');receipt.files.push(ownership(stale));fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');
  if(mode==='modified')fs.writeFileSync(stale,'local edit\n');
  if(mode==='hardlink')fs.linkSync(stale,path.join(target,'stale-link'));
  assert.throws(()=>planInstall({...opts,update:true}),/modified|hardlink|stale|ownership|reconciliation/i);
  assert.equal(fs.existsSync(stale),true);
 }
});

test('ordinary failure restores a removed stale file and leaves no cleanup temporary',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-stale-rollback-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'project',target};applyInstall(planInstall(opts));
 const stale=path.join(target,'.agents/skills/asds-execution-consumer/legacy/obsolete.mjs'),manifest=path.join(target,'.asds/install-manifest.json');
 writeHistoricalTombstone(stale);
 const receipt=JSON.parse(fs.readFileSync(manifest));receipt.files.push(ownership(stale));fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n');
 const files=planInstall({...opts,update:true});
 assert.throws(()=>applyInstall(files,{beforeWrite:file=>{if(file===manifest)throw new Error('injected after cleanup');}}),/injected after cleanup/);
 assert.equal(fs.readFileSync(stale,'utf8'),'owned old payload\n');
 assert.equal(fs.readdirSync(path.dirname(stale)).some(name=>name.startsWith('.asds-update-')),false);
});
