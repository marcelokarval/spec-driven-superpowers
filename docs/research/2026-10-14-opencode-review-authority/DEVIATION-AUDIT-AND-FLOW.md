# Auditoria do desvio e fluxo proposto — ASDS passivo + OpenCode/omo-slim

## 0. Mandato, base e conclusão

**Estado: auditoria e proposta, não implementação aprovada.** Nesta fase, somente este arquivo pode ser gravado. Nenhum código produtivo, teste, configuração, instalação ou consumidor foi alterado; nenhum arquivo foi removido. Não foram executadas novas revisões de planejamento, chamadas de qualificação ou suíte de testes.

Princípio fixado: **o harness pensa e chama seus agentes; ASDS fornece instruções, contratos e ferramentas determinísticas passivas**. A skill contém instruções para a LLM do harness, mas não possui LLM, provider, API key, daemon, conta OS, namespace, socket ou outro OpenCode. Um script registra resultados explícitos; não inventa PASS nem inicia reviewers.

**Conclusão:** há dois desvios diferentes:

1. **Anterior:** o planejamento sensível exige uma autoridade privada que o toolkit não consegue oferecer; paralelamente, existem launchers e defaults que fabricam declarações de revisão.
2. **Introduzido:** tentou-se resolver essa contradição implementando um serviço isolado, expandindo o produto em vez de corrigir seu contrato com o harness.

Os 628 testes anteriores demonstram conformidade com aquele desenho, **não adequação à finalidade agora esclarecida**. Seu aceite técnico não deve ser reutilizado como aceite desta proposta.

### Base e limites de cobertura

- HEAD observado nesta auditoria: `9bbc3fe92e83492c8766450f489aa53d0c85b7f0` (`Release v2.1.0 (#7)`). É diferente do HEAD histórico `dff5f7a...` da rodada anterior; não atribuo essa mudança a esta auditoria.
- `git status`/`git diff`: 12 arquivos rastreados modificados, 399 inserções/30 exclusões, mais arquivos não rastreados. O manifesto anterior cobre **27 arquivos de fonte/teste/template**, não todas as modificações/documentos.
- Enumeração: 788 arquivos rastreados; 653 nos escopos centrais: lib 25, scripts 13, adapters 39, skills 90, references 16, tests 59, docs 411.
- Método: `git ls-tree`, `git show HEAD:path`, `git diff`, arquivos não rastreados, busca de chamadas de processos/rede e de gates de autoridade, leitura das funções e consumidores decisivos. Não houve leitura integral de todos os transcripts históricos; inventário amplo não equivale a auditoria semântica linha a linha dos 788 arquivos.
- Oracle existente `ses_ec359cc34ffeZnlpy4HBwPM7Se`: análise read-only da base anterior. Coordenador: conferência do diff, das funções decisivas, classificação local e síntese. Sem delegação aninhada.
- Linhas da tabela 1A referem-se ao **HEAD**, salvo indicação. Linhas da 1B são da **árvore de trabalho**; funções são a referência estável quando houver deslocamento.
- A proposta de provisionamento está suspensa. Não há instalação separada criada por esta operação. Histórico, quatro arquivos alheios em `docs/observations/` e progresso existente devem ser preservados.

## 1A. Desvios pré-existentes e componentes a preservar

