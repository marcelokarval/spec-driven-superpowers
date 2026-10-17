# Correção passiva C0 — registro de execução

## Mandato e limites

Mandato humano C0 recebido nesta sessão, checkout autorizado `9bbc3fe` com deltas
preexistentes. Um escritor, sem nested/subagents, inferência, sessões de planejamento,
serviços/listeners, restart, instalação global, consumidor operacional, commit ou push.
O relatório DEVIATION-AUDIT-AND-FLOW.md foi lido integralmente e preservado. Fonte,
testes, skills, referências, schema, distribuição e documentação ativa são a candidata
local; ROOT mantém review independente e C10 nativo após congelamento.

## C1 — evidência comportamental

- `TMPDIR=/tmp/opencode node --test tests/passive-correction.test.js`: RED real A07
  (nome não rejeitado, duas aprovações fabricadas), A08 (grant true por default), A09
  (autor/policy fora do hash). A primeira tentativa A08 tinha fixture sem tasks e
  falhou por estrutura; não conta como RED. Foi corrigida e repetida: os três REDs
  comportamentais então reproduzidos, exit 1.
- A01/A02: caracterização **histórica**, não um RED prévio à nova implementação.
  `git show 9bbc3fe:lib/planning-store.mjs` importado em memória via data URL, imports
  locais absolutos; nenhuma cópia operacional/staging. `createPlanningReviewAuthority`
  rejeitou um host de fixture completo; receipt histórico com sessões/atores F/Q
  distintos rejeitou com `adapter-attested ... differs`. Duas asserções positivas
  falharam, exit 1. Não chamar essa caracterização posterior de TDD cronológico.
- Closure fresh-payload: RED adicional real `ERR_MODULE_NOT_FOUND .../lib/install.mjs`
  através de validation. Corrigido extraindo `skill-discovery.mjs`, sem recolocar o
  instalador/driver no payload.
- Logs integrais permanecem nos resultados shell desta sessão (sem novos dumps).

## C2–C8 — candidata implementada

- Removidos plugin/worker/listeners, cliente/core/profile/store da authority, RPC,
  provisionamento/qualificação de daemon, templates operacionais e testes específicos
  daquele runtime. Removidos supervisor headless AGY, prompt primary-only e servidor
  visual/start/stop; brainstorming permanece com artefato estático.
- Antes da remoção: listagem de caminhos/tamanhos, dependentes por rg, links,
  processos e mounts conferidos; nenhum consumidor/processo/mount desses componentes
  observado. Nenhum dado exclusivo/credencial/base ativa foi removido.
- História em docs preservada com notas de supersessão; source-evidence, auditoria
  aprovada e FINAL-SOURCE-SHA256.txt não reescritos como evidência nova. Sem cópias
  operacionais escondidas. Os quatro observations alheios preservados.
- `asds.harness-planning-review/1`: representação por etapa, autor/reviewer actor e
  sessão explícitos, role independente de identidade, assignment e material/policy/
  inventory binding, evidence IDs/digests/path/observer, findings e limitações. Quality
  exige F pass registrada e seu envelopeDigest exato; parent coordenador permitido.
- Registrar é operação explícita única; não cria PASS/Q, grants ou IDs; não altera
  boundaries/tasks. Resultado persistido é lido e hasheado, alterações detectadas.
  Falha/blocked sem finding artificial são válidos; não promovem readiness.
- Material inclui autor, policy, contexto e referências source/context explícitas.
  Reviews/evidências/readback excluídos do candidato e incluídos na identidade final.
  Recompilação invalida ambos os reviews com drift e preserva checkboxes canônicos.
- Builder não inventa grant/readback/layer satisfeita; exige avaliação explícita.
  `--state delivered` falha antes de alterações. Operações de compilação conservam
  bytes anteriores em memória e restauram em falha ordinária, sem backups retidos.
