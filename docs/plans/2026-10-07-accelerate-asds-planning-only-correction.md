# Plano único de correção — Accelerate + ASDS como produtor de planejamento

**Data da revalidação:** 2026-10-07, America/New_York.
**Estado deste documento:** proposta de correção fundamentada e persistida; nenhuma tarefa de implementação abaixo foi iniciada por esta encomenda.
**Pedido:** reanalisar as explicações anteriores, revalidar fontes e provas, condensar a correção em um plano único. ASDS entrega as tasks depois de esgotar as camadas necessárias de planejamento; não executa o trabalho descrito por elas.
**Autor/coordenador desta análise:** Thor/default. O método Subagent-Driven Development (SDD) é inspiração de revisão e consumidor opcional futuro, não um terceiro dono do planejamento.
**Objetivo:** alinhar os dois projetos a uma cadeia com entrada proporcional, planejamento completo/revisado/persistido e consumo posterior explicitamente separado.
**Stack existente:** Accelerate Python + instruções/adaptadores; ASDS JavaScript ESM/Node, Markdown/YAML, OpenSpec 1.14.0 e YAML 2.9.1. Não se propõe novo daemon, dashboard, runtime paralelo ou motor de inferência.

## 1. Escopo e autoridade

Esta encomenda autoriza leitura, verificações locais e a produção deste plano. Não autoriza aplicar a correção, editar AGENTS/SOUL/políticas globais, instalar skills, migrar dados, publicar release, criar issues, fazer commit/push ou iniciar execução de um projeto-alvo.

A finalidade do ASDS já está decidida pelo proprietário; não é uma pergunta a reabrir. Seus agentes podem ler, investigar de forma delimitada, elaborar, revisar, corrigir e persistir planejamento. Não podem implementar as tasks do projeto-alvo como consequência de uma autorização genérica, de uma aprovação do plano ou de um nome de papel como `executor`.

Desenvolver o próprio toolkit ASDS é outra encomenda: as tarefas deste documento poderão ser implementadas por um consumidor autorizado, não pelo planejador como efeito colateral da entrega.

Há um único plano de correção: este arquivo. Os relatórios anteriores são fontes históricas, não backlogs concorrentes. A execução futura referencia os IDs abaixo e preserva os dois working trees; nenhuma alteração preexistente deve ser apagada, incorporada ou publicada silenciosamente.

## 2. Baseline revalidada

Aliases usados nos caminhos:

- `ACC` = `/home/marcelo-karval/Backup/Projetos/accelerate`.
- `ASDS` = `/home/marcelo-karval/Backup/Projetos/spec-driven-superpowers`.
- `HERMES_SKILL` = `/home/marcelo-karval/.hermes/skills/productivity/accelerate` (comparação documental; não qualificação do runtime inteiro).

| Objeto | Observação atual |
|---|---|
| ACC | branch `main`, HEAD `343ec10b20dece67c82de5697e804734dd9dbeb6`, tag local `v1.2.0` |
| ASDS | branch `feat/adaptive-decomposition`, HEAD `5991b3c182db1953db2a830a12ee955676093178`, descrição `v1.2.0-1-g5991b3c` |
| Versão ASDS no pacote | `1.2.0`; o checkout contém um commit posterior à tag |
| ACC antes desta análise | documento de observação não rastreado; código rastreado sem alterações locais reportadas |
| ASDS antes desta análise | README modificado; AGENTS, PROJECT-STATUS, pesquisas, experimentos e observações não rastreados |
| Publicação remota | não reconsultada nesta rodada; não se afirma que a tag local é a última versão remota |
| Node inicial | `/usr/bin/node`, `18.19.1`, abaixo do requisito do pacote |
| Node usado na revalidação | instalação já existente `/home/marcelo-karval/.nvm/versions/node/v24.20.0/bin/node`, versão `24.20.0` |

### Provas executadas nesta rodada

