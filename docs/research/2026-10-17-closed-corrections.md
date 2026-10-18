# Correções delimitadas após a avaliação Atlas — 2026-10-17

## Escopo autorizado e preservações

O proprietário autorizou executar as correções já definidas, sem decidir por ele a
semântica de entrega com escolhas futuras pendentes, `partial` ou aprovação dos
limites de alteração das tarefas. Esclareceu que disponibilizar e garantir o revisor
é responsabilidade do harness; subagentes, novas sessões, sessões exclusivas e
coordenadores são mecanismos possíveis, não uma topologia universal imposta pelo ASDS.

Esta rodada altera somente a fonte local. Não instala, publica, faz commit/push,
modifica trackers ou executa o produto planejado. A candidata Atlas r1 e o material
da avaliação permanecem preservados fora deste diff. Untracked preexistentes não
pertencem a esta entrega.

## Implementação

- `lib/package-builder.mjs`: pacotes recebem descrição de composição não executável,
  agregado explícito e DoD de composição. A reconciliação mantém YAML e resumo
  gerenciado coerentes, inclusive em hierarquias aninhadas e atualizações de filhos.
- Prosa customizada e folhas são preservadas; migração de boilerplate limita-se a
  defaults reconhecidos. Fences de Markdown são opacos; região gerenciada ambígua
  interrompe a operação em vez de apagar texto autoral.
- `tests/package-builder-composition.test.js`: regressões sintéticas de build,
  nesting, resync, idempotência, hashes, custom sections, folhas, fences e rollback.
- Skill/referências: remove instruções obsoletas de capability host-owned e a falsa
  promessa de publicação automática por `--record-review`. Orientação de produto
  é neutra ao transporte; requisitos restritos do adapter atual são documentados
  como compatibilidade existente, não nova decisão de arquitetura.
- Checklist F/Q reforça fidelidade, interfaces, produtores/consumidores, ownership
  de integração, cenários específicos e decisões exportáveis. Dependências
  transitivas válidas e trabalho prévio por interfaces continuam permitidos.

## Revisão e provas

- Implementador: `ses_eb42f25e0ffew89emBVoWdsmWu`.
- Revisor independente read-only: `ses_eb428d3b3ffesyfvOUw4vCgAxI`.
- Primeira revisão encontrou colisão dos marcadores gerenciados com exemplos fenced
  em prosa customizada. O implementador reproduziu e corrigiu; revisão sucessora
  confirmou preservação, atualização do resumo, idempotência e rejeição de ambiguidades.
- A revisão da nova SKILL permitiu atualizar somente seu hash em
  `tests/workflow.test.js`; não houve regeneração indiscriminada de snapshots.
- Primeira suíte ampla: 591/592; único FAIL era esse snapshot de conteúdo alterado.
  Nova execução após correção e snapshot revisado: **595/595**, zero falhas ou skips.
  Comando: `node --test tests/*.test.js`; log local em
  `/tmp/opencode/asds-closed-fixes-tests-final.log`.
- `npm run check`, `npm run validate` e `git diff --check`: exit 0.
  A validação estrutural não certifica autenticidade de reviews ou entrega operacional.
- Gates de boundary pending e invalidação pós-mudança já têm caracterização em
  `tests/passive-correction.test.js`; não foram relaxados nem duplicados por cerimônia.

## Fora desta correção

Readiness, schemas de envelopes, identidades exigidas pelo adapter, decisões
materiais, estados de entrega e gates de publicação não foram alterados. A existência
de testes sintéticos não comprova um novo fluxo de revisão nativa ou entrega
operacional. Esta rodada não transforma a candidata Atlas em pacote aprovado.
