import { projectTaskManager } from './planning-graph.mjs';

const VISUAL_ICONS = Object.freeze({
  accepted_in_scope: '✅',
  partial: '🟨',
  contract_prepared: '📝',
  ready_frontier: '▶️',
  waiting: '⬜',
  blocked: '🚫',
  excluded: '⚪',
});

const MODE_LABELS = Object.freeze({
  planning: 'Planejamento ASDS',
  consumer: 'ASDS Execution Consumer',
  direct: 'execução Accelerate DIRECT',
});

const DEFAULT_AUTHORITY_NOTES = Object.freeze({
  planning: 'Os estados abaixo representam a projeção do planejamento ASDS; as checkboxes formais em tasks.md permanecem abertas até execução reconciliada.',
  consumer: 'Os estados abaixo refletem o replay determinístico do journal v3 no ASDS Execution Consumer; checkboxes formais seguem apenas receipts reconciliados.',
  direct: 'Os estados abaixo representam a execução Accelerate DIRECT, não as checkboxes formais ASDS.',
});

const sorted = values => [...values].sort();

function normalizeProjection(input, options = {}) {
  if (Array.isArray(input)) {
    return projectTaskManager(input, {
      completedTaskIds: options.completedTaskIds ?? [],
      blockers: options.blockers ?? [],
    });
  }
  if (!input || typeof input !== 'object') {
    throw new Error('dag-status-view requires a task-manager projection, planning manifest, or tasks array');
  }
  if (input.taskManager && Array.isArray(input.taskManager.tasks) && !options.completedTaskIds && !options.blockers) {
    return input.taskManager;
  }
  if (Array.isArray(input.tasks)) {
    const looksLikeRawContracts = !input.version && input.tasks.some(t => Array.isArray(t.dependsOn) && t.status === undefined);
    if (looksLikeRawContracts || options.completedTaskIds || options.blockers) {
      return projectTaskManager(input.tasks, {
        completedTaskIds: options.completedTaskIds ?? [],
        blockers: options.blockers ?? input.blockers ?? [],
      });
    }
    return input;
  }
  throw new Error('dag-status-view requires a task-manager projection, planning manifest, or tasks array');
}

function defaultVisualState(status, mode) {
  if (status === 'completed') return 'accepted_in_scope';
  if (status === 'progress_pending') return 'partial';
  if (status === 'blocked') return 'blocked';
  if (status === 'excluded') return 'excluded';
  if (status === 'ready') return mode === 'planning' ? 'contract_prepared' : 'ready_frontier';
  return 'waiting';
}

function defaultSummary(task, visualState, mode) {
  if (visualState === 'accepted_in_scope') return 'Executada e aceita no recorte';
  if (visualState === 'partial') return 'Entrega parcial no recorte';
  if (visualState === 'contract_prepared') return 'Microcontrato preparado';
  if (visualState === 'blocked') {
    const blockers = task.blockedBy?.length ? ` (${task.blockedBy.join(', ')})` : '';
    return `Bloqueada${blockers}`;
  }
  if (visualState === 'ready_frontier') return 'Pronta na fronteira atual';
  if (visualState === 'excluded') return 'Fora do escopo consumível';
  return mode === 'planning' ? 'Contrato planejado' : 'Não executada';
}

function defaultRemaining(task, visualState) {
  if (visualState === 'accepted_in_scope') return 'Concluída no recorte atual';
  if (visualState === 'excluded') return 'Nenhuma ação neste recorte';
  if (visualState === 'contract_prepared') {
    return 'Revisão, admissão, implementação e prova';
  }
  if (task.blockedBy?.length) {
    return `Resolver bloqueios: ${task.blockedBy.join(', ')}`;
  }
  if (task.waitingOn?.length) {
    return `Concluir dependências (${task.waitingOn.join(', ')}) e executar`;
  }
  return 'Executar e provar critérios de aceite';
}

