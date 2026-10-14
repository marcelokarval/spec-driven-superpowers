# Plano de implementação — consumidor oficial de planos ASDS

**Data:** 2026-10-09, America/Bahia.
**Estado:** planejamento persistido; nenhuma tarefa abaixo foi implementada por esta encomenda.
**Checkout observado:** `main` em `52d282ac88887c2d8e7b3d6cda0755bc25b3f00f` (`v2.0.0-dirty`).
**Objetivo:** tornar oficial um consumidor harness-agnostic de pacotes ASDS já entregues, sem devolver execução ao lifecycle planning-only do ASDS.

## 1. Autoridade, baseline e não objetivos

Este plano usa como autoridade `AGENTS.md`, `PROJECT-STATUS.md`, a pesquisa
`docs/research/2026-10-03-planning-core/`, `docs/architecture.md`, o contrato
`docs/architecture/planning-delivery-contract.md` e a skill canônica ASDS. O plano
de 2026-10-07 corrigiu a fronteira planning-only; ele não especifica este consumidor
oficial. Este documento é o único plano novo para essa lacuna e não reabre a correção
já entregue.

O checkout já contém uma pilha local não publicada de hardening do journal v2,
isolamento de review, escopo observado, reconciliação de receipts e compatibilidade
com journal v1. Ela deve ser preservada e integrada, não sobrescrita por uma segunda
máquina de estados. Também devem permanecer intocados os quatro arquivos não
relacionados abaixo:

- `docs/observations/agrelli-visual-2026-10-02-collector.json`;
- `docs/observations/agrelli-visual-2026-10-02-events.jsonl`;
- `docs/observations/p4y-131-2026-10-02-collector.json`;
- `docs/observations/p4y-131-2026-10-02-events.jsonl`.

### Baseline dirty obrigatório para a implementação futura

O implementador deve registrar novamente hashes e status antes de tocar qualquer
arquivo. Na observação que fundamenta este plano já estavam modificados
`PROJECT-STATUS.md`, `docs/architecture.md`,
`docs/architecture/planning-delivery-contract.md`, `lib/contracts.mjs`,
`lib/git-scope.mjs`, `lib/host-bridge.mjs`, `lib/orchestration.mjs`,
`lib/plan-projection.mjs`, `lib/validation.mjs`,
`schemas/superpowers-bridge/{schema.yaml,templates/tasks.md}`,
`scripts/orchestrate.mjs`, três referências sob
`skills/spec-driven-superpowers/references/` e sete testes de contracts,
decomposition, host bridge, store, orchestration e validation. Também já existiam
como untracked `lib/receipt-reconciliation.mjs`,
`scripts/sanitize-pilot-journal.mjs`, `tests/fixtures/`,
`tests/pilot-journal-fixture.test.js` e `tests/receipt-reconciliation.test.js`, além
deste plano e das quatro observações listadas acima.

Essa baseline é contexto de preservação, não autorização para incorporar todo o
dirty state. Cada contrato EC abaixo declara seu write scope. Antes de editar um
arquivo preexistente e dirty, o implementador registra seu hash/base e separa no
receipt os bytes anteriores dos seus próprios deltas. Arquivo dirty fora do write
scope bloqueia a task; arquivo dirty dentro dele exige merge preservador e review
do delta combinado. As quatro observações ficam excluídas de todos os write scopes.

Esta encomenda não autoriza implementação, instalação, update de skill instalada,
alteração do Accelerate ou Prop4You, criação de worktree/backup, tracker, release,
commit ou push. A implementação futura deve primeiro capturar novamente branch,
HEAD e dirty state e trabalhar ao redor das mudanças preexistentes. Não deve
normalizar, mover ou incluir silenciosamente arquivos locais no patch.

Ficam fora do produto:

- planejar ou revisar o conteúdo do pacote ASDS; defeito real volta ao ASDS como
  uma revisão delimitada;
- inventar spawn, sandbox, worktree, mensageria, provider, modelo ou integração que
  o harness não exponha;
- instalar dependências, inicializar OpenSpec, trocar PATH/configuração ou criar um
  runtime paralelo;
- transformar Plane, OpenSpec ou o próprio `tasks.md` em executor;
- conceder autorização de implementação a partir de `planning delivered`;
- permitir que o coordenador escreva código de produto, execute uma task em seu
  próprio nome ou emita review da própria integração.

## 2. Regressão que o desenho precisa impedir

Em sessão Codex nova com spawn disponível, um prompt natural de correção e um plano
ASDS persistido chegaram ao agente. Ele encontrou a Task 0002, mas implementou-a na
sessão raiz, criou zero descendentes, não abriu journal v2, não produziu receipt,
review, integração nem `verifyObjective`, e encerrou com `tasks.md` ainda aberto.

Isso demonstra uma falha de entrada/consumo, não da capacidade isolada das funções:
o repositório já contém `projectTaskManager`, `compilePlan`, `createJournal`,
`readyWave`, `hostDispatch`, `hostCompleteReview`, reconciliação de receipts e
`objectiveSnapshot`. Hoje, porém, essas superfícies são descritas como legado opt-in;
nenhum consumidor oficial transforma o handoff em um gate obrigatório antes de a
sessão coordenadora tocar o projeto.

Critério mínimo da regressão: ao reconhecer um handoff ASDS compatível, a sessão raiz
deve criar/bindar journal v3 antes de qualquer mutação de produto, despachar uma
sessão executora distinta, despachar review distinto, persistir receipts canônicos,
atualizar exclusivamente o checkbox correspondente e só encerrar após
`verifyObjective`. Se a capacidade necessária estiver ausente, deve retornar
`blocked`/`manual_handoff_required`; nunca implementar diretamente para contornar o
gate.

## 3. Fronteira de produto

O sistema passa a ter dois entrypoints independentes:

1. `spec-driven-superpowers`: produz, revisa, persiste e entrega o plano; termina
   sem executar folhas futuras.
2. `asds-execution-consumer`: recebe uma revisão entregue, valida identidade e
   autorização, coordena sua execução e encerra somente após verificação objetiva.

O consumidor não é uma nova versão do ASDS nem uma fase interna da skill planejadora.
Ele pode reutilizar bibliotecas no mesmo repositório, mas tem skill, ativação,
contrato de entrada, lifecycle e retorno próprios. Uma conversa, uma alteração direta
sem pacote ASDS ou um pedido apenas de planejamento não ativa o consumidor.

### Papéis e autoridade de escrita

| Papel | Pode fazer | Não pode fazer |
|---|---|---|
| Coordenador | validar handoff; abrir journal; escolher a próxima operação já elegível; reservar; despachar; reconciliar receipts; atualizar exclusivamente `tasks.md`; registrar decisão final; solicitar `verifyObjective` | editar arquivos de produto; executar comandos da task como executor; corrigir entrega; revisar candidato ou integração; assumir uma sessão filha |
| Executor | implementar exatamente uma folha/retrabalho em contexto limpo e escopo autorizado; executar sua verificação; devolver receipt | marcar `tasks.md`; aceitar a própria entrega; mudar contrato/plano; atuar como reviewer da mesma task |
| Revisor | inspecionar snapshot host-owned em contexto limpo; emitir review de candidato ou integração | implementar/corrigir; confiar na narrativa do executor como primeira evidência; atualizar índice; revisar trabalho próprio |
| Integrador | aplicar/produzir a revisão integrada por operação delegada e escopo explícito | ser o coordenador sob outro rótulo; emitir review; marcar conclusão |
| Verificador | confrontar o objetivo original ou subconjunto consumível com a revisão integrada e emitir prova vinculada ao snapshot | implementar, revisar a própria entrega ou converter cobertura parcial em objetivo completo |
| Host adapter | observar capacidades, preparar/iniciar/parar sessões, impor isolamento/snapshot e reportar tool-call/process evidence | conceder autoridade de usuário; fabricar ferramenta não exposta; converter prompt em sandbox |