| ID | Arquivo / linhas / função | Diagnóstico e correção proposta |
|---|---|---|
| A01 | `lib/planning-store.mjs:121–141`, `createPlanningReviewAuthority`, `hostCompletePlanningReview`, `verifyHostReviewReceipt`; `:148–186`, `verifyPlanningReceipt` | Caminho sensível termina incondicionalmente em autoridade indisponível. É um bloqueio de contrato, não ausência de qualidade das tasks. Substituir por registro/verificação determinísticos de evidência nativa, não por `return true`. Preservar readback e detecção de drift. |
| A02 | `lib/planning-store.mjs:157–173`; `lib/agy-review-supervisor.mjs:476–506`; `tests/agy-review-supervisor.test.js:183–198` | Receipt `/1` tem um único actor/session e exige que ambos os reviews usem esses valores. O supervisor/teste usa sessões diferentes. Versionar representação por review; não reescrever silenciosamente `/1`. |
| A03 | `lib/install.mjs:310–338`; `lib/agy-review-protocol.mjs:211–226` | Contrato instalado fixa `host-private`, `runtimeHostStatus: unavailable`, enforcement adicional. Descoberta de capacidade virou pré-requisito impossível de entrega. Preservar hashes/inventário do instalador; remover essa exigência do planejamento nativo. |
| A04 | `lib/agy-review-protocol.mjs:537–552`, `createAgyReviewDispatchAuthority`, `attestAgyReviewDispatch`, `parseAgyReviewResponse`; `:483–486` | APIs públicas recusam sempre; quality depende de fidelity consumida por um caminho fechado. Extrair parsers/validação de envelope (`:555–560`) e substituir o protocolo de registro. Não declarar o host qualified por configuração. |
| A05 | `adapters/agy/agents/spec-driven-superpowers.md:79–124`; `SKILL.md:140–177`; `skills/spec-driven-superpowers/SKILL.md:140–177` | Instruções proíbem reviewer/fallback quando o hook privado não existe. Devem orientar o harness a usar capacidade nativa observada; indisponibilidade real de reviewer continua blocker, mas falta de daemon ASDS não. Raiz e skill distribuída são arquivos distintos, não symlink. |
| A06 | `lib/agy-review-supervisor.mjs:4,346–389,393–450,454–506` | `spawn`, stdin com prompt e flags `--print/--agent/--model` iniciam inferência headless. Viola passividade mesmo sem HTTP direto ao provider e mesmo retornando `authoritative:false`. Retirar launcher do caminho/payload operacional; extrair somente helpers puros úteis. |
| A07 | `lib/package-builder.mjs:552–619`, `recordPlanningReviews`; `scripts/build-package.mjs:48–53`; `tests/package-builder.test.js:149–156` | Reviewer string basta para defaults de `pass`, findings vazios, `synthetic:false`, texto “Independent review completed”, duas revisões e boundaries ready. Registrar deve exigir resultados explícitos; não pode gerar semântica nem alterar contratos já revisados para torná-los ready. |
| A08 | `lib/package-builder.mjs:455–548`, `syncPlanningPackage` | Defaults incluem `persistenceGranted:true`, autorização textual padrão e readback `matched` antes da escrita final do manifest. Há coleta real de referências, mas isso não prova autorização humana nem leitura posterior do pacote final. Exigir grant recebido; separar compilação, publicação e readback efetivamente executado. |
| A09 | `lib/planning-review.mjs:16–57`, `validatePlanningReview`/`reviewSequence`; `lib/planning-lifecycle.mjs:29–42,151–161` | Base pura útil, porém `priorReviewKind` não vincula o digest da fidelity exata; falta representação forte de sessões por etapa. `planningCandidateSha256` não inclui author/reviewPolicy, embora readback inclua. Fortalecer binding/versionamento sem inferir autoria criptográfica. Preservar DAG, findings e integridade. |
| A10 | `skills/superpowers/brainstorming/scripts/server.cjs:163–176,273,339`; `scripts/start-server.sh:118–119` dentro dessa skill; `visual-companion.md:37–97`; `SKILL.md:37` da brainstorming | Servidor HTTP/WebSocket iniciado com nohup. Não é LLM, mas contraria zero servidor/socket no framework. Remover do payload/fluxo passivo; manter opção de artefato estático sem servidor se autorizada. Não excluir toda a skill brainstorming. |
| A11 | `lib/install.mjs:361–384` | Distribui supervisor/host-bridge/módulos de execução para planner e consumer e copia coleções com servidor visual. Não basta editar o prompt: corrigir o fechamento transitivo do payload. Preservar proteção de arquivos alheios, migração e manifests de instalação. |
| A12 | `references/adapters/antigravity.md:49–75,115–152`; `references/contracts.md:74–89`; `references/intake.md:73–79`; cópias sob `skills/spec-driven-superpowers/references/`; `docs/architecture/planning-delivery-contract.md:182–206` | Doutrina ativa repete autoridade externa/indisponibilidade. Atualizar todas as cópias e o contrato canônico; documentos históricos continuam históricos. `references/capabilities.md:8–25` já distingue planejamento de capacidade de spawn: preservar esse contraponto. |
| A13 | `lib/host-bridge.mjs:76–100,564–650,778` | Mistura validadores de observação e drivers que chamam `host.prepare/start`. Não é um provider próprio, mas o driver ativo não pertence à camada ASDS passiva. Mover responsabilidade de despacho ao harness; manter registradores e validações determinísticas. Não executar migração externa nesta correção sem grant. |
| A14 | `scripts/orchestrate.mjs:23–69`; `skills/asds-execution-consumer/SKILL.md:22–25,121–122`; `references/consumer-boundary.md:18–48` | **Não é desvio por si:** máquina de estados, packets e journals determinísticos de consumidor posterior. Preservar separação Stage-2/Stage-3 e grants; nomes executor/dispatch não demonstram chamada LLM. Não apagar o consumer inteiro. |
| A15 | `adapters/opencode/agents/spec-driven-superpowers.md:3–15`; `spec-driven-superpowers-reviewer.md:3–12` no mesmo diretório; equivalentes Claude/Codex | **Base aproveitável:** prompts de coordinator/reviewer nativos, read-only para reviewer. Configuração declarada não prova carregamento; o harness verifica a sessão real. Não precisam de segundo host. |
| A16 | `docs/experiments/2026-10-03-luna-high/run.py:45–54`, `continue.py:3–13` | Runners históricos chamam `codex exec`. Preservar evidência, marcar não operacionais e excluir de distribuição/descoberta de testes do framework passivo. Não reexecutar como efeito da auditoria. |
| A17 | `lib/runtime-preflight.mjs:8–25`; `lib/git-scope.mjs:21`; `scripts/check.mjs:11`; `scripts/prepare-eval-review.py:1,34–37`; `skills/superpowers/writing-skills/render-graphs.js:72` | **Preservar com escopo:** versões, Git, syntax check, template NOT RUN e Graphviz não são inferência. Determinismo não significa proibir todo subprocesso; significa não criar raciocínio/review semântico nem runtime autônomo. |

### Testes anteriores que precisam de reconciliação

