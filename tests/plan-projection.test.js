import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjection } from '../lib/plan-projection.mjs';
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
