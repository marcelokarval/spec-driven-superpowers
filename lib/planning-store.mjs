import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { safePath } from './planning-paths.mjs';
import { evaluatePlanningLifecycle, planningCandidateSha256, planningReadbackSha256 } from './planning-lifecycle.mjs';
import { projectionSourceDigest } from './plan-projection.mjs';
import { reviewDigest as hash, HARNESS_REVIEW_VERSION, verifyHarnessReviewFiles } from './harness-planning-review.mjs';
import { loadTasks } from './validation.mjs';
import { validateReadiness } from './contracts.mjs';
export const PLANNING_RECEIPT_VERSION='asds.planning-store-receipt/1';
export const REVIEW_RECEIPT_VERSION='asds.independent-review-receipt/1'; // historical, never upgraded implicitly
const completedIndex=content=>[...content.matchAll(/^- \[x\] \[Task ([A-Za-z0-9_-]+)\]\(tasks\/task-\1\.md\): .+$/gm)].map(m=>m[1]);
function destinationPath(root,relative) {
  if(!safePath(relative))throw Error(`unsafe planning path: ${relative}`);
  let current=path.resolve(root);
  if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('planning root symlink refused');
  for(const part of relative.split('/')) {current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error(`planning symlink refused: ${relative}`);}
  return current;
}
export function validatePlanningBundle(bundle) {
  const errors=[],seen=new Set();
  if(!bundle||typeof bundle.revision!=='string'||!Array.isArray(bundle.files)||!bundle.files.length)return ['bundle requires revision and files'];
  for(const f of bundle.files) {
    if(!f||!safePath(f.path)||typeof f.content!=='string'){errors.push('invalid bundle file');continue;}
    if(seen.has(f.path))errors.push(`duplicate bundle file: ${f.path}`);seen.add(f.path);
    if(f.sha256!==undefined&&f.sha256!==hash(f.content))errors.push(`bundle hash mismatch: ${f.path}`);
  }
  for(const r of ['planning-manifest.json','tasks.md'])if(!seen.has(r))errors.push(`missing bundle file: ${r}`);
  return errors;
}
export function readPlanningBundle(root,paths) {
  const files=paths.map(relative=>{const content=fs.readFileSync(destinationPath(root,relative),'utf8');return {path:relative,content,sha256:hash(content)};});
  return {revision:JSON.parse(files.find(f=>f.path==='planning-manifest.json').content).revision,files};
}
/** Historical authority entrypoints cannot dispatch or fabricate a replacement receipt. */
export async function createPlanningReviewAuthority(){throw Object.assign(Error('Use explicit harness review registration; authority API retired'),{code:'PLANNING_REVIEW_API_RETIRED',stage:'registration'});}
export async function hostCompletePlanningReview(){throw Object.assign(Error('Use explicit harness review registration and publishReviewedPlanningPackage'),{code:'PLANNING_REVIEW_API_RETIRED',stage:'registration'});}
export async function verifyPlanningReceipt(receipt,{revision,status,manifest:manifestPath='planning-manifest.json'}={}) {
  const errors=[];let m=null,lifecycle=null;
  try {
    if(receipt?.schemaVersion!==PLANNING_RECEIPT_VERSION||receipt.status!=='matched'||!Array.isArray(receipt.files)||!receipt.files.length||!path.isAbsolute(receipt.destination))throw Error('invalid planning store receipt');
    const paths=receipt.files.map(f=>f.path);
    if(new Set(paths).size!==paths.length)throw Error('duplicate receipt inventory');
    const bundle=readPlanningBundle(receipt.destination,paths);
    if((receipt.completedTaskIds??[]).some(id=>!completedIndex(bundle.files.find(f=>f.path==='tasks.md').content).includes(id)))errors.push('unauthorized progress reset');
    m=JSON.parse(bundle.files.find(f=>f.path===manifestPath).content);
    const expected=new Set(['planning-manifest.json',...m.references.map(r=>r.path)]);
    if(expected.size!==paths.length||paths.some(p=>!expected.has(p)))errors.push('planning receipt inventory differs from manifest');
    for(const f of bundle.files) {
      const prior=receipt.files.find(x=>x.path===f.path);
      if(prior.sha256!==f.sha256 && !(f.path==='tasks.md'&&receipt.normalizedIndexSha256===projectionSourceDigest(f.content,true)))errors.push(`planning store drift: ${f.path}`);
    }
    for(const r of m.references) {
      const f=bundle.files.find(f=>f.path===r.path);
      if(!f||(r.path==='tasks.md'&&r.role==='index'?projectionSourceDigest(f.content,true):f.sha256)!==r.sha256)errors.push(`manifest reference hash differs: ${r.path}`);
    }
    if(m.revision!==receipt.revision||(revision!==undefined&&m.revision!==revision))errors.push('revision differs');
    if(status!==undefined&&m.state!==status)errors.push('manifest state differs from planning return');
    if(path.resolve(m.authority?.destination??'')!==receipt.destination)errors.push('manifest destination differs');
    if(receipt.manifest?.sha256!==receipt.files.find(f=>f.path===manifestPath)?.sha256||receipt.index?.sha256!==receipt.files.find(f=>f.path==='tasks.md')?.sha256)errors.push('receipt manifest/index identity differs');
    if(!m.reviews?.every(r=>r.schemaVersion===HARNESS_REVIEW_VERSION)||m.reviews.length!==2)errors.push('historical review requires explicit harness reconciliation/review');
    else errors.push(...verifyHarnessReviewFiles(receipt.destination,m),
      ...loadTasks(receipt.destination).flatMap(task=>validateReadiness(task)));
    lifecycle=evaluatePlanningLifecycle(m);
    if(!(m.state==='partial'?lifecycle.canPartial:lifecycle.canDeliver))errors.push(...lifecycle.errors,'planning lifecycle is not deliverable');
  } catch(e){errors.push(`planning readback failed: ${e.message}`);}
  return {matched:!errors.length,errors,manifest:m,lifecycle,reviewMatched:!errors.length,
    proofLevel:'harness-record-consistency-and-current-store-bytes',authorityLimit:'Authorized harness is operationally trusted; no authentication of a malicious host or semantic certification.'};
}
/** Atomic file replacement + CAS, in-memory ordinary-failure rollback, no retained backups. */
export function publishPlanningBundle(root,bundle,{expectedRevision=null,expectedManifestSha256=null,failAfter=null}={}) {
  const errors=validatePlanningBundle(bundle);if(errors.length)throw Error(errors.join('; '));
  fs.mkdirSync(root,{recursive:true});
  const manifestPath=destinationPath(root,'planning-manifest.json');
  const lock=destinationPath(root,'.asds-publish.lock');
  const fd=fs.openSync(lock,'wx',0o600);
  const prior=new Map(),written=[],temps=[];
  try {
    const current=fs.existsSync(manifestPath)?fs.readFileSync(manifestPath,'utf8'):null;
    if((current?JSON.parse(current).revision:null)!==expectedRevision)throw Error('planning revision conflict');
    if(expectedManifestSha256!==null&&hash(current??'')!==expectedManifestSha256)throw Error('planning manifest CAS conflict');
    for(const [i,entry] of bundle.files.entries()) {
      const file=destinationPath(root,entry.path);fs.mkdirSync(path.dirname(file),{recursive:true});
      if(fs.existsSync(file)){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.nlink!==1)throw Error('unsafe existing planning file');prior.set(file,{data:fs.readFileSync(file),mode:stat.mode&0o777});}
      const temp=path.join(path.dirname(file),`.asds-write-${randomBytes(12).toString('hex')}`);temps.push(temp);
      const out=fs.openSync(temp,'wx',prior.get(file)?.mode??0o600);
      try{fs.writeFileSync(out,entry.content);fs.fsyncSync(out);}finally{fs.closeSync(out);}
      fs.renameSync(temp,file);written.push(file);
      if(failAfter===i+1)throw Error('injected planning publication failure');
    }
    const observed=readPlanningBundle(root,bundle.files.map(f=>f.path));
    if(observed.files.some((f,i)=>f.sha256!==hash(bundle.files[i].content)))throw Error('planning readback mismatch');
const files=observed.files.map(({path,sha256})=>({path,sha256}));
    return {schemaVersion:PLANNING_RECEIPT_VERSION,status:'matched',revision:bundle.revision,destination:path.resolve(root),files,
      manifest:files.find(f=>f.path==='planning-manifest.json'),index:files.find(f=>f.path==='tasks.md'),
      completedTaskIds:completedIndex(observed.files.find(f=>f.path==='tasks.md').content),
      normalizedIndexSha256:projectionSourceDigest(observed.files.find(f=>f.path==='tasks.md').content,true)};
  } catch(e) {
    const failures=[];
    for(const file of written.reverse())try{if(prior.has(file))fs.writeFileSync(file,prior.get(file).data,{mode:prior.get(file).mode});else fs.unlinkSync(file);}catch(f){failures.push(f.message);}
    throw Error(`${e.message}; ${failures.length?'rollback incomplete: '+failures.join('; '):'prior planning restored'}`);
  } finally {for(const t of temps)if(fs.existsSync(t))fs.unlinkSync(t);fs.closeSync(fd);fs.unlinkSync(lock);}
}
/** Only publication/readback can finalize delivery. No task execution. */
export async function publishReviewedPlanningPackage(root,{verifiedBy,expectedManifestSha256,failAfter=null}={}) {
  if(typeof verifiedBy!=='string'||!verifiedBy.trim())throw Error('explicit readback observer required');
  const mpath=destinationPath(root,'planning-manifest.json'),source=fs.readFileSync(mpath,'utf8'),m=JSON.parse(source);
  if(expectedManifestSha256!==hash(source))throw Error('explicit manifest CAS required');
  if(m.state!=='ready'||m.authority?.persistenceGranted!==true||!m.authority.authorization||path.resolve(m.authority.destination)!==path.resolve(root))throw Error('ready and explicit destination persistence grant required');
  const errors=[...verifyHarnessReviewFiles(root,m),...loadTasks(root).flatMap(task=>validateReadiness(task))];const gate=evaluatePlanningLifecycle(m);
  if(errors.length||!gate.canReady)throw Error([...errors,...gate.errors].join('; '));
  const paths=['planning-manifest.json',...new Set(m.references.map(r=>r.path))];
  const before=readPlanningBundle(root,paths);
  for(const r of m.references) {const f=before.files.find(f=>f.path===r.path);if((r.path==='tasks.md'&&r.role==='index'?projectionSourceDigest(f.content,true):f.sha256)!==r.sha256)throw Error('material/reference drift before publication');}
  m.layers.C15={status:'satisfied',reason:'Published and reopened exact package inventory',references:m.references.map(r=>r.id)};
  m.readback={status:'matched',revision:m.revision,candidateSha256:planningCandidateSha256(m),readbackSha256:planningReadbackSha256(m),destination:m.authority.destination,synthetic:false,executionEvidence:false,verifiedBy,
    evidence:'Deterministic inventory readback before final-state publication',referenceIds:m.references.map(r=>r.id),taskIds:gate.readyTaskIds,checks:{bytes:true,files:true,ids:true,relations:true,decisions:true,reviews:true}};
  if(!evaluatePlanningLifecycle(m).canDeliver)throw Error('final readback lifecycle failed');
  m.state='delivered';m.attendanceOutcome='planning_delivered';
  m.planningContribution={...m.planningContribution,usableTasks:gate.readyTaskIds,executionPerformed:false};
  before.files.forEach(f=>delete f.sha256);
  before.files.find(f=>f.path==='planning-manifest.json').content=JSON.stringify(m,null,2)+'\n';
  const receipt=publishPlanningBundle(root,before,{expectedRevision:m.revision,expectedManifestSha256,failAfter});
  const checked=await verifyPlanningReceipt(receipt,{status:'delivered'});
  if(!checked.matched) {publishPlanningBundle(root,{revision:m.revision,files:[{path:'planning-manifest.json',content:source},{path:'tasks.md',content:before.files.find(f=>f.path==='tasks.md').content}]},{expectedRevision:m.revision});throw Error(checked.errors.join('; '));}
  return receipt;
}
