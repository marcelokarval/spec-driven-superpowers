Vou ler as duas skills solicitadas e o `AGENTS.md` do caso, depois conferir `README.md` e `src/app.js` para preparar apenas o planejamento em `TASKS.md`.

---

A triagem classifica isso como encaminhamento para ASDS; o handoff já aprova planejamento e `TASKS.md`, e recusa explicitamente OpenSpec. Estou consultando o contrato de planejamento e a UI/testes locais para registrar tarefas alinhadas ao comportamento atual, sem tocar nos dados.

---

A descoberta encontrou uma lacuna concreta: `index.html` contém os alvos visuais, mas não carrega pedidos nem executa `src/app.js`; o módulo só lista e formata valores. Vou registrar primeiro uma investigação delimitada do fluxo local de dados e, dependente dela, uma tarefa única para função pura e interação da UI. O plano fixa que status vazio retorna todos e que a lista de entrada não é alterada.

---

Planejamento registrado em [TASKS.md](/home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/07/workspace/TASKS.md).

O plano separa uma investigação do carregamento local dos pedidos e, depois, a implementação da função pura e dos controles de filtrar e limpar. Fixa que status vazio exibe todos, preservando ordem e dados. A investigação é necessária porque a página não carrega pedidos nem inicializa `src/app.js` atualmente.

Não alterei código ou dados, não executei testes e não criei OpenSpec.