// Passive binding helper. Observational/semantic fields are never defaulted.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [source,root,input,output]=process.argv.slice(2);
if(!output)throw Error('Usage: seal-observed.mjs SOURCE PACKAGE OBSERVED.json OUT.json');
const {harnessCandidate,createHarnessPlanningReview,reviewDigest,readReviewEvidence}=await import(pathToFileURL(path.join(source,'lib/harness-planning-review.mjs')));
const m=JSON.parse(fs.readFileSync(path.join(root,'planning-manifest.json')));
const observed=JSON.parse(fs.readFileSync(input));
if(JSON.stringify(observed).includes('REPLACE_'))throw Error('Replace placeholders from actual native observations');
const r={...harnessCandidate(m),...observed};
if(r.evidence.resultDigest!==reviewDigest(readReviewEvidence(root,r.evidence.persistedResultPath)))throw Error('Observed evidence bytes differ');
fs.writeFileSync(output,JSON.stringify(createHarnessPlanningReview(r),null,2)+'\n',{flag:'wx',mode:0o600});