- Alterar os comportamentos esperados em `tests/agy-review-protocol.test.js:213–229,265–270`, `tests/agy-agent.test.js:71–73,174–189`, `tests/agy-review-supervisor.test.js` e `tests/handoff.test.js:178–226`: deixar de exigir indisponibilidade artificial/launcher.
- Corrigir `tests/package-builder.test.js:149–156`: somente um nome de reviewer não pode aprovar duas revisões.
- Preservar e ampliar `tests/planning-review.test.js`, `tests/planning-lifecycle.test.js`, `tests/planning-store.test.js`, testes de DAG/cobertura/progresso e proteção de instalação.
- Atualizar inventário/distribuição em `tests/update.test.js`, testes AGY/installer e snapshots de `tests/workflow.test.js:96–118` **após revisão explícita do novo texto**.
- Conservar regressões de `tests/host-bridge.test.js`, `tests/execution-consumer*.test.js` e `tests/continuity-*.test.js` na responsabilidade correta. Fixtures que simulam host não são prova de revisão real.

## 1B. Candidata local — classificação dos 27 arquivos

Legenda: **R** retirar/reverter o componente ou delta indicado; **S** simplificar/refatorar; **P** preservar comportamento útil. São propostas para implementação posterior, não operações realizadas. Reverter aqui nunca significa `git reset`/restauração cega que apague trabalho alheio.

| # | Arquivo e ponto decisivo atual | Ação proposta / motivo |
|---|---|---|
| 1 | `adapters/opencode/review-authority/index.mjs:9–28`, setup/listen | **R:** plugin de autoridade proprietário que monta worker/core/servidores. Não confundir com os prompts nativos de `adapters/opencode/agents/`. |
| 2 | `adapters/opencode/review-authority/server.mjs:10,47–69` | **R:** HTTP sobre sockets, rotas de review/admissão e listeners. |
| 3 | `adapters/opencode/review-authority/worker.mjs:9,22–48` | **R:** cria/prompta/aguarda sessões a partir do toolkit. O harness fará esses passos. |
| 4 | `adapters/opencode/review-authority/terminal.mjs:10,36` | **S/R:** extrair apenas parser de evidência sem efeitos se útil; retirar registro de hooks e enforcement de contexto do framework. Não usar hook como nova dependência obrigatória. |
| 5 | `lib/execution-consumer.mjs:1–49,validateCurrent` | **R/S:** retirar cliente online, enrollment, handles e bloqueio do consumer legado. Preservar validação determinística e grants Stage-3 existentes. |
| 6 | `lib/execution-handoff.mjs:7–26,createExecutionHandoff` | **R/S:** retirar admissão assíncrona `/2` dependente de serviço; manter envelope/contexto/escopo explícito sem iniciar execução. |
| 7 | `lib/handoff.mjs:93–97`, `createPlanningReturn` | **S:** trocar verificação de authority/contexto online pelo novo registro de revisão + readback. Preservar recusa de delivered quando faltam evidências/bytes. |
| 8 | `lib/install.mjs:362–380`, `sourcePayload` | **R/S:** retirar distribuição authority/templates/provisionamento e também supervisor/servidor anterior; manter ownership e instalação autocontida de helpers passivos. |
| 9 | `lib/planning-review-v2.mjs:21–60,62–86,89–125,128–179` | **S:** aproveitar inventário, binding, parse, normalização/progresso. Retirar restart/boot/admissão e finalização que marca delivered/readback preparado antes da publicação. Não reaproveitar `/2` com significado novo. |
| 10 | `lib/planning-store.mjs:129–229` | **S:** retirar trust root e branches online; registrar/verificar revisões nativas explícitas; preservar publish/readback e diagnósticos válidos. Retornar ao HEAD sem corrigir A01/A02 seria insuficiente. |
| 11 | `lib/review-authority-client.mjs:10,50–82,104–206` | **R:** perfil `/etc/asds`, UID/TCB/netns, sockets, WeakMap de capability e RPC online. |
| 12 | `lib/review-authority-consumer.mjs:3–39` | **R:** segundo registro administrativo de admissão, distinto do journal consumidor e desnecessário ao planning-only. |
| 13 | `lib/review-authority-core.mjs:10`, core/reviewer/admit/consumer | **R:** autoridade que orquestra reviewers, jobs e admissão. Invariantes úteis viram testes do registrador passivo, não novo core autônomo. |
| 14 | `lib/review-authority-profile.mjs:9,33,48,64` | **R:** contas/grupos/ACL/network namespace como requisito ASDS. |
| 15 | `lib/review-authority-store.mjs:13`, `openReviewAuthorityStore` | **R/S:** retirar store exclusivo da autoridade. Reutilizar somente técnicas de escrita/lock/readback nos módulos locais existentes, sem outro serviço ou base paralela. |
| 16 | `scripts/consume.mjs:8–18,35–113` | **R/S:** retirar admit/handle/RPC online. Preservar CLI determinística do consumidor; emissão de packet não é execução. |
| 17 | `scripts/planning-review.mjs:10–17` | **S:** substituir request remoto por CLI de registro de resultados já produzidos pelo harness; nome/flags finais ainda a aprovar. Não manter auto-dispatch. |
| 18 | `scripts/provision-review-authority.mjs`, entrypoint `--initialize` | **R:** provisionamento de store/perfil da infraestrutura rejeitada. |
| 19 | `scripts/qualify-review-authority.mjs`, fases prepare/reobserve | **R/S:** retirar qualificação de daemon/restart. Substituir por roteiro de prova do harness nativo e teste determinístico do registro, sem CLI iniciar LLM. |
| 20 | `skills/spec-driven-superpowers/SKILL.md:140–177` e seção AGY seguinte | **S:** remover `/etc/asds`, payload protegido e authority; coordenador do harness chama F/Q e scripts. Reconciliar também `SKILL.md` raiz e referências copiadas. |
| 21 | `templates/review-authority/README.md:7–119` | **R do payload ativo:** runbook de contas, namespace, serviço e sockets. Preservar histórico do desvio em docs, não instrução executável. |
| 22 | `templates/review-authority/profile.proposed.json:1–36` | **R:** configuração de serviço/UID/netns/provider não pertence ao ASDS passivo. |
| 23 | `tests/handoff.test.js`, casos authority/forged-receipt/diagnostics | **S/P:** preservar detecção de inconsistência, drift e ausência de evidência; substituir expectativas de bloqueio por trust root. Um JSON coerente não prova origem: o teste não pode prometer o contrário. |
| 24 | `tests/review-authority-terminal.test.js` | **S:** aproveitar casos de respostas incompletas, kind/scope e evidência alterada em testes do envelope passivo; retirar obrigação de hook. |
| 25 | `tests/review-authority-worker.test.js` | **R/S:** retirar worker produtor de inferência; fixtures de sessões passam a entradas do registrador. |
| 26 | `tests/review-authority.test.js` | **S:** preservar positivos/negativos materiais, progresso, ordem e persistência; retirar sockets/UID/boot/admissão. Não transformar mock em prova nativa. |
| 27 | `tests/workflow.test.js:113,273–277` | **P/S:** manter gate forte de snapshot; alterar o hash somente após revisão do novo conteúdo passivo. O hash anterior foi aceito para outro desenho. |

