# Rodada 2 — revisão/ampliação de planejamento no worktree Prop4You

Data: 2026-10-08. Rodada concluída. Decomposição/índice/DAG melhoraram; validação OpenSpec reprovou a entrega.

## Método e isolamento

Novo agente nativo Codex: `/root/login_planning_round2_clean`, criado com
`fork_turns: none`, modelo/effort herdados do coordenador, sem overrides.
Não houve chamada CLI `codex exec`, flag `--yolo` ou novo worktree.
O contexto conversacional está limpo; o filesystem retém o pacote r1 e as alterações
preexistentes, pois a encomenda requer evolução no mesmo worktree.

Destino: `/home/marcelo-karval/Backup/Projetos/prop4you/prop4you-platform/.worktrees/login-validation-observation`.
Branch: `experiment/login-validation-observation`; HEAD: `fe4d8b5ff8a7bb69d5147abc94ea802c5e29c58f`.
Os hashes de 109 arquivos anteriores e o prompt exato estão no
[baseline](2026-10-08-login-readiness-round2-baseline.json).

Antes da rodada, o instalador padrão atualizou in-place a ativação já autorizada:
`node scripts/install.mjs --scope project --target <worktree> --update --activate --apply`.
Resultado: 96 arquivos instalados/verificados, sem distribuição alternativa ou backup.
O agente recebeu somente o pedido natural, alvo, autorizações/limites e caminhos das
skills/toolkit, sem resultados anteriores ou rubrica do avaliador.

## Rubrica reservada ao avaliador

1. IDs anteriores conservados conforme o resultado que representam; novos IDs numéricos
   sem colisões ou reaproveitamento; ordem visual não deve criar dependências falsas.
2. Composição distinta de precedência; folhas com resultado independente; pacotes não executáveis.
3. Toda task/aggregate com exatamente um link em `tasks.md`; nenhum segundo índice operacional.
4. Novas e refinadas tarefas alimentam o mesmo índice; manifesto é projeção consistente.
5. Cada folha permite a uma IA sem conversa entender fontes, entradas, saídas, escopo,
   preservações, exceções, aceite e verificação futura.
6. DAG sem ciclos, dependências justificadas por outputs e conflitos de escrita/recursos explícitos.
7. Bloqueios localizados com dono/resolvedora/consumidores; estado inicial e ondas futuras distintos.
8. Reutilização de Auth/recovery existentes e preservação das regras de segurança e senhas legadas.
9. Fidelity antes de quality, revisão independente de Auth, correções na revisão atual e readback.
10. Nenhuma implementação de aplicação ou chamada real Auth; alterações anteriores preservadas.

## Revisão independente do núcleo durante a observação

Verificação focal: `node --test tests/planning-graph.test.js tests/validation.test.js tests/planning-negative-paths.test.js`:
62/62 passaram. `git diff --check` passou. Esses testes não certificam qualidade semântica.

Sondagens puras reproduzidas em `lib/planning-graph.mjs`:

- `validateDecisionRouting` aceita dois blockers distintos para a mesma decisão, embora o contrato diga exatamente um.
- Aceita blocker que afeta uma task independente e não os consumidores declarados da decisão.
- Aceita IDs de decisão duplicados.
- Aceita blocker de um pacote que contém a própria resolvedora; a checagem atual examina apenas o ID direto.
- `projectTaskManager` aceita completedTaskIds de um dependente sem conclusão da predecessora, produzindo `completed` com `waitingOn` não vazio.
- `validateDecisionRouting` com decisão null lança TypeError ao acessar id antes de validar os envelopes.

Por inspeção, `validateChange` valida bijeção de IDs/links, mas não sequência numérica,
preservação de IDs entre revisões ou concordância de títulos/waves do índice.
O comando `plan.mjs manager` varre os contratos do diretório sem consultar `tasks.md`.
Esses são limites do núcleo, não afirmações sobre o comportamento final do participante.

Nenhuma correção adicional do núcleo foi aplicada durante a rodada: a versão testada
permanece estável enquanto o participante trabalha.
## Resultado da rodada e conferência do observador

O participante encerrou com `state: delivered` e retorno planning v2; revisão
`login-access-recovery-r2`, candidate
`e39f263cba3eaea967423cb9bae1da4df610a96e62a6db4727058b7211b11f9f`.
Essa é a declaração do fluxo; a avaliação abaixo distingue as provas que passaram
da rejeição independente OpenSpec.

