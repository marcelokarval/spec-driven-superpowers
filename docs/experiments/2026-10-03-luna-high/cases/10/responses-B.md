Os artefatos estão criados e passaram na validação estrutural ASDS. O comando `openspec` não está no `PATH` deste shell, embora o preflight tenha encontrado a versão 1.14.0 no toolkit permitido; vou validar pelo caminho efetivo já observado, sem instalar nem alterar configuração. Depois farei uma leitura final dos arquivos e deixarei a política de acesso da equipe explicitamente pendente.

---

Criei a proposta OpenSpec e quatro tarefas sequenciais para persistência, proposta/prévia, aplicação autorizada e recuperação. Nenhum código da aplicação foi alterado.

O plano mantém os filtros restritos a status, as permissões sintéticas locais, a exigência de versão atual, a idempotência por ID e conteúdo e a recuperação sem apagar o histórico. Para garantir comparação de versão e gravação atômicas entre abas, o design propõe IndexedDB.

O compartilhamento com a equipe ficou separado como possibilidade futura, sem tarefas executáveis e sem política de acesso presumida. Essa decisão não reabre nem altera o fluxo já especificado.

- [Proposta, incluindo o escopo futuro de compartilhamento](</home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/10/workspace/openspec/changes/propose-saved-view-filter-changes/proposal.md>)
- [Design e decisões](</home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/10/workspace/openspec/changes/propose-saved-view-filter-changes/design.md>)
- [Especificação da capacidade](</home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/10/workspace/openspec/changes/propose-saved-view-filter-changes/specs/saved-view-filter-proposals/spec.md>)
- [Índice das tarefas](</home/marcelo-karval/Backup/Projetos/spec-driven-superpowers/docs/experiments/2026-10-03-luna-high/cases/10/workspace/openspec/changes/propose-saved-view-filter-changes/tasks.md>)

**Validação:** ASDS estrutural e OpenSpec 1.14.0 em modo estrito passaram. Não executei testes da aplicação, pois esta rodada foi apenas de planejamento.

**Limite de leitura:** uma busca textual no toolkit acabou percorrendo também arquivos sob `docs/experiments`; não usei conteúdo de outros casos no plano. Isso ultrapassou o limite de leitura solicitado.

Para uma mudança própria de compartilhamento, a decisão pendente é: quem pode listar e visualizar as visões, e quem pode propor, aprovar/aplicar, recuperar e revogar acesso? Até essa decisão, o compartilhamento permanece fora do escopo executável.