function reconstructStructuralDependencies(tasks, overrides = {}, rawTasks = null) {
  const knownIds = new Set(tasks.map(task => task.id));
  for (const [id, over] of Object.entries(overrides)) {
    if (over && typeof over === 'object' && !knownIds.has(id) && over.title) {
      knownIds.add(id);
    }
  }
  const depsById = new Map([...knownIds].map(id => [id, new Set()]));
  if (Array.isArray(rawTasks)) {
    for (const raw of rawTasks) {
      if (knownIds.has(raw.id)) {
        for (const dep of raw.dependsOn ?? []) {
          if (knownIds.has(dep)) depsById.get(raw.id).add(dep);
        }
      }
    }
  }
  for (const task of tasks) {
    for (const dep of task.waitingOn ?? []) {
      if (knownIds.has(dep)) depsById.get(task.id).add(dep);
    }
    for (const dependent of task.blocks ?? []) {
      if (knownIds.has(dependent)) depsById.get(dependent).add(task.id);
    }
  }
  for (const [id, over] of Object.entries(overrides)) {
    if (over && Array.isArray(over.dependencies)) {
      depsById.set(id, new Set(over.dependencies.filter(dep => knownIds.has(dep))));
    }
  }
  return new Map([...depsById.entries()].map(([id, set]) => [id, sorted(set)]));
}

export function buildDagStatusView(input, options = {}) {
  const projection = normalizeProjection(input, options);
  const rawTasks = Array.isArray(input) ? input : (Array.isArray(input?.tasks) && input?.taskManager ? input.tasks : null);
  const isRuntime = projection.version === 'asds.runtime-task-manager-projection/1';
  const mode = options.mode ?? (isRuntime ? 'consumer' : 'planning');
  if (!MODE_LABELS[mode]) throw new Error(`Invalid DAG status view mode: ${mode}`);
  const overrides = options.overrides ?? {};
  const issueMap = options.issueMap ?? {};
  const structuralDeps = reconstructStructuralDependencies(projection.tasks, overrides, rawTasks);

  const baseTasks = projection.tasks.map(task => ({ ...task }));
  const baseIds = new Set(baseTasks.map(task => task.id));
  for (const [id, over] of Object.entries(overrides)) {
    if (!baseIds.has(id) && over && typeof over === 'object' && typeof over.title === 'string' && over.title.trim()) {
      const deps = structuralDeps.get(id) ?? [];
      baseTasks.push({
        id,
        title: over.title.trim(),
        status: 'waiting',
        wave: over.wave ?? (projection.plannedWaves?.length ?? 1) + 1,
        waitingOn: deps,
        blockedBy: over.blockedBy ?? [],
        blocks: over.blocks ?? [],
        parallelWith: over.parallelWith ?? [],
        serializesWith: over.serializesWith ?? [],
      });
    }
  }

  for (const task of baseTasks) {
    for (const [otherId, deps] of structuralDeps.entries()) {
      if (deps.includes(task.id) && !(task.blocks ?? []).includes(otherId)) {
        task.blocks = sorted(new Set([...(task.blocks ?? []), otherId]));
      }
    }
  }

  const enrichedTasks = sorted(baseTasks.map(task => task.id)).map(id => {
    const task = baseTasks.find(item => item.id === id);
    const over = overrides[id] ?? {};
    const visualState = over.visualState ?? defaultVisualState(task.status, mode);
    if (!VISUAL_ICONS[visualState]) {
      throw new Error(`${id}: unknown visualState ${visualState}`);
    }
    const structural = structuralDeps.get(id) ?? [];
    const issue = over.issue ?? issueMap[task.id] ?? null;
    return {
      id: task.id,
      title: over.title?.trim() || task.title,
      issue: typeof issue === 'string' && issue.trim() ? issue.trim() : null,
      status: task.status,
      visualState,
      icon: VISUAL_ICONS[visualState],
      wave: task.wave ?? 1,
      dependencies: structural,
      waitingOn: task.waitingOn ?? [],
      blockedBy: task.blockedBy ?? [],
      blocks: task.blocks ?? [],
      parallelWith: task.parallelWith ?? [],
      serializesWith: task.serializesWith ?? [],
      subtitle: typeof over.subtitle === 'string' && over.subtitle.trim() ? over.subtitle.trim() : null,
      summary: typeof over.summary === 'string' && over.summary.trim()
        ? over.summary.trim()
        : defaultSummary(task, visualState, mode),
      remaining: typeof over.remaining === 'string' && over.remaining.trim()
        ? over.remaining.trim()
        : defaultRemaining(task, visualState),
    };
  });

  const byId = new Map(enrichedTasks.map(task => [task.id, task]));
  const topologyLines = renderDagTopology(enrichedTasks);
  const frontier = Array.isArray(options.frontier) && options.frontier.length
    ? [...options.frontier]
    : deriveNextFrontier(enrichedTasks, byId);
  const counts = {
    total: enrichedTasks.length,
    accepted_in_scope: enrichedTasks.filter(t => t.visualState === 'accepted_in_scope').length,
    partial: enrichedTasks.filter(t => t.visualState === 'partial').length,
    contract_prepared: enrichedTasks.filter(t => t.visualState === 'contract_prepared').length,
    ready_frontier: enrichedTasks.filter(t => t.visualState === 'ready_frontier').length,
    waiting: enrichedTasks.filter(t => t.visualState === 'waiting').length,
    blocked: enrichedTasks.filter(t => t.visualState === 'blocked').length,
    excluded: enrichedTasks.filter(t => t.visualState === 'excluded').length,
  };

  return {
    schemaVersion: 'asds.dag-status-view/1',
    mode,
    modeLabel: MODE_LABELS[mode],
    totalTasks: enrichedTasks.length,
    counts,
    authorityNote: options.authorityNote ?? DEFAULT_AUTHORITY_NOTES[mode],
    legend: 'Legenda: ✅ executada/aceita no recorte · 🟨 parcial · 📝 contrato preparado · ▶️ pronta agora · ⬜ não executada · 🚫 bloqueada',
    tasks: enrichedTasks,
    topologyLines,
    deliveries: Array.isArray(options.deliveries) ? [...options.deliveries] : [],
    frontier,
  };
}

