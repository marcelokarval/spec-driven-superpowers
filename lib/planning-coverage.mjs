// Pure structural traceability. No filesystem, dispatch, runtime or semantic gate.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const identifier = value => text(value) && value === value.trim();

/**
 * Validate an explicit, additive coverage document, NOT a planning manifest or prose.
 * Callers must inventory every source obligation/exception/negative/preservation
 * separately. This function cannot discover omitted obligations in source text.
 * Input (all tables are arrays; identifiers are exact strings, never normalized):
 * - requirements: {id, kind:'obligation'|'exception'|'negative'|'preservation', source, text}[]
 * - decisions: {id, source, owner?, reason, material:boolean,
 *     status:'resolved'|'pending'|'proposed'|'rejected', requirementIds:string[],
 *     rejectsRequirementIds?:string[], alternatives?:{id,
 *       status:'selected'|'rejected', contradictsRequirementIds:string[]}[]}[]
 *   source/owner/reason reuse manifest decision fields. requirementIds/material and
 *   alternatives are explicit additive data. Rejecting a given source requirement,
 *   or selecting an explicitly contrary alternative, is a structural conflict.
 *   Rejecting a contrary alternative preserves the rule and is allowed. No conflict
 *   is inferred from words. Material decisions require owner; all require provenance.
 * - scenarios: {id}[] (additional source/text fields may be retained by callers)
 * - tasks: {id, nodeType:'package'|'task', parentId?:string|null,
 *     requirements:string[]}[]; same identifiers/composition as manifest.tasks.
 * - acceptances: {id, taskId, text}[]; these are explicit LEAF criteria, not aggregate
 *   criteria or execution receipts. Aggregate criteria belong to package contracts;
 *   this API checks aggregate requirement coverage via pertinent descendant leaves.
 * - mappings: {requirementId, decisionIds:string[], scenarioId, taskId, acceptanceId}[]
 *   Each row is one complete requirement→decision/scenario→leaf→acceptance route.
 *   Every declared decision/requirement pair needs a row naming that decision.
 * Every requirement, scenario, leaf and acceptance must participate. Every task's
 * declared requirement must have a pertinent route; packages require a descendant
 * leaf route, never an unrelated branch or the package's own unchecked declaration.
 * Empty decisions is allowed; other tables must be nonempty. Duplicate IDs, refs,
 * routes, malformed records, composition cycles and unknown references fail closed.
 *
 * Returns {structuralStatus:'valid'|'invalid', semanticStatus:'need-review',
 *   executionPerformed:false, errors:string[], map:{requirementId,kind,source,text,
 *   routes:{decisionIds,decisions,scenarioId,taskId,acceptanceId,acceptanceText}[]}[]}.
 * Errors are deterministic ordinary diagnostics (not thrown). A structurally valid
 * map is NOT PASS, ready, delivered, source completeness or semantic certification.
 * T06/T07 review source inventory completeness and actual meaning, including exact
 * zero/nonnegative, negative and preservation rules. No prose regex is used.
 * T05/T08 adapters must supply this document explicitly; absence of optional coverage
 * on a legacy/T01 manifest must be reported as not evaluated, not invalidated here.
 */
