import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { planInstall, applyInstall } from '../lib/install.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');
function oldInstall(t) {
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'project',target};applyInstall(planInstall(opts));
 const file=path.join(target,'.agents/skills/spec-driven-superpowers/SKILL.md');
 const manifest=path.join(target,'.asds/install-manifest.json');
 const data=JSON.parse(fs.readFileSync(manifest));fs.writeFileSync(file,'previous released skill\n');
 data.files.find(f=>f.path===file).sha256=hash(fs.readFileSync(file));fs.writeFileSync(manifest,JSON.stringify(data,null,2)+'\n');
 return {opts,file,manifest};
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
test('update preserves permissions and rejects mode changes after preview',{skip:process.platform==='win32'},t=>{
 const {opts,file}=oldInstall(t);fs.chmodSync(file,0o600);
 const files=planInstall({...opts,update:true});applyInstall(files);
 assert.equal(fs.statSync(file).mode & 0o777,0o600);
 const second=oldInstall(t);const stale=planInstall({...second.opts,update:true});fs.chmodSync(second.file,0o600);
 assert.throws(()=>applyInstall(stale),/changed/);assert.equal(fs.readFileSync(second.file,'utf8'),'previous released skill\n');
});
test('user update refuses changing shared payload without reconciling other manifests',t=>{
 const target=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-update-shared-')));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const opts={scope:'user',target,dataHome:path.join(target,'data')};applyInstall(planInstall(opts));
 const file=path.join(target,'.asds/LICENSE'),manifest=path.join(target,'.asds/install-manifest.json');
 fs.writeFileSync(file,'old shared payload');const data=JSON.parse(fs.readFileSync(manifest));data.files.find(e=>e.path===file).sha256=hash(fs.readFileSync(file));fs.writeFileSync(manifest,JSON.stringify(data));
 assert.throws(()=>planInstall({...opts,update:true}),/shared payload/);
 assert.equal(fs.readFileSync(file,'utf8'),'old shared payload');
});