O integrador pode ser uma sessão executora nova com propósito `integration`, ou uma
operação atômica nativa comprovada do host. Não pode ser uma mutação de produto feita
pela sessão coordenadora. A mesma identidade não pode ocupar executor, integrador e
reviewer/verifier para a mesma task/revisão. O coordenador nunca é `task.owner`
executável. Quando o consumer oficial estiver operando, sua sessão coordenadora
precisa ser host-owned read-only para o projeto: ela não recebe primitivas genéricas
de escrita. Journal/evidência e a única troca de checkbox passam por brokers estreitos
do host, auditados por before/after snapshot. Sem esse enforcement, o produto retorna
`manual_handoff_required` antes de qualquer dispatch; uma instrução em prompt não
satisfaz a fronteira. Essa garantia de produto não é atribuída ao bootstrap
pré-consumer da seção 12, que declara sua limitação e usa separação voluntária.

## 4. Handoff planning → consumer

O ASDS planning-only não cria nem assina autoridade de execução. Depois que ele
libera ownership, o chamador usa a API pura caller-owned
`createExecutionHandoff(input)` em `lib/execution-handoff.mjs` ou a CLI equivalente
`node scripts/create-execution-handoff.mjs ...`. A autoria registra actor/adapter,
fonte e timestamp observados, sem alegar autenticação que o harness não fornece.

A API recebe: planning return/package root, contexto do pedido original, seleção
atual do consumer, grants atuais com fonte/escopo/validade, destino autorizado de
journal/evidência e uma observação atual de workspace. Ela reabre o pacote e deriva
imutavelmente package ID/revision, manifest/index hashes, taskManager, readback,
realpaths, repo/workspace identity, planning fingerprint e baseline fingerprint.
O caller não pode sobrescrever campos derivados; divergência entre valor fornecido
e derivado é erro. Selection, grants e destino continuam campos caller-authored e
são revalidados em init/start, não transformados em fatos do planejamento.

Capabilities de harness são deliberadamente separadas do handoff: são observações
voláteis coletadas pelo host em init e novamente em cada fronteira assíncrona. A API/
CLI de criação não recebe nem persiste `spawn`, modelos, budget, isolation ou tool
availability e não concede autorização. A CLI escreve somente o output explicitamente
selecionado com create-exclusive/CAS; sem `--output`, imprime o envelope e não muta o
projeto.

O envelope versionado `asds.execution-handoff/1` permanece separado do wire v1 do
Accelerate e de `asds.planning-return/1`. Ele contém somente referências e fatos
necessários ao consumo:

- `packageRoot`, `packageId`, `planningRevision` e hash do
  `planning-manifest.json` entregue;
- `canonicalIndex: tasks.md`, referência/readback da mesma revisão e o
  `taskManager` determinístico;
- identidade do pedido original e `attendanceOutcome`; implementação precisa estar
  pendente, não já declarada concluída;
- projeto-alvo, read scope, limites, recusas e autorizações preservadas;
- autoria caller-owned, decisão explícita de selecionar este consumidor e
  fonte/escopo/validade da autorização de execução; seleção não equivale a autorização;
- destino do journal/evidência já autorizado e perfil de papéis, sem segredos.

O envelope liga fortemente identidade física e lógica. Ele inclui
`packageRootRealpath`, `projectRootRealpath`, `workspaceId`, `repoIdentity` (tipo de
VCS, root/common-dir quando aplicável e revisão-base), `planningFingerprint` e
`workspaceBaselineFingerprint`. O fingerprint da baseline enumera paths/hashes de
committed-since-base, staged, unstaged e untracked não ignorado, distinguindo sujeira
preexistente. O host reobserva realpaths, identidade do repositório/workspace e
fingerprint imediatamente antes de journal init, prepare, start, integração,
progress commit e verificação. Symlink, troca de mount/workspace, outro checkout com
o mesmo HEAD ou drift que não seja explicado pelo ledger de deltas aceitos falha
fechado. Um path textual ou commit isolado não constitui binding suficiente.

### Semântica de pacote `partial`

O contrato `asds.planning-delivery/1` não muda e não ganha campos obrigatórios. Para
um retorno `partial`, `createExecutionHandoff` normaliza `partialScope` somente no
novo envelope de execução a partir dos campos v1 existentes:
`planningContribution.usableTasks` fornece os candidatos consumíveis; `blockers`,
`limitations`, `remainingWork`, task inventory e taskManager fornecem as exclusões,
owners, razões e condições já registradas. A função aceita IDs/refs v1 documentados,
resolve-os para folhas canônicas e rejeita referência ambígua, inexistente ou
duplicada; não inventa usable task, blocker ou decisão ausente.

O `partialScope` derivado contém `consumableTaskIds` não vazio e `excludedTaskIds`,
formando partição exata, disjunta e sem duplicatas de todas as folhas, mais a
proveniência v1 usada em cada decisão. Se `usableTasks` estiver ausente/ambíguo, se
uma exclusão não tiver explicação suficiente nos blockers/remaining work existentes,
ou se a partição não fechar, o partial é não consumível. Nenhuma task consumível pode
depender, direta ou transitivamente, de uma excluída; nenhum agregado que cruza a
fronteira pode ser aceito como completo. O handoff inclui projeção taskManager
restrita ao subconjunto, mas preserva IDs excluídos como `excluded`, nunca como
completed/blocked genérico. O planning manifest e planning return permanecem
byte-identical.

O consumidor não altera checkbox de ID excluído e não pode emitir
`verifyObjective: pass` para o pedido original enquanto houver exclusões. Depois de
aceitar todo o subconjunto, registra `verifyObjective: fail` com os IDs excluídos em
`remainingWork` e retorna `partial_consumed`, deixando explícito o resultado útil e
o objetivo não concluído. Somente um novo planning revision que resolva a partição,
ou uma mudança de objetivo explicitamente autorizada, pode permitir `pass`.

### Gate de recepção

O consumidor deve, antes de qualquer dispatch ou escrita de produto:

1. reabrir o manifest e rejeitar estado diferente de `delivered` ou `partial` com
   partição consumível válida;
2. conferir revisão, readback C15/C16, referências e hashes atuais;
3. carregar somente a ordem declarada em `tasks.md`, rejeitando contrato órfão,
   título/ID/onda divergente ou projeção stale;
4. recomputar `projectTaskManager()` e exigir equivalência byte/semântica com a
   projeção recebida;
5. derivar progresso exclusivamente dos checkboxes canônicos e receipts reconciliados;
6. recusar checkbox fechado sem receipt canônico aceito. Na importação sem journal v3
   e proveniência de progresso, recusar também receipt aceito sem checkbox. Em uma
   retomada com journal v3 válido, receipt aceito + `progressRequested` atual +
   checkbox aberto é precisamente recovery `progress_pending`, não inconsistência;
   aplicar o protocolo idempotente da seção 5;
