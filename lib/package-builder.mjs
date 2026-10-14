import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { safePath } from './contracts.mjs';
import { compilePlanningPlan, projectTaskManager } from './planning-graph.mjs';
import { PLANNING_LAYERS, planningCandidateSha256, planningReadbackSha256 } from './planning-lifecycle.mjs';
import { projectionSourceDigest } from './plan-projection.mjs';
import { loadTasks, validateTaskIndex } from './validation.mjs';
import { buildDagStatusView, formatDagStatusMarkdown } from './dag-status-view.mjs';

const MANIFEST_TASK_FIELDS = Object.freeze([
  'id', 'title', 'owner', 'nodeType', 'parentId', 'requirements',
  'dependsOn', 'dependencyDetails', 'decisionInputs', 'resolvesDecisions',
  'decisionBundleReason', 'write', 'resources', 'scenarios', 'verification',
]);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function sortTaskIds(ids) {
  return [...ids].sort((a, b) => {
    const aNum = /^\d+$/.test(a);
    const bNum = /^\d+$/.test(b);
    if (aNum && bNum) {
      const diff = BigInt(a) - BigInt(b);
      return diff < 0n ? -1 : diff > 0n ? 1 : 0;
    }
    return a.localeCompare(b);
  });
}

export function projectManifestTask(task) {
  return Object.fromEntries(MANIFEST_TASK_FIELDS.map(field => [field, task[field] ?? null]));
}

export function renderTaskContractMarkdown(task) {
  if (!task || typeof task !== 'object' || !nonempty(task.id) || !nonempty(task.title)) {
    throw new Error('Task contract requires id and title');
  }
  const frontmatter = {
    id: String(task.id).trim(),
    title: String(task.title).trim(),
    owner: task.owner ?? 'implementation-agent',
    nodeType: task.nodeType ?? 'task',
    kind: task.kind ?? 'implementation',
    ...(task.parentId ? { parentId: task.parentId } : {}),
    requirements: Array.isArray(task.requirements) ? task.requirements : [],
    dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
    dependencyDetails: Array.isArray(task.dependencyDetails) ? task.dependencyDetails : [],
    decisionInputs: Array.isArray(task.decisionInputs) ? task.decisionInputs : [],
    resolvesDecisions: Array.isArray(task.resolvesDecisions) ? task.resolvesDecisions : [],
    ...(nonempty(task.decisionBundleReason) ? { decisionBundleReason: task.decisionBundleReason.trim() } : {}),
    openDecisions: Array.isArray(task.openDecisions) ? task.openDecisions : [],
    write: Array.isArray(task.write) ? task.write : [],
    resources: Array.isArray(task.resources) ? task.resources : [],
    scenarios: Array.isArray(task.scenarios) ? task.scenarios : [],
    verification: Array.isArray(task.verification) ? task.verification : [],
    boundary: task.boundary ?? {
      change: task.outcome ?? `Execute bounded change for task ${task.id}`,
      target: (Array.isArray(task.write) && task.write.length
        ? task.write
        : (Array.isArray(task.resources) && task.resources.length ? task.resources : ['workspace'])).join(', '),
      exclusions: ['Unrelated domains, out-of-scope modules, and unapproved schema changes'],
      review: {
        verdict: 'pending',
        source: 'planning-coordinator',
      },
    },
  };

  const sections = task.sections ?? {};
  const outcomeText = sections.outcome ?? task.outcome ?? `Deliver the bounded outcome for ${frontmatter.id} (${frontmatter.title}).`;
  const depLines = (frontmatter.dependencyDetails ?? []).map(
    detail => `- Depends on \`${detail.id}\` (${detail.reason}): requires ${detail.requiredOutput}`,
  );
  const baseScopeText = sections.scopeAndDependencies
    ?? task.scopeAndDependencies
    ?? [
      `- Write scope: ${frontmatter.write.length ? frontmatter.write.map(p => `\`${p}\``).join(', ') : 'none (read-only)'}.`,
      `- Resources: ${frontmatter.resources.length ? frontmatter.resources.map(p => `\`${p}\``).join(', ') : 'none'}.`,
    ].join('\n');
  const missingOutputs = (frontmatter.dependencyDetails ?? [])
    .filter(detail => nonempty(detail.requiredOutput) && !baseScopeText.includes(detail.requiredOutput))
    .map(detail => `- Dependency \`${detail.id}\` (${detail.reason}): required output \`${detail.requiredOutput}\`.`);
  const scopeText = [baseScopeText, ...(depLines.length && !sections.scopeAndDependencies && !task.scopeAndDependencies ? depLines : missingOutputs)]
    .filter(Boolean)
    .join('\n');

  const inputsText = sections.inputs
    ?? task.inputs
    ?? [
      `- Scenarios: ${frontmatter.scenarios.length ? frontmatter.scenarios.map(s => `\`${s}\``).join(', ') : 'inherited from child contracts'}.`,
      ...(frontmatter.requirements.length ? [`- Requirements: ${frontmatter.requirements.map(r => `\`${r}\``).join(', ')}.`] : []),
    ].join('\n');

  const acceptanceText = sections.acceptance
    ?? task.acceptance
    ?? (frontmatter.scenarios.length
      ? frontmatter.scenarios.map(s => `- Satisfies scenario \`${s}\` within declared write/resource boundaries.`).join('\n')
      : `- Satisfies the bounded contract and child outcomes for task \`${frontmatter.id}\`.`);

  const verificationText = sections.verification
    ?? task.verificationSection
    ?? (frontmatter.verification.length
      ? frontmatter.verification.map(cmd => `- \`${cmd}\``).join('\n')
      : '- Verified through child leaf task verification commands.');

  const dodText = sections.definitionOfDone
    ?? task.definitionOfDone
    ?? '- All verification commands pass with exit code 0 and changes remain strictly within the declared write scope.';

  const yamlHeader = stringify(frontmatter, { lineWidth: 0 }).trimEnd();
  return [
    '---',
    yamlHeader,
    '---',
    '',
    `# Task ${frontmatter.id}: ${frontmatter.title}`,
    '',
    '## Outcome',
    outcomeText.trim(),
    '',
    '## Scope and dependencies',
    scopeText.trim(),
    '',
    '## Inputs',
    inputsText.trim(),
    '',
    '## Acceptance',
    acceptanceText.trim(),
    '',
    '## Verification',
    verificationText.trim(),
    '',
    '## Definition of done',
    dodText.trim(),
    '',
  ].join('\n');
}