export function renderDagTopology(tasks) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const treeChildren = new Map(tasks.map(task => [task.id, []]));
  const inlineMultiDeps = new Map();
  const fanInGroups = new Map();
  const roots = [];

  for (const task of tasks) {
    const deps = task.dependencies ?? [];
    if (deps.length === 0) {
      roots.push(task.id);
    } else if (deps.length === 1) {
      treeChildren.get(deps[0])?.push(task.id);
    } else {
      const fanInParents = deps.filter(depId => {
        const parent = byId.get(depId);
        return parent && (parent.dependencies?.length ?? 0) > 1;
      });
      if (fanInParents.length === 1) {
        const parent = byId.get(fanInParents[0]);
        const otherDeps = deps.filter(d => d !== parent.id);
        if (otherDeps.every(d => (parent.dependencies ?? []).includes(d))) {
          treeChildren.get(parent.id)?.push(task.id);
          inlineMultiDeps.set(task.id, deps);
          continue;
        }
      }
      const key = `[${deps.join(' + ')}]`;
      if (!fanInGroups.has(key)) fanInGroups.set(key, []);
      fanInGroups.get(key).push(task.id);
    }
  }

  const lines = [];
  const renderNode = (id, prefix = '', isLast = true, isRoot = false) => {
    const task = byId.get(id);
    const branch = isRoot ? '' : (isLast ? '└─ ' : '├─ ');
    const multi = inlineMultiDeps.get(id);
    const labelPrefix = multi ? `[${multi.join(' + ')}] → ` : '';
    const issueTag = task.issue ? ` (${task.issue})` : '';
    lines.push(`${prefix}${branch}${labelPrefix}${task.id}${issueTag} ${task.icon} ${task.title}`);
    const childPrefix = isRoot ? ' ' : `${prefix}${isLast ? '   ' : '│  '}`;
    if (task.subtitle) {
      lines.push(`${childPrefix}     ${task.subtitle}`);
    }
    const children = treeChildren.get(id) ?? [];
    children.forEach((childId, index) => {
      const childIsLast = index === children.length - 1;
      renderNode(childId, childPrefix, childIsLast, false);
      if (!childIsLast && (treeChildren.get(childId)?.length ?? 0) > 0) {
        lines.push(`${childPrefix}│`);
      }
    });
  };

  roots.forEach((rootId, idx) => {
    if (idx > 0) lines.push('');
    renderNode(rootId, '', true, true);
  });

  for (const [groupHeader, memberIds] of fanInGroups.entries()) {
    if (lines.length > 0) lines.push('');
    lines.push(groupHeader);
    memberIds.forEach((memberId, index) => {
      renderNode(memberId, ' ', index === memberIds.length - 1, false);
    });
  }

  return lines;
}