7. validar autorização de execução e persistência do journal separadamente;
8. conferir realpaths, repo/workspace identity e baseline fingerprint;
9. exigir `coordinatorBoundary.enforced: true`, projeto read-only e brokers limitados
   para journal/evidence/progress; caso contrário retornar `manual_handoff_required`;
10. criar journal v3 ligado ao digest do handoff, revisão do plano, partição
    consumível, baseline do projeto e capabilities observadas.

Falha em qualquer item não inicia executor. Um erro de contrato aponta o campo,
task/requisito e revisão afetados e retorna ao planejador; indisponibilidade de
harness, autorização ou isolamento permanece blocker do consumidor.

## 5. Lifecycle oficial do consumidor

```text
planning handoff validado
  -> journal v3 + baseline + capabilities + coordinator boundary
  -> next/readyWave sobre taskManager/DAG corrente
  -> reservar exclusões e despachar executor limpo
  -> delivery + stop observado + receipt de candidato
  -> despachar reviewer limpo sobre snapshot host-owned
  -> rework ou integração delegada
  -> review independente da revisão integrada
  -> decisão forense do coordenador
  -> receipt canônico reconciliado
  -> progressRequested: task entra em progress_pending
  -> broker CAS/lock atualiza somente checkbox da task em tasks.md
  -> progressCommitted liga before/after hashes ao receipt
  -> derivar runtime projection e continuar independentes/dependentes
  -> todas as folhas/pacotes aceitos
  -> verifier limpo ou operação host-owned produz prova do objetivo
  -> coordenador registra verifyObjective
  -> retorno complete|blocked|paused|cancelled
```

### Três representações e protocolo recuperável de progresso

Não há uma única projeção mutável:

1. **planning projection**: `planning-manifest.json.taskManager`, imutável e ligada
   à revisão entregue; expressa frontier/waves/blockers planejados, sem progresso;
2. **runtime projection**: derivada por replay do journal v3, com assignments,
   receipts, reviews, aceites, `progress_pending`, completed e blockers operacionais;
3. **materialized progress**: somente checkboxes de `tasks.md`, uma visão recuperável
   do aceite runtime, nunca a fonte do DAG ou do receipt.

Após aceite e reconciliação, `progressRequested` guarda task ID, contract/planning/
integration revisions, receipt digest, index before-hash e a troca exata esperada.
O estado vira `progress_pending`; dependentes ainda não liberam. O broker faz CAS do
before-hash e troca apenas `[ ]` por `[x]`. `progressCommitted` exige readback do
after-hash e o mesmo receipt, então libera dependentes. Repetir a mesma operação com
checkbox já fechado e hashes/receipt correspondentes é sucesso idempotente; outro
conteúdo, outro receipt ou outra revisão é conflito.

Recuperação após interrupção é determinística: checkbox ainda aberto permite repetir
o CAS; checkbox fechado com única troca esperada permite anexar o
`progressCommitted` ausente; estado ambíguo/drift permanece `progress_pending` com
owner e não executa dependentes. Nunca se reabre checkbox automaticamente, nunca se
marca receipt a partir do checkbox e nunca se edita a planning projection.

`continuation()`/`next` é obrigatório após cada evento e após toda pergunta de
status; uma task aceita não encerra o objetivo. `wave` pode selecionar múltiplos
pares seguros, mas cada dispatch reobserva estado/capabilities e faz CAS antes de
iniciar. `parallelWith` é permissão candidata, `serializesWith` é exclusão, e
`waitingOn`, `blockedBy`, `blocks`, write paths, resources e reservations sempre
prevalecem sobre conveniência do modelo.

`verifyObjective` não deve ser redigido como conclusão intuitiva da sessão raiz.
O consumidor produz um pacote de verificação ligado ao `objectiveSnapshot`, com
pedido original, cobertura, comportamento integrado, autoridade, evidência,
limitações e remaining work. Quando a verificação exige julgamento de produto,
use uma sessão verificadora distinta; quando é determinística, o host pode devolver
observação assinada por sua própria identidade de adapter. O coordenador registra,
mas não fabrica, a prova.

### Journal v3 e replay compatível

Novas runs usam explicitamente header `version: 3` e handlers `applyV3`. O refactor
mantém `replayV1`/`applyV1` e `replayV2`/`applyV2` com a semântica atual, cobertos por
fixtures douradas; código comum pode validar hash/sequence, mas não reinterpretar
eventos antigos. v1/v2 permanecem legíveis e, onde hoje suportado, continuáveis por
seus próprios handlers. Eles não aceitam eventos v3, não ganham integrator/verifier,
coordinator-boundary ou progress provenance retroativos e não são convertidos in
place. Uma retomada sob garantias v3 exige novo journal ligado ao predecessor e
reconciliação explícita, preservando ambos.

## 6. Superfícies exatas

### 6.1 Entrada e documentação do produto

- **Novo** `skills/asds-execution-consumer/SKILL.md`: único entrypoint oficial;
  ativação natural, preflight, loop obrigatório e condição de parada.
- **Novos** `skills/asds-execution-consumer/references/{handoff,protocol,roles,harness-contract,recovery}.md`:
  contratos portáteis, sem nomes de ferramentas universais.
- `skills/spec-driven-superpowers/references/consumer-boundary.md`: apontar para o
  consumidor oficial sem carregá-lo/ativá-lo.
- `skills/spec-driven-superpowers/SKILL.md` e
  `skills/spec-driven-superpowers/references/protocol.md`: preservar a parada
  planning-only e descrever apenas o envelope emitido.
- `skills/superpowers/using-superpowers/SKILL.md`: selecionar o consumidor quando
  houver pacote entregue + pedido/autorização de implementação; não cair em execução
  manual da sessão raiz.
- `skills/superpowers/{executing-plans,subagent-driven-development}/SKILL.md` e
  `skills/openspec/openspec-apply-change/SKILL.md`: adicionar modo condicional
  `ASDS execution-consumer` usado somente dentro de packet/assignment oficial e
  substituir nesse modo os blocos antigos “when ASDS owns lifecycle”. Preservar
  integralmente o fluxo standalone quando não há assignment; não tornar o consumidor
  requisito para planos genéricos/OpenSpec apply nem retirar guardrails próprios.
- `README.md`, `docs/architecture.md`, `PROJECT-STATUS.md`: documentar três camadas
  (planner, consumer, harness) e declarar apenas o estado realmente implementado.

### 6.2 Contratos e núcleo determinístico

- **Novo** `lib/execution-handoff.mjs`: parse/validação fail-closed de
  `asds.execution-handoff/1`, `createExecutionHandoff` caller-owned, normalização
  partial v1 e binding do manifest/readback/projeção/autorização.
- **Novo** `lib/execution-consumer.mjs`: fachada pública que compõe recepção,
  `createJournal`, `continuation`, packets e finalização sem executar ferramentas.
- `lib/planning-graph.mjs`: manter `projectTaskManager()` como projeção canônica;
  adicionar somente campos necessários ao consumo se versionados e cobertos por
  compatibilidade, sem criar um segundo DAG.
- `lib/orchestration.mjs`: evoluir journal de forma aditiva para identidades de
  coordenador/executor/integrador/reviewer/verifier, proibir colisão de papéis,
  retirar integração de produto da sessão root e ligar `verifyObjective` a prova
  externa observada. Introduzir handlers/replay v3 separados; preservar handlers e
  fixtures v1/v2 sem claims retroativos.
- `lib/host-bridge.mjs`: expor dispatch/completion por propósito e exigir sessão,
  tool-call, stop e snapshot reais. Preparação não pode executar trabalho.
