#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { planInstall, applyInstall } from '../lib/install.mjs';

try {
  const { values } = parseArgs({ options: {
    scope: { type: 'string' }, target: { type: 'string' },
    'data-home': { type: 'string' }, 'skills-dir': { type: 'string' }, apply: { type: 'boolean' },
    activate: { type: 'boolean' }, rules: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/install.mjs --scope project|user --target DIR [--data-home DIR] [--skills-dir RELATIVE_DIR] [--activate] [--rules] [--apply]\nPreview is the default. User schemas use OpenSpec XDG_DATA_HOME, not config home. No overwrites or global npm installation.');
  } else {
    const files = planInstall({ ...values, dataHome: values['data-home'], skillsDir: values['skills-dir'] });
    if (values.apply) applyInstall(files);
    console.log(`${values.apply ? 'Installed/verified' : 'Preview only'}: ${files.length} files`);
    if (!values.apply) for (const file of files) console.log(file.path);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
