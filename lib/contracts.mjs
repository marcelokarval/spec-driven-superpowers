const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Contract paths are exact, portable, repository-relative file names, never globs.
export function safePath(value) {
  return typeof value === 'string' && value.length > 0 &&
    !/[\\:*?"<>|[\]\x00-\x1f]/.test(value) &&
    !value.split('/').some(part => !part || part === '.' || part === '..' ||
      /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part));
}

export function validateTasks(tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return ['tasks must be a nonempty array'];
  const errors = [];
  const ids = new Map();
  for (const task of tasks) {
    if (!object(task)) { errors.push('task must be an object'); continue; }
    if (typeof task.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(task.id)) errors.push('invalid task id');
    if (ids.has(task.id)) errors.push(`duplicate task ${task.id}`);
    ids.set(task.id, task);
    for (const field of ['dependsOn', 'write', 'resources', 'scenarios', 'verification']) {
      if (!strings(task[field])) errors.push(`${task.id}: ${field} must be a string array`);
      else if (new Set(task[field]).size !== task[field].length) errors.push(`${task.id}: duplicate ${field}`);
    }
    for (const field of ['scenarios', 'verification']) {
      if (!task[field]?.length) errors.push(`${task.id}: ${field} cannot be empty`);
    }
    for (const file of Array.isArray(task.write) ? task.write : []) {
      if (!safePath(file)) errors.push(`${task.id}: unsafe write path ${file}`);
    }
  }
  if (errors.length) return errors;
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push(`dependency cycle at ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of ids.get(id).dependsOn) {
      if (!ids.has(dependency)) errors.push(`${id}: missing dependency ${dependency}`);
      else visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids.keys()) visit(id);
  return errors;
}

export function chooseExecution(tasks, capabilities = {}) {
  const sequential = reason => ({ mode: 'sequential', reason });
  const errors = validateTasks(tasks);
  if (errors.length) return { mode: 'blocked', reason: errors.join('; ') };
  const readiness = tasks.flatMap(validateReadiness);
  if (readiness.length) return { mode: 'blocked', reason: readiness.join('; ') };
  if (tasks.length < 2) return sequential('Only one task');
  if (capabilities?.spawn !== true || capabilities?.isolatedWrites !== true ||
      !Number.isInteger(capabilities?.maxParallel) || capabilities.maxParallel < tasks.length) {
    return sequential('Session capabilities or concurrency budget are insufficient');
  }
  if (tasks.some(task => task.dependsOn.length)) return sequential('Resolve dependencies before forming a ready wave');
  const writes = [], resources = new Set();
  for (const task of tasks) {
    for (const file of task.write) {
      const normalized = file.normalize('NFC').toLowerCase();
      if (writes.some(other => other === normalized || other.startsWith(`${normalized}/`) || normalized.startsWith(`${other}/`))) {
        return sequential(`Overlapping write scope: ${file}`);
      }
      writes.push(normalized);
    }
    for (const resource of task.resources) {
      if (resources.has(resource)) return sequential(`Shared resource: ${resource}`);
      resources.add(resource);
    }
  }
  return { mode: 'parallel', reason: 'Independent scopes and declared live capabilities' };
}

export function validateDelivery(task, delivery) {
  const errors = validateTasks([{ ...task, dependsOn: [] }]);
  if (errors.length) return errors;
  if (!object(delivery)) return ['delivery must be an object'];
  if (task.contractRevision && delivery.contractRevision !== task.contractRevision) errors.push('stale or absent contract revision');
  if (!['delivered', 'reviewed', 'integrated'].includes(delivery.status)) errors.push('invalid delivery status');
  for (const field of ['baseRevision', 'revision']) {
    if (typeof delivery[field] !== 'string' || !delivery[field].trim()) errors.push(`missing ${field}`);
  }
  if (!strings(delivery.changedFiles)) errors.push('changedFiles must be a string array');
  else for (const file of delivery.changedFiles) {
    if (!safePath(file) || !task.write.includes(file)) errors.push(`scope escape: ${file}`);
  }
  if (!Array.isArray(delivery.evidence)) errors.push('missing verification evidence');
  else {
    for (const command of task.verification) {
      if (!delivery.evidence.some(item => item?.command === command && item.exitCode === 0 && item.revision === delivery.revision)) {
        errors.push(`missing passing evidence: ${command}`);
      }
    }
    if (delivery.evidence.some(item => !object(item) || item.exitCode !== 0 || item.revision !== delivery.revision)) errors.push('failing or stale evidence');
  }
  if (['reviewed', 'integrated'].includes(delivery.status)) {
    if (delivery.reviews?.spec !== delivery.revision || delivery.reviews?.quality !== delivery.revision) errors.push('stale or absent reviews');
    if (delivery.reviews?.independent !== true) errors.push('independent review required');
  }
  if (delivery.status === 'integrated' && (typeof delivery.integrationRevision !== 'string' || !delivery.integrationRevision.trim())) errors.push('missing integration revision');
  if (delivery.status === 'integrated') {
    if (!Array.isArray(delivery.integrationEvidence) || task.verification.some(command =>
      !delivery.integrationEvidence.some(item => item?.command === command && item.exitCode === 0 && item.revision === delivery.integrationRevision))) {
      errors.push('missing passing integration evidence');
    } else if (delivery.integrationEvidence.some(item => !object(item) || item.exitCode !== 0 || item.revision !== delivery.integrationRevision)) {
      errors.push('failing or stale integration evidence');
    }
    if (delivery.integrationReviews?.spec !== delivery.integrationRevision || delivery.integrationReviews?.quality !== delivery.integrationRevision ||
        delivery.integrationReviews?.independent !== true) errors.push('stale or absent independent integration reviews');
  }
  return errors;
}

// Semantic adequacy still needs review; these are minimum executable-contract gates.
export function validateReadiness(task) {
  const errors = [];
  if (!['implementation', 'investigation', 'documentation', 'operation'].includes(task.kind ?? 'implementation')) errors.push(`${task.id}: readiness invalid kind`);
  if (!Array.isArray(task.openDecisions) || task.openDecisions.length) errors.push(`${task.id}: readiness unresolved or undeclared material decisions`);
  const body = (task.body ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '');
  for (const heading of ['Outcome', 'Inputs', 'Acceptance', 'Verification', 'Definition of done']) {
    const section = body.match(new RegExp(`^## ${heading}\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
    if (!section?.[1]?.trim() || /\b(TBD|TODO)\b/.test(section[1])) errors.push(`${task.id}: readiness missing or unfinished ${heading}`);
  }
  return errors;
}

export function affectedTasks(tasks, changedIds) {
  const errors = validateTasks(tasks);
  if (errors.length) throw new Error(errors.join('; '));
  if (!strings(changedIds) || changedIds.some(id => !tasks.some(task => task.id === id))) throw new Error('Unknown changed task');
  const affected = new Set(changedIds);
  let size;
  do {
    size = affected.size;
    for (const task of tasks) if (task.dependsOn.some(id => affected.has(id))) affected.add(task.id);
  } while (size !== affected.size);
  return [...affected].sort();
}