export function validatePlanningCoverage(input) {
  const errors = [];
  const result = map => ({ structuralStatus: errors.length ? 'invalid' : 'valid',
    semanticStatus: 'need-review', executionPerformed: false, errors, map });
  if (!record(input)) { errors.push('coverage must be an object'); return result([]); }
  const tables = ['requirements', 'decisions', 'scenarios', 'tasks', 'acceptances', 'mappings'];
  for (const table of tables) {
    if (!Array.isArray(input[table]) || (table !== 'decisions' && input[table].length === 0)) {
      errors.push(`${table} must be a ${table === 'decisions' ? '' : 'nonempty '}array`);
    }
  }
  if (errors.length) return result([]);

  const indexes = {};
  const refs = (value, label, nonempty = false) => {
    if (!Array.isArray(value) || value.some(id => !identifier(id)) || (nonempty && !value.length)) {
      errors.push(`${label} must be a ${nonempty ? 'nonempty ' : ''}identifier array`);
      return;
    }
    if (new Set(value).size !== value.length) errors.push(`${label}: duplicate ${label.split('.').at(-1)}`);
  };
  const fieldText = (item, field, label) => {
    if (!text(item[field])) errors.push(`${label}: ${field} must be nonempty text`);
  };
  for (const table of tables.filter(table => table !== 'mappings')) {
    const index = new Map(); indexes[table] = index;
    for (const [position, item] of input[table].entries()) {
      const label = `${table}[${position}]`;
      if (!record(item)) { errors.push(`${label} must be an object`); continue; }
      const itemLabel = identifier(item.id) ? item.id : label;
      if (!identifier(item.id)) errors.push(`${label}: id must be an exact nonempty identifier`);
      else if (index.has(item.id)) errors.push(`Duplicate ${table} id: ${item.id}`);
      else index.set(item.id, item);
      if (table === 'requirements') {
        if (!['obligation', 'exception', 'negative', 'preservation'].includes(item.kind)) errors.push(`${label}: invalid requirement kind`);
        fieldText(item, 'source', label); fieldText(item, 'text', label);
      } else if (table === 'decisions') {
        fieldText(item, 'source', label); fieldText(item, 'reason', label);
        if (typeof item.material !== 'boolean') errors.push(`${label}: material must be boolean`);
        if (item.material === true && !text(item.owner)) errors.push(`${itemLabel}: material decision requires owner`);
        if (item.owner !== undefined && !text(item.owner)) errors.push(`${label}: owner must be nonempty text`);
        if (!['resolved', 'pending', 'proposed', 'rejected'].includes(item.status)) errors.push(`${label}: invalid decision status`);
        refs(item.requirementIds, `${label}.requirementIds`, true);
        if (item.rejectsRequirementIds !== undefined) refs(item.rejectsRequirementIds, `${label}.rejectsRequirementIds`);
        if (item.alternatives !== undefined) {
          if (!Array.isArray(item.alternatives)) errors.push(`${label}: alternatives must be an array`);
          else {
            const ids = new Set();
            for (const [n, alternative] of item.alternatives.entries()) {
              const altLabel = `${label}.alternatives[${n}]`;
              if (!record(alternative)) { errors.push(`${altLabel} must be an object`); continue; }
              if (!identifier(alternative.id)) errors.push(`${altLabel}: invalid alternative id`);
              else if (ids.has(alternative.id)) errors.push(`${itemLabel}: duplicate alternative ${alternative.id}`);
              else ids.add(alternative.id);
              if (!['selected', 'rejected'].includes(alternative.status)) errors.push(`${altLabel}: invalid alternative status`);
              refs(alternative.contradictsRequirementIds, `${altLabel}.contradictsRequirementIds`);
            }
          }
        }
      } else if (table === 'tasks') {
        if (!['package', 'task'].includes(item.nodeType)) errors.push(`${label}: invalid nodeType`);
        if (item.parentId !== undefined && item.parentId !== null && !identifier(item.parentId)) errors.push(`${label}: invalid parentId`);
        refs(item.requirements, `${label}.requirements`, true);
      } else if (table === 'acceptances') {
        if (!identifier(item.taskId)) errors.push(`${label}: taskId must be an exact nonempty identifier`);
        fieldText(item, 'text', label);
      }
    }
  }
  const routeKeys = new Set();
  for (const [position, mapping] of input.mappings.entries()) {
    const label = `mappings[${position}]`;
    if (!record(mapping)) { errors.push(`${label} must be an object`); continue; }
    for (const field of ['requirementId', 'scenarioId', 'taskId', 'acceptanceId']) {
      if (!identifier(mapping[field])) errors.push(`${label}: ${field} must be an exact nonempty identifier`);
    }
    refs(mapping.decisionIds, `${label}.decisionIds`);
    if (['requirementId', 'scenarioId', 'taskId', 'acceptanceId'].every(field => identifier(mapping[field])) &&
        Array.isArray(mapping.decisionIds) && mapping.decisionIds.every(identifier)) {
      const key = JSON.stringify([mapping.requirementId, [...mapping.decisionIds].sort(), mapping.scenarioId, mapping.taskId, mapping.acceptanceId]);
      if (routeKeys.has(key)) errors.push(`Duplicate mapping: ${label}`);
      routeKeys.add(key);
    }
  }
  if (errors.length) return result([]); // Shape barrier: malformed nested data never reaches traversal.

  const { requirements, decisions, scenarios, tasks, acceptances } = indexes;
  for (const task of tasks.values()) {
    for (const id of task.requirements) if (!requirements.has(id)) errors.push(`${task.id}: unknown requirement ${id}`);
    if (task.parentId != null) {
      if (!tasks.has(task.parentId)) errors.push(`${task.id}: unknown parent ${task.parentId}`);
      else if (tasks.get(task.parentId).nodeType !== 'package') errors.push(`${task.id}: parent ${task.parentId} is not a package`);
    }
  }
  // Iterative parent chains avoid both recursive stack overflow and cycle hangs.
  const complete = new Set();
  for (const start of tasks.keys()) {
    const chain = new Set(); let id = start;
    while (id != null && tasks.has(id) && !complete.has(id)) {
      if (chain.has(id)) { errors.push(`Composition cycle at ${id}`); break; }
      chain.add(id); id = tasks.get(id).parentId;
    }
    for (const member of chain) complete.add(member);
  }
  for (const decision of decisions.values()) {
    for (const id of decision.requirementIds) if (!requirements.has(id)) errors.push(`${decision.id}: unknown requirement ${id}`);
    for (const id of decision.rejectsRequirementIds ?? []) {
      if (!requirements.has(id)) errors.push(`${decision.id}: unknown rejected requirement ${id}`);
      else errors.push(`${decision.id}: cannot reject given requirement ${id}`);
    }
    for (const alternative of decision.alternatives ?? []) {
      for (const id of alternative.contradictsRequirementIds) {
        if (!requirements.has(id)) errors.push(`${decision.id}: alternative ${alternative.id} has unknown requirement ${id}`);
        else if (alternative.status === 'selected') errors.push(`${decision.id}: selected alternative ${alternative.id} contradicts given requirement ${id}`);
      }
    }
  }
  for (const acceptance of acceptances.values()) {
    if (!tasks.has(acceptance.taskId)) errors.push(`${acceptance.id}: unknown task ${acceptance.taskId}`);
    else if (tasks.get(acceptance.taskId).nodeType !== 'task') errors.push(`${acceptance.id}: acceptance must belong to a leaf task`);
  }

  const map = [...requirements.values()].map(item => ({ requirementId: item.id,
    kind: item.kind, source: item.source, text: item.text, routes: [] }));
  const rows = new Map(map.map(row => [row.requirementId, row]));
  const used = { scenarios: new Set(), tasks: new Set(), acceptances: new Set() };
  const coveredTasks = new Map([...tasks.keys()].map(id => [id, new Set()]));
  const coveredDecisions = new Map([...decisions.keys()].map(id => [id, new Set()]));
  for (const mapping of input.mappings) {
    const before = errors.length;
    for (const [table, field, singular] of [
      ['requirements', 'requirementId', 'requirement'], ['scenarios', 'scenarioId', 'scenario'],
      ['tasks', 'taskId', 'task'], ['acceptances', 'acceptanceId', 'acceptance'],
    ]) if (!indexes[table].has(mapping[field])) errors.push(`Unknown ${singular}: ${mapping[field]}`);
    for (const id of mapping.decisionIds) {
      if (!decisions.has(id)) errors.push(`Unknown decision: ${id}`);
      else if (!decisions.get(id).requirementIds.includes(mapping.requirementId)) errors.push(`${id}: mapping for undeclared requirement ${mapping.requirementId}`);
    }
    const task = tasks.get(mapping.taskId), acceptance = acceptances.get(mapping.acceptanceId);
    if (task) {
      if (task.nodeType !== 'task') errors.push(`${task.id}: mapping target must be a leaf task`);
      if (!task.requirements.includes(mapping.requirementId)) errors.push(`${task.id}: mapping for undeclared requirement ${mapping.requirementId}`);
    }
    if (acceptance && acceptance.taskId !== mapping.taskId) errors.push(`acceptance ${acceptance.id} belongs to ${acceptance.taskId}, not ${mapping.taskId}`);
    if (errors.length !== before) continue;
    rows.get(mapping.requirementId).routes.push({ decisionIds: [...mapping.decisionIds],
      decisions: mapping.decisionIds.map(id => ({ ...decisions.get(id) })),
      scenarioId: mapping.scenarioId, taskId: mapping.taskId,
      acceptanceId: mapping.acceptanceId, acceptanceText: acceptance.text });
    used.scenarios.add(mapping.scenarioId); used.tasks.add(mapping.taskId); used.acceptances.add(mapping.acceptanceId);
    coveredTasks.get(mapping.taskId).add(mapping.requirementId);
    for (const id of mapping.decisionIds) coveredDecisions.get(id).add(mapping.requirementId);
  }
  for (const row of map) if (!row.routes.length) errors.push(`Unmapped requirement: ${row.requirementId}`);
  for (const [table, singular] of [['scenarios', 'scenario'], ['acceptances', 'acceptance']]) {
    for (const id of indexes[table].keys()) if (!used[table].has(id)) errors.push(`Orphan ${singular}: ${id}`);
  }
  for (const decision of decisions.values()) {
    for (const id of decision.requirementIds) if (!coveredDecisions.get(decision.id).has(id)) errors.push(`${decision.id}: missing coverage for requirement ${id}`);
  }
  // Propagate only validated leaf routes up their composition ancestors. Never use
  // package declarations as proof or import coverage from siblings/unrelated roots.
  const descendantCoverage = new Map([...tasks.keys()].map(id => [id, new Set()]));
  for (const leaf of tasks.values()) {
    if (leaf.nodeType !== 'task') continue;
    let parent = leaf.parentId; const seen = new Set();
    while (parent != null && tasks.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      for (const id of coveredTasks.get(leaf.id)) descendantCoverage.get(parent).add(id);
      parent = tasks.get(parent).parentId;
    }
  }
  for (const task of tasks.values()) {
    if (task.nodeType === 'task') {
      if (!used.tasks.has(task.id)) errors.push(`Orphan task: ${task.id}`);
      for (const id of task.requirements) if (!coveredTasks.get(task.id).has(id)) errors.push(`${task.id}: missing coverage for requirement ${id}`);
    } else {
      for (const id of task.requirements) if (!descendantCoverage.get(task.id).has(id)) errors.push(`${task.id}: no descendant leaf covers requirement ${id}`);
    }
  }
  return result(map);
}

/** Render the same explicit coverage input as a readable map; never a semantic PASS. */
export function renderPlanningCoverage(input) {
  const result = validatePlanningCoverage(input);
  const quote = value => JSON.stringify(value);
  const lines = [`Structural coverage: ${result.structuralStatus}; semantics: need-review; execution: not performed`];
  for (const row of result.map) {
    lines.push(`${quote(row.requirementId)} [${row.kind}] source=${quote(row.source)}: ${quote(row.text)}`);
    if (!row.routes.length) lines.push('  -> UNMAPPED');
    for (const route of row.routes) {
      lines.push(`  -> decisions=${quote(route.decisionIds)} / scenario=${quote(route.scenarioId)} -> task=${quote(route.taskId)} -> acceptance=${quote(route.acceptanceId)}: ${quote(route.acceptanceText)}`);
      for (const decision of route.decisions) lines.push(`     decision ${quote(decision.id)} source=${quote(decision.source)} owner=${quote(decision.owner ?? null)} status=${quote(decision.status)} reason=${quote(decision.reason)}`);
    }
  }
  for (const error of result.errors) lines.push(`ERROR: ${error}`);
  return lines.join('\n');
}