### Arquivos fora dos 27 — também fazem parte da correção

| Caminho | Tratamento proposto |
|---|---|
| `PROJECT-STATUS.md` | Atualizar estado: candidata anterior é evidência histórica, não arquitetura aceita; fonte passiva ainda não corrigida. Não apagar evolução. |
| `docs/architecture/planning-delivery-contract.md` | Refatorar contrato ativo: revisão nativa rastreável, não autoridade criptográfica/OS própria. |
| `references/adapters/opencode.md` | Refatorar para chamada nativa pelo harness, capacidade observada e limites; remover exigência de instalação dedicada. |
| `docs/architecture/review-authority-v2.md` | Retirar da doutrina ativa/marcar superseded; preservar histórico se mantido. |
| `docs/research/2026-10-14-opencode-review-authority/PROVISIONING-DECISION.md` | Preservar como proposta rejeitada/suspensa; não executar nem converter em instrução ativa. |
| `.../POSITIVE-PATH.md`, `.../POSITIVE-REPORT.md`, `.../REPORT.md`, `.../WORKLOG.md` | Preservar resultados e limitações; futura nota de supersessão deve distinguir correção técnica e adequação de produto. |
| `.../FINAL-SOURCE-SHA256.txt` | Preservar como identidade histórica da candidata de 27 arquivos; não reutilizar para a correção. |
| `.../source-evidence/README.md` e os 12 `.txt` de fonte OpenCode | Preservar evidência documental versionada; não importar nem distribuir como runtime. Não comprovam host carregado. |
| `docs/observations/agrelli-visual-2026-10-02-{collector.json,events.jsonl}` e `p4y-131-2026-10-02-{collector.json,events.jsonl}` | Preservar intocados: preexistentes/alheios; não são resíduos da authority. |

## 2. Contrato de correção proposto

### 2.1 Fronteira de confiança correta

O harness é o executor confiado operacionalmente pelo usuário. Ele lê a skill, usa seu modelo configurado, chama subagentes nativos, lê o resultado real da sessão e fornece dados ao ASDS. ASDS valida consistência/integridade e persiste o pacote. **Não autentica criptograficamente um harness hostil nem resiste a um processo comprometido do mesmo UID que reescreva todos os dados.**

O termo correto é **revisão independente rastreável pelo harness**, com evidência de sessão/candidato/resultado. Um hash protege contra divergência em relação ao registro observado; não transforma uma narrativa em autoria comprovada. Se o harness não consegue mostrar a origem do resultado, registra a limitação e não declara revisão nativa concluída.

### 2.2 Registro explícito por revisão — proposta de schema, não API existente

Introduzir versão nova, por exemplo `asds.harness-planning-review/1`, sem reinterpretar `asds.independent-review-receipt/1` ou `/2`. Campos mínimos:

```text
packageId, revision, candidateSha256, inventoryDigest, policyDigest
author: { actorId, sessionId }
assignment: { id, requestedBySessionId, kind, candidateSha256, scopeTaskIds }
reviewer: { actorId, sessionId, agentRole }
kind: fidelity | quality
priorReviewDigest: null | digest da fidelity aceita
verdict: pass | fail | blocked
findings: [ id, severity, status, evidence, expectedCorrection, disposition ]
limitations, sourceReferenceIds, taskIds
evidence: { harness, sessionId, messageIds, requestDigest, resultDigest,
            persistedResultPath, observedBySessionId }
envelopeDigest
```