- `lib/receipt-reconciliation.mjs`: concluir/absorver o hardening local atual e
  produzir receipt canônico antes de progress update; campos novos permanecem
  irreconciliáveis por padrão.
- **Novo** `lib/task-index-progress.mjs`: single-writer CAS do checkbox exato em
  `tasks.md`, com lock exclusivo, hash esperado, anchor/ID/título imutáveis,
  `fsync`/rename quando suportado e limpeza de temporário/lock em falha ordinária.
  Nenhum outro byte do índice pode mudar nessa operação; implementar recovery
  idempotente de `progress_pending` e receipts `progressRequested/Committed`.
- `lib/orchestration-store.mjs`: generalizar só o primitive de store/lock que for
  compartilhável; não tratar o journal como autoridade do índice.
- `lib/contracts.mjs`, `lib/validation.mjs`, `lib/git-scope.mjs` e
  `lib/plan-projection.mjs`: validar receipt observado, baseline preexistente,
  realpath/repo/workspace fingerprint, partição partial, três projeções, mutação
  exclusiva do checkbox e coerência pós-update.

### 6.3 CLI, exemplos e instalação

- **Novo** `scripts/create-execution-handoff.mjs`: creator caller-owned; deriva
  campos imutáveis do pacote, recebe autoria/selection/grants/destination atuais,
  exclui capabilities e só persiste com output explícito/create-exclusive.
- **Novo** `scripts/consume.mjs`: comandos `init`, `next`, `packet`, `event`,
  `reconcile`, `progress`, `verify`, `status`; apenas lê/escreve estado autorizado,
  nunca chama prompt, shell de task ou spawn diretamente.
- `scripts/orchestrate.mjs`: manter compatibilidade e delegar primitives comuns;
  emitir aviso/documentação de API legada, sem quebrar journals existentes.
- `package.json`: script `consume`; sem nova dependência salvo necessidade
  demonstrada e review de supply chain.
- **Novo** `examples/execution-consumer/`: handoff, profile, capabilities, events e
  journal sintéticos claramente rotulados; nenhum modelo output fingido.
- `lib/install.mjs`, `scripts/install.mjs`, `tests/install.test.js` e
  `tests/update.test.js`: incluir `asds-execution-consumer` no payload oficial como
  skill irmã, com preview/idempotência/manifests atuais. Instalação apenas por
  comando oficial e autorização separada; não criar alias, launcher, runtime,
  backup ou ativação de projeto.
- Adaptadores existentes em
  `skills/spec-driven-superpowers/references/adapters/*.md`: apontar para o contrato
  comum e registrar somente capacidades realmente documentadas/observadas. Se o
  harness não expõe spawn, wait, message, cancel, snapshot ou isolamento, marcar
  `unavailable`/`unknown`; não escrever pseudochamadas.

## 7. Contratos fail-closed

1. **Entrada:** versão, revisão, readback, taskManager, index, partição partial,
   realpaths, repo/workspace identity, fingerprints e autorização devem concordar;
   extras desconhecidos que afetem execução são rejeitados. Campos derivados só
   podem vir de `createExecutionHandoff`; autoria/selection/grants/destination são
   caller-owned e revalidados. Capabilities nunca viajam no envelope.
2. **Sem implementação root:** qualquer mutation de produto atribuída ao
   coordenador invalida a run. O host mantém o projeto read-only para essa sessão;
   journal/evidência e checkbox só passam por brokers allowlisted/auditados. Sem
   enforcement host-owned, `manual_handoff_required` e zero dispatch.
3. **Separação de identidade:** coordinator, executor, integrator, candidate reviewer,
   integration reviewer e verifier usam identidades/sessões compatíveis com sua
   independência; role reuse proibido por task/revisão.
4. **Contexto limpo:** `fresh:true` em prompt não basta. Host confirma criação,
   ausência de histórico herdado e boundary/snapshot; review exige read-only ou
   disposable copy imposto pelo host.
5. **Autorização:** `executionAuthorized:false` continua nos packets. O host revalida
   a grant antes de reservar e imediatamente antes de start.
6. **Ordem:** dependência só libera após receipt integrado, reviews atuais, decisão
   aceita e `progressCommitted`. `progress_pending` nunca libera sucessor.
   Número/ordem Markdown não substitui DAG.
7. **Exclusão:** paths ancestrais, resources, `serializesWith` e atores externos
   bloqueiam concorrência; ausência de declaração observável não vira isolamento.
8. **Receipts:** contract, plan, candidate, integration e observed-command revisions
   precisam coincidir. Texto “testes passaram” não é evidência autenticada.
9. **Índice:** somente o broker solicitado pelo coordenador altera o checkbox após
   aceite; executor/reviewer ou escrita genérica do root em `tasks.md` invalida
   escopo. Drift de título, ID, onda ou prosa exige replan/reconciliação, não merge
   automático. Import sem journal/proveniência rejeita receipt sem checkbox; journal
   v3 válido com `progressRequested` e checkbox aberto retoma `progress_pending`.
   Recovery é idempotente e sempre parte do journal receipt.
10. **Continuidade:** status/tool return não encerra; active worker preserva lease;
    timeout não equivale a stop; no máximo três recuperações por blocker conforme
    política existente.
11. **Objetivo:** zero tasks abertas é necessário, mas insuficiente. Sem
    `verifyObjective: pass` atual, retorno não pode ser `complete`.
12. **Defeito de plano:** runtime/test failure fica no consumidor; requisito ausente,
    dependência incorreta ou contrato inexequível volta ao ASDS com revisão/task
    afetada, sem o consumidor reescrever o planejamento.
13. **Binding:** toda operação reobserva realpaths, repo/workspace identity e current
    fingerprint = baseline preexistente + deltas aceitos. Outro checkout, symlink,
    mount ou drift inexplicado bloqueia a operação.
14. **Partial:** IDs excluídos não são despachados nem concluídos; subconjunto não
    promove agregado cruzado nem objetivo original. `partial_consumed` preserva
    remaining work e nunca é alias de `complete`.

## 8. Integração harness-agnostic

O núcleo define uma interface injetada, não um conjunto de ferramentas fictícias:

- `observeCapabilities()` retorna fatos atuais e proveniência;
- `observeWorkspace()` retorna realpaths, repo/workspace identity, baseline/current
  fingerprints e ledger de deltas observados;
- `enforceCoordinatorBoundary()` confirma projeto read-only e os brokers exatos;
- `authorize(operation, context)` retorna grant/denial com fonte e escopo;
- `prepare(role, packetSummary)` cria sessão standby sem trabalho de projeto;
- `start(prepared, packet)` devolve identidade e tool-call observado;
- `wait/poll`, `send` e `interrupt` existem somente quando mapeados pelo adapter;
- `observeStop(session)` distingue retorno de ferramenta, processo e sessão;
- `snapshot(target)`/`completeReview` provam boundary antes/depois;
- `integrate(packet)` é operação delegada opcional; sem ela, despacha-se um
  integrador como worker; nunca cai para o coordenador;
- `persistEvidence` usa destino autorizado e reporta falha parcial.
- `commitProgress(request)` é o único broker que pode trocar o checkbox canônico e
  retorna before/after readback; não aceita conteúdo Markdown arbitrário.

