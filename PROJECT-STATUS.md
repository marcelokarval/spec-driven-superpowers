# Estado evolutivo do ASDS

Atualizado em **2026-10-15**. Leia este documento antes de demandar ou evoluir o
projeto. Confirme o checkout antes de usar os hashes abaixo como estado corrente.

## Estado atual — C9/C10 demonstrados; C11 documental, aceite ROOT pendente

Fonte passiva local, não publicada/instalada nesta operação. As três correções do
oracle (readiness persistida, resync planning, paridade do schema), snapshot aprovado
pelo humano e a correção adicional autor ≠ coordenador passaram 589/589 e checks.
ROOT ainda deve revisar/aceitar as correções, inclusive a adicional, no oracle
`ses_ebfe922c2ffe0EpfJccvkv2HSf`; suíte não substitui esse aceite.

C10 foi executado pela ROOT em domínio sintético com fidelity/quality nativas reais,
registradas em sessões distintas. Pacote canônico `/tmp/opencode/asds-passive-c10-native/package`
está delivered; receipt matched em Node novo e retorno planning-delivered foram
reconferidos deterministicamente em C11. F-001/Q-001 nonmaterial/open permanecem;
Q extra não canônico e retry F rejeitado são registrados, não ocultados.

**Não demonstrado:** execução de produto, alvo real, grants/enforcement ou admissão
operacional Stage-3. O retorno de planejamento não é execution-handoff operacional.
Status original in_progress e motivo C16 pré-publicação foram preservados como
bookkeeping congelado, embora a entrega/retorno sejam posteriores. Não há claim
de ausência de gaps, autenticação contra host hostil ou aprovação final do oracle.

Ver [relatório final](docs/research/2026-10-14-opencode-review-authority/PASSIVE-FINAL-REPORT.md),
[worklog](docs/research/2026-10-14-opencode-review-authority/PASSIVE-CORRECTION-WORKLOG.md)
e evidência selecionada. Cadeia C11 pós-documentação: **589/589**, check/validate/
diff-check exit 0; log e hashes nesses artefatos para conferência independente.
Nenhum código/teste/SKILL foi alterado na consolidação C11.

## Histórico da correção C0 — estado antes de C9/C10 (2026-10-15)

A candidata de authority/daemon foi supersedida pelo mandato humano C0. Os testes
anteriores não aprovam o novo produto. ASDS é passivo/determinístico: o harness
conduz raciocínio e reviewers nativos; registros por etapa usam
`asds.harness-planning-review/1`. Sem qualificação nativa nesta implementação.
Fonte local não publicada; ROOT mantém revisão e prova C10 após congelamento.
Ver [worklog](docs/research/2026-10-14-opencode-review-authority/PASSIVE-CORRECTION-WORKLOG.md).
Snapshots de superfícies ativas aguardam revisão independente; hashes esperados
não serão atualizados pelo implementador. Stage-3/journals preservados; driver
legado host-bridge isolado, não distribuído no payload passivo.

## Registro evolutivo anterior — histórico, não instrução operacional

As seções seguintes preservam releases, observações e limites anteriores. Onde
descrevem authority/daemon/supervisor, estão supersedidas pelo mandato C0 acima.
Não representam instalação ou qualificação autorizadas.

## Direção definida

**ASDS entrega planejamento pronto, revisado e persistido:** TASKS e contratos
individuais com requisitos cobertos, fronteiras, hierarquia e dependências.
Entendimento, entrevista e pesquisa entram conforme a necessidade. Implementar
o trabalho descrito nas tasks pertence a um consumidor posterior.

## Release publicado