- Store verifica registros/bytes/lifecycle, não autentica harness malicioso. Ready +
  grant real de destino + CAS permitem publicação e finalização; reabre pacote final.
  Publicação usa lock, rename, fsync e rollback ordinário em memória. Não promete
  transação de diretório resistente a SIGKILL entre múltiplos arquivos.
- Planning return reabre receipt e pode liberar ownership. Handoff determinístico
  aceita o novo pacote preservando escopo/seleção/grants/workspace Stage-3. Nenhuma
  execução de produto. Journals/packets/autorizações preservados.
- `lib/host-bridge.mjs` permanece **repository-only legacy/native Stage-3**, com seus
  testes, mas fora do fechamento distribuído planner/consumer. Não afirmar que sua
  API source deixou de ter drivers. Scripts distribuídos não despacham inferência.
- Parsers/inspectors AGY históricos preservados isolados; APIs antigas não são gates
  do novo caminho. Installer não distribui contrato bloqueante, supervisor, authority
  ou servidor; preserva ownership, manifests/migration e proteção contra drift.
- Raiz/skill/cópias, adapters nativos, README/PROJECT-STATUS e contrato ativo alinhados.
  Plane export é JSON neutro, sem inventar projeto/issue ou fazer HTTP.

## APIs e C10 ROOT

Contrato: `references/harness-planning-review.md`; JSON Schema:
`schemas/harness-planning-review.schema.json`; exports públicos também por
`lib/planning-review.mjs`. Helpers não autenticam origem operacional nem semântica.

CLI: `scripts/planning-review.mjs inspect|record|ready|publish|verify`.
`record --change DIR --input ONE_REVIEW.json` não compila/edita tasks.
`publish --change DIR --observer SESSION --expected-manifest-sha256 HASH --output
RECEIPT.json`; `verify --receipt RECEIPT.json` em outro processo Node.

Kit intencionalmente retido para ROOT: `/tmp/opencode/asds-passive-c10` com README,
spec CSV-own-orders significativo de quatro tasks, novo exemplo de observação JSON
com placeholders inválidos e helper determinístico seal-observed. Originais em
`examples/passive-planning`. Nenhum resultado nativo/grant real fabricado. ROOT deve
confirmar as avaliações de layers/boundaries, preencher IDs reais, despachar F/Q e ler
suas sessões. Handoff operacional só com observação/seleção/grants separados reais;
ausência deles impede esse claim, não entrega de planejamento.

## C9 — validação e congelamento

Foco final: `TMPDIR=/tmp/opencode node --test tests/passive-correction.test.js
tests/planning-review.test.js tests/planning-store.test.js tests/package-builder.test.js
tests/handoff.test.js tests/agy-agent.test.js tests/agy-review-protocol.test.js
tests/execution-handoff.test.js`: **77/77**, exit 0. `npm run check`, `npm run validate`,
`git diff --check`: exit 0. Positivos são fixtures explicitamente sintéticas, não
qualificação nativa; incluem processo Node novo, publish ordinary-failure/CAS,
return/handoff sem run, progresso, evidência alterada e matriz negativa.

Fonte/API/payload congelados para a suíte completa. Hashes esperados de superfícies
ativas NÃO atualizados. Falha de snapshot será reportada à ROOT sem downgrade.
Resultado full, hashes atuais e resíduos serão anexados após observação.

### Hashes para review independente (fonte congelada)

Único snapshot ativo divergente dos dez esperados em workflow:
`skills/spec-driven-superpowers/SKILL.md` atual
`6b5e4ca01d499e9c661e8d33990b64c0769e4522f93164b7765e274d66670275`,
esperado preservado `013d09396ab720b4dbf463410b2dd28c75ed0723a3de84da49edd0a62dacd124`.
Os outros nove continuam iguais. ROOT/oracle deve revisar os bytes novos antes de
ROOT atualizar esse valor mecanicamente. O delta preexistente de workflow foi
preservado; nenhum expected snapshot foi alterado durante este mandato.