Cada adapter declara uma matriz `documented | observed | unavailable | unknown` e
traduz nomes/argumentos reais apenas em runtime. O núcleo retorna operações
abstratas; a skill coordenadora chama as ferramentas que a sessão de fato expõe.
Capacidade parcial preserva trabalho independente e bloqueia somente a etapa que a
consome. A exceção é o boundary do coordenador: sem enforcement/auditoria host-owned
não há execução coordenada e o retorno é `manual_handoff_required`. Sem spawn não há
reviewer “independente” nem execução direta de fallback.

## 9. Estratégia de testes

### 9.1 Unitários determinísticos

- **Novo** `tests/execution-handoff.test.js`: versões, revisão/readback stale,
  creator/validator, autoria/selection/grants/destination, override de derivado,
  capabilities separadas, normalização partial pelos campos v1, closure,
  realpath/repo/workspace/fingerprint stale e taskManager divergente.
- **Novo** `tests/execution-handoff-cli.test.js`: stdout read-only, output
  create-exclusive, pacote preservado, erro tipado e nenhum grant/capability inferido.
- **Novo** `tests/execution-consumer.test.js`: lifecycle completo, role collisions,
  journal v3, coordinator boundary, ordem, blockers, dependentes, exclusions,
  pause/recovery e ausência de `complete` sem objective proof.
- **Novo** `tests/task-index-progress.test.js`: único checkbox, anchor/title/onda
  imutáveis, `progress_pending`, retries antes/depois da escrita, CAS concorrente,
  lock/hardlink/symlink, falha injetada e limpeza.
- Expandir `tests/{orchestration,host-bridge,orchestration-store,receipt-reconciliation,
  plan-projection,validation,contracts,git-scope}.test.js` para os invariantes acima.
- Spies devem provar que bibliotecas puras não chamam shell, modelo, spawn ou
  instalador e que o planner não importa o consumidor.

### 9.2 Integração por adapter fake

Criar `tests/execution-consumer-integration.test.js` com um host fake determinístico
que registra prepare/start/stop/snapshot e filesystem fixture:

- happy path com duas folhas, dependência e uma independente;
- overlap de path/resource serializado apesar de wave igual;
- executor falha, rework ocorre e reviewer novo reabre a mesma revisão;
- drift entre prepare/reserva/start bloqueia antes de trabalho;
- reviewer prompt-only é rejeitado; snapshot drift invalida review;
- receipt de projeção só marca índice após reconciliação canônica;
- import sem journal rejeita receipt sem checkbox, enquanto journal v3 atual com
  `progressRequested` recupera esse mesmo estado como `progress_pending`;
- planning projection permanece imutável enquanto runtime/materialized progress
  avançam e se reconciliam;
- partial executa só o fechamento transitivo consumível, retorna
  `partial_consumed` e mantém excluded/remaining work;
- troca de realpath/repo/workspace ou drift fora do ledger bloqueia cada fronteira;
- host sem coordinator read-only/broker audit retorna `manual_handoff_required`
  antes de preparar worker;
- crash/lock preserva estado anterior e não deixa temporário próprio;
- task final aceita ainda retorna `verify_objective`, depois `complete` somente com
  prova corrente.

Rodar arquivos oficiais explicitamente, `npm run check`, `npm run validate` e
`git diff --check`. Unit/integration verdes provam contratos exercitados, não seleção
natural da skill nem comportamento de qualquer provider.

### 9.3 Qualificação natural da regressão — gate posterior

EC-11 não está autorizado por esta encomenda de planejamento nem pela futura
autorização implícita para implementar EC-01–EC-10. Depois de a fonte candidata e
os testes determinísticos existirem, um pedido humano separado deve autorizar a
sessão externa, fixture, modelo/provider, custos e destino de evidência. Só então
preparar
`docs/qualification/2026-10-09-execution-consumer/` com método, prompt congelado,
baseline, eventos brutos, mutações, descendants, receipts e relatório. O participante
é uma sessão Codex nova, sem transcript/resultado anterior, em fixture isolada e com
spawn realmente disponível. Ele recebe apenas um pedido natural de corrigir o projeto
e um pacote ASDS entregue.

Gates observáveis:

- skill do consumidor foi descoberta naturalmente e o ASDS planner não retomou;
- journal v3 nasceu antes da primeira mutação de produto;
- Task 0002 foi delegada; `descendantCount > 0`; root não escreveu arquivos de
  produto nem executou os comandos da task;
- executor, integrador/reviewer e verifier têm identidades compatíveis com a
  separação exigida;
- review usa snapshot limpo e receipts apontam a mesma revisão;
- somente o coordenador marcou `tasks.md`, após receipt canônico aceito;
- `next` continuou até nenhuma task aberta e `verifyObjective: pass`;
- resposta final corresponde ao journal/readback; timeout/falha não é maquiado.

Executar também negativos: spawn ausente, autorização revogada, taskManager stale,
review isolation desconhecido e status question no meio da run. A resposta esperada
é blocker/continuidade honesta, nunca implementação root. Uma única sessão qualifica
somente essa combinação de versão/harness/modelo/capacidades; não autoriza claim
universal.

## 10. Compatibilidade, atualização e instalador

- `asds.planning-delivery/1`, `asds.planning-return/1` e o wire Accelerate v1 não
  mudam. O novo handoff é aditivo e negociado; seu creator normaliza partial a partir
  de `planningContribution.usableTasks`, blockers, limitations e remainingWork já
  existentes, sem gravar `consumableTaskIds` no pacote planning v1.
- Journals v1 e v2 continuam em handlers/replay próprios, cobertos por fixtures
  douradas e sem semântica retroativa. Novas runs usam explicitamente journal v3,
  que acrescenta coordinator boundary, integrator/verifier, partial partition e
  progress receipts. Não converter in place nem promover prova antiga por migração
  textual.
- `scripts/orchestrate.mjs` e exports públicos permanecem durante uma janela
  documentada. A fachada oficial usa os mesmos primitives, sem manter dois estados.
- `tasks.md` existente pode conter progresso legítimo. Importação exige receipts
  reconciliados. Sem journal/proveniência, receipt sem checkbox é import inconsistente;
  com journal v3 atual e `progressRequested`, é recovery `progress_pending`. Sem
  nenhuma dessas provas, a run fica parcial/bloqueada e não reabre/fecha checkboxes
  automaticamente.
- Planning projection v1 continua imutável; runtime projection/journal v3 e
  materialized checkboxes são representações separadas. Consumidor antigo que espera
  uma projeção mutável deve negociar adapter, não receber retrofit silencioso.
- O instalador oficial continua preview-first, aditivo, manifest-owned e com update
  explícito. O novo payload é instalado no mesmo `--scope`, `--target`, `--data-home`
  e `--skills-dir` da instalação existente. Conflito/modificação local aborta; não
  criar uma segunda instalação para contornar.
- Fonte implementada não atualiza skills já instaladas. Qualquer apply em user/project
  scope, release/tag ou publicação exige encomenda e autorização separadas. Após um
  update autorizado, conferir manifests, bytes, discovery, executável efetivo e
  remover temporários próprios; não reter backup.

## 11. Riscos e mitigação