Os campos são fornecidos explicitamente pelo harness a partir de observações; o script não cria IDs de sessão, texto “review completed”, PASS, independência ou grants. Modelo/variant podem ser registrados quando observáveis, mas não são segredo nem condição de um provider específico. Timestamp é input observacional, não prova de causalidade; IDs/digests vinculam a sequência.

Invariantes:

1. Autor e reviewer têm identidades/sessões explícitas. `sessionID_F != sessionID_Q`, ambas distintas da sessão autora; reviewers não são o autor. O mesmo nome de perfil revisor pode ser usado em duas instâncias distintas — não confundir role com identidade de execução.
2. Subagentes com parent coordenador são legítimos no omo-slim. Não manter a proibição de `parentID` do worker anterior; registrar o parent/assignment para rastreabilidade.
3. Fidelity pass válida deve existir **antes de despachar quality**. O harness aplica o gate; o script exige seu digest exato na quality, mesmo candidato/revisão/política/inventário e ordem do registro.
4. Zero finding material aberto; limitações que impeçam cobrir requisitos bloqueiam PASS. Findings não materiais têm disposição explícita. Texto PASS sem resultado estruturado/evidência não basta.
5. Não inferir resultado por ausência de findings; `fail`/`blocked` podem existir por limitações. Corrigir a validação para não obrigar artificialmente um finding material em toda falha.
6. Hash material cobre fontes relevantes, proposal/design/specs/tasks, inventário, autor e política. Qualquer edição material invalida os reviews atuais; não “atualizar” hash de review antigo para fazê-lo encaixar.
7. Envelopes de review/readback são saídas posteriores ao candidato: seus hashes ficam no digest final de entrega, evitando autorreferência. Alterar review/evidência invalida verificação da entrega mesmo sem alterar o hash material.
8. Exceção única de progresso pós-handoff: normalizar somente checkboxes reconhecidos do índice canônico. `[x]` não deve ser resetado por recompilação nem tratado como implementação verificada pelo planning. Alterar texto, IDs, ordem, dependências ou contratos não é progresso normalizado.
9. O registrador não muda task frontmatter/boundaries para ready. Se isso for necessário, o harness corrige **antes** do congelamento/reviews ou abre nova revisão.
10. Registro válido = conformidade estrutural; semântica é conclusão do reviewer nativo. Manter essa distinção no output, sem alegar proteção contra falsificação coerente pelo próprio host.

### 2.3 Sequência ordenada de engenharia

| Etapa | Responsável / mudança | Gate de saída |
|---|---|---|
| C0 — Aprovar contrato | Usuário/ROOT aprova este boundary e comportamento de versões. Congelar inventário real; preservar alterações alheias, planos e observações. | Escopo e migração explícitos; nenhuma instalação. |
| C1 — Caracterizar e escrever RED | Harness delega implementação futura com scope; testes mostram A01/A02/A07/A08 e importações ativas. | Falhas comportamentais reais, não import error como RED. |
| C2 — Desligar caminho paralelo na fonte | Retirar branches/imports/distribuição de authority da 1B. Retirar supervisor headless e servidor visual do payload operacional. Separar driver `host.start` dos registradores. | Importar/usar planner não abre rede, não despacha modelo e não exige `/etc/asds`. Sem apagar história. |
| C3 — Criar schema passivo versionado | `lib/planning-review.mjs` e schemas: identidades por etapa, digest causal, findings/limitações, inventário fechado. `lib/review.mjs` não existe nesta árvore. | Dados incompletos rejeitados; nenhum default semântico. |
| C4 — Corrigir builder e CLI | `lib/package-builder.mjs`, `scripts/build-package.mjs`: compilar separado de registrar; remover reviewer-string como aprovação e mutation implícita de boundaries. Nova CLI/flags para registro explícito devem ser documentadas. | Registrar F não cria Q; registrar reviews não altera candidato; JSON não ganha PASS por defaults. |
| C5 — Corrigir store/lifecycle/return | `lib/planning-store.mjs`, `lib/planning-lifecycle.mjs`, `lib/handoff.mjs`: substituir autoridade indisponível por verificações de registro/readback. Remover throws incondicionais **junto com** novo caminho validado. | Pacote semanticamente revisado pelo harness, consistente e persistido pode chegar a delivered; ausência/drift continuam bloqueados. |
| C6 — Persistência sem circularidade | Publicar bytes autorizados, reabrir inventário, comparar índices/contratos/reviews/DAG. Persistir estado final e reabrir novamente; falha conserva último plano coerente, sem backups automáticos. | `delivered` é consequência do gate, não confiança em `--state delivered`. Receipt final não hasheia a si próprio. |
| C7 — Compatibilidade/progresso | Manter leitores históricos, sem reinterpretar receipts antigos como novos. Pacotes sem IDs necessários exigem reconciliação/revisão, não IDs inventados. Preservar `[x]` e grants de consumidor. | Plano antigo não apagado; progresso não reiniciado; handoff não inicia Stage-3. |
| C8 — Instruções e distribuição | Atualizar raiz/skill/references/adapters OpenCode/AGY/Claude/Codex, consumer e installer. OpenSpec só quando adotado/autorizado; não inicializar automaticamente. | Nenhum prompt manda obter key/daemon/trust root próprio; nenhuma cópia antiga contradiz o fluxo. |
| C9 — Regressão e revisão independente | Rodar testes focais, `npm test`, `npm run check`, `npm run validate`, `git diff --check`. Revisor read-only compara novo diff com mandato e negativa de regressão. | Fonte passiva e suite atual aprovadas; snapshots atualizados só após revisão dos bytes. |
| C10 — Prova nativa do fluxo | Com autorização própria, usar OpenCode+omo-slim atual, caso sintético, dois reviewers nativos e readback de suas sessões; scripts apenas registram. | Evidência operacional de F→Q→persistência→readback→delivered; nunca “host-compromise secure”. |
| C11 — Entrega | ROOT reconcilia solicitado/entregue, limitações e arquivos; handoff opcional mediante seleção e grant separados. | TASKS/contratos entregues, implementação de produto não executada. |