function deriveNextFrontier(tasks, byId) {
  const steps = [];
  const prepared = tasks.filter(task => task.visualState === 'contract_prepared');
  if (prepared.length) {
    steps.push(`Admitir ${prepared.map(t => t.id).join(', ')}: revisar microcontrato, issue governante e escopo.`);
  }
  const partials = tasks.filter(task => task.visualState === 'partial');
  for (const partial of partials) {
    const directNext = (partial.blocks ?? []).filter(depId => {
      const target = byId.get(depId);
      return target && target.visualState !== 'accepted_in_scope';
    });
    if (directNext.length) {
      steps.push(`Completar ${partial.id} → ${directNext.join(', ')}.`);
    } else {
      steps.push(`Concluir escopo residual de ${partial.id}.`);
    }
  }
  const readyOrIndependent = tasks.filter(task =>
    task.visualState === 'ready_frontier'
    || (task.visualState === 'waiting' && (task.dependencies ?? []).every(dep => {
      const parent = byId.get(dep);
      return parent && (parent.visualState === 'accepted_in_scope' || parent.visualState === 'partial');
    }))
  );
  if (readyOrIndependent.length) {
    steps.push(`Avançar ${readyOrIndependent.map(t => t.id).join(', ')} em lanes independentes quando liberadas.`);
  }
  const sinks = tasks.filter(task => (task.blocks ?? []).length === 0 && task.visualState !== 'accepted_in_scope');
  if (sinks.length) {
    const preSinks = sorted(new Set(sinks.flatMap(s => s.dependencies ?? []))).filter(id => {
      const node = byId.get(id);
      return node && node.visualState !== 'accepted_in_scope';
    });
    if (preSinks.length) {
      steps.push(`Convergir em ${preSinks.join(', ')} → ${sinks.map(s => s.id).join(', ')}.`);
    } else {
      steps.push(`Convergir para fechamento em ${sinks.map(s => s.id).join(', ')}.`);
    }
  }
  return steps;
}

export function formatDagStatusMarkdown(viewOrInput, options = {}) {
  const view = viewOrInput?.schemaVersion === 'asds.dag-status-view/1'
    ? viewOrInput
    : buildDagStatusView(viewOrInput, options);

  const sections = [
    `DAG atual — ${view.totalTasks} tasks (${view.modeLabel})`,
    '',
    view.legend,
    view.authorityNote,
    '',
    ...view.topologyLines,
    '',
    'O que já foi executado e o que falta',
    '',
    'Task\tEstado atual\tFalta',
    ...view.tasks.map(task => `${task.issue ? `${task.id} (${task.issue})` : task.id}\t${task.icon} ${task.summary}\t${task.remaining}`),
  ];

  if (view.deliveries.length) {
    sections.push('', 'Entrega de código confirmada');
    for (const delivery of view.deliveries) {
      const header = [delivery.commit ? `Commit ${delivery.commit}` : null, delivery.issue ?? null, delivery.taskId ? `(${delivery.taskId})` : null]
        .filter(Boolean).join(' — ');
      sections.push('', header);
      for (const bullet of delivery.bullets ?? []) {
        sections.push(`• ${bullet}`);
      }
    }
  }

  if (view.frontier.length) {
    sections.push('', 'Próxima frente', '');
    view.frontier.forEach((step, idx) => {
      sections.push(`${idx + 1}. ${step}`);
    });
  }

  return sections.join('\n') + '\n';
}