Fontes do ASDS congeladas antes do término:
```jsonl
{"path":"skills/spec-driven-superpowers/SKILL.md","sha256":"3418aa3cdb9fc09ff99b946e42752d8c2bfcaca6ee8e7a9b5d45fe8874c8126d"}
{"path":"lib/planning-graph.mjs","sha256":"aa2fb678685d895bc549104dd757b1f8bacf318c8a70585cb14a81e2aaaae365"}
{"path":"lib/validation.mjs","sha256":"5f8a2d8e3f47773e7aedfb48a6c788dd4424a031f368ba6caf4de242ac9ff7a0"}
{"path":"scripts/plan.mjs","sha256":"8b07fd18deeb9697a8f21835e6f71901845445287814901ae9eeecb054770999"}
{"path":"schemas/superpowers-bridge/schema.yaml","sha256":"c2126f994e7baccf4512d159393988b53def89de272a457c8456acdcdd889093"}
{"path":"schemas/superpowers-bridge/templates/planning-manifest.json","sha256":"9709c8a36e3df59dc5f2ae4d95bf7cf27b52b3f487699adf8744d339aed3a352"}
```

Conferência direta do observador:

- Nove folhas: 0001–0009; quatro pacotes: 0100, 0110, 0120, 0130.
- Treze entradas únicas em tasks.md; nenhum órfão, colisão ou divergência de título.
- IDs 0001–0004 conservados, com refinamento descrito no design; folhas novas continuam 0005–0009.
- Pacotes em faixa numérica distinta; não existe regra de allocator/padding/gaps que imponha essa escolha.
- Mesmo pacote e mesmo índice; nenhuma segunda checklist operacional do change.
- Cabeçalhos de ondas coincidem com taskManager.plannedWaves.
- 32 hashes de fontes e 21 referências finais conferidos sem divergência.
- readPlanningBundle leu os 22 arquivos da revisão; hashes e inventário finais conferidos.
- Baseline dos três arquivos da tentativa de implementação anterior e openspec/config.yaml inalterado.
- ASDS validate.mjs --change passou; projeção manager recomputada igual à persistida; diff check passou.
- Nenhuma execução de aplicação, browser/provider, autenticação real, instalação de dependências ou commit.
- Apenas a ativação ASDS preexistente foi atualizada pelo coordenador antes da rodada.
- O participante informa que não leu memórias/históricos/evals; contexto de spawn realmente foi fork_turns:none.
  Um worktree reaproveitado preserva contexto em arquivos e não equivale a filesystem limpo.

### Decomposição e contexto para implementação

A separação melhorou concretamente: UI login (0002), servidor login (0005), UX recovery
(0006), servidor recovery (0007), redirects/callback (0009), prova integrada browser
(0003), prova de retries/antiabuso (0008), compatibilidade/ADR (0001) e reconciliação (0004).
Cada folha tem dono, write scope, fonte, cenários, acceptance, comandos futuros e limites.

D1–D5 foram resolvidas durante o planejamento pelas instruções e contratos existentes.
Assim, não há necessidade de três investigações de decisão futuras artificiais:
0001 conserva evidência documental de compatibilidade, enquanto UI e servidor consomem
a decisão já dada. Esta rodada não exercitou uma decisão material ainda pendente nem
prova que os gates de blockers funcionarão numa próxima entrada ambígua.

Qualidade suficiente para entender os recortes, mas ainda com problemas:

1. A spec tem `# ADDED Requirements`, não `## ADDED Requirements`. O OpenSpec instalado
   rejeita o pacote com dois erros de delta ausente; isso também ocorre no modo padrão,
   não apenas no strict. ASDS passou porque sua validação de specs só coleta cenários
   e não verifica esse contrato do adaptador. A revisão independente não detectou essa falha.
2. Todos os cenários usam o mesmo GIVEN/WHEN/THEN genérico, remetendo à aceitação das
   tasks. Falta comportamento concreto na spec para revisão independente dos contratos.
   A cobertura formal existe, mas não certifica a fidelidade dessa cadeia circular.
3. `dependencyDetails.reason` repete "Consumir resultado verificável antes de iniciar
   esta tarefa" para todas as relações. Os requiredOutputs são específicos e repetidos
   no corpo; os motivos ainda não explicam a consequência concreta de faltar o predecessor.
4. Verification/Definition of done repetem boilerplate (inclusive regra de package em
   folhas e texto de comandos no aggregate). Convém separar checks executáveis de
   inspeção manual e declarar resultados esperados por teste.
5. Requisitos R11/R13 sobre entrega do próprio planejamento aparecem como acceptance
   da reconciliação futura. Devem continuar visíveis como políticas de entrega, com
   distinção explícita das funcionalidades futuras e da conclusão das folhas.

O helper recovery declara FUTURE_SKEW_SECONDS=30, mas exige age>=0 junto às demais
condições: seu comportamento efetivo rejeita qualquer timestamp futuro. Portanto,
A-0007-R08 não constitui endurecimento dessa regra; não foi registrado como defeito.

### DAG, blockers e sequência

| Folha | Predecessoras por output | Bloqueia diretamente |
| --- | --- | --- |
| 0001 compatibilidade/ADR | nenhuma | 0003, 0004 |
| 0002 UI login | nenhuma | 0003, 0008 |
| 0005 servidor login | nenhuma | 0003, 0008 |
| 0006 UX recovery | nenhuma | 0003, 0008 |
| 0007 servidor recovery | nenhuma | 0003, 0008 |
| 0009 redirects/callback | nenhuma | 0003 |
| 0003 prova browser | 0001, 0002, 0005, 0006, 0007, 0009 | 0004 |
| 0008 retries/antiabuso | 0002, 0005, 0006, 0007 | 0004 |
| 0004 reconciliação | 0001, 0003, 0008 | nenhuma |