| Risco | Mitigação/gate |
|---|---|
| Transformar o consumidor em ASDS executor por proximidade no repo | skill e lifecycle separados; planner nunca importa a fachada consumer; teste de dependência |
| Sessão root repetir a regressão | allowlist de escrita, role collision e qualificação por mutações/descendants |
| “Fresh” apenas nominal | snapshot/isolamento host-owned antes/depois e sessão única |
| Dois DAGs divergirem | `projectTaskManager()` derivado dos contratos/índice é a única projeção; journal só registra eventos |
| Checkbox virar prova de conclusão | receipt/review/integration/decision precedem CAS; verifyObjective continua separado |
| Concorrência corromper projeto/índice | reservations, exclusions, external actors, lock/CAS e fail-closed em unknown |
| Integração escondida na root | integrator delegado ou operação host observada; sem fallback manual do coordenador |
| Adapter prometer ferramenta inexistente | capability matrix factual e testes fake; docs específicas só com evidência |
| Mudanças locais atuais serem perdidas | snapshot inicial, patch mínimo, sem checkout/reset/cleanup; quatro observações excluídas |
| Compatibilidade aceitar evidência velha como nova | versões aditivas; replay histórico sem claims retroativos; migração explícita |
| Installer criar segundo runtime ou sobrescrever dono | update oficial, mesma instalação, preview/conflict checks, sem force/backup |
| Qualificação contaminar participante | prompt/fixture congelados, sessão nova, critérios mantidos pelo avaliador, eventos brutos |

## 12. Pacote executável e DAG de implementação

Os contratos abaixo são o backlog canônico desta mudança. Os IDs são estáveis,
`dependsOn` é precedência e `serializesWith` proíbe execução concorrente mesmo sem
dependência causal. Nenhum implementador pode ampliar seu write scope; descoberta de
uma necessidade fora dele retorna ao coordenador para replan explícito. Todos começam
da baseline dirty da seção 1 e excluem `docs/observations/**`, Accelerate, Prop4You,
skills instaladas, configuração global, releases e trackers.

### Bootstrap obrigatório da implementação futura

Uma autorização futura para implementar EC-01–EC-10 não autoriza EC-11, instalação,
release ou publicação. Antes da primeira task, o chamador seleciona um consumidor de
implementação e registra baseline/hashes.

Neste harness Codex, antes de o produto consumer existir, o bootstrap concreto usa
somente as capacidades de colaboração já expostas: a sessão root assume
voluntariamente o papel de coordenadora/observadora, limita suas próprias ações a
leitura, status/diff e `spawn_agent`/`send_message`/`wait_agent`, e não chama
`apply_patch` nem comandos que escrevam o produto. Isso é disciplina observável, não
enforcement host-owned nem sandbox. Cada implementador nasce em um descendant novo
com o contrato EC completo; depois de sua entrega, um segundo descendant novo, com
`fork_turns: "none"` quando disponível e sem a narrativa do implementador no packet
inicial, revisa o diff e a evidência. O filesystem é compartilhado, portanto
independência de sessão não prova isolamento de escrita; as serializações e write
scopes deste pacote continuam obrigatórios.

A root mantém um ledger mínimo na conversa ou em destino de evidência já autorizado,
sem criar automaticamente arquivo no repositório: `runId`, baseline HEAD/status e
hashes dos arquivos dirty tocáveis, task ID, role, descendant/session ID, assignment
e write scope, timestamps, changed paths observados, comandos/exit status reportados,
reviewer ID, findings/verdict, receipt e disposição. Antes/depois de cada worker ela
reobserva status/diff e atribui mudanças apenas pela baseline + write scope; colisão,
mudança fora de scope ou escrita da própria root invalida a task e exige recovery ou
handoff manual. Para cada EC:

1. despachar implementador distinto com este contrato, baseline, write scope e
   testes; a sessão root não corrige nem completa a entrega;
2. observar stop e snapshot/diff do implementador;
3. despachar revisor distinto, sem narrativa do implementador na primeira leitura,
   para conferir escopo, comportamento, preservação do dirty state e testes;
4. findings voltam ao implementador/replacement; o coordenador só aceita após
   re-review da revisão corrigida;
5. registrar receipt antes de liberar dependentes. O mesmo ator não implementa e
   revisa a própria task.

Enquanto o consumidor ainda não existe, esse bootstrap usa apenas operações reais
do harness já expostas e o ledger mínimo; não finge journal v3, coordinator boundary
host-owned, read-only técnico ou review snapshot isolado. Se descendants distintos
não estiverem disponíveis, a implementação não inicia e exige handoff manual entre
sessões independentes. O enforcement forte projetado em EC-05 continua gate do
produto e de EC-11, não pré-requisito circular para construir EC-01–EC-10. A tarefa
EC-11 continua fora desse bootstrap.

### EC-01 — Handoff, identidade e fronteira de papéis

- **Outcome:** contrato `asds.execution-handoff/1` validável, incluindo full/partial,
  realpaths, repo/workspace identity, fingerprints, autoria caller-owned, seleção,
  grants, destino e coordinator boundary; creator API/CLI não pertence ao planner.
- **dependsOn:** nenhum.
- **write:** `lib/execution-handoff.mjs` (novo),
  `scripts/create-execution-handoff.mjs` (novo),
  `skills/asds-execution-consumer/references/{handoff,roles}.md` (novos),
  `tests/{execution-handoff,execution-handoff-cli}.test.js` (novos).
- **read:** planning manifest/lifecycle/graph/validation atuais e baseline dirty.
- **serializesWith:** EC-08, pois ambos escrevem a árvore da nova skill; EC-07, pois
  ambos expõem CLI pública; EC-02, se validation compartilhada precisar mudar — essa
  mudança deve ser transferida a EC-02.
- **Implementação:** exportar `createExecutionHandoff` e validator; reabrir pacote e
  derivar campos imutáveis; normalizar partial de `planningContribution.usableTasks`
  e blockers v1 sem editar o pacote; manter selection/grants/destination/autoria como
  caller-owned; excluir capabilities; CLI stdout por padrão e output create-exclusive.
- **Testes:** full válido; partial v1 válido; usableTasks ausente/ambíguo; partições
  sobreposta/incompleta; consumível dependente de excluído; override de campo
  derivado; autoria/selection/grant/destination ausentes ou stale; capabilities
  recusadas no envelope; realpath/repo/workspace/fingerprint trocados; CLI sem output
  não escreve e output existente falha fechado.
- **Aceite:** nenhum envelope inválido chega a init; partial conserva excluded IDs e
  original remaining work sem mudar planning v1; API/CLI não chama planner, host,
  spawn ou shell de task e não concede autorização.

### EC-02 — Projeções planning/runtime e DAG canônico

- **Outcome:** planning projection imutável e runtime projection derivada do journal,
  sem segundo DAG nem inferência de progresso pelo checkbox.
- **dependsOn:** EC-01.
- **write:** `lib/planning-graph.mjs`, `lib/plan-projection.mjs`,
  `lib/validation.mjs`, `tests/{planning-graph,plan-projection,validation}.test.js`.
- **dirty overlap:** todos os três módulos e `tests/validation.test.js` já têm deltas;
  preservar seus hashes/base e o hardening local.
- **serializesWith:** EC-04 e EC-06 por `validation/plan-projection`; executar antes
  deles. Não serializa com EC-03 se os implementadores não tocarem fora do scope.
- **Implementação:** versionar a projeção sem mutá-la; projetar runtime de eventos v3;
  representar `excluded`, `progress_pending`, ready/waiting/blocked/completed;
  manter `serializesWith`, reverse edges, decisions e waves determinísticos.
- **Testes:** determinismo; planning bytes inalterados durante progresso; closure
  full/partial; blocker propagation; conflicts; orphan/title/wave drift; checkbox
  sozinho não gera completed.
- **Aceite:** todas as operações de scheduling partem do mesmo DAG; as três
  representações têm funções explícitas e divergência falha fechado.