```text
2e7f09266a65435c50ade7fff8ef357bdfe6c0c938ad1cbe91fcffd28cd901d5  lib/harness-planning-review.mjs
c6be4f36809acb4f2eb9beafc97e07cb37f5cdc43f24f27199747924eefd6361  lib/planning-review.mjs
78793e3f857ac9333c2505997a0263f1b8b899281c173b399ea7a6d9a9ad91cf  lib/package-builder.mjs
9d20e8933c263e22b7abe3dfd6b2025e828b1d12005e168054a82d4ff5496fa0  lib/planning-store.mjs
ff33670cca2de4dbee37de9607286188670a742cf322d25a578e171f3173806b  lib/planning-lifecycle.mjs
fad948ee132f7280f7d37ebcdfbee7b0144d07ef49a8488c8a5acb38b0bb1c09  lib/handoff.mjs
9133f777d651927e7cba49cb3143270417242cb3e4f41538cf754ed034753a80  lib/execution-handoff.mjs
bf80473c00a67bb3e0dc02158a38b6f1dd58a384356bd4044c1e1ae252c553b2  lib/install.mjs
7b18d2d615c0b4a99652dea1906df093e8a68f7c9f5e1e6f409369e6bc2c9399  lib/skill-discovery.mjs
b19d0976efbceea26bdb46993a605bb99082b9e1c7f8447f08181f1306e2292e  lib/validation.mjs
bde33bcf972c60b17f793dfdc937b441f281b6f0cae72b8d289ac6eb6390e9bb  scripts/planning-review.mjs
f06bc8a7081759a96e7fbeb6c3d7e14cc959b9cba64b15ce9cc677bfdeb82fa8  scripts/build-package.mjs
dae1ffb1a6fd6b38c31bf5eb5127a9bf220a4e176441c3d2612940be00906b90  schemas/harness-planning-review.schema.json
5c24b8ee44801248be5471e148d9399b0c6d1884578aa034e6402b3d49ebe63b  tests/passive-correction.test.js
```

Observations conferidos novamente: os quatro SHA-256 coincidem integralmente com o
mandato humano. Arquivos de auditoria/final manifest/source-evidence preservados;
kit C10 explicitamente retido para ROOT, não é instalação ou runtime alternativo.

### Reconciliação delimitada após a primeira suíte completa

Primeira suíte congelada: shell `sh_1400bb964001t3t0sIC8hNY3C3`, **556/579**,
23 falhas, tests=1/check=0/validate=0/diff=0. Não foi GREEN. Além do snapshot,
falhas estavam em update/install/index: fixture tentava apagar/esperava reinstalar
contrato retirado, código de reconciliação compartilhada ainda buscava esse contrato
ausente, expectativa exigia host-bridge no payload, provenance exigia servidor.
As 20 falhas de update combinavam fixture/asserções obsoletas e seis falhas em
reconciliação compartilhada; não eram todas meramente snapshots.

Correção delimitada, sem relaxar ownership/migração: remover branches mortos de
contrato na reconciliação; esperar ausência explícita do contrato no setup/saída;
preservar todos os cenários de foreign/symlink/hardlink/rollback/SIGKILL. Vendor
provenance conserva identidades upstream e anota os três recursos retirados, com
teste de paths exatos e ausência, em vez de mentir que ainda são distribuídos.
O helper visual remanescente foi tornado estritamente local: sem conexão/retry
WebSocket; interações ficam na página. Sem mudança de layout/estilo.

Foco de reconciliação `tests/update.test.js tests/install.test.js tests/index.test.js`:
61/63; duas asserções restantes ainda exigiam contrato e foram corrigidas para
ausência. Foco final dessas duas (`--test-name-pattern='explicit SHA-bound legacy
adoption|legacy migration resumes every SIGKILL'`): **2/2**, incluindo todos os
boundaries SIGKILL desse cenário. check/validate/diff-check exit 0.

Fonte final recongelada. A tabela anterior é identidade da primeira candidata;
manifesto **atual** com 57 arquivos e lista de remoções:
`PASSIVE-SOURCE-SHA256.txt`. Não substitui FINAL-SOURCE-SHA256.txt histórico.
Hashes finais adicionais/substitutos:

