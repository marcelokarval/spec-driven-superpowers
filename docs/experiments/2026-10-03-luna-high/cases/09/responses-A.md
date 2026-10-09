Vou ler as duas skills indicadas e o `AGENTS.md` local, depois inspecionar os arquivos pertinentes do projeto sintético para preparar um plano e salvar `TASKS.md`, sem implementar nem iniciar OpenSpec.

---

A classificação do Accelerate encaminha este pedido não trivial ao ASDS. As instruções locais proíbem abrir outros casos e inicializar OpenSpec; vou manter o plano restrito ao `TASKS.md` autorizado e usar apenas as referências de planejamento e coordenação necessárias para decidir dependências e paralelismo.

---

Encontrei uma decisão que muda o comportamento: qual deve ser a ordenação inicial da lista?

1. Mais recentes primeiro.
2. Mais antigas primeiro.
3. Preservar a ordem atual até a pessoa escolher no seletor.

O seletor pode oferecer as duas opções por data; falta definir qual delas usar ao abrir a página. Por isso, ainda não gravei `TASKS.md`.

Também há uma diferença entre o pedido e o estado atual: [src/app.js](/home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/09/workspace/src/app.js) contém a função de lista e renderização textual, mas a estrutura da tela está em [index.html](/home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/09/workspace/index.html). O plano pode deixar a lógica do seletor e a contagem em `src/app.js`, usando a estrutura existente, e atualizar o título da aba e o cabeçalho em `index.html`.

Quanto ao paralelismo, a ordenação, o seletor e a contagem formam uma tarefa única, pois precisam refletir a mesma lista exibida. A mudança de título pode ocorrer em paralelo com essa tarefa: ela altera `index.html`, enquanto a outra altera `src/app.js`, sem dependência aparente entre elas.