### EC-03 — Journal v3, handlers legados e separação de papéis

- **Outcome:** journal v3 com coordinator/integrator/reviewer/verifier distintos,
  objective proof externo e handlers v1/v2 preservados.
- **dependsOn:** EC-01, EC-02.
- **write:** `lib/orchestration.mjs`, `lib/orchestration-store.mjs`,
  `tests/{orchestration,orchestration-store,pilot-journal-fixture}.test.js` e fixtures
  douradas estritamente necessárias sob `tests/fixtures/orchestration/`.
- **dirty overlap:** todas essas superfícies, inclusive fixture v1 e script de
  sanitização relacionado, já podem conter trabalho local; o script não entra no
  scope sem replan.
- **serializesWith:** EC-05, EC-06 e EC-07; EC-03 precede os três.
- **Implementação:** dispatch de replay por versão; congelar applyV1/applyV2;
  introduzir applyV3; impedir role/session reuse e root como worker; modelar partial,
  progress pending/commit e objective proof; preservar hash chain e CAS sequence.
- **Testes:** golden replay v1/v2 byte/state-equivalent; rejeição de evento v3 em
  legado; v3 happy/negative lifecycle; root collision; verifier stale; resume por
  journal sucessor sem conversão in place.
- **Aceite:** fixtures históricas continuam legíveis com semântica anterior; apenas
  v3 oferece as novas garantias; zero path permite root implementar/integrar/revisar.

### EC-04 — Broker idempotente de progresso em `tasks.md`

- **Outcome:** protocolo recuperável `progressRequested → progress_pending →
  progressCommitted`, com única troca de checkbox e readback.
- **dependsOn:** EC-02, EC-03.
- **write:** `lib/task-index-progress.mjs` (novo), `lib/git-scope.mjs`,
  `lib/validation.mjs`, `tests/task-index-progress.test.js` (novo),
  `tests/{git-scope,validation}.test.js`.
- **dirty overlap:** `git-scope`, `validation` e validation tests já estão dirty.
- **serializesWith:** EC-02 e EC-06; executa depois de EC-02 e antes de EC-06.
- **Implementação:** broker aceita estrutura, nunca Markdown livre; realpath/symlink/
  hardlink checks; lock/CAS; operação temporária no mesmo diretório com cleanup;
  recovery nos três pontos de falha; ledger separa dirt preexistente do checkbox.
- **Testes:** antes da escrita, depois da escrita/antes do evento, retry idempotente,
  hash/receipt diferente, drift de prosa/título/onda, concorrência, crash/lock,
  symlink/hardlink e escopo alterado por executor/reviewer/root genérico.
- **Aceite:** dependente só libera após commit; reexecução segura nunca altera outro
  byte; estado ambíguo fica bloqueado e recuperável, não marcado complete.

### EC-05 — Boundary host-owned e bridge portátil

- **Outcome:** adapter contract que prova coordinator read-only, workers limpos,
  snapshots, stop, tool-call e integração delegada sem inventar ferramentas.
- **dependsOn:** EC-03.
- **write:** `lib/host-bridge.mjs`,
  `skills/asds-execution-consumer/references/harness-contract.md` (novo),
  `tests/{host-bridge,continuity-boundaries}.test.js`.
- **dirty overlap:** host bridge e ambos os testes já estão dirty.
- **serializesWith:** EC-03, EC-06, EC-07 e EC-08; executar após EC-03.
- **Implementação:** adicionar observeWorkspace/coordinatorBoundary/progress broker;
  reobservar identity/fingerprint em cada await boundary; preparar sem executar;
  integrar por worker/operação nativa; retornar manual handoff sem enforcement.
- **Testes:** prompt-only boundary recusado; prepare/start drift; mount/realpath/repo
  swap; root mutation detectada; review snapshot drift; cancel/transport/stop
  distintos; capabilities unavailable/unknown.
- **Aceite:** nenhum adapter pode declarar segurança por texto; ausência de enforcement
  impede o primeiro worker; integração nunca recai na root.

### EC-06 — Receipts canônicos, reconciliação e progresso

- **Outcome:** receipt liga projection/canonical/planning/runtime/candidate/integration/
  review/progress revisions e falha fechado para campos novos.
- **dependsOn:** EC-03, EC-04, EC-05.
- **write:** `lib/contracts.mjs`, `lib/receipt-reconciliation.mjs`,
  `tests/{contracts,receipt-reconciliation}.test.js`.
- **dirty overlap:** todos os arquivos já estão dirty ou untracked; preservar o
  hardening local em vez de recriar o módulo.
- **serializesWith:** EC-03–EC-05 e EC-07; executar após EC-05.
- **Implementação:** incorporar receipt/progress provenance; validar observed command
  scope e baseline ledger; manter allowlist de equivalência mínima e unknown field
  irreconciliável; partial IDs excluídos nunca recebem receipt de aceite.
- **Testes:** stale/mismatched revisions; fake evidence; owner-only equivalence;
  execution-significant diff; receipt antigo sem provenance; progress recovery;
  preexisting dirty separado de candidate changes.
- **Aceite:** checkbox não certifica receipt e receipt não fecha checkbox; somente o
  par reconciliado atual permite progress commit.

### EC-07 — Fachada e CLI oficiais

- **Outcome:** API/CLI puras que dirigem o lifecycle oficial sem executar shell,
  modelo ou spawn internamente.
- **dependsOn:** EC-02, EC-03, EC-04, EC-05, EC-06.
- **write:** `lib/execution-consumer.mjs` (novo), `scripts/consume.mjs` (novo),
  `scripts/orchestrate.mjs`, `package.json`, `tests/execution-consumer.test.js`
  (novo), `tests/continuity-cli.test.js`.
- **dirty overlap:** `scripts/orchestrate.mjs` já está dirty.
- **serializesWith:** EC-03, EC-05, EC-06 e EC-08; executar após todos.
- **Implementação:** commands init/next/packet/event/reconcile/progress/verify/status;
  v3 default; source/current binding em mutações; predecessor link para legado;
  retornos complete/partial_consumed/blocked/paused/cancelled/manual_handoff_required.
- **Testes:** CLI sem parent dir creation; no shell/spawn spy; stale sequence/source/
  workspace; recovery progress; full e partial terminal states; status read-only não
  pausa nem encerra.
- **Aceite:** fluxo completo é reproduzível por eventos e readback; mensagens CLI não
  viram evidência; legacy CLI permanece compatível e documentada.

### EC-08 — Entry skill e modos condicionais

- **Outcome:** pedido natural com pacote entregue seleciona o consumidor; planner
  permanece parado e skills genéricas preservam standalone.
- **dependsOn:** EC-01, EC-05, EC-07.
- **write:** `skills/asds-execution-consumer/SKILL.md` e references restantes
  (novos), `skills/spec-driven-superpowers/{SKILL.md,references/consumer-boundary.md,
  references/protocol.md}`, `skills/superpowers/{using-superpowers,executing-plans,
  subagent-driven-development}/SKILL.md`,
  `skills/openspec/openspec-apply-change/SKILL.md`, `tests/{index,workflow}.test.js`.
- **serializesWith:** EC-01, EC-05, EC-07 e EC-09; executar após EC-07.
- **Implementação:** ativação exige handoff + selection + grant; bootstrap journal/
  boundary antes de implementação; worker modes só com assignment oficial; ausência
  de assignment segue texto standalone; planejamento nunca importa consumer skill.