### 2.4 Matriz de prova futura

- **Positivo determinístico:** pacote + registros explícitos F/Q válidos → validação → persistência/readback em processo novo → retorno delivered → envelope de handoff. Fixtures declaradas como fixtures; não apresentadas como sessões reais.
- **Positivo nativo separado:** coordinator chama subagentes do harness, lê resultados reais e salva evidência ligada ao candidato; nenhuma chamada LLM feita por scripts ASDS.
- **Negativos:** ausência F/Q; Q antes de F; Q com outro digest F; autor como reviewer; F/Q mesma sessão; candidato/revisão/autor/política/inventário diferentes; finding material aberto; limitações incompatíveis; referência/evidência inexistente; resultado alterado; path inseguro; state delivered forçado; readback divergente; review reaproveitado após rework.
- **Progresso:** marcar checkbox legítimo depois do handoff preserva review e `[x]`; mudar descrição/ordem/contrato invalida; recompilação não desfaz conclusão. Drift de review/readback também rejeita.
- **Passividade:** import closure e runtime de CLI não iniciam processo de inferência, servidor, socket ou provisionamento. Não proibir indiscriminadamente Git, Node syntax checks ou OpenSpec local determinístico.
- **Instalação:** preview/distribuição não inclui launchers/authority; preserva manifest ownership e arquivos alheios. Não executar instalação global para testar essa correção.
- **Limite declarado:** nenhum teste sintético demonstra que um host malicioso não fabricou todos os registros. O contrato operacional confia no harness autorizado e torna sua atividade inspecionável.

## 3. ASCII ponta a ponta — OpenCode + omo-slim

**Diagrama alvo após correção, não fluxo já implementado.** Exemplo: usuário pede planejar “exportação CSV dos pedidos do usuário autenticado, sem exportar pedidos alheios”, sem implementar. `C`, `F`, `Q` são IDs ilustrativos, não sessões reais. Revisões são novos subagentes nativos; nenhuma API/provider é configurada pelo ASDS.

O exemplo inclui Plane apenas quando já há projeto/issue governante aplicáveis e autorização. **Neste repositório o usuário declarou governança local e ausência de projeto Plane próprio**: não criar issue/projeto nem usar prefixo Prop4You. A mesma etapa usa registro local. `accelerate` governa o trabalho; não autoriza instalação nem impõe um serviço Hermes/Thor dentro do OpenCode.