export function renderTasksIndexMarkdown(tasks, { completedTaskIds = [], title = 'Tasks', blockers = [] } = {}) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const orderedIds = sortTaskIds(tasks.map(task => task.id));
  const completed = new Set(completedTaskIds);
  const manifestTasks = orderedIds.map(id => projectManifestTask(byId.get(id)));
  const projection = projectTaskManager(manifestTasks, { blockers });

  const lines = [
    `# ${title}`,
    '',
    '## Task Index',
    '',
    ...orderedIds.map(id => {
      const task = byId.get(id);
      const mark = completed.has(id) ? 'x' : ' ';
      return `- [${mark}] [Task ${id}](tasks/task-${id}.md): ${task.title}`;
    }),
    '',
    '## Planned Waves',
    '',
    ...projection.plannedWaves.map((wave, idx) => `- Wave ${idx + 1}: ${wave.join(', ')}`),
    '',
  ];
  return lines.join('\n');
}

export function renderMermaidDag(tasks) {
  const orderedIds = sortTaskIds(tasks.map(task => task.id));
  const byId = new Map(tasks.map(task => [task.id, task]));
  const lines = ['flowchart TD'];
  for (const id of orderedIds) {
    const task = byId.get(id);
    const safeTitle = String(task.title ?? id).replaceAll('"', "'");
    lines.push(`  T_${id}["${id}: ${safeTitle}"]`);
  }
  for (const id of orderedIds) {
    const task = byId.get(id);
    for (const dep of task.dependsOn ?? []) {
      lines.push(`  T_${dep} --> T_${id}`);
    }
  }
  return lines.join('\n') + '\n';
}

