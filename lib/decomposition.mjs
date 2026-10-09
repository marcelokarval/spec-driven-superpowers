// One planning graph: packages aggregate outcomes, leaves alone are dispatched.
export const isPackage = task => task.nodeType === 'package';
export const childrenOf = (tasks, id) => tasks.filter(task => task.parentId === id);
export const prerequisites = (tasks, task) => [...task.dependsOn, ...childrenOf(tasks, task.id).map(child => child.id)];
const text = value => typeof value === 'string' && value.trim().length > 0;
export function ancestorsOf(tasks, id) {
  const result = [], seen = new Set([id]);
  let current = tasks.find(task => task.id === id);
  while (current?.parentId !== undefined && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = tasks.find(task => task.id === current.parentId);
    if (current) result.push(current);
  }
  return result;
}
export function validateDecomposition(tasks, { legacyExecution = false } = {}) {
  const errors = [];
  for (const task of tasks) {
    if (task.nodeType !== undefined && !['package', 'task'].includes(task.nodeType)) errors.push(`${task.id}: invalid nodeType`);
    const children = childrenOf(tasks, task.id);
    if (task.parentId !== undefined) {
      const parent = tasks.find(item => item.id === task.parentId);
      if (!parent) errors.push(`${task.id}: orphan composition parent ${task.parentId}`);
      else if (!isPackage(parent)) errors.push(`${task.id}: leaf-with-children parent ${parent.id}`);
      else {
        if (task.nodeType === undefined) errors.push(`${task.id}: child must have explicit nodeType`);
        for (const key of ['write', 'resources', 'scenarios', 'requirements']) if ((task[key] ?? []).some(item => !(parent[key] ?? []).includes(item))) errors.push(`${task.id}: ${key} escapes parent contract`);
        if (legacyExecution && parent.dependsOn.some(id => !task.dependsOn.includes(id))) errors.push(`${task.id}: parent prerequisites must be inherited`);
      }
      const seen = new Set([task.id]);
      let current = task;
      while (current?.parentId !== undefined) {
        if (seen.has(current.parentId)) { errors.push(`${task.id}: composition cycle at ${current.parentId}`); break; }
        seen.add(current.parentId); current = tasks.find(item => item.id === current.parentId);
      }
    }
    if (isPackage(task)) {
      if (!children.length) errors.push(`${task.id}: package requires children`);
      for (const key of ['scenarios', 'requirements', 'write', 'resources']) if ((task[key] ?? []).some(value => !children.some(child => (child[key] ?? []).includes(value)))) errors.push(`${task.id}: package ${key === 'scenarios' ? 'scenario' : key} coverage missing`);
    } else if (children.length) errors.push(`${task.id}: leaf-with-children`);
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
  const errors=validateDecomposition(after);
  const old=before.find(task=>task.id===id), next=after.find(task=>task.id===id);
  const added=after.filter(task=>!before.some(prior=>prior.id===task.id));
  if (!old || isPackage(old) || !next || !added.length) return ['refine requires an existing leaf and new replacement tasks'];
  const recursive = isPackage(next);
  const replacements=recursive ? added : [next,...added];
  if (next.parentId !== old.parentId) errors.push('refinement must preserve original parent identity');
  if (recursive) {
    const retained = task => JSON.stringify(Object.fromEntries(Object.entries(task).filter(([key]) => !['nodeType','boundary','contractRevision','readinessErrors','tier'].includes(key)).sort(([a],[b])=>a.localeCompare(b))));
    if(retained(old)!==retained(next)) errors.push('recursive refinement must preserve original outcome and scope');
  }
  for (const task of replacements) {
    if (recursive ? !ancestorsOf(after, task.id).some(parent => parent.id === id) : task.nodeType !== 'task' || task.parentId !== old.parentId) errors.push('refined leaves must retain the same package or recursive subtree');
    for (const key of ['write','resources','scenarios','requirements']) if((task[key] ?? []).some(value=>!(old[key] ?? []).includes(value))) errors.push(`refinement expands ${key}`);
    if(!recursive && old.dependsOn.some(dep=>!task.dependsOn.includes(dep))) errors.push('refinement drops prerequisites');
  }
  for (const key of ['write','resources','scenarios','requirements']) if((old[key] ?? []).some(value=>!replacements.some(task=>(task[key] ?? []).includes(value)))) errors.push(`refinement drops ${key} coverage`);
  const originalCriteria=old.approvalCriteria ?? [];
  const refinedCriteria=(recursive ? [next, ...replacements] : replacements).flatMap(task=>task.approvalCriteria ?? []);
  if(originalCriteria.some(item=>!refinedCriteria.some(other=>JSON.stringify(item)===JSON.stringify(other))) || refinedCriteria.some(item=>!originalCriteria.some(other=>JSON.stringify(item)===JSON.stringify(other)))) errors.push('refinement must preserve explicit approval criteria');
  if(old.scenarios.some(s=>!replacements.some(t=>t.scenarios.includes(s)))) errors.push('refinement drops scenario coverage');
  // Metadata remains optional for legacy refinement, but any declared inventory
  // must justify exactly its declared dependencies (including new replacements).
  for(const task of after) {
    const details=task.dependencyDetails;
    if(details !== undefined && (!Array.isArray(details) || details.length !== task.dependsOn.length ||
      details.some(detail=>!detail || typeof detail !== 'object' || Array.isArray(detail) ||
        typeof detail.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(detail.id) ||
        !task.dependsOn.includes(detail.id) || !text(detail.reason) || !text(detail.requiredOutput)) ||
      new Set(details.map(detail=>detail.id)).size !== details.length))
      errors.push(`${task.id}: refinement dependencyDetails must exactly justify each dependsOn id with reason and requiredOutput`);
  }
  const comparable=task=>JSON.stringify(Object.fromEntries(Object.entries(task).filter(([key])=>!['contractRevision','readinessErrors','dependsOn'].includes(key)).sort(([a],[b])=>a.localeCompare(b))));
  for(const prior of before) {
    if(prior.id===id)continue;
    const current=after.find(t=>t.id===prior.id);
    const redirected=!recursive && prior.dependsOn.includes(id);
    // Compare the entire old contract, projecting away only explanations for the
    // newly authorized edges. Old declarations and their metadata stay exact;
    // unrelated and recursive contracts receive no metadata exception.
    const preserved=current && redirected && Array.isArray(prior.dependencyDetails) && Array.isArray(current.dependencyDetails)
      ? {...current,dependencyDetails:current.dependencyDetails.filter(detail=>!added.some(task=>task.id===detail?.id))}
      : current;
    if(!current || comparable(prior)!==comparable(preserved)) {errors.push('refinement rewrites an existing contract');continue;}
    const expected=[...prior.dependsOn,...(redirected?added.map(t=>t.id):[])];
    if(JSON.stringify([...new Set(expected)].sort())!==JSON.stringify([...current.dependsOn].sort())) errors.push('refinement must redirect dependent work to every replacement');
  }
  return errors;
}