Frontier: ready 0001/0002/0005/0006/0007/0009; waiting 0003/0004/0008.
Não há blockers de decisão: D1–D5 estão resolved. Ready expressa pré-condições
lógicas satisfeitas, não autorização de execução nem disponibilidade simultânea.

Ondas sugeridas: [0001,0002,0005,0006,0009] → [0007] → [0003] → [0008] → [0004].
0005 e 0007 escrevem os mesmos actions.ts/actions.test.ts; precisam de serialização.
0003 e 0008 usam a mesma stack sintética; precisam de exclusão de recurso.
0007 não depende logicamente de 0005, e 0008 não depende logicamente de 0003:
essas ordens são a recomendação conservadora do compilador, podem ser invertidas
quando inputs e reserva de recursos permitirem. Não criar edges falsas só para
ordenar os números. A implementação não seguiria 0001→0002→...→0009.

O revisor independente real encontrou Q01: 0008 testava pending da UI sem depender
do candidato UI. Autor corrigiu deps para 0002/0005/0006/0007 e revisor reavaliou
fidelity antes de quality sobre o candidate corrigido. Finding completo em
reviews/independent-review.md no worktree. Esta parte do loop foi demonstrada.

### Autoridade de tasks.md e gerenciadores

No pacote observado, tasks.md permaneceu o índice único e recebeu todas as novas tasks.
Contratos individuais definem relações/conteúdo e o manifesto carrega cópia/projeção
comparada à fonte. Esse arranjo não exige repetir todo contrato no índice.

Ainda não há garantia universal dessa autoridade: manager lê a pasta sem validar o
índice; validateChange não confere títulos/waves/numerical allocation/stable IDs entre
revisões. Para um tracker sem mutex/recursos, conflicts precisam ser traduzidos em
serialização explícita pelo consumidor e conferidos após importação; apenas importar
dependsOn libera 0005 e 0007 simultaneamente. Não houve escrita em Plane/Linear.

### Correções prioritárias recomendadas

1. Fechar validação do adaptador OpenSpec quando a entrega usa essa planning home,
   validando headers/deltas e formato normativo antes de aceitar delivered.
2. Fortalecer revisão de spec: cenários comportamentais específicos, dependências
   justificadas concretamente e critérios sem boilerplate que deixe regra de produto aberta.
3. Fazer exportadores consumirem o índice canônico validado e conferir IDs/títulos/waves;
   registrar identidade e refinamentos entre revisões sem renumerar o trabalho existente.
4. Fechar as sondagens do núcleo: unicidade/routing de blockers, expansão de packages,
   envelopes malformados, completed inconsistente e conflitos no consumo externo.
5. Em nova rodada posterior, provocar mudança de escopo e uma decisão genuinamente
   pendente; avaliar retomada/realimentação do índice e preservação do último pacote coerente.

Conclusão do observador: **melhoria de decomposição/DAG/índice demonstrada; entrega
OpenSpec ainda reprovada e gates adicionais do núcleo precisam de correção**.
Não alterei o pacote produzido após o encerramento para mascarar o resultado;
o artefato reprovado foi preservado como evidência. Nenhuma nova correção de source
foi aplicada nesta rodada de revisão/avaliação.

## Remediação posterior do framework

Após encerrar e preservar a rodada, uma etapa separada corrigiu o source do ASDS,
sem reescrever o pacote Prop4You:

- o gate de entrega passou a rejeitar delta OpenSpec sem heading level-two,
  requisito normativo ou cenário WHEN/THEN;
- projeções por diretório passaram a consumir o inventário de `tasks.md`, conferindo
  bijeção, título exato, ordem numérica e ondas contra o manifest;
- a projeção exporta `serializesWith`, rejeita dependente completed com pré-requisito
  incompleto e mantém conflitos separados de precedência;
- decisões/blockers duplicados, malformados, não relacionados ou que incluem o
  próprio resolver são rejeitados;
- templates e referências exigem outputs/motivos concretos e preservação de IDs.

Evidência posterior: ASDS `297/297`, check/validate/diff-check verdes e OpenSpec
strict `5/5`; Accelerate `tests/all.sh` e diff-check verdes. Contra este pacote
negativo preservado, o ASDS corrigido agora acusa `no OpenSpec delta section` e
`taskManager projection is absent or stale`; o OpenSpec continua acusando zero
deltas. O novo `plan.mjs manager` recompila as nove folhas do índice e torna
explícitos os conflitos 0003/0008 e 0005/0007. Isso qualifica a correção estrutural,
mas uma nova sessão limpa ainda precisa avaliar a qualidade semântica produzida.