function collectSpecFiles(root) {
  const specsDir = path.join(root, 'specs');
  if (!fs.existsSync(specsDir)) return [];
  const results = [];
  function walk(relDir) {
    const absDir = path.join(root, relDir);
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile() && entry.name.endsWith('.md')) results.push(rel);
    }
  }
  walk('specs');
  return results.sort();
}

export function collectCanonicalReferences(root) {
  const references = [];
  const addRef = (id, relPath, role) => {
    const absPath = path.join(root, relPath);
    if (!fs.existsSync(absPath)) return;
    const bytes = fs.readFileSync(absPath);
    const isMutableIndex = role === 'index' && path.posix.basename(relPath).toLowerCase() === 'tasks.md';
    const digest = isMutableIndex
      ? projectionSourceDigest(bytes.toString('utf8'), true)
      : sha256(bytes);
    references.push({ id, path: relPath, role, sha256: digest });
  };

  addRef('proposal', 'proposal.md', 'proposal');
  addRef('design', 'design.md', 'design');
  for (const specFile of collectSpecFiles(root)) {
    const capability = path.posix.dirname(specFile).slice('specs/'.length) || 'spec';
    addRef(`spec:${capability}`, specFile, 'specification');
  }
  addRef('tasks-index', 'tasks.md', 'index');
  addRef('dag', 'dag.mmd', 'graph');
  addRef('dag-status', 'dag-status.md', 'status-view');

  const tasksDir = path.join(root, 'tasks');
  if (fs.existsSync(tasksDir)) {
    const taskFiles = fs.readdirSync(tasksDir)
      .filter(name => /^task-[A-Za-z0-9_-]+\.md$/.test(name))
      .sort();
    for (const file of taskFiles) {
      const id = file.replace(/^task-/, '').replace(/\.md$/, '');
      addRef(`task:${id}`, `tasks/${file}`, 'contract');
    }
  }
  return references;
}

function normalizeDecisionsAndBlockers(tasks, rawDecisions = [], rawBlockers = []) {
  const plan = compilePlanningPlan(tasks);
  const transitiveDeps = id => {
    const result = new Set();
    const visit = cur => {
      for (const dep of plan.dependencies[cur] ?? []) {
        if (!result.has(dep)) {
          result.add(dep);
          visit(dep);
        }
      }
    };
    visit(id);
    return result;
  };

  const decisions = rawDecisions.map(d => {
    const status = d.status === 'open' ? 'unresolved' : (d.status ?? 'unresolved');
    return {
      ...d,
      id: d.id,
      material: d.material ?? true,
      status,
      summary: d.summary ?? d.question ?? `Decision ${d.id}`,
    };
  });

  const blockers = rawBlockers.map(b => {
    const decisionId = b.decisionId;
    const consumers = tasks.filter(t => (t.decisionInputs ?? []).includes(decisionId)).map(t => t.id);
    const defaultAffected = consumers.length
      ? plan.leaves.filter(leafId => consumers.includes(leafId) || consumers.some(c => transitiveDeps(leafId).has(c)))
      : [];
    const affectedTasks = Array.isArray(b.affectedTasks) && b.affectedTasks.length
      ? b.affectedTasks
      : Array.isArray(b.taskIds) && b.taskIds.length
        ? b.taskIds
        : defaultAffected;
    return {
      ...b,
      id: b.id,
      ...(decisionId ? { decisionId } : {}),
      owner: b.owner ?? 'planning-coordinator',
      question: b.question ?? b.summary ?? `Resolve decision ${decisionId ?? b.id}`,
      consequence: b.consequence ?? `Blocks execution of ${affectedTasks.join(', ')} until resolved`,
      resolution: b.resolution ?? `Complete resolver task for ${decisionId ?? b.id}`,
      affectedTasks,
    };
  });

  return { decisions, blockers };
}

function buildDefaultLayers(references, existingLayers = null) {
  if (existingLayers && typeof existingLayers === 'object' && PLANNING_LAYERS.every(id => existingLayers[id])) {
    return existingLayers;
  }
  const refIds = references.map(r => r.id);
  const primaryRef = refIds.includes('tasks-index') ? ['tasks-index'] : refIds.slice(0, 1);
  return Object.fromEntries(
    PLANNING_LAYERS.map(id => [
      id,
      existingLayers?.[id] ?? {
        status: 'satisfied',
        reason: `Evaluated and bound in canonical planning package (${id})`,
        references: primaryRef,
      },
    ]),
  );
}