```text
dcf86eacbe7151fad4a6634169bccec16d2e71eda19caf7c4083bf23acae3150  lib/install.mjs
bf3c7e9a1c558782ba85d86180410159c1017dae54429f5517a073d7009a5c78  skills/superpowers/brainstorming/scripts/helper.js
250d3f661b437f69075f65ff2da06cfa9efad11b881f88abf9ab735870be1fb1  vendor-provenance.json
```

Última conferência de temporários passivos/authority: somente o kit C10 solicitado
permanece em `/tmp/opencode/asds-passive-c10`; fixtures próprias foram removidas.
Não houve instalação/migração de deployment real; versões instaladas anteriores
não foram atualizadas como efeito colateral. Aplicar eventual update exige seu
próprio escopo/grant e inspeção de manifests/dados locais.

### Resultado final observado — STOP no snapshot

Shell `sh_14010263b001hSzigM9P7dvLFR`:

- `TMPDIR=/tmp/opencode npm test`: **578/579**, exit **1**.
- Única falha: `tests/workflow.test.js:273`, snapshot ativo da skill, hash atual e
  esperado registrados acima. Não alterado pelo implementador. STOP respeitado.
- `npm run check`: exit **0**; `npm run validate`: exit **0**;
  `git diff --check`: exit **0**.
- Todos os testes atuais de migração/ownership/SIGKILL e Stage-3 passaram nesta
  candidata. Redução de 628 para 579 reflete retirada dos testes dos runtimes
  removidos e regressões passivas novas; não é equivalência de cobertura nativa.

Não anunciar suíte GREEN/aceite. Próximos gates da ROOT: review independente do diff
e dos bytes da skill; somente então ROOT atualiza o expected hash; C10 nativo com
sessões/resultados reais usando o kit. Nenhum E2E nativo foi executado aqui.

Kit contém também `new-contract.example.json` completo com placeholders inválidos,
sem proveniência fabricada. `observed.example.json` + seal-observed derivam somente
bindings/digest, nunca verdict/findings/limitações/identidades/grants.
Sem commit/push, instalação real ou mudança de configuração global.

## C9 remediation — três achados independentes e snapshot aprovado

Mandato subsequente da ROOT após oracle read-only `ses_ebfe922c2ffe0EpfJccvkv2HSf`.
Parecer lido nesta sessão, sem spawn/delegação. Antes das alterações, os **57 hashes**
do último PASSIVE-SOURCE-SHA256.txt conferiam: nenhuma superfície modificada por
outro escritor detectada. Skills raiz e distribuída tinham exatamente o SHA humano
aprovado `6b5e4ca01d499e9c661e8d33990b64c0769e4522f93164b7765e274d66670275`.
As skills não foram editadas; somente esse expected em workflow foi atualizado,
agora sob aprovação humana expressa posterior ao STOP anterior.

### RED antes das correções

`TMPDIR=/tmp/opencode node --test --test-name-pattern='C9 '
tests/passive-correction.test.js`: primeira execução **0/5**, exit **1**;
desdobramento para isolar os objetos aninhados, segunda execução **0/7**, exit **1**.
Todos comportamentais, não erros de import/fixture:

- ready não lançava erro com boundary persistida pending e F/Q válidas;
- publish não rejeitava a mesma boundary mesmo com manifest ready forçado;
- resync de pedido planning entregue alterava candidateSha256, tanto sem quanto
  com checkbox de progresso;
- parent numérico era aceito; findings e limitations com unknown:true também eram
  aceitos após recalcular o envelopeDigest.

### Correções delimitadas

- Builder consulta `validateReadiness` dos contratos atuais carregados por
  `loadTasks`, não a projeção sem boundary. Store usa os mesmos registradores
  determinísticos existentes antes de publicar e ao verificar receipt nativo.
  Não se usa `validateChange` para esse gate: `[x]` continua progresso do consumer,
  sem exigir receipt de implementação nem executar um comando futuro.
