# Experimento operacional Accelerate → ASDS, Luna/high

Comece por [REPORT.md](REPORT.md). Os resultados são observações de comportamento,
não certificação do framework ou comparação estatística de modelos.

## Como navegar

- [Método e limites](METHOD.md), [ambiente fixado](environment.json), [auditoria de modelo e skills](audit.json).
- [Dez cenários e critérios definidos](cases.json), [índice mecânico dos resultados](results.json).
- Cada `cases/NN/REPORT.md` reúne prompts, respostas públicas e ações na ordem.
- `result-A/B/C.json`: lançamento, duração, timeout, tokens reportados e hashes finais.
- `events-A/B/C.jsonl`: mensagens públicas, comandos e ações; não contém raciocínio privado.
- `mutations.jsonl` + `versions/`: conteúdo observado antes/durante/depois; não é journal atômico.
- `workspace/`: estado real deixado pelo participante, inclusive estados incompletos ou incorretos. Não foi corrigido pelo avaliador.
- `tool-failure-categories.json`: categorias extraídas dos resultados públicos e referências ao transcript nativo.
- [Continuações suplementares](supplemental-protocol.json): B original dos casos interrompidos 04/10; C de 05 responde à decisão material que faltava.

| Caso | Tema |
|---|---|
| [01](cases/01/REPORT.md) | Conversa sem projeto |
| [02](cases/02/REPORT.md) | Pedido vago → filtro de status |
| [03](cases/03/REPORT.md) | Alteração exata da cor do botão |
| [04](cases/04/REPORT.md) | Visual genérico → planejamento delimitado |
| [05](cases/05/REPORT.md) | Visões salvas, OpenSpec e granularidade |
| [06](cases/06/REPORT.md) | Execução de plano amplo existente → refinamento |
| [07](cases/07/REPORT.md) | Handoff Accelerate, recusa de OpenSpec e continuidade |
| [08](cases/08/REPORT.md) | Investigação inconclusiva sem novo experimento |
| [09](cases/09/REPORT.md) | Dependências, paralelismo e mudança de regra |
| [10](cases/10/REPORT.md) | Proposta de IA, autoridade e escopo futuro |

## Reprodução

`prepare.py` documenta a preparação original; **não o execute sobre esta coleta**.
`run.py` recusa repetição de A existente; `continue.py` recusa sobrescrever resultados
suplementares. O runner usa a instalação oficial Codex já autenticada, sem alterar
configuração global. O limite é 240 segundos por turno e duas sessões simultâneas.
`summarize.py` e `audit.py` regeneram apenas índices da coleta; não são novos testes
nem editam os workspaces. A configuração e o catálogo podem mudar após esta data.

Estes testes usam projetos sintéticos e nenhuma delegação dentro dos participantes.
Não comprovam execução/revisão por pares, integração Plane, navegador real, publicação
ou qualidade em projetos de produção. As sessões não receberam conversa anterior,
mas receberam as instruções normais do harness e o bootstrap explícito das skills.
