import test from 'node:test';
import assert from 'node:assert/strict';
import { safePath, validateTasks, chooseExecution, validateDelivery, validateCanonicalReceipt } from '../lib/contracts.mjs';
import { digest } from '../lib/orchestration.mjs';

const task = (id, overrides = {}) => ({
  id, dependsOn: [], write: [`src/${id}.js`, `tests/${id}.test.js`],
  resources: [], scenarios: [`feature/${id}`],
  verification: ['npm test'], ...overrides,
  openDecisions: overrides.openDecisions ?? [],
  body: overrides.body ?? '## Outcome\nValidate the feature.\n## Inputs\nFeature spec.\n## Acceptance\nValid input succeeds.\n## Verification\nRun npm test.\n## Definition of done\nReviewed and integrated.',
});
test('task graph rejects cycles, missing dependencies, duplicate IDs and path escape', () => {
  assert.deepEqual(validateTasks([task('1'), task('2', { dependsOn: ['1'] })]), []);
  for (const tasks of [
    [task('1', { dependsOn: ['1'] })],
    [task('1', { dependsOn: ['2'] }), task('2', { dependsOn: ['1'] })],
    [task('1', { dependsOn: ['missing'] })],
    [task('1'), task('1')],
    [task('1', { write: ['../outside'] })],
    [task('1', { write: ['/absolute'] })],
    [task('1', { scenarios: [] })],
  ]) assert.ok(validateTasks(tasks).length > 0);
});
test('portable paths reject Windows aliases and ambiguous suffixes', () => {
  for (const file of ['src/NUL.txt', 'CON', 'src/COM1.log', 'src/LPT9', 'src/file.js.', 'src /file.js']) {
    assert.equal(safePath(file), false, file);
  }
  for (const file of ['src/console.js', '.agents/skills', 'src/company.txt']) {
    assert.equal(safePath(file), true, file);
  }
});
test('parallelism requires live capabilities, budget, disjoint scope and resources', () => {
  const capabilities = { spawn: true, isolatedWrites: true, maxParallel: 2 };
  assert.equal(chooseExecution([task('1'), task('2')], capabilities).mode, 'parallel');
  assert.equal(chooseExecution([task('1'), task('2')], {}).mode, 'sequential');
  assert.equal(chooseExecution([task('1'), task('2', { dependsOn: ['1'] })], capabilities).mode, 'sequential');
  assert.equal(chooseExecution([task('1'), task('2', { write: ['src/1.js'] })], capabilities).mode, 'sequential');
  assert.equal(chooseExecution([task('1'), task('2', { write: ['SRC/1.JS'] })], capabilities).mode, 'sequential');
  assert.equal(chooseExecution([task('1'), task('2')], { ...capabilities, maxParallel: 1 }).mode, 'sequential');
  assert.equal(chooseExecution([
    task('1', { write: ['src/caf\u00e9.js'] }), task('2', { write: ['src/cafe\u0301.js'] }),
  ], capabilities).mode, 'sequential');
  assert.equal(chooseExecution([
    task('1', { resources: ['db:test'] }), task('2', { resources: ['db:test'] }),
  ], capabilities).mode, 'sequential');
});
test('scheduler blocks unresolved decisions and missing readiness in all modes', () => {
  const capabilities = { spawn: true, isolatedWrites: true, maxParallel: 2 };
  assert.equal(chooseExecution([task('1', { openDecisions: ['Payload?'] })]).mode, 'blocked');
  assert.equal(chooseExecution([task('1'), task('2', { body: '' })], capabilities).mode, 'blocked');
});
test('delivery requires reviewed revision, passing evidence and no scope escape', () => {
  const delivery = {
    status: 'reviewed', baseRevision: 'base', revision: 'head',
    changedFiles: ['src/1.js'], evidence: [{ command: 'npm test', exitCode: 0, revision: 'head' }],
    reviews: { spec: 'head', quality: 'head', independent: true },
  };
  assert.deepEqual(validateDelivery(task('1'), delivery), []);
  for (const change of [
    { changedFiles: ['src/outside.js'] },
    { evidence: [] },
    { evidence: [{ command: 'npm test', exitCode: 1 }] },
    { evidence: [{ command: 'npm test', exitCode: 0, revision: 'old-head' }] },
    { reviews: { spec: 'old-head', quality: 'head', independent: true } },
    { reviews: { spec: 'head', quality: 'head', independent: false } },
  ]) assert.ok(validateDelivery(task('1'), { ...delivery, ...change }).length > 0);
});
test('hardened evidence separates declared command from observed execution scope',()=>{
  const delivery={status:'delivered',baseRevision:'base',revision:'head',changedFiles:['src/1.js'],evidence:[{
    command:'npm test -- tests/1.test.js',exitCode:0,revision:'head',
    observed:{invocation:'npm test -- tests/1.test.js',scope:'full-suite',targets:['all discovered tests'],source:'test runner output'},
  }]};
  const contract=task('1',{verification:['npm test -- tests/1.test.js']});
  assert.deepEqual(validateDelivery(contract,delivery,{requireObservedExecution:true}),[]);
  const legacy={...delivery,evidence:delivery.evidence.map(({observed,...item})=>item)};
  assert.ok(validateDelivery(contract,legacy,{requireObservedExecution:true}).some(error=>error.includes('observed execution')));
  assert.deepEqual(validateDelivery(contract,legacy),[]);
  for(const observed of [
    {invocation:'true',scope:'declared',targets:['fixture'],source:'claim'},
    {invocation:'npm test -- tests/1.test.js',scope:'declared',targets:[],source:'claim'},
  ]) assert.ok(validateDelivery(contract,{...delivery,evidence:[{...delivery.evidence[0],observed}]},{requireObservedExecution:true}).length);
});
test('host labels and permissive nested objects are not verifiable execution provenance',()=>{
  const contract=task('1',{verification:['npm test']});
  const observed={invocation:'npm test',scope:'declared',targets:['tests/1.test.js'],source:'host'};
  const delivery={status:'reviewed',baseRevision:'base',revision:'head',changedFiles:['src/1.js'],
    evidence:[{command:'npm test',exitCode:0,revision:'head',observed}],
    reviews:{spec:'head',quality:'head',independent:true}};
  assert.ok(validateDelivery(contract,delivery,{requireObservedExecution:true,requireHostAttestation:true}).length,
    'a caller-written source:host label cannot replace a host/journal observation binding');
  assert.ok(validateDelivery(contract,{...delivery,evidence:[{...delivery.evidence[0],futureAuthority:true}]},{requireObservedExecution:true,requireHostAttestation:true}).length,
    'evidence items must reject unknown nested authority fields');
  assert.ok(validateDelivery(contract,{...delivery,reviews:{...delivery.reviews,futureAuthority:true}},{requireObservedExecution:true,requireHostAttestation:true}).length,
    'review records must reject unknown nested authority fields');
});
test('malformed integration evidence returns structural errors instead of throwing',()=>{
  const delivery={status:'integrated',baseRevision:'base',revision:'head',changedFiles:[],evidence:[{command:'npm test',exitCode:0,revision:'head'}],
    reviews:{spec:'head',quality:'head',independent:true},integrationRevision:'integrated',integrationEvidence:{},
    integrationReviews:{spec:'integrated',quality:'integrated',independent:true}};
  assert.doesNotThrow(()=>validateDelivery(task('1'),delivery));
  assert.ok(validateDelivery(task('1'),delivery).some(error=>error.includes('integration evidence')));
});

