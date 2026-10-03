import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { safePath, validateTasks, validateReadiness, validateDelivery } from './contracts.mjs';
import { discoverSkills } from './install.mjs';

export function parseMapping(text) {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors.map(error => error.message).join('; '));
  const value = document.toJS({ maxAliasCount: 100 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('YAML must be a mapping');
  return value;
}

export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Missing YAML frontmatter');
  return parseMapping(match[1]);
}

// Artifact references cannot traverse symlinks or escape the selected root.
function localPath(root, relative) {
  if (!safePath(relative)) throw new Error(`Unsafe artifact path: ${relative}`);
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Artifact symlink refused: ${relative}`);
  }
  return current;
}

function read(root, relative) {
  return fs.readFileSync(localPath(root, relative), 'utf8');
}

function markdownFiles(root, directory) {
  const result = [];
  for (const entry of fs.readdirSync(localPath(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Artifact symlink refused: ${relative}`);
    if (entry.isDirectory()) result.push(...markdownFiles(root, relative));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(relative);
  }
  return result.sort();
}

export function validateSchema(root) {
  const errors = [];
  try {
    const schema = parseMapping(read(root, 'schema.yaml'));
    if (typeof schema.name !== 'string' || !/^[a-z0-9-]+$/.test(schema.name)) errors.push('Invalid schema name');
    if (schema.version !== 1) errors.push('Unsupported schema version');
    if (!Array.isArray(schema.artifacts) || !schema.artifacts.length) throw new Error('Missing schema artifacts');
    const graph = schema.artifacts.map(artifact => ({
      id: artifact.id, dependsOn: artifact.requires, write: [], resources: [],
      scenarios: ['schema'], verification: ['schema validation'],
    }));
    errors.push(...validateTasks(graph));
    for (const artifact of schema.artifacts) {
      if (typeof artifact.generates !== 'string' || !safePath(artifact.generates.replaceAll('*', 'glob'))) {
        errors.push(`Unsafe generates path: ${artifact.id}`);
      }
      if (!safePath(artifact.template)) errors.push(`Invalid template: ${artifact.id}`);
      else if (!read(root, `templates/${artifact.template}`).trim()) errors.push(`Empty template: ${artifact.id}`);
    }
    if (!Array.isArray(schema.apply?.requires) || !schema.apply.requires.length ||
        schema.apply.requires.some(id => !graph.some(artifact => artifact.id === id))) errors.push('Invalid apply dependencies');
    if (!safePath(schema.apply?.tracks)) errors.push('Invalid apply tracks');
  } catch (error) { errors.push(error.message); }
  return errors;
}

export function loadTasks(root) {
  // Bind approval/evidence to planning context, not to the mutable progress index.
  const context = ['proposal.md', 'design.md', ...markdownFiles(root, 'specs')]
    .map(file => [file, read(root, file)]);
  const sources = markdownFiles(root, 'tasks').map(file => {
    const source = read(root, file);
    const task = parseFrontmatter(source);
    if (file !== `tasks/task-${task.id}.md`) throw new Error(`Task id/filename mismatch: ${file}`);
    const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
    return { task: { ...task, body }, file, source };
  });
  return sources.map(entry => {
    const dependencies = new Set();
    function visit(task) {
      if (dependencies.has(task.id)) return;
      dependencies.add(task.id);
      for (const id of Array.isArray(task.dependsOn) ? task.dependsOn : []) {
        const dependency = sources.find(item => item.task.id === id);
        if (dependency) visit(dependency.task);
      }
    }
    visit(entry.task);
    const boundSources = sources.filter(item => dependencies.has(item.task.id)).map(item => [item.file, item.source]);
    const contractRevision = createHash('sha256').update(JSON.stringify([...context, ...boundSources])).digest('hex');
    return { ...entry.task, contractRevision };
  });
}

