// Disposable functional fixture; no toolkit/runtime installation or worktree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectGitScope } from '../../lib/git-scope.mjs';
import { loadTasks, validateChange } from '../../lib/validation.mjs';
import { receiveHandoff, acceptWork } from '../../lib/handoff.mjs';
const toolkit = fileURLToPath(new URL('../../', import.meta.url));
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-counts-pilot-'));
const change = path.join(project, 'openspec/changes/counts');
const git = (...args) => {
 const result=spawnSync('git',['-c',`core.hooksPath=${os.devNull}`,'-c','commit.gpgSign=false','-c','user.email=fixture@example.invalid','-c','user.name=ASDS fixture',...args],{cwd:project,encoding:'utf8'});
 if(result.status!==0) throw new Error(result.stderr);
 return result.stdout.trim();
};
try {
 fs.mkdirSync(path.dirname(change),{recursive:true});
 fs.cpSync(path.join(toolkit,'examples/basic-change'),change,{recursive:true});
 const work=acceptWork(receiveHandoff({objective:'Validate positive counts',project,scope:['src/count.js','tests/count.test.js'],constraints:['fixture only','no publication'],risks:[],references:[change],authorizations:[]},{source:'direct'}));
 const errors=validateChange(change); if(errors.length) throw new Error(errors.join('; '));
 git('init'); git('add','.'); git('commit','-m','fixture planning baseline');
 const base=git('rev-parse','HEAD');
 fs.mkdirSync(path.join(project,'tests'));
 fs.writeFileSync(path.join(project,'tests/count.test.js'),`const test = require('node:test');
const assert = require('node:assert/strict');
const { isPositiveCount } = require('../src/count.js');
test('accept positive integers', () => { for (const n of [1, 3, 100]) assert.equal(isPositiveCount(n), true); });
test('reject invalid counts', () => { for (const n of [0, -1, 1.5, '3', null, NaN, Infinity]) assert.equal(isPositiveCount(n), false); });
`);
 const run=()=>{const r=spawnSync(process.execPath,['--test','tests/count.test.js'],{cwd:project,encoding:'utf8'});return {command:'node --test tests/count.test.js',exitCode:r.status,output:r.stdout+r.stderr};};
 const red=run(); if(red.exitCode!==1 || !red.output.includes('MODULE_NOT_FOUND')) throw new Error('Unexpected RED');
 fs.mkdirSync(path.join(project,'src'));
 fs.writeFileSync(path.join(project,'src/count.js'),`exports.isPositiveCount = value => Number.isInteger(value) && value > 0;\n`);
 const green=run(); if(green.exitCode!==0) throw new Error('GREEN failed');
 git('add','src/count.js','tests/count.test.js');git('commit','-m','fixture count implementation');
 const scope=collectGitScope(project,base);
 const evidence={project,change,base,scope,contractRevision:loadTasks(change)[0].contractRevision,work,red,green,status:'delivered-awaiting-independent-review',boundary:'temporary test fixture, no installed toolkit/runtime'};
 fs.writeFileSync(path.join(toolkit,'docs/reviews/counts-pilot-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({project,change,base,revision:scope.revision,red:red.exitCode,green:green.exitCode,status:evidence.status}));
} catch(error) {fs.rmSync(project,{recursive:true,force:true});throw error;}
