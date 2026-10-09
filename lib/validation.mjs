import { ancestorsOf, childrenOf, prerequisites } from './decomposition.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { safePath, validateTasks, validateReadiness, validateDelivery } from './contracts.mjs';
import { discoverSkills } from './install.mjs';
import { evaluatePlanningLifecycle } from './planning-lifecycle.mjs';
import { projectTaskManager, validateDecisionRouting } from './planning-graph.mjs';
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
const taskIndexPattern = /^\s*[-*] \[([ xX])\] \[Task ([A-Za-z0-9_-]+)\]\(tasks\/task-([A-Za-z0-9_-]+)\.md\): (.+)$/;

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

function optionalMarkdownFiles(root, directory) {
  return fs.existsSync(path.join(root, directory)) ? markdownFiles(root, directory) : [];
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
  const context = ['proposal.md', 'design.md'].filter(file => fs.existsSync(path.join(root, file)))
    .concat(optionalMarkdownFiles(root, 'specs'))
    .map(file => [file, read(root, file)]);
  let taskFiles;
  try { taskFiles = markdownFiles(root, 'tasks'); }
  catch (error) {
    if (error.message.startsWith('Artifact symlink refused: tasks/')) {
      throw new Error(error.message.replace('Artifact symlink', 'Task symlink'));
    }
    throw error;
  }
  const sources = taskFiles.map(file => {
    const source = read(root, file);
    let task;
    try { task = parseFrontmatter(source); }
    catch (error) {
      if (error.message === 'YAML must be a mapping') throw new Error('Task YAML must be a mapping');
      throw error;
    }
    if (file !== `tasks/task-${task.id}.md`) throw new Error(`Task id/filename mismatch: ${file}`);
    const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
    const heading = body.match(/^# Task\s+[A-Za-z0-9_-]+:\s*(.+)$/m);
    return { task: { ...task, title: task.title ?? heading?.[1]?.trim(), body }, file, source };
  });
  return sources.map(entry => {
    const dependencies = new Set(), visited = new Set();
    function visit(task) {
      if (visited.has(task.id)) return;
      visited.add(task.id);
      dependencies.add(task.id);
      for (const ancestor of ancestorsOf(sources.map(item => item.task), task.id)) {
        dependencies.add(ancestor.id);
        for (const id of ancestor.dependsOn ?? []) {
          const dependency = sources.find(item => item.task.id === id);
          if (dependency) visit(dependency.task);
        }
      }
      for (const id of Array.isArray(task.dependsOn) ? prerequisites(sources.map(item => item.task), task) : []) {
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

export function validateChangeSpecs(root) {
  const errors = [], files = optionalMarkdownFiles(root, 'specs');
  const openSpecShaped = ['proposal.md', 'design.md'].some(file => fs.existsSync(path.join(root, file))) ||
    fs.existsSync(path.join(root, 'specs'));
  if (!files.length) return openSpecShaped ? ['No specification files'] : [];
  for (const file of files) {
    const source = read(root, file), sections = [...source.matchAll(/^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$/gm)];
    if (!sections.length) { errors.push(`${file}: no OpenSpec delta section`); continue; }
    for (const [index, section] of sections.entries()) {
      const body = source.slice(section.index + section[0].length, sections[index + 1]?.index);
      if (['ADDED','MODIFIED'].includes(section[1]) && !/^### Requirement:\s*.+$/m.test(body)) {
        errors.push(`${file}: ${section[1]} Requirements section has no requirements`);
      }
    }
    for (const match of source.matchAll(/^### Requirement:\s*(.+)$/gm)) {
      const preceding = sections.filter(section => section.index < match.index).at(-1);
      if (!preceding) { errors.push(`${file}: requirement outside OpenSpec delta section`); continue; }
      const offset = match.index + match[0].length;
      const relativeEnd = source.slice(offset).search(/^(?:### Requirement:|## (?:ADDED|MODIFIED|REMOVED|RENAMED) Requirements)\s*$/m);
      const block = source.slice(offset, relativeEnd < 0 ? undefined : offset + relativeEnd);
      if (['ADDED','MODIFIED'].includes(preceding[1])) {
        if (!/\b(?:SHALL|MUST)\b/.test(block)) errors.push(`${file}: requirement ${match[1].trim()} lacks SHALL/MUST in its body`);
        if (!/^#### Scenario:\s*.+$/m.test(block)) errors.push(`${file}: requirement ${match[1].trim()} lacks a scenario`);
        for (const scenario of block.split(/^#### Scenario:\s*.+$/m).slice(1)) {
          if (!/^- \*\*WHEN\*\*\s+.+$/m.test(scenario) || !/^- \*\*THEN\*\*\s+.+$/m.test(scenario)) {
            errors.push(`${file}: requirement ${match[1].trim()} has a scenario without WHEN/THEN outcomes`);
          }
        }
      }
    }
  }
  return errors;
}

export function validateTaskIndex(root, tasks = loadTasks(root)) {
  const errors = [], source = read(root, 'tasks.md'), entries = [], declaredWaves = [];
  for (const line of source.split(/\r?\n/)) {
    const wave = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:Wave|Onda)\s+(\d+)(?:\*\*)?:\s*([A-Za-z0-9_-]+(?:\s*,\s*[A-Za-z0-9_-]+)*)\s*$/i);
    if (wave) declaredWaves.push({ number:Number(wave[1]), taskIds:wave[2].split(',').map(id=>id.trim()) });
    if (!/^\s*[-*] \[[ xX]\]/.test(line)) continue;
    const match = line.match(taskIndexPattern);
    if (!match || match[2] !== match[3]) { errors.push(`Invalid task index entry: ${line}`); continue; }
    entries.push({ completed:match[1].toLowerCase()==='x', id:match[2], title:match[4].trim() });
  }
  if (!entries.length) errors.push('No task links in tasks.md');
  const byId = new Map(tasks.map(task => [task.id, task])), seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) errors.push(`Duplicate indexed task: ${entry.id}`);
    seen.add(entry.id);
    if (!byId.has(entry.id)) errors.push(`Missing task contract: ${entry.id}`);
    else if (entry.title !== byId.get(entry.id).title) errors.push(`Task index title differs from contract: ${entry.id}`);
  }
  for (const task of tasks) if (!seen.has(task.id)) errors.push(`orphan contract: ${task.id}`);
  const numeric = entries.map(entry=>entry.id).filter(id=>/^\d+$/.test(id));
  if (numeric.some((id,index)=>index>0 && BigInt(id)<=BigInt(numeric[index-1]))) errors.push('Numeric task IDs must be strictly increasing in tasks.md');
  if (declaredWaves.some((wave,index)=>wave.number!==index+1)) errors.push('Declared waves must be consecutively numbered from 1');
  const declaredIds=declaredWaves.flatMap(wave=>wave.taskIds);
  if (new Set(declaredIds).size!==declaredIds.length) errors.push('A task may appear in only one declared wave');
  if (declaredIds.some(id=>!byId.has(id) || byId.get(id).nodeType==='package')) errors.push('Declared waves may contain only known executable tasks');
  return { errors, entries, declaredWaves:declaredWaves.map(wave=>wave.taskIds) };
}

export function validateChange(root, { receipts = {}, allowUnready = false } = {}) {
  const errors = [];
  try {
    const tasks = loadTasks(root);
    const indexValidation = validateTaskIndex(root, tasks), indexed = new Map(indexValidation.entries.map(entry=>[entry.id,entry.completed]));
    errors.push(...indexValidation.errors, ...validateChangeSpecs(root), ...validateTasks(tasks));
    const specFiles = optionalMarkdownFiles(root, 'specs'), scenarios = new Set();
    for (const file of specFiles) {
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
      if ((task.nodeType ?? 'task') === 'task') {
        const body = (task.body ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '');
        const scope = body.match(/^## Scope and dependencies\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
        if (!scope?.[1]?.trim() || /\b(TBD|TODO)\b/.test(scope[1])) errors.push(`${task.id}: planning contract missing or unfinished Scope and dependencies`);
        for (const detail of task.dependencyDetails ?? []) if (!body.includes(detail.requiredOutput)) errors.push(`${task.id}: planning contract omits required dependency output for ${detail.id}`);
      }
      if (indexed.get(task.id)) {
        const receipt = receipts?.[task.id];
        if (!receipt || receipt.status !== 'integrated') errors.push(`Completed task ${task.id} requires integrated receipt`);
        else errors.push(...validateDelivery(task, receipt).map(error => `${task.id}: ${error}`));
      }
      for (const dependency of [...(Array.isArray(task.dependsOn) ? task.dependsOn : []), ...childrenOf(tasks, task.id).map(child => child.id)]) {
        if (indexed.get(task.id) && !indexed.get(dependency)) errors.push(`Completed task ${task.id} has incomplete dependency ${dependency}`);
      }
      for (const scenario of Array.isArray(task.scenarios) ? task.scenarios : []) {
        if (specFiles.length && !scenarios.has(scenario)) errors.push(`Unknown scenario: ${scenario}`);
        covered.add(scenario);
      }
    }
    for (const scenario of scenarios) if (!covered.has(scenario)) errors.push(`Unmapped scenario: ${scenario}`);
    if (fs.existsSync(path.join(root, 'planning-manifest.json'))) errors.push(...validatePlanningDelivery(root));
  } catch (error) { errors.push(error.message); }
  return errors;
}

const protectedDomains = new Set(['authentication','authorization','credentials','security','financial','destructive','sensitive-data']);
export function validatePlanningDelivery(root) {
  const errors = [];
  try {
    const manifest = JSON.parse(read(root, 'planning-manifest.json'));
    const evaluation = evaluatePlanningLifecycle(manifest);
    errors.push(...evaluation.errors.map(error => `planning manifest: ${error}`));
    const gate = { ready:'canReady', delivered:'canDeliver', partial:'canPartial' }[manifest.state];
    if (!gate || evaluation[gate] !== true) errors.push(`planning manifest: declared ${manifest.state} does not satisfy its lifecycle gate`);
    const domains = manifest.reviewPolicy?.domains;
    if (!strings(domains) || !domains.length) errors.push('planning manifest: reviewPolicy.domains must be a nonempty string array');
    else if (domains.some(domain => protectedDomains.has(domain)) &&
      (manifest.reviewPolicy.risk === 'ordinary-low' || manifest.reviewPolicy.independentRequired !== true)) {
      errors.push('planning manifest: protected domains require non-ordinary risk and independent review');
    }
    const loaded = loadTasks(root), indexValidation = validateTaskIndex(root, loaded);
    errors.push(...indexValidation.errors.map(error=>`planning manifest: ${error}`));
    const fields = ['id','title','owner','nodeType','parentId','requirements','dependsOn','dependencyDetails','decisionInputs','resolvesDecisions','decisionBundleReason','write','resources','scenarios','verification'];
    const project = task => Object.fromEntries(fields.map(field => [field, task[field] ?? null]));
    if (!Array.isArray(manifest.tasks) || JSON.stringify(loaded.map(project)) !== JSON.stringify(manifest.tasks.map(project))) {
      errors.push('planning manifest: task inventory differs from persisted contracts');
    } else {
      const expected = projectTaskManager(manifest.tasks, { blockers: manifest.blockers });
      if (JSON.stringify(manifest.taskManager) !== JSON.stringify(expected)) errors.push('planning manifest: taskManager projection is absent or stale');
      if (!indexValidation.declaredWaves.length) errors.push('planning manifest: tasks.md must declare the projected waves');
      else if (JSON.stringify(indexValidation.declaredWaves) !== JSON.stringify(expected.plannedWaves)) errors.push('planning manifest: tasks.md waves differ from taskManager projection');
      errors.push(...validateDecisionRouting(manifest.tasks, manifest.decisions, manifest.blockers).map(error => `planning manifest: ${error}`));
    }
    for (const reference of manifest.references ?? []) {
      if (!reference || typeof reference.path !== 'string' || !safePath(reference.path) || !/^[a-f0-9]{64}$/.test(reference.sha256 ?? '')) continue;
      const bytes = fs.readFileSync(localPath(root, reference.path));
      if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) errors.push(`planning manifest: reference hash mismatch ${reference.path}`);
    }
  } catch (error) { errors.push(`planning manifest: ${error.message}`); }
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