- Resync não altera `originalRequestedProduct.status` em função do estado delivered.
  Preserva o pedido congelado; state/attendance já registram a entrega. Nenhum campo
  material foi excluído/normalizado fora do hash; alterações reais do objetivo ainda
  invalidam ambas as revisões e readback. Não foi necessário editar lifecycle.
- Parent opcional, quando presente, deve texto não vazio (null também rejeitado,
  conforme o schema distribuído). Findings/limitations têm chaves fechadas como no
  schema. Parent nativo textual e parent omitido continuam válidos.
- Regressões incluem rollback do ready rejeitado, publish recusado sem finalizar,
  receipt raw delivered incapaz de contornar readiness, resync preservando hash,
  reviews, readback, delivered e receipt com/sem progresso, e mudança material real
  invalidando as evidências sem apagar `[x]`.

Foco após correções: `TMPDIR=/tmp/opencode node --test
tests/passive-correction.test.js` **13/13**, exit **0**. Foco combinado final:
`TMPDIR=/tmp/opencode node --test tests/passive-correction.test.js
tests/planning-store.test.js tests/planning-lifecycle.test.js tests/package-builder.test.js
tests/handoff.test.js tests/workflow.test.js`: **88/88**, exit **0**.

Fonte/API recongeladas para a cadeia completa exigida. API e kit C10 **inalterados**;
nenhuma inferência C10, instalação, runtime, grant ou publicação externa executada.
Validation Owner final e prova nativa continuam com ROOT. Resultado full e hashes
atualizados abaixo após observação; não reutilizar o antigo 578/579 como resultado
desta candidata corrigida.

### C9 remediation — gate final observado

Comando exato: `TMPDIR=/tmp/opencode npm test && npm run check && npm run validate
&& git diff --check`, shell **`sh_140d3b48d001c47wZaxAElISFw`**, exit **0**.
`npm test`: **586/586**, zero falhas/cancelamentos/skips. check, validate e diff-check
também exit **0**; nenhum teste removido ou pulado na remediação. Acréscimo de sete
regressões sobre os 579 anteriores. O snapshot aprovado agora passa.

Pontos finais para ROOT:

- `lib/package-builder.mjs:487–500`: preservar status do pedido congelado;
  `:552–558`: readiness dos contratos persistidos antes de ready/delivered.
- `lib/planning-store.mjs:61–63,110`: readiness efetiva no receipt nativo e publish.
- `lib/harness-planning-review.mjs:28,42–49`: parent textual opcional e arrays de
  findings/limitations fechados conforme schema.
- `tests/passive-correction.test.js:155–222`: regressões comportamentais;
  `tests/workflow.test.js:113`: único expected humano aprovado atualizado.

PASSIVE-SOURCE-SHA256.txt atualizado apenas para os cinco arquivos autorizados que
mudaram nesta remediação. Os outros 52 hashes conferem; quatro observations também
conferem com os hashes do mandato. Worklog é append-only nesta etapa; histórias,
source-evidence e FINAL-SOURCE-SHA256.txt não editados. Nenhum helper novo necessário:
reuso dos validadores determinísticos existentes, sem dependência nova.

```text
8f9e475d7239a4b5d528f9d11c49b3c3a6ca30be29f89ccbe4683d2daff187c5  lib/harness-planning-review.mjs
262e229041746885e65dfea5ae0687e89f944b2c97317fe7bd0d582c013c7f65  lib/package-builder.mjs
f0d00d7b4123381f88496d97a518cbb325d294e4765a499e92a91d716e0ea4a9  lib/planning-store.mjs
ab939e2cb9f6f37658fae63ae3774c3c1ffb01cc2f5802b090f713d51e3d7085  tests/passive-correction.test.js
416fe03c04e38b186e4c01859add617dbcbd547ff3b3f2f9f142ff09b5e3fb97  tests/workflow.test.js
```

