---
id: "P01"
nodeType: package
parentId: null
dependsOn: []
---
# Task P01: catálogo somente leitura

**SYNTHETIC**. Revisão blocked-r1; planejamento blocked, implementação não iniciada.

## Outcome
Compor listagem, exportação e guia sem mutar a base. Agregado não recebe executor.

## Inputs
[Briefing](../brief.md): S01–S04, R01–R04, D01–D04; filhos 0001/0002/0003.

## Scope and dependencies
Composição: [0001](task-0001.md), [0002](task-0002.md), [0003](task-0003.md).
Nenhuma escrita atribuída ao agregado. Ordem futura segue dependsOn das folhas;
pai não precede filhos. Exclui CRUD, novo banco, auth, instalação e publicação.

## Acceptance
Positive: listagem e exportação representam a mesma base ordenada e guia corresponde às interfaces.
Negative: falha de leitura é descrita/tratada sem saída enganosa; plano parcial não vira agregado aceito.
Preservation: IDs, nomes e ordem física da base não mudam; recusa de inicialização preservada.
Aceite composto exige R01–R04 e interfaces coerentes, não contagem de checkboxes.

## Verification
Consumidor futuro confere testes das folhas e exemplos do guia na mesma revisão
implementada. ASDS revisa apenas os contratos e seu readback; não roda esses testes.

## Definition of done
- [ ] Consumidor posterior demonstrou os três resultados e preservação da base.
- [ ] Interfaces e guia conferidos contra a implementação futura, não só relato.
Nenhum item acima foi executado por ASDS.
