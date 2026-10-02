import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverSkills } from '../lib/install.mjs';

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'asds-discovery-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function skill(collection, name, content = `---\nname: ${name}\ndescription: Test skill\n---\nInstructions\n`) {
  const directory = path.join(collection, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), content);
  return directory;
}

test('discovery ignores directories without SKILL.md, including residual duplicate names', t => {
  const collection = fixture(t);
  fs.mkdirSync(path.join(collection, 'spec-driven-superpowers'));
  fs.mkdirSync(path.join(collection, 'references'));
  fs.writeFileSync(path.join(collection, 'README.md'), 'Collection documentation');
  const expected = skill(collection, 'valid');
  assert.deepEqual(discoverSkills(collection, new Set(['spec-driven-superpowers'])), [expected]);
});

test('discovery still rejects real duplicate skill sources', t => {
  const collection = fixture(t);
  skill(collection, 'spec-driven-superpowers');
  assert.throws(() => discoverSkills(collection, new Set(['spec-driven-superpowers'])), /duplicate skill source/i);
});

test('discovery rejects empty skills and directories named SKILL.md', t => {
  for (const content of ['', ' \n\t', null]) {
    const collection = fixture(t);
    const directory = path.join(collection, 'invalid');
    fs.mkdirSync(directory);
    if (content === null) fs.mkdirSync(path.join(directory, 'SKILL.md'));
    else fs.writeFileSync(path.join(directory, 'SKILL.md'), content);
    assert.throws(() => discoverSkills(collection), /invalid skill source/i);
  }
});

test('discovery rejects linked skill sources', { skip: process.platform === 'win32' }, t => {
  for (const linkedDirectory of [true, false]) {
    const collection = fixture(t);
    const outside = skill(fixture(t), 'outside');
    if (linkedDirectory) fs.symlinkSync(outside, path.join(collection, 'linked'));
    else {
      fs.mkdirSync(path.join(collection, 'linked'));
      fs.symlinkSync(path.join(outside, 'SKILL.md'), path.join(collection, 'linked/SKILL.md'));
    }
    assert.throws(() => discoverSkills(collection), /symlink/i);
  }
});