- ACC: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider tests/test_entry.py tests/test_routing.py tests/test_v1_authority.py` → **66 passed, 80 subtests passed**.
- ASDS: Node 24.20.0, `node --test --test-reporter=tap tests/*.test.js` (arquivos explicitamente selecionados) → **114 testes, 114 pass, 0 fail, 0 skipped**.
- ASDS: `node scripts/validate.mjs` → passou; validação estrutural.
- ASDS: `node scripts/check.mjs` → passou; sintaxe JavaScript, não análise de tipos/linter externo.
- ASDS: `node scripts/check-accelerate-handoff.mjs --accelerate <ACC>` → passou; grants/refusals, gaps, continuidade e paridade de entrada direta.
- ASDS: `node docs/research/2026-10-03-planning-core/probes.mjs` → reproduziu os limites descritos abaixo.
- `git diff --check` nos dois repositórios → sem erros de whitespace no diff rastreado.

Os testes usam fixtures e não qualificam um modelo, uma instalação global ou integração remota. Não foi executada a suíte shell completa do catálogo ACC, uma nova bateria de modelos ou publicação. A descoberta indiscriminada por `npm test` foi evitada porque `docs/experiments/` contém fixtures deliberadamente incompletas. A instalação Node existente foi selecionada somente para os comandos; nenhum launcher ou configuração persistente foi alterado.

## 3. Reconciliação do que foi dito anteriormente

| Afirmação/discussão | Veredito revalidado | Consequência |
|---|---|---|
| Accelerate 1.2.0 é entrada/conversa/direct/asds | Correto para as fontes locais | Preservar proporcionalidade, evidência de risco e autorização |
| ASDS assume execução e integração | Correto como descrição do contrato antigo; incorreto como arquitetura desejada | Corrigir ACC e ASDS, não legitimar o contrato pela existência de testes verdes |
| ASDS é planejador | Autoridade explícita do usuário e AGENTS local; implementação ainda divergente | Fronteira normativa do plano |
| SDD seria uma integração totalmente nova | Correção: ASDS já o inclui com um bloco `ASDS mode` | Adaptar a ligação existente, sem copiar outro orquestrador |
| Dois estágios de revisão agregam valor | Sim, como método; não como garantia automática | Fidelidade primeiro, qualidade depois; veredito vinculado ao artefato |
| SDD cria paralelismo seguro por si só | Não | Contexto separado não isola filesystem, recursos ou decisões; planejamento recomenda, não dispara |
| Basta produzir contracts com `ready` | Falso | A sondagem com seções contendo somente `x` passa na validação estrutural |
| A hierarquia já seria arbitrária | Falso | `lib/decomposition.mjs:12` rejeita pacotes com pai e tarefas com avô |
| TASKS e recibos já garantem entrega do plano | Não | `createReturn` exige referências textuais, mas não abre os artefatos |
| Persistência do journal protege o pacote inteiro | Não | Lock/rename de um JSON não publica atomicamente N Markdown |
| Plane está integrado | Não | Arquitetura proposta; nenhum connector/projeção fiel foi comprovado |
| OMO/OMO-Slim foi escolhido | Não | Alternativa discutida, não decisão aplicada; não é pré-requisito do núcleo |
| Bateria histórica provou planejamento confiável | Não | Relatórios preservam falhas, contaminação e limites de tempo; não repetir como taxa de confiabilidade |
| Testes anteriores em Node 18 qualificariam suporte | Não | Limitação corrigida nesta análise com a suíte em Node 24 existente |
| Skill Accelerate do Hermes equivale ao projeto ACC | Não | Contratos documentais diferentes; alinhar/renomear exige escopo separado, não patch silencioso |

**Correção da recomendação anterior:** usar primeiro um pacote-modelo e depois um consumidor SDD continua útil, mas não basta como plano de correção. É necessário corrigir finalidade, estados, passagem de controle, artefatos, hierarquia, revisão, publicação e qualificação conjuntamente. A execução posterior não é o gate final do planejador.

## 4. Arquitetura-alvo e responsabilidades

```text
Pedido do usuário
  → Accelerate: entender ação/produto pedido, contexto, limites e encaminhamento
       ├ conversa → resposta
       ├ execução trivial explicitamente solicitada → ação direta proporcional
       └ planejamento necessário ou explicitamente solicitado → ASDS
            → entender e esgotar as camadas aplicáveis
            → entregar índice + contratos revisados e persistidos
            → encerrar a contribuição de planejamento
  → chamador/host conserva o objetivo original
       └ se houver execução autorizada: consumidor posterior escolhido
            (direto, SDD ou outro mecanismo compatível; fora do ASDS)
```

### Invariantes

- Pedido de **plano**, mesmo de uma alteração mínima, não pode virar edição de código por ser trivial.
- Pedido de **implementação** não pode ser anunciado como concluído quando apenas seu plano foi entregue.
- Aceitar contexto, aceitar produzir planejamento e ter permissão de escrita são decisões distintas.
- Autorizações prévias são preservadas, mas não alteram a responsabilidade do ASDS. O chamador pode reutilizar autorização de execução; o planejador nunca a consome para implementar.
- O encerramento da contribuição ASDS libera seu ownership. Continuação de planejamento usa a revisão existente; “agora implemente” segue para consumidor posterior, não mantém ASDS executor por inércia.
- Accelerate não reaplica uma segunda revisão semântica após ASDS. O chamador valida identidade, integridade e limites do retorno sem refazer o planejamento.
- Uma fonte canônica de planejamento, com projeções derivadas. Registro de execução futura não é outro plano.
- Reaproveitar habilidades técnicas e mecanismos antigos isolados; não apagar bibliotecas de execução apenas porque saíram do caminho principal.

### Decisões recomendadas para esta correção

1. Evoluir o toolkit existente, sem trocar sua base por OMO/OMO-Slim. A alternativa pode ser avaliada como consumidor posteriormente, sem bloquear a correção.
2. Manter nomes canônicos existentes `tasks.md` e `tasks/task-ID.md`; “TASKS” é conceito. Não criar arquivos duplicados apenas por capitalização.
3. Preservar o pacote de entrada v1 de sete campos. A distinção explícita entre produto pedido e contribuição planejadora pertence a um contexto interno versionado, normalizado no receptor; não adicionar chaves obrigatórias ao wire v1 silenciosamente.
4. Criar um contrato novo de **entrega de planejamento**, separado de recibos antigos de implementação. Leitores legados continuam explícitos; não interpretar `completed` v1 como prova de plano entregue.
5. Manter Markdown/YAML e um manifest de planejamento como pacote portátil, independente de OpenSpec e modelos. OpenSpec é uma integração de organização/validação, não condição para a qualidade da saída.
6. Revisão do planejamento por pacote, com aprofundamento nas folhas arriscadas/amplas; não exigir três agentes por tarefa.
7. Consumidor posterior não precisa ser um novo serviço. Este plano define o contrato de consumo, não implementa uma plataforma de execução.
8. Plane é destino condicional. Sua equivalência deve ser comprovada se selecionado; ausência dessa implementação não se esconde como compatibilidade disponível.

## 5. O significado verificável de “exaurir as camadas”

Exaurir não significa rodar todas as skills, entrevistar indefinidamente ou alcançar perfeição. Significa que **nenhuma camada necessária ficou sem avaliação, nenhuma decisão material foi escondida e nenhuma obrigação foi empurrada para uma task genérica só para terminar o plano**.

Para cada camada, registrar no manifest compacto: `satisfied`, `reused`, `not_applicable` ou `blocked`, com motivo, evidência/referência e trabalho afetado. `not_applicable` exige justificativa concreta; um campo preenchido não substitui revisão. Reutilizar uma decisão válida satisfaz a camada sem repeti-la.

| Camada | Trabalho esperado | Saída/gate |
|---|---|---|
| C01 — Encomenda | Distinguir conversa, plano e objetivo final; destinatário, destino e limites | Produto do ASDS e produto original não confundidos |
| C02 — Contexto/onboarding | Ler fontes pertinentes, convenções e estado real | Base suficiente e fontes identificadas, sem varredura indiscriminada |
| C03 — Briefing/entendimento | Consolidar resultado, requisitos, exclusões e restrições | Cada obrigação tem fonte; linguagem preservada |
| C04 — Lacunas/entrevista | Perguntar só escolhas materiais não respondidas | Decisão com responsável/consequência; pendências localizam bloqueio |
| C05 — Pesquisa | Resolver fatos acessíveis que impedem planejar | Evidência/conclusão delimitada; incerteza remanescente explícita |
| C06 — Alternativas/brainstorming | Comparar abordagens quando há escolha real | Alternativa escolhida, trade-offs e não objetivos; sem ritual se já decidido |
| C07 — Especificação | Requisitos e cenários positivos/negativos/preservações | Critérios observáveis e cobertura verificável |
| C08 — Design | Contratos compartilhados, interfaces, riscos, restrições | Decisões suficientes para decompor; detalhe interno reversível pode ficar ao executor |
| C09 — Decomposição | Separar resultados, criar agregados e folhas | Fronteiras justificadas; profundidade necessária, sem teto artificial |
| C10 — Relações | Hierarquia, precedência, bloqueios e paralelismo recomendado | Grafo coerente e razões; sem dispatch ou reserva real |
| C11 — Microcontratos | Produzir todas as folhas e índice | Destinatário sem histórico entende resultado, limites, entradas e aceite |
| C12 — Revisão de fidelidade | Comparar pacote à encomenda e fontes normativas | Zero perda/invenção de requisito; decisões e recusas preservadas |
| C13 — Revisão de qualidade | Avaliar granularidade, viabilidade, interfaces e composição | Defeitos materiais resolvidos; teste de consumidor sem histórico |
| C14 — Correção/convergência | Corrigir achados e revisar repercussões | Veredito da revisão atual, sem loop opcional infinito |
| C15 — Persistência/readback | Publicar no destino autorizado e reabrir o pacote | Conteúdo, IDs, relações, revisão e conjunto de arquivos equivalentes |
| C16 — Entrega | Retornar estado, referências, limitações e bloqueios | Plano entregue ≠ software implementado; ownership encerrado corretamente |

C07–C15 podem usar artefatos existentes e reavaliação seletiva, mas não podem desaparecer em uma encomenda de planejamento aceito. Não há obrigação de um documento por camada: o manifest aponta para proposal/design/specs/tasks já existentes.

### Bloqueios e condições de parada

- Resolver internamente o que puder ser resolvido nas fontes autorizadas. Não entregar “investigar o que precisamos” como substituto da própria elaboração.
- Uma investigação futura é task válida quando a encomenda é planejar essa investigação, quando o experimento depende legitimamente de execução futura, ou quando falta acesso/autoridade; nesses casos explicitar qual decisão futura bloqueia quais consumidores.
- Partes independentes podem ser planejadas e persistidas enquanto outras aguardam. Isso resulta em **entrega parcial**, nunca em planejamento completo com gaps omitidos.
- Critério completo: todas as camadas satisfeitas/reutilizadas/não aplicáveis com justificativa; cobertura integral; folhas prontas; revisões atuais; readback completo; ausência de bloqueadores materiais.
- Orçamento de revisão proposto: até três rodadas corretivas por conjunto de achados, interrompendo antes se não houver progresso ou surgir decisão humana. O teto não concede aprovação. Resultado persistido permanece parcial/bloqueado com próxima ação e responsável.
- Melhoria opcional recebe disposição separada; não amplia o escopo nem invalida uma entrega correta por preferência estética.

## 6. Contrato-alvo do pacote

### Índice e metadados

Um manifest novo proposto, `planning-manifest.json`, identifica schema/revisão do pacote, objetivo original, contribuição de planejamento, fontes, destino, camadas, decisões/bloqueios e evidências de revisão/readback. Não é um segundo índice de progresso; `tasks.md` continua sendo a visão canônica de tarefas e os contratos contêm suas relações.

O manifest referencia arquivos e hashes; não duplica seu conteúdo nem promete consentimento autenticado. Não armazenar segredos ou cópias desnecessárias de conversas.

Separar:

- estado do planejamento: `draft`, `reviewing`, `ready`, `delivered`, `partial`, `blocked`, `superseded`;
- prontidão da folha: pronta ou bloqueada com motivo;
- progresso de implementação futura: mantido pelo consumidor, não inferido do estado do plano.

Não há promoção para `delivered` sem readback da mesma revisão. Checkboxes futuras permanecem abertas em um plano novo entregue. Execução histórica legítima de um plano importado deve ser preservada como evidência separada, não apagada nem tomada como revisão de planejamento.

### Microcontrato mínimo

ID estável; tipo agregado/folha; pai opcional; resultado; contexto/fontes; alvo; inclusões/exclusões; requisitos/cenários; entradas e pré-condições; saídas/interfaces; dependências e razões; recursos/restrições de paralelismo; riscos/decisões; aceite positivo, negativo e preservações relevantes; verificação futura e resultado esperado; definição de conclusão da tarefa futura.

Uma task não precisa trazer toda a implementação antecipada. Caminhos existentes devem ser observados; caminhos novos devem ser rotulados como propostos. Detalhes de nomes internos que não mudam o contrato podem ser decididos pelo consumidor.

### Hierarquia e precedência

- Hierarquia é uma floresta de composição: agregados podem conter agregados/folhas; somente folhas representam trabalho futuro executável.
- `parentId` não gera automaticamente uma aresta de precedência pai → filho.
- Precedência é um DAG separado, com razão e saída exigida. Referência a um agregado significa aguardar seu resultado composto; a visão derivada expande isso para os pré-requisitos terminais pertinentes e detecta ciclos também nessa expansão.
- Agregação de cobertura/estado não equivale a executar o agregado. Aceite de planejamento do pai verifica recorte e cobertura dos descendentes; aceite de software futuro pertence ao consumidor.
- Compartilhar arquivo exige restrição de concorrência, não fusão automática de duas entregas independentes.
- Refinamento mantém IDs existentes quando o significado permanece, registra substituições quando não permanece e reconcilia requisitos/dependentes. Nunca marcar evidência velha como prova de um contrato novo.

### Revisões e SDD

Aproveitar de SDD: autor distinto de revisor quando disponível/necessário; contexto focado; fidelidade antes de qualidade; correção seguida de revisão; coordenador responsável pelo conjunto.

Não importar: TDD de produto como obrigação do planejador, commit automático, tarefa de duração fixa, três agentes por folha, worktree obrigatório, executor/modelo como requisito do DAG, ou segundo tracker.

Registrar achados com requisito/task/revisão, evidência, severidade, correção esperada e disposição. Veredito não é autenticado por um booleano `independent`. Referenciar a sessão/ator real e os artefatos examinados. Para risco ordinário, ausência de subagente permite autorrevisão declarada se a política aplicável aceitar; quando independência é obrigatória, falta de revisor bloqueia a promoção, não a escrita do plano.

A revisão vinculada ao conteúdo inclui o significado do índice, requisitos, decisões, relações e contratos; mudanças só de checkbox não alteram a identidade semântica. Mudanças de escopo/aceite/interface invalidam os afetados, seus dependentes e agregados relevantes. Mudança global sem mapeamento confiável invalida conservadoramente o pacote. Hash identifica bytes/versão, não qualidade.

### Persistência sem falsas promessas

Alvo: manter o último pacote coerente até a promoção da nova revisão e comprovar recuperação após interrupção. Não afirmar atomicidade multi-arquivo por usar rename em um arquivo.

Decisão técnica obrigatória em T09: escolher um mecanismo suportado de publicação do pacote e leitura consistente com a política do proprietário. Eventual área transitória, journal com preimages, geração imutável ou retenção de versão anterior exige apresentar caminhos, tamanho/limite, consumidores e limpeza; obter autorização quando configurar cópia/backup/staging excepcional. Sem essa decisão, não implementar um apagamento seguido de recriação nem declarar durabilidade pronta.

Para alterações existentes, conferir revisão anterior e conflitos antes de substituir. Interrupção, disco cheio, escrita parcial, edição concorrente e readback divergente impedem promoção. Resíduo da própria operação deve ser removido após comprovação, sem apagar a única cópia coerente ou dados do usuário.

## 7. Tarefas de correção — índice único

Todos os itens abaixo estão **planejados, não executados**. São contratos de correção para um consumidor futuro. “Proposto” em um caminho significa arquivo ainda a criar, não símbolo existente. As dependências ordenam resultados; passos RED/GREEN, leitura e commit não viram tarefas artificiais.

| ID | Resultado | Depende de |
|---|---|---|
| T01 | Contrato e pacote-modelo de entrega de planejamento | — |
| T02 | Hierarquia recursiva preservando identidade | T01 |
| T03 | DAG de planejamento independente de executor | T02 |
| T04 | Rastreabilidade integral de requisitos e decisões | T01 |
| T05 | Ciclo de camadas, prontidão e bloqueios parciais | T03, T04 |
| T06 | Revisão de fidelidade vinculada à revisão | T04, T05 |
| T07 | Revisão de qualidade e correção finita | T02, T03, T06 |
| T08 | Saída equivalente com/sem OpenSpec | T01, T05 |
| T09 | Publicação consistente e recuperação do pacote | T07, T08 |
| T10 | Retorno de planejamento e fim de ownership ASDS | T05, T07, T09 |
| T11 | Entrada ACC distingue plano de execução | T01, T10 |
| T12 | Skills de elaboração/revisão alinhadas ao planejador | T05, T06, T07, T08 |
| T13 | Execução legada isolada e contrato de consumidor | T03, T10, T12 |
| T14 | Projeções e autoridades ACC/ASDS coerentes | T11, T12, T13 |
| T15 | Matriz determinística integrada e migração compatível | T02–T14 |
| T16 | Evals de artefatos e fronteira de comportamento | T15 |
| T17 | Distribuição e qualificação nos harnesses selecionados | T14, T16 |
| X01 | Projeção Plane fiel, se destino selecionado | T09, T10, T15 + autorização do destino |
| X02 | Reconciliação da skill Hermes, se incluída | T14 + decisão de identidade/escopo |
| X03 | Piloto de consumidor SDD, se execução selecionada | T10, T13, T16 + escopo de execução |

### T01 — Contrato e pacote-modelo

- **Resultado:** especificação única do produto e exemplo revisável de planejamento entregue, com implementação futura aberta.
- **Entradas:** pedido atual; `ASDS/AGENTS.md`; pesquisa planning-core; contratos e baseline desta análise.
- **Alvos existentes:** `ASDS/openspec/specs/asds-core/spec.md`, `schemas/superpowers-bridge/templates/{proposal,design,spec,tasks,task-template,summary}.md`, `skills/spec-driven-superpowers/references/contracts.md`.
- **Novos propostos:** `ASDS/docs/architecture/planning-delivery-contract.md`, `ASDS/examples/planning-delivery/` com índice, contratos e manifest do exemplo. Nenhuma inicialização de projeto externo.
- **Fronteira:** definir produto, estados, relações, autorização e compatibilidade; não implementar o domínio usado no exemplo.
- **Aceite:** exemplo contém agregado e folhas independentes, caso bloqueado separado, critérios positivos/negativos, decisões e fontes; leitor sem histórico explica cada entrega. A variante completa entrega plano com checkboxes de implementação abertas. A variante parcial não se anuncia completa.
- **Verificação futura:** revisão de requisitos e qualidade do pacote-modelo; novos testes de contrato em `tests/planning-delivery.test.js` distinguem plano entregue de software concluído. O arquivo de teste é proposto, não existente.
- **Saída:** decisões normativas suficientes para T02–T17; nenhum requisito de produto deixado implicitamente ao implementador.

### T02 — Hierarquia recursiva

- **Resultado:** árvore/floresta de composição sem o limite pacote → tarefa e sem impor profundidade a casos simples.
- **Entradas/dependências:** T01; IDs e formatos atuais.
- **Alvos:** `ASDS/lib/decomposition.mjs`, consumidores estruturais em `lib/contracts.mjs` e `lib/validation.mjs`; `tests/decomposition.test.js`, `tests/decomposition-sources.test.js`.
- **Fronteira:** composição, refinamento e identidade; não criar scheduler ou aplicar mudanças em projetos-alvo.
- **Aceite:** pai/filho/neto/bisneto quando justificados; folhas sem filhos; agregados não executáveis; rejeição de órfãos/ciclos; preservação de cobertura, IDs e escopos no split; crescimento sem teto arbitrário de tasks.
- **Verificação futura:** RED da restrição atual com caso aninhado válido, GREEN da nova validação, negativos de ciclo/escape/perda de requisitos e regressão de planos legados.
- **Saída:** relações de composição confiáveis para DAG e revisão.

### T03 — DAG puro de planejamento

- **Resultado:** validar/renderizar precedência e recomendar paralelismo sem modelo, spawn, journal de execução ou recibo de código.
- **Entradas/dependências:** T02; `compilePlan`, `renderDag`, `prerequisites` e consumidores existentes.
- **Alvos:** `ASDS/lib/orchestration.mjs`, `lib/decomposition.mjs`, `lib/contracts.mjs`, `scripts/orchestrate.mjs` como compatibilidade; novos propostos `lib/planning-graph.mjs`, `scripts/plan.mjs`, `tests/planning-graph.test.js`.
- **Fronteira:** extrair sem duplicar regra de grafo. Orquestração antiga passa a consumir a mesma representação; não removê-la nem executá-la.
- **Aceite:** composição e precedência não se confundem; expansão de dependência de agregado detecta ciclos; razões/saídas exigidas legíveis; mesmo arquivo admite folhas separadas com recomendação sequencial. Falta de spawn não bloqueia planejamento.
- **Verificação futura:** testes puros de DAG, hierarquia profunda, referência ausente, ciclo efetivo e render determinístico; spy prova zero chamada de host/modelo.
- **Saída:** representação canônica reutilizável pelo plano e por consumidores.

### T04 — Cobertura de requisitos e decisões

- **Resultado:** cada obrigação e exceção da encomenda liga-se ao aceite de folhas/resultado composto, sem depender só de IDs de cenários.
- **Entradas/dependências:** T01; cenários, proposta/design e fontes recebidas.
- **Alvos:** `ASDS/lib/validation.mjs`, `lib/contracts.mjs`, `skills/spec-driven-superpowers/references/planning.md`; novo proposto `tests/planning-coverage.test.js`.
- **Fronteira:** estrutura de rastreabilidade e preservação; julgamento do significado é T06/T07, não regex de verbos.
- **Aceite:** detectar requisito sem destino, destino órfão, decisão material sem responsável e alternativa contrária à regra já dada; preservar limites como zero permitido por regra não negativa; cobertura de agregado exige todos os descendentes pertinentes.
- **Verificação futura:** fixture com IDs corretos mas exceção sem cobertura deve ser apontado pela revisão semântica; tests de integridade detectam ausência de vínculo; não afirmar que vínculo prova significado.
- **Saída:** matriz legível requisito → decisão/cenário → task → aceite.

### T05 — Camadas, prontidão e parcialidade

- **Resultado:** ciclo próprio do planejamento com todos os critérios C01–C16 avaliados, sem exigir execução futura.
- **Entradas/dependências:** T03, T04.
- **Alvos:** `ASDS/lib/contracts.mjs`, `lib/validation.mjs`; novos propostos `lib/planning-lifecycle.mjs`, `tests/planning-lifecycle.test.js`.
- **Fronteira:** estados/provas de planejamento; manter recebimento/aceite/autoridade separados. Não reutilizar `integrated` como “plano pronto”.
- **Aceite:** `ready` exige camadas e revisões aplicáveis; `delivered` exige readback; parte bloqueada não bloqueia redação independente nem desaparece; `not_applicable` sem motivo falha; decisão já respondida não reabre entrevista.
- **Verificação futura:** transições positivas/negativas, bloqueio por camada, retomada e ausência de chamadas de execução. Planejamento totalmente pronto com nenhuma task implementada deve passar.
- **Saída:** API de ciclo de planejamento distinta do journal de execução.

### T06 — Revisão de fidelidade

- **Resultado:** parecer rastreável de aderência do pacote ao pedido e às fontes.
- **Entradas/dependências:** T04, T05; pacote-modelo e revisão congelada.
- **Alvos:** `ASDS/skills/superpowers/writing-plans/plan-document-reviewer-prompt.md`, referências ASDS de contratos/planejamento; novo proposto `lib/planning-review.mjs` e testes correspondentes.
- **Fronteira:** instrução de revisão e contrato verificável de achados; não simular avaliação humana/LLM no validador.
- **Aceite:** revisor recebe pedido/fontes e artefatos, não só narrativa do autor; identifica perda/invenção de requisito e mudança de autorização; cada achado aponta requisito/task/revisão; parecer de outra revisão não promove o candidato.
- **Verificação futura:** fixtures com escopo extra, recusa esquecida, regra reaberta e requisitos ausentes; teste de identidade e evidência de revisão, com limites de autenticação declarados.
- **Saída:** fidelidade aprovada ou bloqueios precisos para correção; T07 só aprova após fidelidade válida.

### T07 — Qualidade e convergência

- **Resultado:** avaliação semântica das folhas e composição, com correção finita e revisão do candidato corrigido.
- **Entradas/dependências:** T02, T03, T06.
- **Alvos:** `ASDS/lib/planning-review.mjs` proposto em T06; `skills/spec-driven-superpowers/references/planning.md`; novo proposto `skills/spec-driven-superpowers/references/planning-review.md`.
- **Fronteira:** aplicar princípios SDD a planejamento, não despachar implementadores de produto. Aprovação estrutural não vira semântica automaticamente.
- **Aceite:** rejeitar folha ampla/vazia, interface incompatível e DoD sem demonstração; aceitar folha coerente longa e múltiplas folhas no mesmo arquivo; consumidor sem histórico consegue explicar o trabalho; correção material invalida parecer afetado; limite de rodadas resulta em parcial/bloqueado, nunca aprovação automática.
- **Verificação futura:** revisão de pacotes com defeitos semeados e conformes, incluindo a task `x` da sondagem; trilha achado → correção → reavaliação. Modelo/tempo/número de agentes não substitui a rubrica.
- **Saída:** pacote semanticamente revisado ou limitações acionáveis.

### T08 — Saída equivalente independente de OpenSpec

- **Resultado:** mesmo contrato de qualidade em projeto com bridge, schema alternativo, OpenSpec ausente ou recusado.
- **Entradas/dependências:** T01, T05; root de entrega autorizado.
- **Alvos:** `ASDS/lib/validation.mjs`, `lib/plan-projection.mjs`, `skills/spec-driven-superpowers/references/activation.md`, `schemas/superpowers-bridge/schema.yaml`; novos testes de store/planejamento.
- **Fronteira:** separar loader neutro de planejamento do loader específico OpenSpec; preservar schema/config existente. Nenhum root é criado por descoberta.
- **Aceite:** índice + contratos + fontes/design suficientes em destino local autorizado sem `openspec/`; recusa não degrada saída nem pergunta de novo; schema sem microcontracts recebe complemento explícito sem trocar config; input TASKS existente mantém identidade e fontes, sem segundo plano.
- **Verificação futura:** matriz de quatro configurações, snapshots antes/depois, paths/symlinks/escapes negativos, leitura de planos antigos. Falta de autorização do destino retorna bloqueio específico.
- **Saída:** pacote validável sem runtime OpenSpec; adapter OpenSpec preservado.

### T09 — Persistência consistente e recuperação

- **Resultado:** publicar/refinar pacote sem perder a última revisão coerente; conferir entrega real.
- **Entradas/dependências:** T07, T08; decisão explícita de armazenamento conforme seção 6.
- **Alvos:** novos propostos `ASDS/lib/planning-store.mjs`, `tests/planning-store.test.js`; reaproveitar conceitos, não confundir o escopo de `lib/orchestration-store.mjs`.
- **Fronteira:** apenas pacote de planejamento. Não criar backups/staging/runtime alternativo sem autorização específica; não alterar a política do proprietário.
- **Aceite:** publicação idempotente com revisão esperada; rejeição de conflito/edição concorrente; readback de todos os arquivos e relações; falha/interrupção mantém revisão anterior legível ou recuperação explícita, sem falso `delivered`; limpeza comprovada dos resíduos próprios.
- **Verificação futura:** injeção de falha em cada ponto de publicação, interrupção de processo, disco/IO simulados, concorrência, rollback e readback divergente. Testes em fixtures, não em dados exclusivos.
- **Saída:** recibo de persistência vinculado à revisão que T10 pode verificar. Se a estratégia exigir exceção não aprovada, T09 permanece bloqueada; não escolher silenciosamente solução insegura.

### T10 — Retorno e encerramento do ASDS

- **Resultado:** retorno distingue plano entregue, parcial, bloqueado ou cancelado e encerra o ownership de planejamento.
- **Entradas/dependências:** T05, T07, T09; pacote e recibo atuais.
- **Alvos:** `ASDS/lib/handoff.mjs`, `skills/spec-driven-superpowers/references/intake.md`, `tests/handoff.test.js`, `scripts/check-accelerate-handoff.mjs`; contrato novo de retorno versionado.
- **Fronteira:** preservar leitura do retorno legado; não alterar wire v1 sem negociação. `createReturn` legado é estrutura, não certificado de entrega.
- **Aceite:** novo caminho verifica pacote/revisão/readback; referência inexistente não permite `delivered`; resultado declara contribuição de planejamento e objetivo original pendente quando aplicável; follow-up de revisão retoma plano, follow-up de implementação retorna ao chamador.
- **Verificação futura:** testes de plano-only, implementação originalmente solicitada, gaps, stale review/readback e continuidade; nenhuma execução autorizada por um campo de resultado.
- **Saída:** fronteira explícita para ACC e consumidores.

### T11 — Classificação ACC por produto pedido

- **Resultado:** pedido de plano não vira execução trivial; pedido de implementação não é falsamente encerrado pelo plano.
- **Entradas/dependências:** T01, T10.
- **Alvos:** `ACC/core/entry.py`, `core/routing.py`, `core/entry-rubric.md`, `core/asds-integration.md`, `evals/entry-cases.json`, `tests/test_entry.py`, `tests/test_routing.py`.
- **Fronteira:** observações estruturadas/versionadas e contexto do adaptador; não alegar NLP determinístico. API estrita v1 continua compatível; novos campos não são injetados nela.
- **Aceite:** conversa continua conversa; plano mínimo vai para planejador; execução trivial só acontece quando esse é o produto pedido e autorizado; retomada após entrega não mantém ASDS executor; sem ASDS disponível não rebaixa risco ou finge plano entregue.
- **Verificação futura:** regressões positivas/negativas e produtor→receptor real; instruções e casos rotulados distinguem “explique planejamento”, “planeje X” e “implemente X”.
- **Saída:** entrada e handoff coerentes com a finalidade.

### T12 — Elaboração e revisão nas skills

- **Resultado:** camadas condicionais e saída obrigatória conectadas nas instruções realmente distribuídas.
- **Entradas/dependências:** T05, T06, T07, T08.
- **Alvos:** `ASDS/skills/spec-driven-superpowers/SKILL.md`, referências `planning.md`, `protocol.md`, `contracts.md`, `activation.md`; `skills/superpowers/brainstorming/SKILL.md`, `skills/superpowers/writing-plans/SKILL.md`; ASDS modes das skills OpenSpec relevantes.
- **Fronteira:** modificar modo ASDS sem destruir uso standalone das skills; manter proveniência. Instruções específicas do modo devem substituir claramente o trecho incompatível, não acumular ressalvas contraditórias.
- **Aceite:** não impor código completo, worktree, commit ou duração fixa por task; conectar escrita dos contratos à revisão; remover “corrigir sem re-revisar” do modo ASDS; perguntar apenas lacunas materiais; resumo não substitui contratos finais.
- **Verificação futura:** testes de autoridade por modo, revisão de instruções e cenários comportamentais T16; cobertura das camadas C01–C16 sem novo documento obrigatório por camada.
- **Saída:** agente guiado a produzir o pacote, não a implementar.

### T13 — Execução isolada e consumo externo

- **Resultado:** impedir que o planejador transicione implicitamente para apply/SDD/integração, preservando utilidades legadas como opcionais.
- **Entradas/dependências:** T03, T10, T12.
- **Alvos:** `ASDS/skills/superpowers/subagent-driven-development/SKILL.md`, referências `orchestration.md`, `operational-continuity.md`, `capabilities.md`; schema apply/summary; fronteiras de `lib/orchestration.mjs`, `lib/host-bridge.mjs`, `scripts/orchestrate.mjs`.
- **Fronteira:** sem apagar APIs legadas nem instalar consumidor novo. O adapter do consumidor usa contratos/revisões canônicos, nunca torna ASDS dono da implementação.
- **Aceite:** planejamento não importa/aciona dispatch, model profile ou code receipts; autorização genérica de implementação não altera isso; consumidores recebem plano e devolvem progresso separado; defeito de plano volta como revisão delimitada; nenhuma conclusão de software é inferida de `delivered` planning.
- **Verificação futura:** spies de no-dispatch/no-code-write e regressões do legado explicitamente selecionado; auditoria da cadeia openspec-propose → apply e writing-plans → SDD.
- **Saída:** contrato de consumo documentado; piloto real é X03, não gate universal do ASDS.

### T14 — Autoridades e projeções alinhadas

- **Resultado:** fonte e entrypoints publicados dos dois projetos descrevem o mesmo produto e ciclo.
- **Entradas/dependências:** T11, T12, T13.
- **Alvos ACC:** `README.md`, `SKILL.md`, `AGENTS.md`, `core/control-plane/branch-enforcement-matrix.md`, `global-runtime/accelerate/SKILL.md`, projeções Codex/OpenCode/OpenHands/Agy e seus testes de autoridade.
- **Alvos ASDS:** `README.md`, `docs/architecture.md`, `openspec/specs/asds-core/spec.md`, `rules/AGENTS.md`, schema/templates, catálogo de adapters; atualizar `PROJECT-STATUS.md` somente para o estado comprovado.
- **Fronteira:** AGENTS/regras e publicação requerem autorização de alteração aplicável. Atualizar fonte não atualiza instalações globais; separar docs ativas de histórico.
- **Aceite:** nenhuma entrada ativa atribui implementação ao ASDS; não retirar descrições de execução futura dos contratos por busca textual cega; preservar arquivos históricos e explicar limites. A compatibilidade com o produtor/consumidor continua passando.
- **Verificação futura:** matriz explícita de superfícies, testes de autoridade, links locais e revisão semântica do diff; nenhum claim de instalação global por paridade de fonte.
- **Saída:** candidato coerente para regressões e distribuição.

### T15 — Regressão e compatibilidade integradas

- **Resultado:** matriz determinística completa do novo contrato, preservando os mecanismos que continuam válidos.
- **Entradas/dependências:** T02–T14; baseline preservada.
- **Alvos:** `ASDS/tests/`, `scripts/check-accelerate-handoff.mjs`, scripts de check/validate; `ACC/tests/`, `evals/entry-cases.json`; documentação de migração explícita.
- **Fronteira:** não reclassificar todo teste antigo como obsoleto para obter verde; categorizar testando planejador, consumidor legado ou ferramenta neutra.
- **Aceite:** matriz da seção 8 coberta; rejeição de retorno/revisão stale; compatibilidade v1 e planos antigos explícita; migração não confunde progresso executado com prontidão do plano; suite seleciona somente testes oficiais.
- **Verificação futura:** Node suportado, comandos da seção 9; cada defeito atual tem regressão reproduzível; migrar somente fixtures autorizadas, não projetos reais.
- **Saída:** evidência de mecanismos, ainda não qualificação de agente.

### T16 — Evals de produto e comportamento

- **Resultado:** evidência de que agentes entregam bons artefatos e respeitam a fronteira planejadora nas condições declaradas.
- **Entradas/dependências:** T15; rubrica congelada e fixtures isoladas antes dos participantes.
- **Alvos:** `ASDS/skills/spec-driven-superpowers/evals/evals.json`, infraestrutura de avaliação/documentação existente; novo conjunto proposto `ASDS/docs/qualification/planning-delivery/`; casos ACC de entrada.
- **Fronteira:** não reutilizar outputs históricos como resultado novo, não fornecer gabaritos/logs anteriores aos participantes, não fixar Luna/high por herança do experimento antigo; usar política aprovada do harness.
- **Aceite:** artefatos abertos e revisados por avaliador sem narrativa do autor; sem código-alvo alterado; resposta de continuação resolve a pergunta real; timeout classificado separadamente; caso contaminado não qualifica independência; testes de retorno e readback reais no destino fixture.
- **Verificação futura:** casos da seção 8; relatórios por candidato/harness/modelo efetivamente observado, escopo, resultado, limitações e erros; comparar versões sem prometer taxa universal.
- **Saída:** qualificação delimitada do produto, com falhas não ocultadas.

### T17 — Distribuição, atualização e qualificação de entrada

- **Resultado:** candidato correto distribuível e, apenas em escopo autorizado, comprovado nos harnesses escolhidos.
- **Entradas/dependências:** T14, T16; autorização separada para release/instalação.
- **Alvos:** `ASDS/lib/install.mjs`, `scripts/install.mjs`, testes install/update/discovery, docs de release; instaladores/projeções ACC existentes e respectivas provas.
- **Fronteira:** preview-first, paths oficiais, hash/manifest de ownership, sem cópia/runtime paralelo ou backup automático. Selecionar destinos reais; não alegar suporte universal.
- **Aceite:** payload inclui referências novas, nenhum dono local sobrescrito, update stale rejeitado, source/instalado comparados após apply autorizado; sessão nova carrega entrypoint e produz planejamento sem implementar; limpeza de resíduos e limites de rollback declarados.
- **Verificação futura:** fixtures de instalação primeiro; posteriormente preview/apply/readback e sessão nova em cada destino escolhido. CI e release somente com gates/autorizações aplicáveis.
- **Saída:** fonte qualificada e matriz explícita de instalado/provado/não selecionado; publicação não é efeito colateral desta encomenda.

### X01 — Destino Plane condicional

- **Resultado:** projeção equivalente do plano quando Plane for o destino escolhido.
- **Entradas/dependências:** T09, T10, T15; workspace/projeto, autoridade e API reais descobertos antes de mutar.
- **Alvos:** `ASDS/skills/spec-driven-superpowers/references/integrations.md`; adapter e testes novos somente depois do levantamento de capacidades.
- **Fronteira:** Plane representa trabalho, não executa. Sem criar issue durante a elaboração deste plano e sem presumir hierarquia suportada pelo provider.
- **Aceite:** IDs estáveis, corpo completo, pais/filhos, dependências, bloqueios e revisão preservados; idempotência; readback de cada item/relação; falha parcial explícita; nenhuma hierarquia achatada silenciosamente. Relação sem suporte exige representação acordada ou bloqueio.
- **Verificação futura:** prova read-only de capacidade, fixtures de projeção, sandbox autorizado e readback integral; não trocar a fonte canônica no meio da entrega.
- **Saída:** compatibilidade Plane só declarada após essa prova. Não bloqueia entrega local quando Plane não foi selecionado.

### X02 — Skill Accelerate do Hermes condicional

- **Resultado:** eliminar ambiguidade de identidade entre governança local e produto standalone quando esse ambiente entrar no escopo.
- **Entradas/dependências:** T14; decisão se a skill Hermes permanece distinta/nomeada como governança ou adota a entrada standalone.
- **Alvos:** `HERMES_SKILL/SKILL.md` e referências somente após escopo explícito; políticas efetivas e consumers precisam ser descobertos antes de qualquer alteração.
- **Fronteira:** não copiar ACC por cima da governança Hermes, não remover gates ou mudar perfis silenciosamente.
- **Aceite:** nomes/responsabilidades inequívocos e sessão nova comprovada; regras locais de segurança preservadas.
- **Verificação futura:** runtime truth e workflow Hermes próprios quando autorizado. Não realizado nesta auditoria dos repositórios.
- **Saída:** reconciliação de instalação separada da correção do produto.

### X03 — Piloto do consumidor SDD condicional

- **Resultado:** demonstrar recebibilidade do pacote por um executor independente sem replanejamento paralelo.
- **Entradas/dependências:** T10, T13, T16; projeto fixture e implementação explicitamente autorizados.
- **Fronteira:** consumidor é dono da implementação; ASDS só corrige seu plano se devolvido um defeito concreto.
- **Aceite:** executor usa contrato/revisão, revisor testa fidelidade e qualidade do código, progresso separado; resultado não reabre intake/planejamento completo nem transfere execução ao ASDS.
- **Verificação futura:** execução delimitada em fixture, evidências reais e declaração de autorização. Sem piloto, pode-se provar compreensão por um leitor sem executar o domínio.
- **Saída:** prova de integração opcional, não obrigação para encerrar todo planejamento.

## 8. Matriz de aceitação do produto corrigido

| Caso | Resultado exigido | Donos |
|---|---|---|
| A01 Conversa sobre segurança/planejamento | Resposta, sem ativação/escrita indevida | T11, T14, T16 |
| A02 Plano explícito de alteração mínima | Índice/folha proporcionais; zero implementação | T05, T11, T16 |
| A03 Pedido originalmente de implementação | ASDS entrega somente contribuição de planejamento; objetivo original não falsamente concluído | T10, T11, T13 |
| A04 Contexto completo e decisões dadas | Reutilizar; nenhuma entrevista/aprovação redundante | T04, T05, T12 |
| A05 Lacuna material localizável | Inspeção delimitada antes de perguntar; fontes explícitas | T05, T12, T16 |
| A06 Lacuna humana não respondida | Bloqueio localizado, resto persistido, estado parcial honesto | T05, T09, T16 |
| A07 Resultado amplo | Split espontâneo e revisão das fronteiras, não por contagem de arquivos | T02, T07, T16 |
| A08 Hierarquia profunda | Composição válida e DAG acíclico separados | T02, T03 |
| A09 Folhas no mesmo arquivo | Contratos separados; recomendação sequencial se necessário | T03, T07 |
| A10 Seções vazias de significado com YAML válido | Não promovidas por parsing/`ready` | T06, T07, T16 |
| A11 Requisito negativo ou preservação omitido | Achado de fidelidade; promoção bloqueada | T04, T06 |
| A12 Correção após review | Parecer afetado invalidado, reavaliação da nova revisão | T06, T07, T10 |
| A13 OpenSpec ausente/recusado/schema diferente | Saída equivalente e config preservada | T08, T12 |
| A14 Sem subagentes | Planejamento possível; independência não fabricada, gate obrigatório preservado | T07, T12 |
| A15 Interrupção durante revisão persistida | Último pacote coerente recuperável; nenhuma deleção prematura | T09 |
| A16 Concorrência/revisão stale/readback divergente | Rejeitar promoção, preservar dados e declarar recuperação | T09, T10 |
| A17 Arquivo de evidência inexistente | Não declarar plano entregue | T09, T10 |
| A18 “Continue implementando” recebido pelo planejador | Retorno explícito ao chamador; nenhuma task implementada pelo ASDS | T10, T13, T16 |
| A19 Plano recebido com execução histórica | Preservar história; revisar planejamento separadamente | T08, T15 |
| A20 Pacote v1/protocolos mistos | Compatibilidade explícita, sem downgrade de garantia silencioso | T10, T11, T15 |
| A21 Sessão nova/harness selecionado | Carga real do entrypoint, contrato correto e limites observados | T17 |
| A22 Plane selecionado | Equivalência e readback integral, ou bloqueio explícito | X01 |

## 9. Ordem e verificação para o consumidor futuro

Esta é ordem de dependências para a arquitetura final, não versões provisórias de produto:

1. T01 fixa o contrato e a referência de qualidade.
2. T02/T03 e T04 podem avançar em frentes independentes com ownership de arquivos coordenado.
3. T05 liga camadas e prontidão; T06/T07 ligam revisão real; T08 resolve armazenamento sem OpenSpec.
4. T09 prova persistência; T10/T11 fecham retorno/entrada; T12/T13 alinham o método e isolam execução.
5. T14 reconcilia todas as autoridades; T15/T16 comprovam mecanismos e comportamento.
6. T17 distribui/qualifica apenas destinos autorizados. X01–X03 só quando selecionados.

Arquivos compartilhados como `lib/contracts.mjs`, `lib/validation.mjs` e `planning.md` exigem sequência de escrita ou dono único de integração. A independência lógica das tarefas não concede concorrência de edição. Não criar worktrees/clones como atalho sem autorização de instalação/isolamento aplicável.

Comandos existentes para baseline/regressão (executar nos respectivos roots):

- ACC: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider tests/test_entry.py tests/test_routing.py tests/test_v1_authority.py`.
- ACC, antes de release: `bash tests/all.sh`; reportar individualmente qualquer fixture/suíte histórica ou ambiente bloqueado.
- ASDS, Node compatível já selecionado: `node --test tests/*.test.js`, `node scripts/validate.mjs`, `node scripts/check.mjs`.
- Seam: `node scripts/check-accelerate-handoff.mjs --accelerate <ACC>`.
- Ambos: `git diff --check`.

Os testes novos propostos só entram nos comandos após existirem. Cada mudança comportamental deve ter RED que demonstra a lacuna, implementação e GREEN do candidato final. Não tratar verificação futura como realizada neste plano. Não há obrigação de commit para produzir hashes/revisões; quando houver commit autorizado, a revisão deve acompanhar o candidato posterior às correções.

### Definição de conclusão da correção

- Fontes e projeções ativas concordam: ASDS planeja e entrega, não implementa.
- Todas as camadas são avaliadas com evidência e saída proporcional; não há skip silencioso ou elaboração infinita.
- TASKS/contratos são completos, recebíveis, rastreáveis, revisados e conferidos no destino.
- Hierarquia/DAG/partialidade/refinamento preservam identidade e requisitos.
- Revisão estrutural, semântica, de persistência e comportamental são declaradas separadamente.
- Ausência de OpenSpec/modelo/spawn não inventa autoridade ou rebaixa qualidade; limitações de independência são honestas.
- Plano entregue não implica tasks implementadas; contrato de consumo e fim de ownership comprovados.
- Nenhuma instalação/export/Plane/release é anunciada sem prova própria. Destinos opcionais não selecionados aparecem como tais, não como pendências escondidas.

## 10. Decisões humanas remanescentes — não reabrir finalidade

Não bloqueiam a elaboração deste plano:

- Autorizar ou não a implementação das correções e edição das autoridades pertinentes.
- Para T09, aprovar a estratégia concreta caso necessite cópia transitória/retenção/backup excepcional; apresentar caminhos, limite de espaço e limpeza antes de criá-los.
- Selecionar destinos de entrega/qualificação: local, Plane, harnesses; a proposta base é local e portátil.
- Incluir ou não reconciliação Hermes e piloto de consumidor externo.
- Autorizar commit/push/release/instalação quando houver candidato comprovado.

Não pedir novamente se ASDS é planejador, se deve entregar tasks ou se uma folha ampla deve ser refinada dentro do escopo: essas decisões já estão dadas.

## 11. Fontes principais e limites desta entrega

Referências dentro do ASDS:

- [Autoridade local](../../AGENTS.md) e [estado evolutivo](../../PROJECT-STATUS.md).
- [Pesquisa anterior](../research/2026-10-03-planning-core/REPORT.md) e [mapa anterior](../research/2026-10-03-planning-core/CHANGE-MAP.md), reavaliados, não aplicados por mera leitura.
- [Sondagens reproduzíveis](../research/2026-10-03-planning-core/probes.mjs).
- [Skill ativa de fonte](../../skills/spec-driven-superpowers/SKILL.md).
- [Planejamento](../../skills/spec-driven-superpowers/references/planning.md), [ativação](../../skills/spec-driven-superpowers/references/activation.md), [protocolo antigo](../../skills/spec-driven-superpowers/references/protocol.md).
- [SDD distribuído pelo projeto](../../skills/superpowers/subagent-driven-development/SKILL.md) e [writing-plans](../../skills/superpowers/writing-plans/SKILL.md).
- [Hierarquia](../../lib/decomposition.mjs), [contratos](../../lib/contracts.mjs), [validação](../../lib/validation.mjs), [handoff](../../lib/handoff.mjs).
- [Schema](../../schemas/superpowers-bridge/schema.yaml) e [template de tarefa](../../schemas/superpowers-bridge/templates/task-template.md).

Referências ACC, sob o root explicitamente auditado: `SKILL.md:14–29`, `core/asds-integration.md:5–15`, `core/entry.py:54–56`, `core/routing.py:6–14`, `adapters/runtime/opencode/accelerate-plugin.js:10–22`, `global-runtime/accelerate/SKILL.md` e testes entry/routing/authority.

Os limites não são ocultados: não se fez auditoria linha a linha de todo o catálogo, nova pesquisa de API Plane, migração de instalação, benchmark de modelos nem prova universal de harness. As evidências históricas orientam cenários, mas não certificam o candidato futuro. Este documento entrega o plano de correção solicitado; não entrega as correções implementadas.
