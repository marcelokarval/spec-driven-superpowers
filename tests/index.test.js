import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Helper to extract YAML frontmatter from markdown
function parseFrontmatter(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, `File must contain YAML frontmatter: ${filePath}`);
  
  const yamlContent = match[1];
  const data = {};
  for (const line of yamlContent.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      data[key] = val;
    }
  }
  return data;
}

test('Universal AGENTS.md rule existence and governance directives', () => {
  const agentsRulePath = path.join(rootDir, 'rules', 'AGENTS.md');
  assert.ok(fs.existsSync(agentsRulePath), 'rules/AGENTS.md must exist');
  
  const content = fs.readFileSync(agentsRulePath, 'utf8');
  assert.ok(content.includes('Autonomous Spec-Driven Superpowers Standard'), 'Must contain ASDS title');
  assert.ok(content.includes('Core Principle: OpenSpec Governs "What", Superpowers Governs "How"'), 'Must define Core Principle');
  assert.ok(content.includes('Zero-Command Autonomous Orchestration'), 'Must define Zero-Command directive');
  assert.ok(content.includes('Pre-flight Baseline Health Check'), 'Must define Pre-flight check');
  assert.ok(content.includes('Mandatory Master-Detail Task Architecture'), 'Must define Master-Detail task architecture');
  assert.ok(content.includes('Native Parallelism & Workspace Isolation'), 'Must define parallelism');
  assert.ok(content.includes('Strict TDD, Atomic Commits, Visual Proofs & Evidence Ledger'), 'Must define TDD & Evidence Ledger');
});

test('Master ASDS Skill frontmatter and integrity', () => {
  const masterSkillPath = path.join(rootDir, 'skills', 'spec-driven-superpowers', 'SKILL.md');
  const frontmatter = parseFrontmatter(masterSkillPath);
  assert.equal(frontmatter.name, 'spec-driven-superpowers');
  assert.ok(frontmatter.description, 'Master skill must have a description');
});

test('OpenSpec skills catalog frontmatter integrity', () => {
  const openspecDir = path.join(rootDir, 'skills', 'openspec');
  const expectedSkills = [
    'openspec-explore',
    'openspec-propose',
    'openspec-apply-change',
    'openspec-archive-change',
    'openspec-sync-specs',
    'openspec-update-change'
  ];

  for (const skillName of expectedSkills) {
    const skillPath = path.join(openspecDir, skillName, 'SKILL.md');
    const frontmatter = parseFrontmatter(skillPath);
    assert.equal(frontmatter.name, skillName, `Skill name in frontmatter must match ${skillName}`);
    assert.ok(frontmatter.description, `Skill ${skillName} must have description`);
  }
});

test('Superpowers skills catalog frontmatter integrity', () => {
  const superpowersDir = path.join(rootDir, 'skills', 'superpowers');
  const expectedSkills = [
    'brainstorming',
    'dispatching-parallel-agents',
    'executing-plans',
    'finishing-a-development-branch',
    'receiving-code-review',
    'requesting-code-review',
    'subagent-driven-development',
    'systematic-debugging',
    'test-driven-development',
    'using-git-worktrees',
    'using-superpowers',
    'verification-before-completion',
    'writing-plans',
    'writing-skills'
  ];

  for (const skillName of expectedSkills) {
    const skillPath = path.join(superpowersDir, skillName, 'SKILL.md');
    const frontmatter = parseFrontmatter(skillPath);
    assert.equal(frontmatter.name, skillName, `Skill name in frontmatter must match ${skillName}`);
    assert.ok(frontmatter.description, `Skill ${skillName} must have description`);
  }
});

test('Superpowers-bridge schema and templates integrity', () => {
  const schemaPath = path.join(rootDir, 'schemas', 'superpowers-bridge', 'schema.yaml');
  assert.ok(fs.existsSync(schemaPath), 'schema.yaml must exist');
  
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  assert.ok(schemaContent.includes('name: superpowers-bridge'), 'Schema name must be superpowers-bridge');
  assert.ok(schemaContent.includes('id: proposal'), 'Must include proposal artifact');
  assert.ok(schemaContent.includes('id: specs'), 'Must include specs artifact');
  assert.ok(schemaContent.includes('id: design'), 'Must include design artifact');
  assert.ok(schemaContent.includes('id: tasks'), 'Must include tasks artifact');
  assert.ok(schemaContent.includes('id: summary'), 'Must include summary artifact');

  const templatesDir = path.join(rootDir, 'schemas', 'superpowers-bridge', 'templates');
  const expectedTemplates = ['proposal.md', 'spec.md', 'design.md', 'tasks.md', 'task-template.md', 'summary.md'];
  for (const tpl of expectedTemplates) {
    assert.ok(fs.existsSync(path.join(templatesDir, tpl)), `Template ${tpl} must exist`);
  }
});

test('Cross-platform installer scripts existence', () => {
  assert.ok(fs.existsSync(path.join(rootDir, 'scripts', 'install.ps1')), 'install.ps1 must exist');
  assert.ok(fs.existsSync(path.join(rootDir, 'scripts', 'install.sh')), 'install.sh must exist');
});