- [ASDS v2.1.0](https://github.com/marcelokarval/spec-driven-superpowers/releases/tag/v2.1.0),
  publicado em 2026-10-14. Inclui o construtor/reconciliador atômico de pacotes
  (`scripts/build-package.mjs`), projeção visual ASCII + Mermaid da DAG de tasks
  (`lib/dag-status-view.mjs`, `validate.mjs --print-dag`), reconciliação bottom-up
  de nós `package`, gravação atômica de reviews (`--record-review`), exportação de
  payloads para Plane (`--export-plane`), suporte a `openDecisions` em tasks
  bloqueadas (`blockedTaskIds`), consumidor durável `asds-execution-consumer`,
  protocolo/supervisor AGY e migração preview-first de receipts format 1.
- [ASDS v2.0.0](https://github.com/marcelokarval/spec-driven-superpowers/releases/tag/v2.0.0),
  publicado em 2026-10-08. Primeira release cuja fronteira principal é
  planejamento revisado e persistido; implementação futura pertence a um consumidor.
- O release anterior [v1.2.0](https://github.com/marcelokarval/spec-driven-superpowers/releases/tag/v1.2.0)
  permanece como registro imutável da fase de coordenação de execução.
- Documentos antigos que dizem "candidate" ou "release draft" registram o estágio
  anterior à publicação, conforme explicado no próprio release.

## Evolução local

- A branch de publicação atual é `v2.1.0`; o tag imutável identifica a fonte publicada.
- A decomposição adaptativa anterior foi incorporada e ampliada para composição
  recursiva separada da DAG de precedência.
- Pesquisa e experimentos delimitados que sustentam a fronteira de produto estão
  versionados como evidência histórica; não equivalem a qualificação universal.
- A alternativa OMO/OMO-Slim foi discutida. Escolha, customização e piloto estão pendentes.
- Em 2026-10-08 o plano de correção planning-only recebeu autorização de implementação.
  O checkout agora contém contrato de produto, grafo/coverage/lifecycle de planejamento,
  revisão vinculada à revisão, publicação/readback com rollback ordinário e retorno v2.
  Skills, schema e autoridades Accelerate foram realinhados na fonte. Essa evolução
  está publicada na fonte; instalações globais continuam sendo operação separada.
- A primeira correção pós-observação também está implementada localmente: `tasks.md`
  passou a governar projeções por diretório, títulos/IDs/ondas são conferidos,
  conflitos são exportados por tarefa, completion incoerente é rejeitada e o
  roteamento de decisões/bloqueios falha fechado para duplicatas, alvos não
  relacionados e envelopes malformados. Specs de mudanças agora precisam do delta
  OpenSpec estrutural antes de uma entrega poder ser aceita.
- A segunda correção pós-observação fecha duas ambiguidades operacionais: C15 não
  pode ser declarado satisfeito sem recibo durável de readback nem durante review,
  e a skill distingue ausência no PATH do executável OpenSpec fixado no checkout
  ASDS antes de declarar a dependência indisponível. A instalação de projeto deve
  ser atualizada pelo instalador oficial existente, sem cópia paralela de runtime.
- A pilha de execução experimental recebeu hardening local após o piloto 0007 →
  0005: progresso de tasks por checkbox não invalida o manifesto, receipts de
  projeção agora têm reconciliação explícita com contratos canônicos, baseline separa sujeira
  preexistente, journals v2 exigem isolamento/snapshots host-owned e escopo de
  comando observado, e o objetivo só termina após `verifyObjective`. O journal v1
  do piloto foi sanitizado e persistido como fixture de compatibilidade; isto não
  publica nem instala a evolução.
- O fechamento do verifier da pilha experimental agora também é host-owned:
  `hostCompleteVerifier` observa o stop, revalida workspace e snapshot, obtém o
  resultado do verifier por uma observação host-owned vinculada à sessão e revisão
  objetiva correntes e persiste uma receipt fechada antes de derivar
  `verifyObjective`. Resultado arbitrário do caller e append genérico são rejeitados.
  Replay puro agora trata esse evento apenas como histórico `structural_only`; a
  conclusão autoritativa vive numa associação não serializável do bridge com o
  adapter host e o journal exatos. Após restart, somente a reobservação da receipt
  durável pelo host reidrata essa autoridade. O store recebe bytes, não a função de
  derivação/capability. Isto continua evolução local, sem instalação ou publicação.
- O retorno planning-only recebeu hardening C4 local: `createPlanningReturn` não
  aceita mais `storeVerified` como autoridade, reabre o destino de um receipt
  versionado do planning store e confere revisão, manifest, índice, inventário e
  hashes atuais. Drift e divergência de estado retornam não entregue. Domínios
  sensíveis exigem receipt de uma raiz host-private ou assinada e durável. Como essa
  raiz ainda não existe, `createPlanningReviewAuthority` e
  `hostCompletePlanningReview` falham fechado; nenhum adapter JavaScript, receipt
  serializável ou fake host libera `delivered`. Domínios ausentes,
  inválidos ou protegidos rebaixados para `ordinary-low` falham fechados. Qualquer
  falha mantém ownership no ASDS
  e não seleciona consumidor; somente `delivered` libera o próximo owner.
  `ordinary-low` limita explicitamente a alegação de review à estrutura do manifest.
  O instalador autocontido também inclui `lib/handoff.mjs` e imports transitivos.
  Isto preserva C1-C3 e os artefatos de observação existentes; não publica nem instala.
- O adapter de fonte para AGY inclui os TypeNames exatos
  `spec-driven-superpowers` (coordenador planning-only) e
  `spec-driven-superpowers-reviewer` (revisor fresco e zero-write). O builder abre o
  package root canônico, recusa symlink, hardlink, zero-byte, drift e race de leitura
  e deriva revisão, candidate e inventários dos bytes atuais de
  `planning-manifest.json` + `tasks.md`. Referências `review` são hash-validadas para
  integridade, mas não entram nos inventários frescos. A validação pura do envelope
  rejeita binding stale e PASS com limitação; ela não prova independência nem autoriza
  entrega.
- A limitação externa é explícita: AGY 1.3.3 não oferece autoridade privada e durável
  nem identidade do parent. O `PostToolUse` observado inclui metadados `toolCall`,
  mas não o output aninhado, a identidade do parent ou autoridade durável necessários
  para vincular o resultado. Portanto as APIs públicas
  `createAgyReviewDispatchAuthority`, `attestAgyReviewDispatch` e
  `parseAgyReviewResponse` falham fechado e não emitem nem aceitam authority/receipt
  fornecidos pelo caller. Fidelity não pode ser consumida e quality não pode ser
  autorizada por este adapter de fonte; nenhuma alegação operacional de review
  independente é feita.
- O contrato instalado `.asds/agy-review-dispatch-contract.json` é somente discovery:
  fixa os paths e hashes oficiais de coordinator, reviewer e protocol, declara
  `runtimeHostStatus: unavailable`, e seu inspector exige ownership dos quatro
  payloads pelo manifest v3 exato do perfil oficial. O instalador autocontido projeta
  os agentes apenas nos perfis AGY oficiais de projeto e usuário, inclui seus bytes no
  manifest, faz readback integral e mantém update/uninstall fail-closed. Esta é
  evolução de fonte; nenhuma instalação real, inicialização OpenSpec, sessão AGY ou
  publicação foi feita.
- Uma camada fonte separada de supervisor AGY headless foi adicionada sem promover o
  hook nativo. Ela projeta um reviewer primary-only zero-write e contrato próprio,
  valida o manifest fechado, a bijeção com o inventário integral produzido pelo
  payload oficial e todos os bytes declarados, executa fidelity e quality
  em streams frescos, captura evidência privada e recusa replay/drift. Os resultados
  são captura não confiável: completion falha fechado e a fonte não cria authority ou
  receipt de planning-store. O bootstrap por FD é
  apenas configuração, não autenticação do parent; produção ainda exige um serviço
  sob boundary de SO e endpoint/store privados, ou assinatura equivalente cujo
  segredo não esteja acessível ao modelo. Só fake CLI foi usado; nenhum serviço,
  daemon ou turno AGY real foi iniciado.
- O transporte de captura foi alinhado ao stream headless observado no AGY 1.3.3:
  input `event: "user"`, `init` único vinculado a conversation/agent/cwd/model/tools/
  `request-review`, `step_update` fechado somente para leitura e `result` SUCCESS
  terminal na mesma conversation. Schema antigo por `type`, IDs divergentes,
  ferramentas de escrita/comando, subagent/delegação/background/permissão, ACTIVE
  sem terminal, resultado não-SUCCESS, evento posterior e campos desconhecidos são
  recusados. `runtimeHostStatus`, authority e completion continuam `unavailable`;
  o supervisor permanece somente captura não confiável e não foi instalado nem
  executado contra uma sessão real.
- A correção pós-rodada AGY distingue a entrega inicial, cujas caixas futuras nascem
  abertas, do progresso pós-handoff válido em `tasks.md`. O planner não pode transformar
  o hash/manifest normalizado em ordem para apagar `[x]`; reopen exige protocolo do
  consumidor e receipt/journal correspondente ou contradição concreta. O inventário
  de review agora normaliza o mesmo progresso canônico. Restauração byte-exata só se
  aplica após corrupção provada e preserva a revisão entregue; alteração material
  cria candidato novo e exige fidelity/quality frescas. Ao alcançar o preflight de
  review num runtime AGY unavailable, o coordenador encerra esse caminho uma vez antes
  do reviewer e não inventa escrita, validação, banco, assinatura, receipt ou review.
  Isto é evolução local de fonte;
  não instala, publica nem modifica projeto-alvo.
  O comparador público retorna `existing package bytes unchanged` para igualdade e
  rejeita regressão de checkbox sem receipt de reopen; ele não fabrica prova de entrega
  ou corrupção e, sozinho, não autoriza o status de restauração.
- A correção round7 muda a ordem do gate AGY: locator/lineage é resolvido primeiro e
  a descoberta somente leitura, limitada a `openspec/changes/*`, retorna
  `locator-required` para zero ou múltiplos pacotes. O único pacote é inspecionado e
  classificado como no-op/progresso/contradição/material antes do preflight de review.
  `runtimeHostStatus: unavailable` bloqueia somente review fresco de candidato material;
  não impede leitura/validação nem invalida uma entrega existente sem mudança material.
  Ausência de lineage não concede qualquer escrita. O comparador de progresso é neutro
  (`existing package state with updated progress`, review indeterminado); somente
  lifecycle/readback validado permite reconhecer o baseline como entregue.

## Evidências e limites

- Continuação positiva OpenCode /2 implementou candidato de fonte:
  binding com autor/política/contexto, core causal, store fsync single-writer,
  cliente de perfil protegido fixo, publicação/readback, admission sobre snapshot
  imutável e harness. Conformance sintética passou; factory produção continua
  recusando roots/callbacks caller. Worker/default plugin usam container V2 real e
  model Ref `id`; init/next/pause/cancel são continuidade administrativa de admissão,
  com identidade canônica independente do actionID. Execução de produto não foi
  fornecida nem ligada a esse registro; verify/progress/reconcile são UNSUPPORTED.
  Canais exigem GIDs/diretórios separados, consumer UID efetivo, ACLs sem extensões
  e isolamento concreto da API geral. Provas de progresso/objetivo continuam gates
  do host de execução, não booleanos caller. **Aceitação independente/grants pendentes;
  não declarar runtime/consumer qualificado.**
  [Estado/gates e inputs exatos](docs/research/2026-10-14-opencode-review-authority/POSITIVE-REPORT.md).

- Em 2026-10-14, correção delimitada OpenCode adicionou somente códigos/stages aos
  diagnósticos do planning store, preservando authority/completion/verification
  fail-closed. Receipt sintético coerente alcança a rejeição final; bindings alterados,
  fake callbacks e reobservação em Node fresco não promovem entrega. Isso é prova
  negativa estrutural, não review autêntico, E2E ou consumer revalidado. APIs V2
  oficiais não demonstram boundary externa; CLI v2.0.28 não prova servidor.
  Receipt /1 ainda presume ator/sessão únicos para ambos os reviews; candidate hash
  ainda exclui autor/política. Ver [relatório e gates](docs/research/2026-10-14-opencode-review-authority/REPORT.md).
  Qualificação permanece bloqueada, sem instalação, ativação ou publicação.

- [Rodada Prop4You login/recovery de 2026-10-08](docs/experiments/2026-10-08-login-readiness-round2.md):
  novo Codex sem histórico conversacional, no worktree autorizado existente. Ativação
  local atualizada pelo instalador padrão; nove folhas e quatro pacotes no mesmo índice,
  revisão independente com correção de dependência, readback de 22 arquivos e fontes
  preservadas. ASDS passou, mas OpenSpec rejeitou o delta com header inválido: não
  qualifica entrega completa da pilha. Sondagens adicionais identificaram gaps de
  blocker routing, autoridade do índice na exportação e consistência de completion.
  Nenhuma publicação/instalação global ou implementação Prop4You nessa rodada.
- A correção foi revalidada contra esse mesmo pacote negativo preservado: o ASDS
  agora o rejeita por delta OpenSpec ausente e projeção task-manager stale; o CLI
  recompila a projeção somente a partir do índice e expõe `serializesWith` para os
  pares 0003/0008 e 0005/0007. O OpenSpec continua rejeitando o header inválido,
  portanto a evidência negativa não foi silenciosamente reparada.
- Gates locais após a correção: ASDS `298/298`, `npm run check`, `npm run validate`,
  `git diff --check` e OpenSpec strict `5/5`; Accelerate `bash tests/all.sh` e
  `git diff --check` passaram. A primeira tentativa restrita do gate Accelerate
  parou apenas no socket de browser monitoring; a repetição autorizada fora dessa
  restrição passou integralmente. Isso prova os gates locais, não publicação/release.
- Gates locais desta pilha de hardening em 2026-10-09: todos os arquivos de teste
  selecionados em `tests/*.test.js` passaram em sequência, além de `npm run check`,
  `npm run validate` e `git diff --check`. A regressão no pacote Prop4You observado
  confirmou a correção do hash de `tasks.md`; a reconciliação formal de 0007/0005
  permanece rejeitada até nova revisão independente mapear critérios canônicos
  omitidos pela projeção. Os receipts históricos que apenas trocaram a revisão não
  têm a nova proveniência e não são tratados como prova. Não houve nova execução
  funcional do produto nem prova de deploy.
- Em 2026-10-10, os gates reais desta árvore passaram: bateria focal
  reviewer/protocolo/installer/update/workflow `91/91`; suíte oficial descoberta
  somente em `tests/*.test.js` `559/559`; `npm run check`; `npm run validate`; e
  `git diff --check`. Os testes focais cobrem o fail-closed das três APIs públicas,
  validação pura sem autoridade, package Prop4You real-shaped, paths oficiais exatos,
  manifest v3/ownership, drift/link, install/update/uninstall, migração e crash
  recovery. Isto comprova a fonte e as fixtures locais, não um hook nativo AGY. Sem a
  capacidade privada/durável ausente no AGY 1.3.3, o runtime continua indisponível e
  nenhuma sessão de reviewer foi qualificada.
- Após a correção de progresso pós-handoff, a bateria focal final de
  AGY protocol/agent/validation/workflow passou `55/55`, o supervisor passou `35/35`
  e a suíte oficial completa passou `599/599`; `npm run check`, `npm run validate` e
  `git diff --check` também passaram. Esses gates provam a fonte/testes locais e a
  normalização de progresso; não provam instalação, sessão AGY, banco, assinatura,
  reviewer real ou alteração no projeto-alvo.
- Receipts históricos format 1 agora têm migração local explícita e preview-first,
  vinculada ao SHA-256 exato do próprio receipt. A adoção valida identidade, paths
  canônicos únicos, raízes oficiais estreitas, arquivos regulares sem hardlink e
  hashes antes de reconciliar o payload e emitir/readback do manifest atual. Cada
  path também precisa pertencer ao payload oficial atual ou a um tombstone exato
  versionado na fonte; sibling skills, extensões de schema, paths estrangeiros e
  ownership ambíguo de `AGENTS.md`/config são rejeitados; não há
  backup nem runtime paralelo. O apply exige o digest canônico exibido pelo preview;
  um journal CAS-bound liga opções, features e receipts irmãos exatos e permite
  retomada após SIGKILL sem aceitar artefato desconhecido. Um journal ativo bloqueia
  install/update/uninstall comum; temporários forward e reverse de replace usam
  uma identidade journal-bound e só são recuperados pelas imagens old/new com
  bytes/modo exatos. Instalações user sem
  sibling podem atualizar o payload compartilhado histórico; com siblings exigem
  reconciliação explícita em preview, apply e resume. Nenhum target ou home foi
  migrado por esta mudança.
- [Qualificação Codex/Agy](docs/qualification/2026-10-03-harness/report.md): entrada
  natural das skills observada em casos delimitados; fidelidade a requisito no Agy
  permaneceu parcial. Não comprova o fluxo em qualquer projeto.
- [Bateria Luna/high](docs/experiments/2026-10-03-luna-high/REPORT.md): 10 sessões,
  21 turnos, quatro interrupções por prazo e um caso com contaminação de leitura.
  Não demonstrou entrega confiável de planejamento excelente.
- [Pesquisa de fundamentos](docs/research/2026-10-03-planning-core/REPORT.md):
  contratos ativos de ASDS/Accelerate ainda atribuem execução ao ASDS; prontidão
  estrutural não prova qualidade; hierarquia recursiva é rejeitada pelo núcleo.
- **A leitura natural deste estado evolutivo por uma sessão nova ainda não foi
  comprovada.** O AGENTS da raiz exige a leitura; isso não equivale a uma prova de carga.
- Projeção fiel em Plane permanece não implementada; o hardening local não prova
  adaptação universal de todos os harnesses aos novos contratos de revisão v2.

## Pendências e próximos passos

1. Qualificar novamente os evals planning-only em sessões novas, sem usar resultados antigos,
   incluindo um pacote que exercite decisões materiais, conflitos e revisão do índice.
2. Tratar instalação como operação separada; publicação de fonte não atualiza outras
   skills globais ou projetos automaticamente.
3. Avaliar os artefatos produzidos e qualificar a leitura desta entrada em sessão nova.
   Depois comprovar a entrega no destino autorizado, incluindo Plane quando selecionado.

Para aprofundar, siga o [índice da pesquisa](docs/research/2026-10-03-planning-core/README.md).
Atualize este estado quando houver implementação, decisão arquitetural, qualificação
ou release novo; registre a evidência e preserve a distinção entre proposta e entrega.
