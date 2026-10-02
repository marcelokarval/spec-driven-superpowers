import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const directory of ['lib', 'scripts', 'tests']) {
  for (const name of fs.readdirSync(path.join(root, directory))) {
    if (!/\.(mjs|js)$/.test(name)) continue;
    const file = path.join(root, directory, name);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(result.stderr || result.error?.message);
      process.exitCode = 1;
    }
  }
}
if (!process.exitCode) console.log('JavaScript syntax checks passed.');
