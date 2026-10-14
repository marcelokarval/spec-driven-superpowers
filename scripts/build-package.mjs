#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildPlanningPackage,
  exportPlaneProjectionPayloads,
  recordPlanningReviews,
  syncPlanningPackage,
} from '../lib/package-builder.mjs';
import { validateChange } from '../lib/validation.mjs';

try {
  const { values } = parseArgs({
    options: {
      change: { type: 'string' },
      spec: { type: 'string' },
      state: { type: 'string' },
      revision: { type: 'string' },
      'package-id': { type: 'string' },
      'record-review': { type: 'string' },
      'export-plane': { type: 'string' },
      'print-dag': { type: 'boolean' },
      candidate: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });

  if (values.help || !values.change) {
    console.log(
      'Usage: node scripts/build-package.mjs --change DIR [--spec SPEC_JSON] [--state reviewing|ready|partial|delivered|blocked] [--revision r1] [--package-id ID] [--record-review REVIEWER_OR_JSON] [--export-plane OUT_JSON] [--print-dag] [--candidate]\n' +
      'Compiles canonical tasks.md (with Planned Waves), dag.mmd, dag-status.md, and planning-manifest.json (with SHA-256 references, package hierarchy reconciliation, and taskManager projection) in one pass, then runs structural validation.',
    );
    if (!values.help) process.exitCode = 1;
  } else {
    const changeDir = path.resolve(values.change);
    const specData = values.spec ? JSON.parse(fs.readFileSync(path.resolve(values.spec), 'utf8')) : {};
    const mergedOptions = {
      ...specData,
      ...(values.state ? { state: values.state } : {}),
      ...(values.revision ? { revision: values.revision } : {}),
      ...(values['package-id'] ? { packageId: values['package-id'] } : {}),
    };

    let result;
    if (values.spec) {
      result = buildPlanningPackage(changeDir, mergedOptions);
    } else if (values['record-review']) {
      const reviewArg = values['record-review'];
      const reviewSpec = fs.existsSync(path.resolve(reviewArg))
        ? JSON.parse(fs.readFileSync(path.resolve(reviewArg), 'utf8'))
        : { reviewer: reviewArg };
      result = recordPlanningReviews(changeDir, { ...mergedOptions, ...reviewSpec });
    } else {
      result = syncPlanningPackage(changeDir, mergedOptions);
    }

    if (values['export-plane']) {
      const planeData = exportPlaneProjectionPayloads(changeDir);
      if (values['export-plane'] === 'stdout' || values['export-plane'] === '-') {
        console.log(JSON.stringify(planeData, null, 2));
      } else {
        fs.writeFileSync(path.resolve(values['export-plane']), JSON.stringify(planeData, null, 2) + '\n', 'utf8');
      }
    }

    if (values['print-dag'] && fs.existsSync(path.join(changeDir, 'dag-status.md'))) {
      console.log(fs.readFileSync(path.join(changeDir, 'dag-status.md'), 'utf8').trimEnd());
    }

    const isCandidate = values.candidate ?? ['draft', 'reviewing', 'blocked'].includes(result.manifest.state);
    const errors = validateChange(changeDir, { candidate: isCandidate });
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else {
      console.log(
        `ASDS package built and validated: ${result.manifest.packageId} (${result.manifest.tasks.length} tasks, ${result.references.length} references, state=${result.manifest.state}).`,
      );
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