```text
LEGENDA
  [H/LLM] raciocinio ou acao do harness/modelo nativo
  [D]     ferramenta ASDS deterministica, sem modelo/servidor
  [RO]    subagente sem escrita de produto/planejamento
  G#      gate observado; falha -> corrigir ou blocked, nunca PASS fabricado

USUARIO / ROOT
  | pede: "PLANEJE exportacao CSV, somente pedidos proprios; NAO implemente"
  v
+--------------------------------------------------------------------------+
| 0. HARNESS OpenCode + omo-slim / Orchestrator / sessao C          [H/LLM] |
| Pediu: usuario/ROOT. Executa: coordenador, carregando accelerate.          |
| Input: pedido, repo, restricoes, decisoes existentes, grants.              |
| Output: rota scoped para este exemplo; Execution Manifest; nao-goals.     |
| Valida: coordenador semanticamente; usuario resolve lacunas materiais.    |
| Disco: execution-manifest/contexto no destino explicitamente autorizado. |
| G0: planning-only, scopes e dono conhecidos; sem implementar feature.      |
+--------------------------------------------------------------------------+
  |
  +--> 1. GOVERNANCA / skill Plane, SE APLICAVEL                    [H + tools]
  |    Pediu/executa: coordenador do harness.
  |    Input: issue existente e projeto real; autorizacao separada se mutar.
  |    Output: escopo/aceite vivos, readback e link da issue na sessao.
  |    Valida: coordenador compara provider com pedido, sem prefixo inventado.
  |    Disco: referencia da issue/contexto; Plane nao vira segundo plano.
  |    G1: sem Plane aplicavel -> governanca LOCAL, nao bloquear planejamento.
  |
  v
+--------------------------------------------------------------------------+
| 2. HARNESS carrega spec-driven-superpowers (Stage-2 / ASDS)        [H/LLM] |
| Pediu: coordenador C, atendendo ROOT. Executa: proprio coordenador.        |
| Input: contexto/manifest/grants, requisitos e recusas ja decididos.        |
| Output: framing, fontes necessarias, lacunas reais e destino do pacote.   |
| Valida: coordenador; pergunta ao humano so o que realmente falta.          |
| Disco: contexto/intake/proposal iniciais; decisoes preservadas.            |
| G2: nenhuma API key, hook host-private ou segundo host necessario.         |
+--------------------------------------------------------------------------+
  |
  +-- SE houver lacuna factual --------------------------------------------+
  |   C -- subagent nativo --> Explorer OU Librarian / sessao E        [RO] |
  |   Pediu: C. Executa: especialista do harness, nunca script ASDS.         |
  |   Input: pergunta delimitada, paths/fontes, zero-write, prazo.           |
  |   Output: evidencias com paths/linhas ou docs/versionamento e limites.   |
  |   Valida: C abre fontes decisivas; retorno do filho e alegacao, nao gate.|
  |   Disco: filho nao grava; C registra evidencias aceitas no contexto.    |
  |   Se background: taskID retido -> notificacao terminal -> readback.     |
  +------------------------------- retorna a C ---------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 3. PLANEJAR E DECOMPOR                                            [H/LLM] |
| Pediu: C. Executa: C usando ASDS; especialistas so conforme necessidade.  |
| Input: requisitos/fontes/decisoes, criterios de aceite, limites.           |
| Output: proposal/design/specs e contratos com hierarquia e DAG.           |
| Valida: C semanticamente: nenhuma feature inventada ou criterio vazio.    |
| Disco (exemplo):                                                         |
|   proposal.md, design.md, specs/.../spec.md (se OpenSpec adotado)           |
|   tasks/task-0001.md -> contrato de dados/colunas e casos de CSV           |
|   tasks/task-0002.md -> endpoint filtrado por ownership [dep:0001]         |
|   tasks/task-0003.md -> UI e estados da exportacao [dep:0001]              |
|   tasks/task-0004.md -> integracao/regressao/aceite [dep:0002,0003]         |
|   Cada folha: inputs, scope, nao-goals, dependencias, aceite/verificacao.  |
| G3: comandos de implementacao nos contratos sao FUTUROS, nao executados.  |
+--------------------------------------------------------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 4. COMPILAR / VALIDAR / CONGELAR r1                                    [D] |
| Pediu: C. Executa: CLI ASDS invocada pelas tools do harness.              |
| Input: contratos/fontes + build spec explicito.                           |
| Tool: build-package.mjs; validate.mjs/validateChange; OpenSpec SE adotado. |
| Output: inventario, DAG, cobertura estrutural, candidateSha256=H1.        |
| Valida: scripts estrutura; C revisa sentido. Script nao certifica texto.  |
| Disco: tasks.md, dag.mmd, dag-status.md, planning-manifest.json reviewing.|
| G4: erros de estrutura -> C corrige -> recompila; NAO chamar review cedo. |
+--------------------------------------------------------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 5. FIDELITY REVIEW #1 — reviewer nativo / sessao F1                 [RO] |
| Pediu: C via subagent(spec-driven-superpowers-reviewer ou oracle).         |
| Executa: LLM do subagente no harness, nao worker/daemon ASDS.              |
| Input: pedido original, recusas, fontes, pacote r1/H1, assignment scope.   |
| Output: cobertura semantica, omissions/invencoes, findings + pass/fail.    |
| Valida: reviewer julga; C le sessao terminal/resultado e confronta fontes.|
| Disco: C salva resposta observada + IDs de sessao/mensagem + digests.     |
| G5: F1 != C; sem escrever pacote; sem usar narrativa do autor como prova. |
+--------------------------------------------------------------------------+
  |
  +-- EXEMPLO FAIL: "task-0002 nao testa pedidos de outro usuario" ---------+
  |   6. LOOP DE CORRECAO                                           [H/LLM] |
  |   Pediu: finding F1. Executa: C (reviewer nao corrige seu proprio alvo). |
  |   Input: finding material + fontes originais.                          |
  |   Output: contratos/specs corrigidos, caso negativo de ownership.      |
  |   Valida: C + compilador [D]; revisao semantica sera novamente externa. |
  |   Disco: task-0002/spec atualizados; r2/H2; F1 preservada como historica.|
  |   G6: H2 != H1 -> F1 invalida para r2; nao copiar PASS/hash anterior.   |
  |       C chama nova fidelity nativa F2 para r2/H2.                      |
  +------------------------- F2 PASS em r2/H2 -----------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 7. REGISTRAR FIDELITY OBSERVADA                                        [D] |
| Pediu: C. Executa: registrador ASDS, sem iniciar sessao.                 |
| Input: resultado F2 explicito, r2/H2, autor C, scope, evidencia/mensagens. |
| Output: envelope F validado e digest DF; nenhuma quality sintetizada.    |
| Valida: script campos/binding/findings; C autenticidade operacional.      |
| Disco: reviews/fidelity-r2.json + referencia no manifest.                |
| G7: F pass, sem findings materiais abertos, bytes atuais ainda H2.        |
+--------------------------------------------------------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 8. QUALITY REVIEW #2 — reviewer nativo / sessao Q2                  [RO] |
| Pediu: C SOMENTE apos G7. Executa: segundo subagente nativo.             |
| Input: fontes + pacote r2/H2 + binding de fidelity DF; sem autoelogio C.  |
| Output: decomposicao, fronteiras, DAG, viabilidade, aceite por folha.     |
| Valida: reviewer semanticamente; C faz readback do resultado terminal.   |
| Disco: C salva resposta observada/IDs; registrador salva quality-r2.json.|
| G8: Q2 != F2 != C; Q referencia DF exato; mesmo r2/H2 e inventario.       |
|                                                                         |
| FAIL material -> C corrige -> r3/H3 -> NOVA F3 -> NOVA Q3.                |
| Sem mudanca material: jamais descartar findings para fabricar PASS.       |
+--------------------------------------------------------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 9. GATE CONJUNTO / PACOTE READY                                        [D] |
| Pediu: C. Executa: validators planning-review/lifecycle/coverage/DAG.     |
| Input: bytes atuais, F2/DF, Q2 que aponta DF, policy/autor/inventario.     |
| Output: ready ou erros precisos; integridade nao e seguranca contra host.|
| Valida: scripts invariantes; C reconcilia cobertura e nenhum gap oculto. |
| Disco: manifest ready e referencias de review; sem alterar tasks.       |
| G9: qualquer drift material -> invalidar ambos e retornar ao loop.       |
+--------------------------------------------------------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 10. PERSISTENCIA + READBACK DETERMINISTICO                              [D] |
| Pediu: C, sob grant do usuario. Executa: planning-store/CLI local.        |
| Input: pacote ready, destino autorizado, revisao esperada, evidencias.   |
| Output: arquivos publicados, hashes lidos, recibo local de persistencia. |
| Valida: reabre arquivos; compara inventario/IDs/DAG/reviews/bytes.        |
| Disco: tasks.md + tasks/task-0001..0004.md + fontes + reviews + manifest. |
| G10: so apos correspondencia, manifest state="delivered"; reabrir final.|
| Falha: manter ultimo pacote coerente; blocked; sem backup automatico.    |
+--------------------------------------------------------------------------+
  |
  v
+--------------------------------------------------------------------------+
| 11. SAIDA STAGE-2 / ROOT                                               [H] |
| Pediu: usuario/ROOT. Entrega: C. Valida: ROOT/humano + recibos [D].        |
| Input: pacote final/readback; results F2/Q2; limites conhecidos.          |
| Output: links tasks/contratos, solicitado x entregue, gates e residuos.  |
| Disco: relato final vinculado a r2/H2 e digest final da entrega.         |
| G11: delivered = PLANEJAMENTO revisado/persistido, nao feature pronta.   |
+--------------------------------------------------------------------------+
  |
  +--> Se Plane aplicavel: harness projeta/atualiza sob grant + readback.
  |    Nunca duplica plano nem marca implementacao concluida por entregar tasks.
  |
  +--> SEM selecao/grant Stage-3: FIM. Nada e executado automaticamente.
  |
  +--> COM selecao/grant novos:
       ROOT -> harness carrega asds-execution-consumer
       [D] valida handoff/pacote atual/contexto/escopo/grant
       [H] conduz implementacao via capacidades NATIVAS, em outra fase
       [D] registra journal/progresso; preserva [x] sem reabrir reviews
       Mudanca MATERIAL do plano -> retorno explicito ao Stage-2
```

