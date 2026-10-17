import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildPlanningPackage,
  exportPlaneProjectionPayloads,
  reconcilePackageHierarchy,
  recordPlanningReviews,
  syncPlanningPackage,
} from '../lib/package-builder.mjs';
import { validateChange } from '../lib/validation.mjs';

test('buildPlanningPackage compiles canonical tasks, index waves, dag-status and manifest in one pass with zero candidate validation errors', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-pkg-builder-'));
  try {
    const changeDir = path.join(tmpDir, 'openspec/changes/sample-change');
    const result = buildPlanningPackage(changeDir, {
      packageId: 'sample-change',
      revision: 'r1',
      state: 'reviewing',
      reviewPolicy: {risk:'elevated',domains:['architecture'],independentRequired:true},
      proposal: '# Proposal\n\nDeliver sample change.\n',
      design: '# Design\n\nArchitecture design.\n',
      specs: {
        auth: [
          '# Auth Specification',
          '',
          '## ADDED Requirements',
          '',
          '### Requirement: Auth Flow',
          'The system SHALL enforce bounded auth.',
          '',
          '#### Scenario: Valid Login',
          '- **WHEN** a user submits valid credentials',
          '- **THEN** the session is established',
          '',
          '#### Scenario: Invalid Login',
          '- **WHEN** a user submits invalid credentials',
          '- **THEN** the request is rejected',
        ].join('\n'),
      },
      decisions: [
        {
          id: 'D1',
          status: 'open',
          summary: 'Choose token TTL policy',
          resolverTaskId: '0001',
        },
      ],
      blockers: [
        {
          id: 'B1',
          kind: 'decision',
          decisionId: 'D1',
          summary: 'Wait for D1 resolution',
          taskIds: ['0002'],
          affects: ['src/session.js'],
        },
      ],
      tasks: [
        {
          id: '0001',
          title: 'Resolve token policy: D1 & baseline',
          owner: 'planner-agent',
          kind: 'investigation',
          requirements: ['Auth Flow'],
          dependsOn: [],
          dependencyDetails: [],
          decisionInputs: [],
          resolvesDecisions: ['D1'],
          openDecisions: [],
          write: ['docs/token-policy.md'],
          resources: ['docs/token-policy.md'],
          scenarios: ['auth/Valid Login'],
          verification: ['npm test'],
        },
        {
          id: '0002',
          title: 'Parent package for session enforcement',
          owner: 'implementation-agent',
          nodeType: 'package',
          kind: 'implementation',
          requirements: [],
          dependsOn: ['0001'],
          dependencyDetails: [
            {
              id: '0001',
              reason: 'Requires resolved token policy D1',
              requiredOutput: 'Approved token policy in docs/token-policy.md',
            },
          ],
          decisionInputs: ['D1'],
          resolvesDecisions: [],
          openDecisions: ['D1'],
          write: [],
          resources: [],
          scenarios: [],
          verification: ['npm test'],
        },
        {
          id: '0003',
          title: 'Implement session enforcement leaf',
          owner: 'implementation-agent',
          nodeType: 'task',
          parentId: '0002',
          kind: 'implementation',
          requirements: ['Auth Flow'],
          dependsOn: ['0001'],
          dependencyDetails: [
            {
              id: '0001',
              reason: 'Requires resolved token policy D1',
              requiredOutput: 'Approved token policy in docs/token-policy.md',
            },
          ],
          decisionInputs: ['D1'],
          resolvesDecisions: [],
          openDecisions: ['D1'],
          write: ['src/session.js'],
          resources: ['src/session.js'],
          scenarios: ['auth/Invalid Login'],
          verification: ['npm test'],
        },
      ],
    });

    assert.equal(result.manifest.packageId, 'sample-change');
    assert.equal(result.manifest.tasks.length, 3);
    // Parent package 0002 was automatically reconciled bottom-up from child 0003
    const pkgTask = result.manifest.tasks.find(t => t.id === '0002');
    assert.deepEqual(pkgTask.write, ['src/session.js']);
    assert.deepEqual(pkgTask.scenarios, ['auth/Invalid Login']);
    assert.deepEqual(pkgTask.requirements, ['Auth Flow']);
    assert.deepEqual(reconcilePackageHierarchy(changeDir), []);

    assert.ok(fs.existsSync(path.join(changeDir, 'tasks.md')));
    assert.ok(fs.existsSync(path.join(changeDir, 'dag.mmd')));
    assert.ok(fs.existsSync(path.join(changeDir, 'dag-status.md')));
    assert.ok(fs.existsSync(path.join(changeDir, 'planning-manifest.json')));

    const candidateErrors = validateChange(changeDir, { candidate: true });
    assert.deepEqual(candidateErrors, []);

    // Strict mode (without candidate: true) flags pre-review gates before recordPlanningReviews
    const strictErrors = validateChange(changeDir, { candidate: false });
    assert.ok(strictErrors.length > 0);

    // Record independent reviews atomically -> transitions to partial (since B1 blocker is active)
    // and passes strict non-candidate validateChange even with openDecisions on blocked leaf 0003!
    assert.throws(() => recordPlanningReviews(changeDir, { reviewer:'reviewer-1' }), /explicit harness review schema/);
    const errors = validateChange(changeDir, { candidate:true });
    assert.deepEqual(errors, []);

    const plane = exportPlaneProjectionPayloads(changeDir, { parentIssueId: 'epic-uuid-1' });
    assert.equal(plane.counts.totalLeafIssues, 2);
    assert.equal(plane.counts.ready, 1);
    assert.equal(plane.counts.blocked, 1);
    assert.match(plane.issues[0].name, /^P4Y-I · 0001 — /);
    assert.equal(plane.issues[0].parent, 'epic-uuid-1');
    assert.match(plane.issues[0].description_html, /<h3>ASDS Task Contract/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('package-builder tests use isolated fixtures, never machine-specific projects or installation cleanup', () => {
  // Installation behavior is covered by isolated fixtures in install.test.js.
  // Inspect only this repository file; never probe a user's project or home.
  const source = fs.readFileSync(new URL('./package-builder.test.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\/(?:home|Users)\//);
  const removals = [...source.matchAll(/\bfs\.rmSync\s*\(([^\n]*)/g)];
  assert.equal(removals.length, 1);
  assert.equal(removals[0][1], 'tmpDir, { recursive: true, force: true });');
});
