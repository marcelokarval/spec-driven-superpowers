import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preflight } from '../lib/runtime-preflight.mjs';
test('bounded discovery reuses known executable outside PATH without downloads or initialization',{skip:process.platform === 'win32' ? 'POSIX shell executable fixture' : false},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-preflight-')); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const cli=path.join(root,'openspec-cli'); fs.writeFileSync(cli,'#!/bin/sh\necho 1.14.0\n',{mode:0o755});
 const request={tool:'openspec',operation:'validate',required:true,knownPaths:[cli],project:root,expectedVersions:['1.14.0']};
 const result=preflight(request,{pathEnv:''});
 assert.equal(result.state,'available'); assert.equal(result.selected.path,cli); assert.equal(result.selected.origin,'documented');
 assert.equal(result.project.state,'not_initialized'); assert.equal(fs.existsSync(path.join(root,'openspec')),false);
 assert.equal(result.capability,'unverified');
 assert.equal(result.installationAuthorized,false);
});
test('versions are explicit; incompatible candidates cannot silently win; refusal preserved',{skip:process.platform === 'win32' ? 'POSIX shell executable fixture' : false},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-preflight-')); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const one=path.join(root,'one'), two=path.join(root,'two');
 fs.writeFileSync(one,'#!/bin/sh\necho 0.1.0\n',{mode:0o755}); fs.writeFileSync(two,'#!/bin/sh\necho 1.14.0\n',{mode:0o755});
 const r=preflight({tool:'openspec',operation:'validate',knownPaths:[one,two],expectedVersions:['1.14.0'],installationDecision:{decision:'denied',source:'user'}},{pathEnv:''});
 assert.equal(r.selected.path,two); assert.equal(r.candidates[0].state,'incompatible'); assert.equal(r.installationDecision.decision,'denied');
 const absent=preflight({tool:'openspec',operation:'validate',knownPaths:[],installationDecision:{decision:'denied',source:'user'}},{pathEnv:''});
 assert.equal(absent.state,'absent'); assert.equal(absent.remediation.action,'respect_refusal');
 assert.throws(()=>preflight({tool:'npx',operation:'install'}),/supported/);
});
test('inaccessible binaries and invalid project configurations are separate observations',{skip:process.platform === 'win32' ? 'POSIX file permission fixture' : false},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-preflight-')); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const cli=path.join(root,'cli'); fs.writeFileSync(cli,'not executable',{mode:0o600});
 fs.mkdirSync(path.join(root,'openspec')); fs.writeFileSync(path.join(root,'openspec/config.yaml'),'schema: [broken');
 const r=preflight({tool:'openspec',operation:'validate',project:root,knownPaths:[cli]},{pathEnv:''});
 assert.equal(r.state,'inaccessible'); assert.equal(r.project.state,'invalid_configuration');
});

test('native Node preflight uses the existing executable on every supported test platform',()=>{
 const result=preflight({tool:'node',operation:'orchestrate',knownPaths:[process.execPath],expectedVersions:[process.version.slice(1)]},{pathEnv:''});
 assert.equal(result.state,'available'); assert.equal(result.selected.effectivePath,fs.realpathSync(process.execPath));
 assert.equal(result.selected.version,process.version.slice(1)); assert.equal(result.capability,'unverified');
});