### Como isso se traduz em OpenCode + omo-slim

- O coordenador escolhe e chama a ferramenta nativa `subagent`; ASDS não executa esse comando por dentro de um script. Roles ASDS são usados se disponíveis; `oracle` é alternativa de revisão quando compatível com o escopo. Não presumir catálogo ou aliases de outra edição OmO.
- Uma sessão F e uma sessão Q distintas são necessárias; reutilizar o mesmo perfil de agente não significa reutilizar a sessão. Em background, o harness guarda task/session ID, espera notificação e lê o resultado; não inventa status nem cria worker duplicado por timeout.
- Explorer/Librarian são condicionais. Se o contexto já resolve as perguntas, não são chamados. Fidelity e quality são gates de revisão do pacote, não convites a implementar o produto.
- `accelerate` fixa rota, scopes, responsáveis e prova proporcional. Sua skill instalada é orientada a Hermes; adaptar a governança ao harness não significa invocar automaticamente CLI Thor, Kanban, daemon ou criar artefatos fora do grant.
- `plane` é integração do harness, não HTTP dentro do compilador ASDS. `--export-plane` pode gerar JSON determinístico; só o harness, autorizado, faz mutação e readback do provider.
- Os caminhos `reviews/fidelity-r2.json` e flags novas de registro são **propostos**. O CLI atual `--record-review REVIEWER_OR_JSON` não atende o contrato e precisa da correção C4 antes do exemplo ser operacional.
- OpenSpec é validação adicional local quando o projeto já o adotou ou autoriza; um pacote neutro pode ser entregue sem inicializar OpenSpec.

## 4. Decisão solicitada à ROOT

Aprovar ou corrigir **o contrato, a classificação de remoção/refatoração e o fluxo acima**. Não há pedido de instalar, obter credencial, criar infraestrutura ou executar produto. A implementação só deve começar após essa reconciliação.

O objetivo da próxima fase será: **ASDS passivo funcional, duas revisões nativas reais rastreáveis, registro determinístico honesto e tasks persistidas/readback**. Não será “autoridade resistente ao próprio harness”. Nenhuma dessas mudanças está implementada por este relatório.