test('canonical receipts require exact provenance, observed commands and separated baseline dirt',()=>{
  const sha = value => value.repeat(64);
  const contract = task('1',{contractRevision:'canonical-1',verification:['npm test']});
  const baselineLedger={schemaVersion:'asds.workspace-baseline-ledger/1',workspaceBaselineFingerprint:sha('a'),candidateFingerprint:sha('b'),workspaceIdentityDigest:sha('3'),snapshotDigest:sha('4'),deltaDigest:sha('5'),observationToken:sha('6'),preexistingDirty:[{path:'src/1.js',sha256:sha('1')}],candidateChanges:[{path:'src/1.js',beforeSha256:sha('1'),afterSha256:sha('2')}],source:'host-bridge'};
  const receipt = {
    schemaVersion:'asds.canonical-receipt/1',status:'integrated',contractRevision:'canonical-1',baseRevision:'base',revision:'candidate',
    changedFiles:['src/1.js'],evidence:[{command:'npm test',exitCode:0,revision:'candidate',observed:{invocation:'npm test',scope:'declared',targets:['tests/1.test.js'],source:'host'}}],
    reviews:{spec:'candidate',quality:'candidate',independent:true},integrationRevision:'integration',
    integrationEvidence:[{command:'npm test',exitCode:0,revision:'integration',observed:{invocation:'npm test',scope:'full-suite',targets:['tests/*.test.js'],source:'host'}}],
    integrationReviews:{spec:'integration',quality:'integration',independent:true},
    hostAttestation:null,baselineObservation:null,authorityConsumptions:null,
    provenance:{schemaVersion:'asds.receipt-provenance/1',taskId:'1',projectionRevision:'projected-1',canonicalRevision:'canonical-1',planningRevision:'plan',runtimeRevision:'runtime',candidateRevision:'candidate',integrationRevision:'integration',reviewRevision:'integration',progressRevision:sha('c'),journalVersion:3,journalSequence:9,journalEventDigest:sha('d'),runtimeReceiptDigest:sha('e'),baselineLedger},
    reconciliation:{schemaVersion:'asds.receipt-reconciliation/1',taskId:'1',projectionContractRevision:'projected-1',canonicalContractRevision:'canonical-1',projectedContractDigest:sha('f'),canonicalContractDigest:sha('0'),differences:[],equivalence:null,planRevision:'plan',journalSequence:9,journalEventDigest:sha('d')},
  };
  receipt.hostAttestation={schemaVersion:'asds.delivery-host-attestation/1',token:sha('9'),source:'host-bridge',authorityGeneration:1,taskId:'1',planningRevision:'plan',candidateRevision:'candidate',integrationRevision:'integration',reviewRevision:'integration',journalVersion:3,journalSequence:9,journalEventDigest:sha('d'),
    evidence:[{phase:'candidate',command:'npm test',revision:'candidate',scope:'declared',targets:['tests/1.test.js'],evidenceDigest:digest(receipt.evidence[0]),toolCallDigest:sha('7'),eventSequence:3,eventDigest:sha('7')},{phase:'integration',command:'npm test',revision:'integration',scope:'full-suite',targets:['tests/*.test.js'],evidenceDigest:digest(receipt.integrationEvidence[0]),toolCallDigest:sha('8'),eventSequence:6,eventDigest:sha('8')}],
    reviews:[{phase:'candidate',revision:'candidate',reviewerSession:'candidate-reviewer',eventSequence:4,eventDigest:sha('4')},{phase:'integration',revision:'integration',reviewerSession:'integration-reviewer',eventSequence:7,eventDigest:sha('7')}]};
  receipt.baselineObservation={schemaVersion:'asds.workspace-baseline-observation/1',token:sha('6'),source:'host-bridge',authorityGeneration:1,journalVersion:3,journalSequence:9,journalEventDigest:sha('d'),planningRevision:'plan',candidateRevision:'candidate',integrationRevision:'integration',reviewRevision:'integration',workspaceIdentityDigest:sha('3'),snapshotDigest:sha('4'),deltaDigest:sha('5'),ledgerDigest:digest(baselineLedger),preexistingDirty:baselineLedger.preexistingDirty,candidateChanges:baselineLedger.candidateChanges};
  receipt.authorityConsumptions=[['delivery-attestation',receipt.hostAttestation],['baseline-observation',receipt.baselineObservation]].map(([kind,artifact])=>{const binding={kind,token:artifact.token,source:'host-bridge',authorityGeneration:1,journalVersion:3,journalSequence:9,journalEventDigest:sha('d'),planningRevision:'plan',candidateRevision:'candidate',integrationRevision:'integration',reviewRevision:'integration',payloadDigest:digest(artifact)};return {schemaVersion:'asds.host-authority-consumption/1',kind,handle:digest({generation:1,token:artifact.token,binding}),token:artifact.token,source:'host-bridge',authorityGeneration:1,binding};});
  const validationContext={workspaceBaselineFingerprint:sha('a'),planningRevision:'plan',journalSequence:9,journalEventDigest:sha('d'),hostAttestation:receipt.hostAttestation,baselineObservation:receipt.baselineObservation};
  assert.deepEqual(validateCanonicalReceipt(contract,receipt,validationContext),[]);
  const forgedHandle={...receipt,authorityConsumptions:receipt.authorityConsumptions.map((item,index)=>index?item:{...item,handle:sha('f')})};
  assert.ok(validateCanonicalReceipt(contract,forgedHandle,validationContext).some(error=>/handle|authority consumption/i.test(error)),
    'an arbitrary 64-byte hex handle cannot authenticate a consumption receipt');
  assert.ok(validateCanonicalReceipt(contract,{...receipt,provenance:{...receipt.provenance,baselineLedger:{...receipt.provenance.baselineLedger,preexistingDirty:[]}}},{
    workspaceBaselineFingerprint:sha('a'),baselineObservation:{schemaVersion:'asds.workspace-baseline-observation/1',
      token:sha('6'),source:'host-bridge',authorityGeneration:1,journalVersion:3,journalSequence:9,journalEventDigest:sha('d'),planningRevision:'plan',candidateRevision:'candidate',integrationRevision:'integration',reviewRevision:'integration',workspaceIdentityDigest:sha('3'),snapshotDigest:sha('4'),deltaDigest:sha('5'),ledgerDigest:sha('9'),
      preexistingDirty:[{path:'src/1.js',sha256:sha('1')}],candidateChanges:[{path:'src/1.js',beforeSha256:sha('1'),afterSha256:sha('2')}]},
  }).length,'a structurally valid but incomplete/synthetic baseline ledger must not pass observed baseline reconciliation');
  for (const invalid of [
    {...receipt,provenance:{...receipt.provenance,planningRevision:'stale'}},
    {...receipt,provenance:{...receipt.provenance,unexpected:true}},
    {...receipt,futureReceiptAuthority:true},
    {...receipt,reconciliation:{...receipt.reconciliation,futureAuthority:true}},
    {...receipt,authorityConsumptions:[...receipt.authorityConsumptions,{...receipt.authorityConsumptions[0],kind:'progress-readback',binding:{...receipt.authorityConsumptions[0].binding,kind:'progress-readback'}}]},
    {...receipt,authorityConsumptions:receipt.authorityConsumptions.map((item,index)=>index?item:{...item,binding:{...item.binding,futureAuthority:true}})},
    {...receipt,evidence:receipt.evidence.map(({observed,...item})=>item)},
    {...receipt,provenance:{...receipt.provenance,baselineLedger:{...receipt.provenance.baselineLedger,candidateChanges:[{path:'src/1.js',beforeSha256:sha('9'),afterSha256:sha('2')}]}}},
  ]) assert.ok(validateCanonicalReceipt(contract,invalid,{...validationContext,projectionRevision:'projected-1',runtimeRevision:'runtime',progressRevision:sha('c'),runtimeReceiptDigest:sha('e')}).length);
});
