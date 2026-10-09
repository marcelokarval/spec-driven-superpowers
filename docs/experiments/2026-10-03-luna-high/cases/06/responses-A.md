Vou ler as duas skills indicadas e o `AGENTS.md` do caso, depois conferir `TASKS.md` e o README para identificar a próxima etapa já liberada. Vou manter o trabalho restrito a este projeto sintético, sem delegação e sem iniciar OpenSpec.

---

Apliquei Accelerate para preservar a autorização/contexto e transferir a execução estruturada ao ASDS; o trabalho é continuação de `TASKS.md`, não uma nova proposta. Estou consultando as referências ASDS sobre continuidade, plano existente, leitura de escopo e execução no harness atual, mantendo a proibição de OpenSpec e de delegação.

---

O plano confirma T01 como próxima etapa aberta e T02 depende dela. O README delimita as visões salvas a nome obrigatório, ID único, JSON local versão 1, listagem sem mutação, abertura que restaura o filtro de status e exclusão da visão sem excluir pedidos. Estou conferindo a estrutura estática e o estado atual para executar só T01.

---

A estrutura confirma que o T01 pode ficar isolado como camada de persistência/operações: a página não carrega módulos ainda, e a integração visual está explicitamente no T02. Vou tratar “JSON local” como armazenamento JSON no `localStorage` da aplicação estática, com formato versionado, e deixar a tela intacta. Implementarei salvar/listar/abrir/excluir com storage e gerador de IDs injetáveis, sem executar nem acrescentar testes nesta rodada.

---

Implementei a camada de visões salvas em [src/saved-views.js](/home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/06/workspace/src/saved-views.js). Ela salva JSON local na versão 1, exige nome, gera IDs únicos e oferece listagem, abertura do status salvo e exclusão sem alterar pedidos. Também detecta JSON inválido e formatos incompatíveis.

Mantive a tela sem alterações, conforme a dependência do T02. Não executei nem acrescentei testes; por isso, deixei o T01 sem marcação de conclusão em `TASKS.md`.