Não equivale a aceite independente ou C10. APIs/kit C10 permanecem os mesmos em
`/tmp/opencode/asds-passive-c10`; nenhum conteúdo do kit foi modificado nesta etapa.
Sem instalação/deployment real, restart, execução de produto, LLM delegado,
commit/push ou alteração de grants/semântica passiva. ROOT faz verificação final e
prova nativa separadamente.

## C10 preparer/coordinator separation — bounded source correction

New human scope fixes the discovered requester/observer conflation, not the author
identity or the frozen native kit. Before edits: all 57 source hashes and every entry
in `/tmp/opencode/asds-passive-c10-native/prepared-files.sha256` matched. Kit candidate
was `850fcb25cc5811b6cfba2f26862efbfa10c556eeabff2f8b7ec81527f8aaaa2a`, with zero
reviews and null readback. No kit file or package material changed in this correction.

### RED and bounded change

Added three explicitly synthetic tests to `tests/passive-correction.test.js`, using
the actual C10 author/coordinator identity SHAPE but synthetic reviewer/result data
only in isolated temporary fixture directories. No native identities/results invented
for the real package. RED command: `TMPDIR=/tmp/opencode node --test
--test-name-pattern='C10 ' tests/passive-correction.test.js`, exit **1**, **1/3**:
different-coordinator positive and the layer transition both failed with `assignment
binding mismatch; explicit observed evidence required`. The negative test passed.

`lib/harness-planning-review.mjs` now requires nonempty actual coordinator session in
requestedBySessionId, the same nonempty observedBySessionId within an envelope and
the same requester/observer across F/Q. It does NOT require equality with author.
Reviewer actor/session are distinct from the recorded author/coordinator identities;
F and Q remain distinct and causally bound. Author=coordinator remains supported.
No new authority, coordinator ID default or impersonation/mapping service introduced.
The schema shape was already compatible; only its relational description was clarified.
Canonical contract instructions and their distributed reference copy were aligned;
SKILL files were not edited.

### Layer inspection and safe transition

No cyclic output hash bug found: `planningCandidateSha256` excludes layers/review/
evidence/readback outputs; `harnessCandidate.inventoryDigest` covers material refs
only; `planningReadbackSha256` explicitly includes layers and reviews. The existing
record CLI adds only the actual supplied review/evidence refs and keeps reviewing;
it does not manufacture C12–C16 assessments. Builder sync forces C15 blocked until
publication; publish sets C15/readback/final state and reopens it.

Synthetic regression starts C12/C13/C14/C15/C16 blocked, registers explicit F/Q under
a distinct coordinator, proves those layers remain blocked, and proves ready rejects
before an explicit observed assessment. Then fixture-only C12/C13/C14/C16 assessments
are applied via existing sync API with the FULL ready gate, followed by CLI ready and
publish/readback. Candidate/inventory/review envelopes remain exact; final readback
identity changes to bind the assessments. C15 is still blocked/null before publish
and satisfied only by publisher. This is deterministic conformance, not native C10.

Exact ROOT recipe is in `references/harness-planning-review.md` under "Updating
review/convergence/delivery layers after actual observations", also in distributed
references. After real F then Q, ROOT authors ONLY the four observed layer assessments
outside the package, verifies actual stored review files, merges into existing layers,
and calls `syncPlanningPackage(...,{state:'ready',layers,reconcilePackages:false,
writeDagMermaid:false,writeDagStatus:false})`. The ready gate deliberately rolls back
if regeneration changes material/reviews. Inspect the NEW ready manifest hash, then
publish with that CAS and actual coordinator observer, then fresh-process verify.
C16 describes reconciled readiness/state/refs/limits, not a claim of prior publication;
C15/readback/delivered must never be set by hand. Material findings require rework and
fresh F/Q, not layer relabeling. No real layer assessment or F/Q was created here.

### Focus and freeze

Post-fix `tests/passive-correction.test.js`: **16/16**, exit **0**.
Combined `TMPDIR=/tmp/opencode node --test tests/passive-correction.test.js
tests/planning-review.test.js tests/handoff.test.js tests/workflow.test.js`:
**45/45**, exit **0**. check/validate/diff-check exit **0**.
Source/API/docs frozen for required full chain; result and updated hashes follow.