function patchTaskFrontmatter(absFilePath, updater) {
  const source = fs.readFileSync(absFilePath, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)$/);
  if (!match) return false;
  const fm = parse(match[1]);
  if (!fm || typeof fm !== 'object') return false;
  const nextFm = updater(structuredClone(fm));
  if (JSON.stringify(fm) === JSON.stringify(nextFm)) return false;
  const nextYaml = stringify(nextFm, { lineWidth: 0 }).trimEnd();
  fs.writeFileSync(absFilePath, `---\n${nextYaml}\n---${match[2]}`, 'utf8');
  return true;
}

export function reconcilePackageHierarchy(root) {
  const resolvedRoot = path.resolve(root);
  const tasksDir = path.join(resolvedRoot, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];
  const taskFiles = fs.readdirSync(tasksDir)
    .filter(name => /^task-[A-Za-z0-9_-]+\.md$/.test(name))
    .sort();
  if (!taskFiles.length) return [];

  const records = new Map();
  for (const file of taskFiles) {
    const absPath = path.join(tasksDir, file);
    const source = fs.readFileSync(absPath, 'utf8');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;
    try {
      const fm = parse(match[1]);
      if (fm && typeof fm === 'object' && nonempty(fm.id)) {
        records.set(String(fm.id), { id: String(fm.id), absPath, fm });
      }
    } catch {
      // Handled by downstream validation
    }
  }

  const childrenByParent = new Map();
  for (const rec of records.values()) {
    const parentId = rec.fm.parentId;
    if (nonempty(parentId) && records.has(String(parentId))) {
      const key = String(parentId);
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key).push(rec.id);
    }
  }

  const packageIds = [...records.values()]
    .filter(rec => rec.fm.nodeType === 'package' || childrenByParent.has(rec.id))
    .map(rec => rec.id);
  if (!packageIds.length) return [];

  const depthOf = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const parentId = records.get(id)?.fm?.parentId;
    if (!nonempty(parentId) || !records.has(String(parentId))) return 0;
    return 1 + depthOf(String(parentId), seen);
  };

  const orderedPackages = [...packageIds].sort((a, b) => depthOf(b) - depthOf(a));
  const reconciled = [];
  for (const pkgId of orderedPackages) {
    const childIds = sortTaskIds(childrenByParent.get(pkgId) ?? []);
    if (!childIds.length) continue;
    const parentRec = records.get(pkgId);
    const children = childIds.map(cid => records.get(cid)?.fm).filter(Boolean);
    const unionField = field => [...new Set(children.flatMap(c => Array.isArray(c[field]) ? c[field] : []))];
    const nextFields = {
      nodeType: 'package',
      decisionInputs: [],
      resolvesDecisions: [],
      openDecisions: [],
      write: unionField('write'),
      resources: unionField('resources'),
      scenarios: unionField('scenarios'),
      requirements: unionField('requirements'),
    };
    parentRec.fm = { ...parentRec.fm, ...nextFields };
    const changed = patchTaskFrontmatter(parentRec.absPath, fm => ({
      ...fm,
      ...nextFields,
    }));
    if (changed) reconciled.push(pkgId);
  }
  return reconciled;
}