- **Testes:** matrizes natural/direct/planning/consumer/standalone; pacote sem grant;
  grant sem pacote; no-spawn/no-boundary; links locais; busca de autoridades
  contraditórias limitada às superfícies ativas.
- **Aceite:** regressão não encontra rota de implementação root; executing-plans,
  SDD e OpenSpec apply continuam úteis fora do consumidor sem semântica alterada.

### EC-09 — Payload oficial e exemplos sintéticos

- **Outcome:** skill irmã incluída pelo instalador oficial e exemplos completos sem
  alterar nenhuma instalação real.
- **dependsOn:** EC-08.
- **write:** `lib/install.mjs`, `scripts/install.mjs`, `tests/{install,update}.test.js`,
  `examples/execution-consumer/**` (novo), `package.json` somente se EC-07 não tiver
  feito o script.
- **serializesWith:** EC-08; `package.json` também serializa com EC-07.
- **Implementação:** payload no mesmo target/skills-dir; manifests por harness;
  preview/update/reconcile-shared atuais; exemplos de full/partial/progress recovery
  marcados synthetic.
- **Testes:** preview zero writes; apply fixture; idempotência; conflict/modified file;
  multi skill-root; update ownership; symlink/hardlink; rollback ordinário e cleanup.
- **Aceite:** nenhum teste toca user scope real, instala dependência ou cria runtime;
  fonte ≠ instalação; conteúdo novo aparece no manifest correto.

### EC-10 — Integração determinística e regressões cruzadas

- **Outcome:** prova local do mecanismo com adapter fake, incluindo a regressão e
  todos os fail-closed paths; não é prova de harness/modelo real.
- **dependsOn:** EC-02–EC-09.
- **write:** `tests/execution-consumer-integration.test.js` (novo), fixtures novas sob
  `tests/fixtures/execution-consumer/`; correção de produto encontrada volta à task
  proprietária, não amplia este scope.
- **serializesWith:** nenhum após dependências; fixtures não podem reutilizar paths
  de `tests/fixtures/orchestration/login-pilot-v1/` de modo mutável.
- **Implementação:** fake host registra descendants, boundaries, snapshots, receipts,
  progress e objective proof; cenários full, partial, recovery, drift e manual handoff.
- **Testes:** arquivo de integração mais os arquivos oficiais afetados explicitamente,
  depois `npm run check`, `npm run validate` e `git diff --check`; preservar a seleção
  explícita para não descobrir fixtures em `docs/experiments/`.
- **Aceite:** happy path só completa após v3/progress commit/verify; regressão produz
  implementador e revisor distintos; negativos não geram mutação root nem falso done.

### EC-11 — Qualificação natural posterior, não autorizada

- **Outcome futuro:** qualificar uma versão candidata em sessão/harness real conforme
  a seção 9.3.
- **dependsOn:** EC-10 e autorização humana nova, explícita, que selecione ambiente,
  provider/modelo, custos, fixture e destino de evidência.
- **write futuro:** somente `docs/qualification/2026-10-09-execution-consumer/**` e
  fixture efêmera autorizada; qualquer outro path exige novo plano/escopo.
- **serializesWith:** EC-12 quando este promove claims; qualificação precede promoção.
- **Gate:** nesta encomenda, estado `not_authorized`; não criar sessão, fixture,
  eventos, diretório, prompt run ou custo. EC-01–EC-10 podem produzir apenas candidato
  local. Quando autorizado, aplicar todos os gates observáveis da seção 9.3.

### EC-12 — Documentação de candidato e promoção condicionada

- **Outcome:** documentar honestamente o que EC-01–EC-10 provaram; somente depois de
  EC-11 autorizado/passar promover o claim de consumidor qualificado.
- **dependsOn:** EC-10 para documentação de candidato; EC-11 para promoção oficial.
- **write:** `README.md`, `docs/architecture.md`, `PROJECT-STATUS.md`, `CHANGELOG.md`.
- **dirty overlap:** os três primeiros relevantes já estão dirty; preservar conteúdo
  local e registrar somente estado comprovado.
- **serializesWith:** EC-08 pelas autoridades/documentação e EC-11 pela promoção.
- **Testes:** links locais, coerência de versões/claims e `git diff --check`; não rodar
  qualificação, installer real, release ou publicação.
- **Aceite:** antes de EC-11, texto diz `candidato local`; após prova separadamente
  autorizada, identifica exatamente harness/version/model/capabilities e limitações.

### DAG e waves permitidas

```text
EC-01 -> EC-02 -> EC-03 -> EC-04 -> EC-06 -> EC-07 -> EC-08 -> EC-09 -> EC-10
                    \-> EC-05 ----^       \-----------------------------^
EC-10 -> EC-12[candidato local]
EC-10 -> EC-11[autorização separada] -> EC-12[promoção qualificada]
```

As serializações e o dirty overlap tornam a linha crítica deliberadamente quase
sequencial. Só trabalhos com write scopes efetivamente disjuntos podem formar wave,
após revalidar o checkout: EC-04 e EC-05 podem avançar em paralelo depois de EC-03;
EC-09 e a preparação de fixtures exclusivamente novas de EC-10 podem se sobrepor
somente se `package.json`, installer tests e fixture roots não coincidirem. A
quantidade de agentes disponível não revoga essas exclusões.

## 13. Critérios de aceite do produto

O consumidor só pode ser chamado de oficial quando todos forem verdadeiros:

- ASDS principal permanece planning-only em skill, protocolo, imports e comportamento;
- um handoff entregue e autorizado abre journal v3 antes de mutação de produto,
  enquanto handlers/replay v1/v2 preservam sua semântica histórica;
- taskManager/DAG canônicos governam ordem, dependências, blockers e exclusões;
- planning projection, runtime projection e checkbox materializado permanecem
  distintos e recovery de `progress_pending` é idempotente;
- coordenador não implementa, integra nem revisa task; workers/reviewers/verifier são
  sessões/atores compatíveis com a independência declarada;
- o host impõe projeto read-only à sessão coordenadora e audita brokers estreitos;
  sem isso o sistema retorna `manual_handoff_required` antes do primeiro dispatch;
- receipts de candidato, integração, review e reconciliação vinculam a mesma revisão;
- somente o coordenador atualiza o checkbox exato de `tasks.md`, sem alterar o plano;
- realpath, repo identity, workspace identity e fingerprints são revalidados em cada
  fronteira assíncrona e distinguem dirty state anterior dos deltas aceitos;
- pacote partial executa apenas `consumableTaskIds`, preserva `excludedTaskIds` e
  nunca declara o objetivo original completo;
- interrupção, stale state, capability unknown e falta de spawn falham fechados;
- `complete` exige todas as tasks/pacotes aceitos, índice reconciliado e
  `verifyObjective: pass` atual;
- testes unitários, integração fake, `npm run check`, `npm run validate` e
  `git diff --check` passam com limites relatados;
- mediante autorização separada, a qualificação natural reproduz o caminho com
  descendentes reais ou registra a falha sem promover a fonte;
- instalação/update, publicação e release permanecem gates separados, nunca efeitos
  colaterais da implementação da fonte.

EC-11 não está autorizado nesta encomenda. Até uma autorização posterior e sua
passagem, a formulação correta é “candidato local a consumidor oficial”.
Até instalação autorizada e readback no destino escolhido, não afirmar que uma
sessão externa usa essa versão. Até release/tag imutável e CI pertinente, não
afirmar publicação.
