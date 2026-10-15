#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ExecutionHandoffError, createExecutionHandoff } from '../lib/execution-handoff.mjs';

try {
  const { values } = parseArgs({ strict: true, allowPositionals: false, options: {
    input: { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/create-execution-handoff.mjs --input INPUT_JSON [--output NEW_JSON]\nWithout --output, the validated envelope is printed to stdout. Output uses create-exclusive semantics.');
  } else {
    if (!values.input) throw new ExecutionHandoffError('--input is required');
    if (values.output && fs.existsSync(path.resolve(values.output))) throw new ExecutionHandoffError('output already exists', 'ASDS_EXECUTION_HANDOFF_OUTPUT_EXISTS');
    const input = JSON.parse(fs.readFileSync(path.resolve(values.input), 'utf8'));
    const envelope = createExecutionHandoff(input);
    const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
    if (values.output) {
      try { fs.writeFileSync(path.resolve(values.output), serialized, { flag: 'wx', mode: 0o600 }); }
      catch (cause) {
        if (cause.code === 'EEXIST') throw new ExecutionHandoffError('output already exists', 'ASDS_EXECUTION_HANDOFF_OUTPUT_EXISTS', { cause });
        throw cause;
      }
    } else process.stdout.write(serialized);
  }
} catch (error) {
  const code = error instanceof ExecutionHandoffError ? error.code : 'ASDS_EXECUTION_HANDOFF_INVALID';
  process.stderr.write(`${code}: ${error.message}\n`);
  process.exitCode = 1;
}