export function validateChange(root, { receipts = {}, allowUnready = false } = {}) {
  const errors = [];
  try {
    const index = read(root, 'tasks.md');
    const indexed = new Map();
    for (const line of index.split(/\r?\n/)) {
      if (!/^\s*[-*] \[[ xX]\]/.test(line)) continue;
      const match = line.match(/^- \[([ xX])\] \[Task ([A-Za-z0-9_-]+)\]\(tasks\/task-([A-Za-z0-9_-]+)\.md\): .+$/);
      if (!match || match[2] !== match[3]) { errors.push(`Invalid task index entry: ${line}`); continue; }
      if (indexed.has(match[2])) errors.push(`Duplicate indexed task: ${match[2]}`);
      indexed.set(match[2], match[1].toLowerCase() === 'x');
    }
    if (!indexed.size) errors.push('No task links in tasks.md');
    const tasks = loadTasks(root);
    errors.push(...validateTasks(tasks));
    for (const id of indexed.keys()) if (!tasks.some(task => task.id === id)) errors.push(`Missing task contract: ${id}`);
    const scenarios = new Set();
    for (const file of markdownFiles(root, 'specs')) {
      const capability = path.posix.dirname(file).slice('specs/'.length);
      for (const match of read(root, file).matchAll(/^#### Scenario:\s*(.+)$/gm)) {
        const id = `${capability}/${match[1].trim()}`;
        if (scenarios.has(id)) errors.push(`Duplicate scenario: ${id}`);
        scenarios.add(id);
      }
    }
    const covered = new Set();
    for (const task of tasks) {
      if (!allowUnready || indexed.get(task.id)) errors.push(...validateReadiness(task));
      if (!indexed.has(task.id)) errors.push(`orphan contract: ${task.id}`);
      if (indexed.get(task.id)) {
        const receipt = receipts?.[task.id];
        if (!receipt || receipt.status !== 'integrated') errors.push(`Completed task ${task.id} requires integrated receipt`);
        else errors.push(...validateDelivery(task, receipt).map(error => `${task.id}: ${error}`));
      }
      for (const dependency of Array.isArray(task.dependsOn) ? task.dependsOn : []) {
        if (indexed.get(task.id) && !indexed.get(dependency)) errors.push(`Completed task ${task.id} has incomplete dependency ${dependency}`);
      }
      for (const scenario of Array.isArray(task.scenarios) ? task.scenarios : []) {
        if (!scenarios.has(scenario)) errors.push(`Unknown scenario: ${scenario}`);
        covered.add(scenario);
      }
    }
    for (const scenario of scenarios) if (!covered.has(scenario)) errors.push(`Unmapped scenario: ${scenario}`);
  } catch (error) { errors.push(error.message); }
  return errors;
}

export function validatePackage(root) {
  const errors = validateSchema(path.join(root, 'schemas/superpowers-bridge'));
  try {
    const names = new Set(['spec-driven-superpowers']);
    const sources = [path.join(root, 'skills/spec-driven-superpowers')];
    for (const collection of ['openspec', 'superpowers']) {
      sources.push(...discoverSkills(path.join(root, 'skills', collection), names));
    }
    for (const source of sources) {
      const skill = parseFrontmatter(read(source, 'SKILL.md'));
      if (skill.name !== path.basename(source) || typeof skill.description !== 'string' || !skill.description.trim()) {
        errors.push(`Invalid skill metadata: ${source}`);
      }
    }
  } catch (error) { errors.push(error.message); }
  return errors;
}

export function validateLocalLinks(root, files) {
  const errors = [];
  for (const file of files) {
    const text = read(root, file).replace(/```[\s\S]*?```/g, '');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const link = match[1];
      if (/^(?:[a-z]+:|#)/i.test(link)) continue;
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURI(link.split('#')[0])));
      try { localPath(root, relative); }
      catch (error) { errors.push(`${file}: broken link ${link}: ${error.message}`); }
    }
  }
  return errors;
}