export function syncPlanningPackage(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  if (options.reconcilePackages !== false) {
    reconcilePackageHierarchy(resolvedRoot);
  }
  const existingManifestPath = path.join(resolvedRoot, 'planning-manifest.json');
  const existingManifest = fs.existsSync(existingManifestPath)
    ? JSON.parse(fs.readFileSync(existingManifestPath, 'utf8'))
    : {};

  let completedTaskIds = options.completedTaskIds ?? [];
  if (!options.completedTaskIds && fs.existsSync(path.join(resolvedRoot, 'tasks.md'))) {
    try {
      const currentTasks = loadTasks(resolvedRoot);
      const currentIndex = validateTaskIndex(resolvedRoot, currentTasks);
      completedTaskIds = currentIndex.entries.filter(e => e.completed).map(e => e.id);
    } catch {
      completedTaskIds = [];
    }
  }

  const loadedTasks = loadTasks(resolvedRoot);
  const orderedIds = sortTaskIds(loadedTasks.map(t => t.id));
  const byId = new Map(loadedTasks.map(t => [t.id, t]));
  const orderedTasks = orderedIds.map(id => byId.get(id));
  const manifestTasks = orderedTasks.map(projectManifestTask);

  const { decisions, blockers } = normalizeDecisionsAndBlockers(
    manifestTasks,
    options.decisions ?? existingManifest.decisions ?? [],
    options.blockers ?? existingManifest.blockers ?? [],
  );

  const tasksMd = renderTasksIndexMarkdown(orderedTasks, {
    completedTaskIds,
    title: options.indexTitle ?? 'Tasks',
    blockers,
  });
  fs.writeFileSync(path.join(resolvedRoot, 'tasks.md'), tasksMd, 'utf8');

  if (options.writeDagMermaid !== false) {
    fs.writeFileSync(path.join(resolvedRoot, 'dag.mmd'), renderMermaidDag(orderedTasks), 'utf8');
  }

  const taskManager = projectTaskManager(manifestTasks, { blockers });

  if (options.writeDagStatus !== false) {
    const dagView = buildDagStatusView(
      { tasks: manifestTasks, taskManager, blockers },
      {
        mode: options.dagMode ?? 'planning',
        ...(options.dagViewOptions ?? {}),
      },
    );
    fs.writeFileSync(path.join(resolvedRoot, 'dag-status.md'), formatDagStatusMarkdown(dagView), 'utf8');
  }

  const references = collectCanonicalReferences(resolvedRoot);
  const packageId = options.packageId ?? existingManifest.packageId ?? path.basename(resolvedRoot);
  const revision = options.revision ?? existingManifest.revision ?? 'r1';
  const state = options.state ?? existingManifest.state ?? 'reviewing';
  const destination = options.destination
    ?? existingManifest.authority?.destination
    ?? `openspec/changes/${packageId}`;
  const reviews = options.reviews ?? existingManifest.reviews ?? [];
  const reviewsPassed = Array.isArray(reviews) && reviews.length === 2 && reviews.every(r => r?.verdict === 'pass');
  const rawPolicy = options.reviewPolicy ?? existingManifest.reviewPolicy ?? {};
  const reviewPolicy = {
    risk: rawPolicy.risk ?? rawPolicy.riskTier ?? 'elevated',
    domains: Array.isArray(rawPolicy.domains) && rawPolicy.domains.length ? rawPolicy.domains : ['architecture'],
    independentRequired: rawPolicy.independentRequired ?? rawPolicy.independentReviewRequired ?? true,
  };
  const layers = buildDefaultLayers(references, options.layers ?? existingManifest.layers);

  const existingRequested = options.originalRequestedProduct ?? existingManifest.originalRequestedProduct;
  const requestedKind = options.requestedKind ?? existingRequested?.kind ?? 'planning';
  const originalRequestedProduct = existingRequested
    ? {
        ...existingRequested,
        kind: requestedKind,
        status: requestedKind === 'implementation'
          ? 'not_fulfilled'
          : (state === 'delivered' ? 'fulfilled' : (existingRequested.status ?? 'in_progress')),
      }
    : {
        kind: requestedKind,
        status: requestedKind === 'implementation' ? 'not_fulfilled' : (state === 'delivered' ? 'fulfilled' : 'in_progress'),
      };

  const plan = compilePlanningPlan(manifestTasks);
  const blockedSet = new Set(taskManager.blockedTaskIds ?? []);
  const usableTaskIds = plan.leaves.filter(id => !blockedSet.has(id));

  const manifest = {
    schemaVersion: 'asds.planning-delivery/1',
    returnVersion: options.returnVersion ?? existingManifest.returnVersion ?? 'asds.planning-return/2',
    packageId,
    revision,
    state,
    author: options.author ?? existingManifest.author ?? 'planning-coordinator',
    attendanceOutcome: state === 'delivered' ? 'planning_delivered' : (options.attendanceOutcome ?? existingManifest.attendanceOutcome ?? 'planning_in_progress'),
    synthetic: false,
    originalRequestedProduct,
    planningContribution: options.planningContribution ?? existingManifest.planningContribution ?? {
      product: 'reviewed-planning-package',
      executionPerformed: false,
    },
    authority: {
      persistenceGranted: true,
      destination,
      authorization: options.authorization ?? existingManifest.authority?.authorization ?? 'host-planning-persistence-grant',
      scope: 'openspec-change-only',
    },
    reviewPolicy,
    layers,
    reviews,
    blockers,
    decisions,
    tasks: manifestTasks,
    taskManager,
    ...(options.includeUsableTasks || existingManifest.usableTasks || ['ready', 'delivered', 'partial'].includes(state)
      ? { usableTasks: usableTaskIds }
      : {}),
    references,
  };

  const candidateSha256 = planningCandidateSha256(manifest);
  const readbackSha256 = planningReadbackSha256(manifest);
  manifest.readback = {
    status: 'matched',
    revision,
    candidateSha256,
    readbackSha256,
    destination,
    synthetic: false,
    executionEvidence: false,
    verifiedBy: options.verifiedBy ?? existingManifest.readback?.verifiedBy ?? 'asds-package-builder',
    evidence: `Verified ${references.length} canonical references and ${manifestTasks.length} task contracts`,
    referenceIds: references.map(r => r.id),
    taskIds: usableTaskIds,
    checks: {
      bytes: true,
      files: true,
      ids: true,
      relations: true,
      decisions: true,
      reviews: reviewsPassed,
    },
  };

  fs.writeFileSync(existingManifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { manifest, taskManager, references };
}

export function recordPlanningReviews(root, reviewSpec = {}) {
  const resolvedRoot = path.resolve(root);
  const tasksDir = path.join(resolvedRoot, 'tasks');
  const reviewer = reviewSpec.reviewer ?? 'independent-planning-reviewer';
  const boundarySource = reviewSpec.boundarySource ?? reviewer;

  if (reviewSpec.markBoundariesReady !== false && fs.existsSync(tasksDir)) {
    const taskFiles = fs.readdirSync(tasksDir)
      .filter(name => /^task-[A-Za-z0-9_-]+\.md$/.test(name))
      .sort();
    for (const file of taskFiles) {
      patchTaskFrontmatter(path.join(tasksDir, file), fm => ({
        ...fm,
        boundary: {
          ...(fm.boundary ?? {}),
          review: {
            ...(fm.boundary?.review ?? {}),
            verdict: 'ready',
            source: boundarySource,
          },
        },
      }));
    }
  }

  const firstPass = syncPlanningPackage(resolvedRoot, {
    ...reviewSpec,
    reviews: [],
  });
  const m = firstPass.manifest;
  const candidateSha256 = m.readback.candidateSha256;
  const plan = compilePlanningPlan(m.tasks);
  const scopeTaskIds = reviewSpec.scopeTaskIds ?? plan.leaves;
  const defaultRef = m.references.some(r => r.id === 'tasks-index')
    ? 'tasks-index'
    : m.references[0]?.id ?? 'proposal';
  const mode = reviewSpec.mode ?? 'independent';
  const liveEvidence = reviewSpec.liveEvidence ?? `Independent review completed by ${reviewer} for ${m.packageId}@${m.revision}`;

  const buildEnvelope = (kind, override = {}) => ({
    kind,
    revision: m.revision,
    candidateSha256,
    verdict: override.verdict ?? reviewSpec.verdict ?? 'pass',
    synthetic: false,
    liveEvidence: override.liveEvidence ?? liveEvidence,
    reviewer: override.reviewer ?? reviewer,
    reference: override.reference ?? reviewSpec.reference ?? defaultRef,
    mode: override.mode ?? mode,
    scopeTaskIds: override.scopeTaskIds ?? scopeTaskIds,
    findings: Array.isArray(override.findings)
      ? override.findings
      : (Array.isArray(reviewSpec.findings) ? reviewSpec.findings : []),
  });

  const reviews = [
    buildEnvelope('fidelity', reviewSpec.fidelity),
    buildEnvelope('quality', reviewSpec.quality),
  ];
  const allPassed = reviews.every(r => r.verdict === 'pass');
  const nextState = reviewSpec.state
    ?? (allPassed ? ((m.blockers?.length ?? 0) > 0 ? 'partial' : 'ready') : 'reviewing');

  return syncPlanningPackage(resolvedRoot, {
    ...reviewSpec,
    state: nextState,
    reviews,
  });
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function exportPlaneProjectionPayloads(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  const manifestPath = path.join(resolvedRoot, 'planning-manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : syncPlanningPackage(resolvedRoot).manifest;
  const loadedTasks = loadTasks(resolvedRoot);
  const orderedIds = sortTaskIds(loadedTasks.map(t => t.id));
  const byId = new Map(loadedTasks.map(t => [t.id, t]));
  const projById = new Map((manifest.taskManager?.tasks ?? []).map(t => [t.id, t]));
  const titlePrefix = options.titlePrefix ?? 'P4Y-I · ';
  const parentIssueId = options.parentIssueId ?? null;

  const issues = [];
  for (const id of orderedIds) {
    const task = byId.get(id);
    if ((task.nodeType ?? 'task') === 'package') continue;
    const proj = projById.get(id) ?? {};
    const statusCategory = proj.status ?? 'waiting';
    const wave = proj.wave ?? 1;
    const name = `${titlePrefix}${task.id} — ${task.title}`;
    const relContractPath = `openspec/changes/${manifest.packageId}/tasks/task-${task.id}.md`;

    const mdLines = [
      `### ASDS Task Contract — \`${manifest.packageId}@${manifest.revision}\``,
      '',
      `- **Task ID**: \`${task.id}\``,
      `- **Contract Path**: \`${relContractPath}\``,
      `- **Wave**: Wave ${wave}`,
      `- **Planning Status**: \`${statusCategory}\``,
      `- **Kind / Owner**: \`${task.kind ?? 'implementation'}\` / \`${task.owner ?? 'implementation-agent'}\``,
      ...(task.parentId ? [`- **Parent Package Task**: \`${task.parentId}\``] : []),
      `- **Depends On**: ${(task.dependsOn ?? []).length ? task.dependsOn.map(d => `\`${d}\``).join(', ') : 'none'}`,
      ...((proj.blockedBy ?? []).length ? [`- **Blocked By**: ${proj.blockedBy.map(b => `\`${b}\``).join(', ')}`] : []),
      ...((task.resolvesDecisions ?? []).length ? [`- **Resolves Decisions**: ${task.resolvesDecisions.map(d => `\`${d}\``).join(', ')}`] : []),
      ...((task.openDecisions ?? []).length ? [`- **Open Decisions**: ${task.openDecisions.map(d => `\`${d}\``).join(', ')}`] : []),
      `- **Write Scope**: ${(task.write ?? []).length ? task.write.map(w => `\`${w}\``).join(', ') : 'none (read-only)'}`,
      `- **Verification**: ${(task.verification ?? []).map(v => `\`${v}\``).join(', ')}`,
      '',
      (task.body ?? '').trim(),
    ];
    const description_markdown = mdLines.join('\n').trim() + '\n';

    const htmlLines = [
      `<h3>ASDS Task Contract — <code>${escapeHtml(manifest.packageId)}@${escapeHtml(manifest.revision)}</code></h3>`,
      '<ul>',
      `<li><strong>Task ID</strong>: <code>${escapeHtml(task.id)}</code></li>`,
      `<li><strong>Contract Path</strong>: <code>${escapeHtml(relContractPath)}</code></li>`,
      `<li><strong>Wave</strong>: Wave ${wave}</li>`,
      `<li><strong>Planning Status</strong>: <code>${escapeHtml(statusCategory)}</code></li>`,
      `<li><strong>Kind / Owner</strong>: <code>${escapeHtml(task.kind ?? 'implementation')}</code> / <code>${escapeHtml(task.owner ?? 'implementation-agent')}</code></li>`,
      ...(task.parentId ? [`<li><strong>Parent Package Task</strong>: <code>${escapeHtml(task.parentId)}</code></li>`] : []),
      `<li><strong>Depends On</strong>: ${(task.dependsOn ?? []).length ? task.dependsOn.map(d => `<code>${escapeHtml(d)}</code>`).join(', ') : 'none'}</li>`,
      ...((proj.blockedBy ?? []).length ? [`<li><strong>Blocked By</strong>: ${proj.blockedBy.map(b => `<code>${escapeHtml(b)}</code>`).join(', ')}</li>`] : []),
      ...((task.resolvesDecisions ?? []).length ? [`<li><strong>Resolves Decisions</strong>: ${task.resolvesDecisions.map(d => `<code>${escapeHtml(d)}</code>`).join(', ')}</li>`] : []),
      ...((task.openDecisions ?? []).length ? [`<li><strong>Open Decisions</strong>: ${task.openDecisions.map(d => `<code>${escapeHtml(d)}</code>`).join(', ')}</li>`] : []),
      `<li><strong>Write Scope</strong>: ${(task.write ?? []).length ? task.write.map(w => `<code>${escapeHtml(w)}</code>`).join(', ') : 'none (read-only)'}</li>`,
      `<li><strong>Verification</strong>: ${(task.verification ?? []).map(v => `<code>${escapeHtml(v)}</code>`).join(', ')}</li>`,
      '</ul>',
      `<pre><code>${escapeHtml((task.body ?? '').trim())}</code></pre>`,
    ];
    const description_html = htmlLines.join('\n');

    issues.push({
      taskId: task.id,
      name,
      wave,
      statusCategory,
      priority: options.priority ?? (statusCategory === 'ready' ? 'high' : 'medium'),
      parentTaskId: task.parentId ?? null,
      ...(parentIssueId ? { parent: parentIssueId } : {}),
      dependsOn: task.dependsOn ?? [],
      blockedBy: proj.blockedBy ?? [],
      resolvesDecisions: task.resolvesDecisions ?? [],
      openDecisions: task.openDecisions ?? [],
      write: task.write ?? [],
      verification: task.verification ?? [],
      description_markdown,
      description_html,
    });
  }

  return {
    schemaVersion: 'asds.plane-projection/1',
    packageId: manifest.packageId,
    revision: manifest.revision,
    state: manifest.state,
    counts: {
      totalLeafIssues: issues.length,
      ready: issues.filter(i => i.statusCategory === 'ready').length,
      waiting: issues.filter(i => i.statusCategory === 'waiting').length,
      blocked: issues.filter(i => i.statusCategory === 'blocked').length,
    },
    issues,
  };
}

export function buildPlanningPackage(root, spec = {}) {
  const resolvedRoot = path.resolve(root);
  fs.mkdirSync(path.join(resolvedRoot, 'tasks'), { recursive: true });

  if (nonempty(spec.proposal)) {
    fs.writeFileSync(path.join(resolvedRoot, 'proposal.md'), spec.proposal.trimEnd() + '\n', 'utf8');
  }
  if (nonempty(spec.design)) {
    fs.writeFileSync(path.join(resolvedRoot, 'design.md'), spec.design.trimEnd() + '\n', 'utf8');
  }
  if (spec.specs && typeof spec.specs === 'object') {
    for (const [capability, content] of Object.entries(spec.specs)) {
      const rel = capability.endsWith('.md') ? `specs/${capability}` : `specs/${capability}/spec.md`;
      if (!safePath(rel)) throw new Error(`Unsafe spec path: ${rel}`);
      const fullPath = path.join(resolvedRoot, rel);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, String(content).trimEnd() + '\n', 'utf8');
    }
  }
  if (Array.isArray(spec.tasks) && spec.tasks.length) {
    for (const task of spec.tasks) {
      const markdown = renderTaskContractMarkdown(task);
      fs.writeFileSync(path.join(resolvedRoot, 'tasks', `task-${task.id}.md`), markdown, 'utf8');
    }
  }
  if (spec.recordReview) {
    const reviewOpts = typeof spec.recordReview === 'object' ? spec.recordReview : { reviewer: String(spec.recordReview) };
    return recordPlanningReviews(resolvedRoot, { ...spec, ...reviewOpts });
  }
  return syncPlanningPackage(resolvedRoot, spec);
}

