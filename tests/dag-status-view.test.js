import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDagStatusView, formatDagStatusMarkdown } from '../lib/dag-status-view.mjs';

function sampleTask(id, title, dependsOn = [], write = [`src/${id}.js`]) {
  return {
    id,
    title,
    owner: 'implementation-agent',
    nodeType: 'task',
    requirements: ['R1'],
    dependsOn,
    dependencyDetails: dependsOn.map(dep => ({
      id: dep,
      reason: `requires ${dep}`,
      requiredOutput: `${dep}-output`,
    })),
    decisionInputs: [],
    resolvesDecisions: [],
    openDecisions: [],
    write,
    resources: [],
    scenarios: ['cap/Scenario 1'],
    verification: ['npm test'],
  };
}

test('buildDagStatusView and formatDagStatusMarkdown render tree branches, fan-in groups, table, deliveries and frontier', () => {
  const tasks = [
    sampleTask('0001', 'Inventário executivo', []),
    sampleTask('0002', 'Semântica / reuse do SDD', ['0001']),
    sampleTask('0011', 'Documentos + projeção Plane', ['0002']),
    sampleTask('0003', 'Matriz operação × grant', ['0002']),
    sampleTask('0004', 'Lifecycle e compatibilidade', ['0003']),
    sampleTask('0005', 'Atribuição financeira / autoria', ['0003']),
    sampleTask('0006', 'Contratos públicos — NO-CHANGE focal', ['0003']),
    sampleTask('0010', 'Shell delegado, R2 e i18n', ['0006']),
    sampleTask('0013', 'Compatibilidade e elegibilidade de cleanup', ['0003']),
    sampleTask('0007', 'Correções de admissão server-side', ['0004', '0005', '0006']),
    sampleTask('0008', 'Revogação, expiração e freshness', ['0004', '0007']),
    sampleTask('0009', 'Admissão async e successors necessários', ['0003', '0004']),
    sampleTask('0012', 'Provas nativas, adversariais e browser', ['0007', '0008', '0009', '0010']),
    sampleTask('0014', 'Reconciliação de aceite e fechamento', ['0011', '0012', '0013']),
  ];

  const view = buildDagStatusView(tasks, {
    mode: 'direct',
    completedTaskIds: ['0001', '0002', '0003', '0006'],
    overrides: {
      '0004': { visualState: 'partial', summary: 'Decisão de fonte produzida e conferida', remaining: 'Resolver deadlines legados indeterminados e provar lifecycle' },
      '0005': { visualState: 'partial', summary: 'Principal/cota preservados; decisão “registrar ator” tomada', remaining: 'Implementar e provar 0015' },
      '0007': { visualState: 'partial', summary: 'Fix técnico P4Y-237 implementado, revisado e commitado', remaining: 'Demais divergências de admissão demonstradas' },
      '0008': { subtitle: 'também depende de 0004' },
      '0011': { visualState: 'partial', summary: 'Quatro documentos esclarecidos; nota 462 publicada', remaining: 'Versionamento documental e reconciliação completa da projeção' },
      '0015': {
        title: 'Auditoria ator/delegação nas aquisições LF',
        visualState: 'contract_prepared',
        dependencies: ['0003', '0004', '0005', '0006'],
        subtitle: 'suplemento DIRECT novo; código não iniciado',
        summary: 'Microcontrato preparado',
        remaining: 'Review, issue governante, leases/autoria, TDD, implementação e prova',
      },
    },
    issueMap: {
      '0001': 'P4Y-480',
      '0007': 'P4Y-237',
    },
    deliveries: [
      {
        commit: '0dea08db',
        issue: 'P4Y-237',
        taskId: '0007',
        bullets: [
          'Falha técnica do resolver agora impede downstream.',
          'RED: 1 falha comportamental + 3 positivos.',
          'GREEN e revisão independente: 4/4 PASS.',
        ],
      },
    ],
  });

  assert.equal(view.totalTasks, 15);
  assert.equal(view.counts.accepted_in_scope, 4);
  assert.equal(view.counts.partial, 4);
  assert.equal(view.counts.contract_prepared, 1);
  const md = formatDagStatusMarkdown(view);
  assert.match(md, /DAG atual — 15 tasks \(execução Accelerate DIRECT\)/);
  assert.match(md, /0001 \(P4Y-480\) ✅ Inventário executivo/);
  assert.match(md, /\[0004 \+ 0005 \+ 0006\]/);
  assert.match(md, /\[0003 \+ 0004 \+ 0005 \+ 0006\]/);
  assert.match(md, /0015 📝 Auditoria ator\/delegação nas aquisições LF/);
  assert.match(md, /Commit 0dea08db — P4Y-237 — \(0007\)/);
  assert.match(md, /Próxima frente/);
});