### Final observed gate for coordinator correction

`TMPDIR=/tmp/opencode npm test && npm run check && npm run validate && git diff
--check`: **exit 0**, shell **`sh_140e353b7001019f5wC9m9nQeU`**.
Suite **589/589**, zero failures/cancelled/skipped; check/validate/diff-check passed.
Three tests added, none deleted. All observations remain synthetic conformance;
actual ROOT dispatch, semantic acceptance and native C10 remain unperformed here.

Final source lines: `lib/harness-planning-review.mjs:34–43` coordinator semantics;
`tests/passive-correction.test.js:237–308` separation, negatives and output-layer
transition. Safe commands/observed-layer application are documented at
`references/harness-planning-review.md:34–134` and its exact distributed copy.
Schema description at line 5 clarifies the relational rule without changing shape.

PASSIVE-SOURCE-SHA256.txt refreshed for exactly five relevant files; remaining hashes
unchanged. Both SKILL hashes remain the approved
`6b5e4ca01d499e9c661e8d33990b64c0769e4522f93164b7765e274d66670275`.
All C10 prepared-file hashes still match, including the author plan, binding, report
and helper templates. No native review/evidence/layer-success file was created there.
The kit README's historical blocker warning is superseded by THIS source correction;
it was deliberately not rewritten as part of the frozen kit.

```text
04f4f11c16ca7f10f794edaea39a3f12389d9b22dd4423e32cd905eab5a02f33  lib/harness-planning-review.mjs
53541a360fd87212aa5d218632e1f6c5249ebd3676771a9707edab6f2a86af6b  references/harness-planning-review.md
9be08ac39ddd1c5b02f3b5ee726f80ca729d4e3ca361310d8e090bd6afd72090  schemas/harness-planning-review.schema.json
53541a360fd87212aa5d218632e1f6c5249ebd3676771a9707edab6f2a86af6b  skills/spec-driven-superpowers/references/harness-planning-review.md
a903d8c9fed6edebf1a7e9a6118d8d8cfb16ea2f443c754514d2763d049d6a6b  tests/passive-correction.test.js
```

No native F/Q, external inference, provider/host, actual installation, commit/push,
product execution or change to planning grants. No layer cyclic hash workaround,
receipt rewriting or forged author/coordinator identity used.

## C11 — documentation and durable selected evidence only

New explicit human scope: final report, append-only worklog, truthful PROJECT-STATUS,
source-manifest refresh and a small `c10-native-evidence/` audit directory. No product
code/test/SKILL, canonical package or /tmp kit write; no native child/oracle/model,
installation/restart, execution admission, product run or commit/push.

Inspected the actual canonical manifest, receipt, planning-return, intake, native
F/Q records/results/requests and existing local session exports before persisting
evidence. Used allowlists, not export copies: session/message/time/model/agent/finish/
parent plus exact request/final text only. F final
`msg_140e745a20019kf3hxGv4h7aED` from `ses_ebf19f63affe52X2mitA2QWLYi` and Q final
`msg_140e98dc5001pRtq0YOArJtNVo` from `ses_ebf16bee0ffe0gNbD0qgz2SUUG` matched saved
evidence bytes exactly. Both persisted exports show openai/gpt-6-astra/default,
reviewer agent, ROOT parent, stop and succeeded. No raw export, reasoning/encrypted
reasoning, providerState, snapshot, internal tool args/results or token/cost metadata
copied to the repository. Raw exports remain in the canonical /tmp kit for ROOT.

24 exact selected files total **85,122 bytes**: 16 receipt-listed package files and
receipt/return/intake/bindings/observed assessments/requests. Minimal runtime metadata
is 4,754 bytes. Copies retain the ORIGINAL absolute destination and IDs, never a new
live authorized package. This is human-requested audit evidence retention, not an
alternate installation/runtime/operational backup. No unique /tmp evidence removed.

