#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { planInstall, applyInstall } from '../lib/install.mjs';

try {
  const { values } = parseArgs({ options: {
    scope: { type: 'string' }, target: { type: 'string' },
    'config-home': { type: 'string' }, apply: { type: 'boolean' },
    activate: { type: 'boolean' }, rules: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/install.mjs --scope project|user --target DIR [--config-home DIR] [--activate] [--rules] [--apply]\nPreview is the default. No overwrite, global npm installation, or automatic harness configuration.');
  } else {
    const files = planInstall({ ...values, configHome: values['config-home'] });
    if (values.apply) applyInstall(files);
    console.log(`${values.apply ? 'Installed/verified' : 'Preview only'}: ${files.length} files`);
    if (!values.apply) for (const file of files) console.log(file.path);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
