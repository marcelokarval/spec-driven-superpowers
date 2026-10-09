import { ancestorsOf, childrenOf, isPackage, prerequisites, validateDecomposition } from './decomposition.mjs';
import { safePath } from './planning-paths.mjs';
const sorted = values => [...values].sort();
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
// Composition, effective planning precedence and legacy completion are distinct views.
export function structuralGraph(tasks, { legacyExecution = false, includeDependencyDetails = false } = {}) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const errors = validateDecomposition(tasks, { legacyExecution });
  for (const task of tasks) for (const id of task.dependsOn) if (!byId.has(id)) errors.push(`${task.id}: missing dependency ${id}`);
  const terminal = (id, seen = new Set()) => {
    if (seen.has(id) || !byId.has(id)) return [];
    const next = new Set([...seen, id]), task = byId.get(id);
    return isPackage(task) ? childrenOf(tasks, id).flatMap(child => terminal(child.id, next)) : [id];
  };
  const dependencies = Object.fromEntries(tasks.map(task => [task.id, legacyExecution ? prerequisites(tasks, task) : sorted(new Set(
    [task, ...ancestorsOf(tasks, task.id)].flatMap(item => item.dependsOn).flatMap(id => terminal(id))))]));
  const leaves = tasks.filter(task => !isPackage(task)).map(task => task.id);
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push(`${legacyExecution ? 'dependency' : 'effective dependency'} cycle at ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies[id] ?? []) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const id of legacyExecution ? byId.keys() : leaves) visit(id);
  // Expanded edges retain each original declaration, even when two declarations
  // yield the same terminal edge. Legacy structural callers need no metadata.
  const dependencyRelations = includeDependencyDetails ? sorted(leaves).flatMap(to =>
    [byId.get(to), ...ancestorsOf(tasks, to)].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      .flatMap(task => [...(task.dependencyDetails ?? [])].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        .flatMap(detail => sorted(terminal(detail.id)).map(from => ({from, to, declaredBy:task.id,
          dependencyId:detail.id, reason:detail.reason, requiredOutput:detail.requiredOutput}))))
  ) : undefined;
  return { ...(includeDependencyDetails ? {dependencyRelations} : {}), composition: tasks.filter(task => task.parentId !== undefined).map(task => ({ parent: task.parentId, child: task.id })), dependencies, leaves: sorted(leaves), errors: [...new Set(errors)] };
}
export function compilePlanningPlan(tasks) {
  if (!Array.isArray(tasks) || !tasks.length || tasks.some(task=>!task || typeof task!=='object' || Array.isArray(task))) throw new Error('Invalid planning tasks');
  // Planning aggregates may declare scope in prose; absent inventories are derived
  // from descendants. Explicit empty arrays remain constraints, never widened.
  const declared = tasks;
  tasks = tasks.map(task => task && ({ ...task, ...(task.parentId === null ? {parentId:undefined} : {}), write: task.write ?? (isPackage(task) ? [] : undefined), resources: task.resources ?? [], scenarios: task.scenarios ?? [] }));
  for (let pass=0;pass<tasks.length;pass++) for(const task of tasks.filter(isPackage)) {
    const original=declared.find(item=>item.id===task.id);
    for(const key of ['write','resources','scenarios','requirements']) if(original[key] === undefined) task[key]=sorted(new Set(childrenOf(tasks,task.id).flatMap(child=>Array.isArray(child[key])?child[key]:[])));
  }
  if (tasks.some(task => !validId(task.id) || (task.parentId !== undefined && !validId(task.parentId)) ||
    (task.requirements !== undefined && !strings(task.requirements)) ||
    !['dependsOn','write','resources','scenarios'].every(key => strings(task[key])) ||
    !task.dependsOn.every(validId))) throw new Error('Invalid planning tasks');
  for (const task of tasks) {
    for (const key of ['dependsOn','write','resources','scenarios','requirements'])
      if (task[key] && new Set(task[key]).size !== task[key].length) throw new Error(`${task.id}: duplicate ${key}`);
    for (const file of task.write) if (!safePath(file)) throw new Error(`${task.id}: unsafe write path ${file}`);
    const details = task.dependencyDetails ?? (task.dependencyDetails === undefined && !task.dependsOn.length ? [] : undefined);
    if (!Array.isArray(details) || details.length !== task.dependsOn.length ||
      details.some(detail => !detail || typeof detail !== 'object' || Array.isArray(detail) ||
        !validId(detail.id) || !task.dependsOn.includes(detail.id) ||
        typeof detail.reason !== 'string' || !detail.reason.trim() ||
        typeof detail.requiredOutput !== 'string' || !detail.requiredOutput.trim()) ||
      new Set(details.map(detail => detail.id)).size !== details.length)
      throw new Error(`${task.id}: dependencyDetails must exactly justify each dependsOn id with reason and requiredOutput`);
  }
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) throw new Error('duplicate task id');
  const ordered = [...tasks].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const graph = structuralGraph(ordered, {includeDependencyDetails:true});
  if (graph.errors.length) throw new Error(graph.errors.join('; '));
  return { version: 'asds.planning-graph/1', tasks: ordered, ...graph, parallelism: recommendParallelism(ordered, graph) };
}
const norm = value => value.normalize('NFC').toLowerCase();
function overlap(a, b) { return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); }
export function recommendParallelism(tasks, graph = structuralGraph(tasks)) {
  if (graph.errors.length) throw new Error(graph.errors.join('; '));
  const remaining = new Set(graph.leaves), done = new Set(), waves = [], conflicts = [];
  const byId = new Map(tasks.map(task => [task.id, task]));
  for (let i=0;i<graph.leaves.length;i++) for (let j=i+1;j<graph.leaves.length;j++) {
    const left=byId.get(graph.leaves[i]), right=byId.get(graph.leaves[j]);
    if (left.write.some(a=>right.write.some(b=>overlap(norm(a),norm(b))))) conflicts.push({tasks:[left.id,right.id],reason:'Overlapping write scope; sequential recommendation, not fusion'});
    else if(left.resources.some(a=>right.resources.some(b=>norm(a)===norm(b)))) conflicts.push({tasks:[left.id,right.id],reason:'Shared resource; sequential recommendation, not fusion'});
  }
  while (remaining.size) {
    const wave=[];
    for(const id of sorted(remaining)) if(graph.dependencies[id].every(dep=>done.has(dep)) && !wave.some(other=>conflicts.some(c=>c.tasks.includes(id)&&c.tasks.includes(other)))) wave.push(id);
    if(!wave.length) throw new Error('effective dependency cycle prevents recommendation');
    waves.push(wave); for(const id of wave){remaining.delete(id);done.add(id);}
  }
  return { recommendationOnly:true, waves, conflicts };
}

// Pure projection for Plane/Linear/simple queues. Planning delivery does not
// execute these tasks; it exports enough causal state for a later consumer.
export function projectTaskManager(tasks, { completedTaskIds = [], blockers = [] } = {}) {
  const plan = compilePlanningPlan(tasks), leaves = new Set(plan.leaves);
  if (!strings(completedTaskIds) || completedTaskIds.some(id => !leaves.has(id))) throw new Error('invalid completedTaskIds');
  if (!Array.isArray(blockers)) throw new Error('invalid blockers');
  const completed = new Set(completedTaskIds), byId = new Map(plan.tasks.map(task => [task.id, task]));
  for (const id of completed) if (plan.dependencies[id].some(dependency => !completed.has(dependency))) {
    throw new Error(`${id}: completed task has incomplete dependency`);
  }
  const blockerMap = new Map(plan.leaves.map(id => [id, new Set()]));
  const expand = affected => {
    const roots = new Set(affected), selected = new Set();
    let changed = true;
    while (changed) { changed = false; for (const task of plan.tasks) if (roots.has(task.parentId) && !roots.has(task.id)) { roots.add(task.id); changed = true; } }
    for (const id of plan.leaves) if (roots.has(id)) selected.add(id);
    return selected;
  };
  for (const blocker of blockers) {
    if (!blocker || typeof blocker !== 'object' || !validId(blocker.id) || !strings(blocker.affectedTasks) ||
        !blocker.affectedTasks.length || blocker.affectedTasks.some(id => !byId.has(id))) throw new Error('invalid task-manager blocker');
    for (const id of expand(blocker.affectedTasks)) blockerMap.get(id).add(blocker.id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of plan.leaves) for (const dependency of plan.dependencies[id]) {
      for (const blocker of blockerMap.get(dependency)) if (!blockerMap.get(id).has(blocker)) { blockerMap.get(id).add(blocker); changed = true; }
    }
  }
  const reverse = new Map(plan.leaves.map(id => [id, []]));
  for (const id of plan.leaves) for (const dependency of plan.dependencies[id]) reverse.get(dependency).push(id);
  const waveById = new Map(plan.parallelism.waves.flatMap((wave, index) => wave.map(id => [id, index + 1])));
  const projected = plan.leaves.map(id => {
    const waitingOn = plan.dependencies[id].filter(dependency => !completed.has(dependency));
    const blockedBy = sorted(blockerMap.get(id));
    const status = completed.has(id) ? 'completed' : blockedBy.length ? 'blocked' : waitingOn.length ? 'waiting' : 'ready';
    const task = byId.get(id), title = typeof task.title === 'string' && task.title.trim() ? task.title.trim() : id;
    const serializesWith = sorted(plan.parallelism.conflicts.filter(conflict => conflict.tasks.includes(id))
      .flatMap(conflict => conflict.tasks.filter(other => other !== id)));
    return { id, title, owner:task.owner ?? null, status, wave: waveById.get(id), waitingOn, blockedBy,
      blocks: sorted(reverse.get(id)), parallelWith: sorted(plan.parallelism.waves[waveById.get(id)-1].filter(other => other !== id)),
      serializesWith,
      decisionInputs:[...(task.decisionInputs ?? [])], resolvesDecisions:[...(task.resolvesDecisions ?? [])],
      write: [...task.write], resources: [...task.resources], scenarios: [...task.scenarios], verification: [...task.verification] };
  });
  return { version:'asds.task-manager-projection/1', tasks:projected,
    readyTaskIds:projected.filter(task=>task.status==='ready').map(task=>task.id),
    waitingTaskIds:projected.filter(task=>task.status==='waiting').map(task=>task.id),
    blockedTaskIds:projected.filter(task=>task.status==='blocked').map(task=>task.id),
    completedTaskIds:projected.filter(task=>task.status==='completed').map(task=>task.id),
    plannedWaves:plan.parallelism.waves, conflicts:plan.parallelism.conflicts };
}

export function validateDecisionRouting(tasks, decisions, blockers) {
  if (!Array.isArray(decisions) || !Array.isArray(blockers)) return ['decision routing requires decisions and blockers arrays'];
  const errors = [], plan = compilePlanningPlan(tasks);
  if (decisions.some(decision => !decision || typeof decision !== 'object' || Array.isArray(decision) || !validId(decision.id))) {
    return ['decision routing requires valid decision objects'];
  }
  const known = new Map();
  for (const decision of decisions) {
    if (known.has(decision.id)) errors.push(`${decision.id}: duplicate decision id`);
    else known.set(decision.id, decision);
  }
  const blockerIds = new Set();
  for (const blocker of blockers) {
    if (!blocker || typeof blocker !== 'object' || Array.isArray(blocker) || !validId(blocker.id) ||
        !strings(blocker.affectedTasks) || !blocker.affectedTasks.length || blocker.affectedTasks.some(id => !plan.tasks.some(task => task.id === id))) {
      errors.push('invalid decision blocker'); continue;
    }
    if (blockerIds.has(blocker.id)) errors.push(`${blocker.id}: duplicate blocker id`);
    blockerIds.add(blocker.id);
    if (blocker.decisionId !== undefined && (!validId(blocker.decisionId) || !known.has(blocker.decisionId))) {
      errors.push(`${blocker.id}: unknown decision ${blocker.decisionId}`);
    }
  }
  const resolvers = new Map();
  for (const task of plan.tasks.filter(task => task.nodeType !== 'package')) {
    if (typeof task.owner !== 'string' || !task.owner.trim()) errors.push(`${task.id}: decision routing requires owner`);
    for (const field of ['decisionInputs','resolvesDecisions']) if (!strings(task[field] ?? [])) errors.push(`${task.id}: ${field} must be a string array`);
    for (const id of [...(task.decisionInputs ?? []),...(task.resolvesDecisions ?? [])]) if (!known.has(id)) errors.push(`${task.id}: unknown decision ${id}`);
    for (const id of task.resolvesDecisions ?? []) {
      if (resolvers.has(id)) errors.push(`${id}: multiple resolver tasks`); else resolvers.set(id,task.id);
    }
    if ((task.resolvesDecisions?.length ?? 0)>1 && (typeof task.decisionBundleReason !== 'string' || !task.decisionBundleReason.trim())) errors.push(`${task.id}: multiple decisions require decisionBundleReason`);
  }
  const transitive = id => {
    const result = new Set(), visit = current => { for (const dependency of plan.dependencies[current] ?? []) if (!result.has(dependency)) { result.add(dependency); visit(dependency); } };
    visit(id); return result;
  };
  const expanded = affected => {
    const roots = new Set(affected), result = new Set();
    let changed = true;
    while (changed) { changed=false; for (const task of plan.tasks) if (roots.has(task.parentId) && !roots.has(task.id)) { roots.add(task.id); changed=true; } }
    for (const id of plan.leaves) if (roots.has(id)) result.add(id);
    return result;
  };
  for (const decision of decisions) if (decision.material === true && decision.status !== 'resolved') {
    const resolver = resolvers.get(decision.id), matches = blockers.filter(item => item?.decisionId === decision.id), blocker = matches[0];
    if (!resolver) errors.push(`${decision.id}: unresolved material decision requires one resolver task`);
    if (matches.length !== 1) errors.push(`${decision.id}: unresolved material decision requires exactly one blocker`);
    const affected = blocker && strings(blocker.affectedTasks) ? expanded(blocker.affectedTasks) : new Set();
    if (resolver && affected.has(resolver)) errors.push(`${decision.id}: blocker cannot block its resolver task`);
    const consumers = plan.tasks.filter(task => task.decisionInputs?.includes(decision.id));
    if (!consumers.length) errors.push(`${decision.id}: unresolved material decision has no consuming task`);
    for (const consumer of consumers) {
      if (resolver && !transitive(consumer.id).has(resolver)) errors.push(`${consumer.id}: decision ${decision.id} resolver ${resolver} is not a prerequisite`);
      if (blocker && !affected.has(consumer.id)) errors.push(`${consumer.id}: decision ${decision.id} blocker does not affect its consumer`);
    }
    const allowed = new Set(consumers.map(task => task.id));
    for (const id of plan.leaves) if (consumers.some(consumer => transitive(id).has(consumer.id))) allowed.add(id);
    for (const id of affected) if (!allowed.has(id) && id !== resolver) errors.push(`${decision.id}: blocker affects unrelated task ${id}`);
  }
  return errors;
}
// Mermaid decimal entities prevent user prose from becoming diagram syntax/HTML.
const mermaidText = value => Array.from(value.replace(/\s/g, ' ')).map(char =>
  /^[\p{L}\p{N} .,:;_/-]$/u.test(char) ? char : `#${char.codePointAt(0)};`).join('');
export function renderPlanningDag(plan) {
  const checked=compilePlanningPlan(plan.tasks), index=new Map(checked.tasks.map((task,i)=>[task.id,`t${i}`]));
  const lines=['flowchart TD'];
  for(const task of checked.tasks) lines.push(`    ${index.get(task.id)}["${task.id} · ${isPackage(task)?'package':'task'}"]`);
  for(const edge of checked.composition) lines.push(`    ${index.get(edge.parent)} -. composition .-> ${index.get(edge.child)}`);
  for(const id of checked.leaves) for(const dep of checked.dependencies[id]) {
    const label=checked.dependencyRelations.filter(edge=>edge.from===dep && edge.to===id)
      .map(edge=>`${edge.declaredBy} requires ${edge.dependencyId}; reason: ${edge.reason}; required output: ${edge.requiredOutput}`).join(' / ');
    lines.push(`    ${index.get(dep)} -->|"${mermaidText(label)}"| ${index.get(id)}`);
  }
  return lines.join('\n');
}
