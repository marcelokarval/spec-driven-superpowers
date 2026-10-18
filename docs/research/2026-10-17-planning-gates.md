# Gates de planejamento — implementação das decisões consolidadas

## Pedido e resultado

Implementar na fonte local as decisões do proprietário sobre boundaries `pending`,
decisões futuras contratadas e liberdade do harness para disponibilizar reviewers.
O pacote continua sendo planejamento; revisão de conteúdo não implementa produto.

- Boundary com `change`, `target`, `exclusions` completos é aceita com `pending`
  somente no contexto de F/Q válidas, atuais e com evidências/bytes conferidos.
- Contratos e `candidateSha256` permanecem inalterados de F/Q até publicação.
- Decisões futuras válidas com resolver/blocker bloqueiam consumidores e dependentes,
  não a entrega de um plano completo; é obrigatória ao menos uma folha utilizável.
- Camadas incompletas do próprio planejamento impedem entrega completa; não são
  reclassificadas como simples decisões futuras. `partial` mantém esse significado.
- Manifesto, readback e receipt expõem `usableTasks` e `blockedTaskIds`; o handoff e
  consumidor excluem as folhas bloqueadas do despacho.
- Coordenador não autor pode revisar. Ordem F→Q, vínculo à candidata e distinção
  entre autores e reviewers permanecem. O adapter ainda requer F/Q de identidades
  distintas; não houve mudança de schema ou instalação.

## Arquivos alterados nesta rodada

- `lib/validation.mjs`: validação contextual única para approval F/Q, inventário,
  bytes, boundaries completas e decisões roteadas. Folha implícita legada não escapa
  do gate; `candidate:true` não dispensa evidências em ready/delivered/partial.
- `lib/package-builder.mjs`: ready consome o gate contextual e projeta bloqueados.
  Preserva a correção anterior de pacotes e prosa customizada.
- `lib/planning-lifecycle.mjs`: separa incompletude de planejamento dos bloqueios de
  execução e confere o escopo derivado.
- `lib/planning-store.mjs`: publish/verify usam o gate contextual e conferem escopos
  aditivos em readback/receipt; compatibilidade com recibos antigos sem bloqueios.
- `lib/harness-planning-review.mjs`: permite requester/coordenador não autor como
  reviewer, sem permitir autor ou reutilização da mesma identidade F/Q.
- `lib/execution-handoff.mjs`, `lib/execution-consumer.mjs`: adaptam o escopo entregue
  aos consumidores desbloqueados; aprovação contextual deriva uma cópia em memória
  somente após conferir handoff, manifesto, fonte persistida e F/Q atuais.
- `tests/planning-package-gates.test.js` (novo), `tests/passive-correction.test.js`,
  `tests/planning-lifecycle.test.js`: fluxo CLI completo e regressões negativas.
- Skill e referências `planning.md`, `contracts.md`, `adapters/opencode.md`:
  semântica nova e limites reais. `tests/workflow.test.js`: hash da SKILL atualizado
  após revisão independente explícita, não por regeneração indiscriminada.
- `PROJECT-STATUS.md` e este registro: continuidade e evidências.

Não foi necessário modificar diretamente `lib/decomposition.mjs` nem
`scripts/planning-review.mjs`: os comandos existentes usam as funções corrigidas;
readiness genérica permanece fail-closed para tarefa destacada sem prova de pacote.
As expansões para validation/handoff/consumer foram necessárias para não publicar
um plano que depois bloqueasse sua própria folha utilizável ou despachasse excluídas.

## Revisão independente e remediação

Implementador: `ses_eb42f25e0ffew89emBVoWdsmWu`.
Revisor zero-write: `ses_eb428d3b3ffesyfvOUw4vCgAxI`.

A revisão encontrou e as correções sucessoras resolveram:

1. Folha legada sem nodeType não validava boundary. A validação contextual agora
   trata a folha implícita como task em cópia, sem alterar bytes persistidos.
2. Flag candidate dispensava prova de review em estado ready. A dispensa agora é
   restrita a draft/reviewing/blocked; evidência é conferida nos demais estados.
3. Consumidor reaplicava readiness genérica e bloqueava pending já aprovada por F/Q.
   O consumidor oficial agora deriva visão runtime após binding/prova atual,
   preserva contrato/contractRevision e mantém compilação genérica estrita.

Revisão sucessora não encontrou novo defeito concreto no recorte. O coordenador leu
os artefatos decisivos e executou os gates; review consultiva não substituiu testes.

## Provas finais

`node --test tests/*.test.js`: **622 passaram, zero falhas, zero skips**.
Log local: `/tmp/opencode/asds-planning-gates-final-tests.log`.

`npm run check`, `npm run validate`, `git diff --check`: **exit 0**.

O teste CLI cria fixtures sintéticas e usa processos novos para
build→inspect→record F→record Q→ready→publish→verify, com/sem decisões futuras.
Confere hashes/bytes invariantes, escopo em manifesto/receipt, tamper e exclusão de
dependentes. Também cobre handoff→init→ação executor→dispatch sintético de folha
usable, sem executar worker/produto, além de autor negado, F/Q inválidas/stale,
boundaries incompletas, camada bloqueada, fonte alterada e capacidades insuficientes.

## Limites e preservação

Estas provas são determinísticas com identidades/evidências explicitamente
sintéticas, não aprovação semântica de um projeto ou nova sessão nativa F/Q real.
Não houve commit/push, release, instalação global, serviço, tracker ou alteração da
candidata Atlas r1. Arquivos alheios preexistentes foram preservados. As alterações
da rodada anterior continuam locais e não foram revertidas.
