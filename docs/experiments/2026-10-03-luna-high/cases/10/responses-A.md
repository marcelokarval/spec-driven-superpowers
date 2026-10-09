Vou ler as duas skills e o `AGENTS.md` do caso, depois inspecionar os artefatos sintéticos existentes e preparar a proposta OpenSpec com tarefas. Vou manter o escopo em planejamento: sem implementação, execução em provider real ou delegação.

---

A rota é ASDS: o pedido inclui uma mudança de comportamento com proposta, prévia, aplicação e recuperação, além de autorização explícita para OpenSpec e tarefas. O projeto sintético ainda não tem `openspec/`; vou seguir a autorização registrada no pedido e consultar os contratos de intake, planejamento, adaptação Codex e validação antes de gerar os artefatos.

---

O material existente descreve um app local sem dependências ou backend e cita visões salvas futuras com filtro de status e versão inicial 1; não há implementação ainda. Vou modelar a mudança como um fluxo de proposta imutável, prévia de diff, aplicação com autorização e controle de versão/idempotência, e recuperação local, preservando o limite sintético. Agora verifico a convenção OpenSpec/ASDS do toolkit para criar somente o conjunto de artefatos necessários.

---

A busca textual anterior foi ampla dentro da documentação do toolkit e incluiu o diretório do experimento atual; vou limitar as próximas leituras a este caso e aos arquivos de referência já identificados. Como esse comando não será usado como evidência de validação independente, registrarei essa limitação no retorno. Para os artefatos, estou fechando os detalhes operacionais com base no app e nos contratos lidos.