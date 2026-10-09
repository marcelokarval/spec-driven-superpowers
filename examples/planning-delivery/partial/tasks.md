# Tasks: catálogo somente leitura — partial

**SYNTHETIC** — revisão partial-r1. Planejamento não é implementação.
Fontes, decisões, interfaces e recusas: [brief.md](brief.md).
Revisões e limitações: [reviews.md](reviews.md); metadados/readback ilustrativo:
[planning-manifest.json](planning-manifest.json).

## Composição
- [ ] [Task P01](tasks/task-P01.md): catálogo somente leitura
  - [ ] [Task 0001](tasks/task-0001.md): Listagem ordenada sem gravação
  - [ ] [Task 0002](tasks/task-0002.md): Exportação fiel sem gravação
  - [ ] [Task 0003](tasks/task-0003.md): Guia do consumidor

## Precedência e paralelismo recomendado
0001 e 0002 não dependem entre si: podem ser planejadas/implementadas em paralelo
por consumidor posterior, pois escrevem arquivos diferentes. 0003 depende de
0001 e 0002 para exemplos verificados; P01 é composição, nunca dependência
implícita. Recomendação não reserva recursos nem abre executor.

## Projeção de execução
- Onda 1: 0001, 0002
- Onda 2: 0003

## Disponibilidade do planejamento
0001: utilizável. 0002/0003: bloqueadas por B01 (formato sem decisão). P01 não está inteiramente entregue.
Checkboxes acima significam implementação futura, não prontidão do planejamento.
