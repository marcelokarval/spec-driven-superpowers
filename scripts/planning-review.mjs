#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { recordPlanningReviews, syncPlanningPackage } from '../lib/package-builder.mjs';
import { harnessCandidate, verifyHarnessReviewFiles, reviewDigest } from '../lib/harness-planning-review.mjs';
import { publishReviewedPlanningPackage, verifyPlanningReceipt } from '../lib/planning-store.mjs';
try {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{change:{type:'string'},input:{type:'string'},receipt:{type:'string'},observer:{type:'string'},'expected-manifest-sha256':{type:'string'},output:{type:'string'}}});
  const [command]=positionals;
  const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
  let result;
  if(command==='verify')result=await verifyPlanningReceipt(json(values.receipt),{status:'delivered'});
  else {
    if(!values.change)throw Error('--change required');
    const root=path.resolve(values.change);
    if(command==='inspect'){const m=json(path.join(root,'planning-manifest.json'));result={...harnessCandidate(m),manifestSha256:reviewDigest(fs.readFileSync(path.join(root,'planning-manifest.json'))),reviewErrors:verifyHarnessReviewFiles(root,m)};}
    else if(command==='record')result=recordPlanningReviews(root,json(values.input));
    else if(command==='ready')result=syncPlanningPackage(root,{state:'ready'});
    else if(command==='publish')result=await publishReviewedPlanningPackage(root,{verifiedBy:values.observer,expectedManifestSha256:values['expected-manifest-sha256']});
    else throw Error('Usage: planning-review.mjs inspect|record|ready|publish --change DIR [--input REVIEW.json | --observer ID --expected-manifest-sha256 HASH]; verify --receipt FILE');
  }
  if(values.output)fs.writeFileSync(values.output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(result,null,2));
  if(result.matched===false)process.exitCode=1;
}catch(e){console.error(`ASDS_PASSIVE_REVIEW_ERROR: ${e.message}`);process.exitCode=1;}
