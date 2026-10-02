#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { validatePackage, validateChange, loadTasks } from '../lib/validation.mjs';
import { safePath, validateDelivery } from '../lib/contracts.mjs';
import { collectGitScope } from '../lib/git-scope.mjs';

try {
  const { values } = parseArgs({ options: {
    change: { type: 'string' }, delivery: { type: 'string' }, task: { type: 'string' },
    repo: { type: 'string' }, base: { type: 'string' }, help: { type: 'boolean' },
    receipts: { type: 'string' },
    'delivery-revision': { type: 'string' }, 'integration-repo': { type: 'string' },
    'integration-base': { type: 'string' }, 'integration-scope': { type: 'string' },
  } });
  if (values.help) {
    console.log('Usage: npm run validate [-- --change DIR [--receipts MAP_JSON] [--delivery JSON --task ID --repo REPO_ROOT --base APPROVED_BASE [--delivery-revision COMMIT] [--integration-repo REPO --integration-base APPROVED_BASE --integration-scope PATHS_JSON]]]\nIntegrated receipts require independently approved integration base/scope. Delivery checks current state unless an explicit historical commit is selected. No verification command execution.');
  } else {
    if ((values.repo || values.task || values.base) && !values.delivery) throw new Error('--repo, --task and --base require --delivery');
    if (['delivery-revision', 'integration-repo', 'integration-base', 'integration-scope'].some(key => values[key]) && !values.delivery) throw new Error('Revision/integration options require --delivery');
    if (values.receipts && !values.change) throw new Error('--receipts requires --change');
    const receipts = values.receipts ? JSON.parse(fs.readFileSync(values.receipts, 'utf8')) : {};
    const errors = values.change ? validateChange(path.resolve(values.change), { receipts }) : validatePackage(fileURLToPath(new URL('../', import.meta.url)));
    if (values.delivery) {
      if (!values.change || !values.task || !values.repo || !values.base) throw new Error('Delivery requires --change, --task, --repo and independently approved --base');
      const task = loadTasks(path.resolve(values.change)).find(task => task.id === values.task);
      if (!task) throw new Error(`Unknown task: ${values.task}`);
      const receipt = JSON.parse(fs.readFileSync(values.delivery, 'utf8'));
      const scope = collectGitScope(path.resolve(values.repo), values.base, values['delivery-revision']);
      if (receipt.baseRevision !== scope.baseRevision || receipt.revision !== scope.revision) errors.push('Receipt does not match current Git snapshot/base');
      if (!Array.isArray(receipt.changedFiles) || JSON.stringify([...new Set(receipt.changedFiles)].sort()) !== JSON.stringify(scope.changedFiles)) errors.push('Receipt omits or adds Git paths');
      errors.push(...validateDelivery(task, { ...receipt, changedFiles: scope.changedFiles }));
      if (receipt.status === 'integrated') {
        if (!values['integration-base'] || !values['integration-scope']) throw new Error('Integrated receipt requires independently approved --integration-base and --integration-scope');
        const integration = collectGitScope(path.resolve(values['integration-repo'] ?? values.repo), values['integration-base']);
        const allowed = JSON.parse(fs.readFileSync(values['integration-scope'], 'utf8'));
        if (!Array.isArray(allowed) || !allowed.every(safePath) || new Set(allowed).size !== allowed.length) throw new Error('Invalid integration scope');
        if (JSON.stringify([...allowed].sort()) !== JSON.stringify(integration.changedFiles)) errors.push('Integration scope differs from independently approved paths');
        if (receipt.integrationRevision !== integration.revision) errors.push('Integration does not match current Git snapshot');
      } else if (['integration-repo', 'integration-base', 'integration-scope'].some(key => values[key])) {
        throw new Error('Integration options require an integrated receipt');
      }
    }
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else console.log('ASDS validation passed (structural checks; not a certification of test/review authenticity).');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