In a new C11 Node process, verifyPlanningReceipt(canonical receipt, delivered) returned
matched=true, no errors, reviewMatched=true; recreating planning-return from the saved
intake/receipt and actual return inputs was deep-equal to saved planning-return:
planning delivered, owner null, original planning fulfilled. Candidate is unchanged
`850fcb25cc5811b6cfba2f26862efbfa10c556eeabff2f8b7ec81527f8aaaa2a`; final manifest
`367c3bcae20e2792871791212dc93027ba40c4c78b681bc0c2508f77d6cd4207`.
Full narrow result: `c10-native-evidence/canonical-readback.json`.

Preserved and reported rather than concealed:
- F-001 and Q-001 are nonmaterial OPEN, with dispositions, not zero findings.
- ROOT reports extra Q `ses_ebf16cc0effenPI3ecvu5aYna2`, PASS but not canonical,
  inadvertently dispatched after restart/continuity confusion. C11 did NOT call/read
  that session; attribution is explicit in metadata/report.
- ROOT reports F duplicate record retry rejected EEXIST/already registered; not retried
  here. One canonical F and exact final bytes were independently compared locally.
- Original material status in_progress and C16 prepublication reason remain verbatim
  even though actual final state/receipt/return are delivered/fulfilled. No silent
  manifest repair, destination relocation or re-review bypass.
- synthetic:false denotes actual observations here, NOT a real app target.
- Stage-2 planning-return handoff is demonstrated, NOT operational Stage-3 admission:
  no real target/grants/enforced boundary. Gate remains; no execution claims.

New PASSIVE-FINAL-REPORT reconciles requested/implemented/proven, including the three
original oracle defects, approved snapshot, extra author/coordinator correction,
589 tests and native flow. Acceptance of ALL source fixes remains with ROOT/oracle
`ses_ebfe922c2ffe0EpfJccvkv2HSf`; not asserted accepted. PROJECT-STATUS now distinguishes
current evidence from earlier source-only/history sections. Both SKILLs untouched.
Deletion evidence confirms six tracked git deletions and 17 now-absent paths from
the historical local authority manifest. No additional removal in C11.

One required full chain will run AFTER these documentation updates, normal explicit
tests only, captured in `c10-native-evidence/c11-validation.log` and status JSON.
Then source hashes (all 57, only PROJECT-STATUS changed in this phase) and separate
final artifact hashes will be finalized without self-hash recursion. No old source
evidence/FINAL-SOURCE manifest rewriting. Final observed result follows.

### C11 observed final gate and evidence limits

Executed the required full chain ONCE after the documentation updates:
`TMPDIR=/tmp/opencode npm test && npm run check && npm run validate && git diff
--check`, **exit 0**, **589/589**, zero failed/cancelled/skipped. Captured directly
in `c10-native-evidence/c11-validation.log`, with actual completion time/status in
`c11-validation-status.json` (2026-10-15T19:04:32Z). Explicit normal tests selection;
no docs/experiment/evidence fixture discovery. Final documentation/result and hash
metadata additions did not change product code/tests/SKILL or canonical package.

The 57-file source manifest is refreshed only for the allowed PROJECT-STATUS entry;
all other 56 source hashes remain the source-frozen values, including the original
three fixes, approved snapshot and additional coordinator correction. Six tracked
deletions match git and the manifest; 17 absent historical local authority paths
are separately attributed, not presented as new git deletions. A separate artifact
manifest covers the exact audit copies/metadata/logs and final report/worklog/status/
source-manifest, excludes its own path, and does not alter old FINAL-SOURCE history.

No raw session export or internal reasoning/provider/tool data was copied. Requests
and final text only were extracted and byte-checked. The artifact directory is
authorized durable audit evidence, not a separately installed/runnable ASDS or
rebased canonical planning destination. The original /tmp kit remains untouched.
Native planning delivery/readback and planning-return are demonstrated for this
bounded synthetic case; production application behavior and Stage-3 admission are
not. ROOT/oracle source review and final acceptance remain explicitly pending.
