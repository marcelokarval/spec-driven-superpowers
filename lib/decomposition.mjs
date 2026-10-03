// One planning graph: packages aggregate outcomes, leaves alone are dispatched.
export const isPackage = task => task.nodeType === 'package';
export const childrenOf = (tasks, id) => tasks.filter(task => task.parentId === id);
export const prerequisites = (tasks, task) => [...task.dependsOn, ...childrenOf(tasks, task.id).map(child => child.id)];
const text = value => typeof value === 'string' && value.trim().length > 0;
export function validateDecomposition(tasks) {
  const errors = [];
  for (const task of tasks) {
    if (task.nodeType !== undefined && !['package', 'task'].includes(task.nodeType)) errors.push(`${task.id}: invalid nodeType`);
    if (task.parentId !== undefined) {
      const parent = tasks.find(item => item.id === task.parentId);
      if (!parent || !isPackage(parent) || isPackage(task) || parent.parentId !== undefined) errors.push(`${task.id}: require one-level package parent`);
      else {
        if (task.nodeType !== 'task') errors.push(`${task.id}: child must be an explicit task`);
        for (const key of ['write', 'resources', 'scenarios']) if (task[key].some(item => !parent[key].includes(item))) errors.push(`${task.id}: ${key} escapes parent contract`);
        if (parent.dependsOn.some(id => !task.dependsOn.includes(id))) errors.push(`${task.id}: parent prerequisites must be inherited`);
      }
    }
    if (isPackage(task)) {
      const children = childrenOf(tasks, task.id);
      if (!children.length) errors.push(`${task.id}: package requires children`);
      if (task.scenarios.some(scenario => !children.some(child => child.scenarios.includes(scenario)))) errors.push(`${task.id}: package scenario coverage missing`);
    }
  }
  return errors;
}
export function boundaryErrors(task) {
  if (task.nodeType !== 'task') return [];
  const b = task.boundary;
  return b && text(b.change) && text(b.target) && Array.isArray(b.exclusions) && b.exclusions.length && b.exclusions.every(text) &&
    b.review?.verdict === 'ready' && text(b.review.source) ? [] : [`${task.id}: reviewed bounded change, target and exclusions required`];
}

// Structural refinement conserves scenario and scope sets; semantic equivalence
// is still a coordinator assessment, never inferred from text similarity.
export function validateRefinement(before, after, id) {
  const errors=[];
  const old=before.find(task=>task.id===id), next=after.find(task=>task.id===id);
  const added=after.filter(task=>!before.some(prior=>prior.id===task.id));
  if (!old?.parentId || isPackage(old) || !next || !added.length) return ['refine requires an existing child and new sibling tasks'];
  const replacements=[next,...added];
  for (const task of replacements) {
    if (task.nodeType !== 'task' || task.parentId !== old.parentId) errors.push('refined leaves must retain the same package');
    for (const key of ['write','resources','scenarios']) if(task[key].some(value=>!old[key].includes(value))) errors.push(`refinement expands ${key}`);
    if(old.dependsOn.some(dep=>!task.dependsOn.includes(dep))) errors.push('refinement drops prerequisites');
  }
  const originalCriteria=old.approvalCriteria ?? [];
  const refinedCriteria=replacements.flatMap(task=>task.approvalCriteria ?? []);
  if(originalCriteria.some(item=>!refinedCriteria.some(other=>JSON.stringify(item)===JSON.stringify(other))) || refinedCriteria.some(item=>!originalCriteria.some(other=>JSON.stringify(item)===JSON.stringify(other)))) errors.push('refinement must preserve explicit approval criteria');
  if(old.scenarios.some(s=>!replacements.some(t=>t.scenarios.includes(s)))) errors.push('refinement drops scenario coverage');
  const comparable=task=>JSON.stringify(Object.fromEntries(Object.entries(task).filter(([key])=>!['contractRevision','readinessErrors','dependsOn'].includes(key)).sort(([a],[b])=>a.localeCompare(b))));
  for(const prior of before) {
    if(prior.id===id)continue;
    const current=after.find(t=>t.id===prior.id);
    if(!current || comparable(prior)!==comparable(current)) {errors.push('refinement rewrites an existing contract');continue;}
    const expected=[...prior.dependsOn,...(prior.dependsOn.includes(id)?added.map(t=>t.id):[])];
    if(JSON.stringify([...new Set(expected)].sort())!==JSON.stringify([...current.dependsOn].sort())) errors.push('refinement must redirect dependent work to every replacement');
  }
  return errors;
}
