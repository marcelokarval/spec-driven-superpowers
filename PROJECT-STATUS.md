# Estado evolutivo do ASDS

Atualizado em **2026-10-08**. Leia este documento antes de demandar ou evoluir o
projeto. Confirme o checkout antes de usar os hashes abaixo como estado corrente.

## Direção definida

**ASDS entrega planejamento pronto, revisado e persistido:** TASKS e contratos
individuais com requisitos cobertos, fronteiras, hierarquia e dependências.
Entendimento, entrevista e pesquisa entram conforme a necessidade. Implementar
o trabalho descrito nas tasks pertence a um consumidor posterior.

## Release publicado

- [ASDS v2.0.0](https://github.com/marcelokarval/spec-driven-superpowers/releases/tag/v2.0.0),
  publicado em 2026-10-08. Esta é a primeira release cuja fronteira principal é
  planejamento revisado e persistido; implementação futura pertence a um consumidor.
- O release anterior [v1.2.0](https://github.com/marcelokarval/spec-driven-superpowers/releases/tag/v1.2.0)
  permanece como registro imutável da fase de coordenação de execução.
- Documentos antigos que dizem "candidate" ou "release draft" registram o estágio
  anterior à publicação, conforme explicado no próprio release.

## Evolução local

- A branch de publicação é `v2.0.0`; o tag imutável identifica a fonte publicada.
- A decomposição adaptativa anterior foi incorporada e ampliada para composição
  recursiva separada da DAG de precedência.
- Pesquisa e experimentos delimitados que sustentam a fronteira de produto estão
  versionados como evidência histórica; não equivalem a qualificação universal.
- A alternativa OMO/OMO-Slim foi discutida. Escolha, customização e piloto estão pendentes.
- Em 2026-10-08 o plano de correção planning-only recebeu autorização de implementação.
  O checkout agora contém contrato de produto, grafo/coverage/lifecycle de planejamento,
  revisão vinculada à revisão, publicação/readback com rollback ordinário e retorno v2.
  Skills, schema e autoridades Accelerate foram realinhados na fonte. Essa evolução
  está publicada na fonte; instalações globais continuam sendo operação separada.
- A primeira correção pós-observação também está implementada localmente: `tasks.md`
  passou a governar projeções por diretório, títulos/IDs/ondas são conferidos,
  conflitos são exportados por tarefa, completion incoerente é rejeitada e o
  roteamento de decisões/bloqueios falha fechado para duplicatas, alvos não
  relacionados e envelopes malformados. Specs de mudanças agora precisam do delta
  OpenSpec estrutural antes de uma entrega poder ser aceita.
- A segunda correção pós-observação fecha duas ambiguidades operacionais: C15 não
  pode ser declarado satisfeito sem recibo durável de readback nem durante review,
  e a skill distingue ausência no PATH do executável OpenSpec fixado no checkout
  ASDS antes de declarar a dependência indisponível. A instalação de projeto deve
  ser atualizada pelo instalador oficial existente, sem cópia paralela de runtime.

## Evidências e limites

- [Rodada Prop4You login/recovery de 2026-10-08](docs/experiments/2026-10-08-login-readiness-round2.md):
  novo Codex sem histórico conversacional, no worktree autorizado existente. Ativação
  local atualizada pelo instalador padrão; nove folhas e quatro pacotes no mesmo índice,
  revisão independente com correção de dependência, readback de 22 arquivos e fontes
  preservadas. ASDS passou, mas OpenSpec rejeitou o delta com header inválido: não
  qualifica entrega completa da pilha. Sondagens adicionais identificaram gaps de
  blocker routing, autoridade do índice na exportação e consistência de completion.
  Nenhuma publicação/instalação global ou implementação Prop4You nessa rodada.
- A correção foi revalidada contra esse mesmo pacote negativo preservado: o ASDS
  agora o rejeita por delta OpenSpec ausente e projeção task-manager stale; o CLI
  recompila a projeção somente a partir do índice e expõe `serializesWith` para os
  pares 0003/0008 e 0005/0007. O OpenSpec continua rejeitando o header inválido,
  portanto a evidência negativa não foi silenciosamente reparada.
- Gates locais após a correção: ASDS `298/298`, `npm run check`, `npm run validate`,
  `git diff --check` e OpenSpec strict `5/5`; Accelerate `bash tests/all.sh` e
  `git diff --check` passaram. A primeira tentativa restrita do gate Accelerate
  parou apenas no socket de browser monitoring; a repetição autorizada fora dessa
  restrição passou integralmente. Isso prova os gates locais, não publicação/release.
- [Qualificação Codex/Agy](docs/qualification/2026-10-03-harness/report.md): entrada
  natural das skills observada em casos delimitados; fidelidade a requisito no Agy
  permaneceu parcial. Não comprova o fluxo em qualquer projeto.
- [Bateria Luna/high](docs/experiments/2026-10-03-luna-high/REPORT.md): 10 sessões,
  21 turnos, quatro interrupções por prazo e um caso com contaminação de leitura.
  Não demonstrou entrega confiável de planejamento excelente.
- [Pesquisa de fundamentos](docs/research/2026-10-03-planning-core/REPORT.md):
  contratos ativos de ASDS/Accelerate ainda atribuem execução ao ASDS; prontidão
  estrutural não prova qualidade; hierarquia recursiva é rejeitada pelo núcleo.
- **A leitura natural deste estado evolutivo por uma sessão nova ainda não foi
  comprovada.** O AGENTS da raiz exige a leitura; isso não equivale a uma prova de carga.
- Projeção fiel em Plane e novos mecanismos de entrega/revisão não foram implementados.

## Pendências e próximos passos

1. Qualificar novamente os evals planning-only em sessões novas, sem usar resultados antigos,
   incluindo um pacote que exercite decisões materiais, conflitos e revisão do índice.
2. Tratar instalação como operação separada; publicação de fonte não atualiza outras
   skills globais ou projetos automaticamente.
3. Avaliar os artefatos produzidos e qualificar a leitura desta entrada em sessão nova.
   Depois comprovar a entrega no destino autorizado, incluindo Plane quando selecionado.

Para aprofundar, siga o [índice da pesquisa](docs/research/2026-10-03-planning-core/README.md).
Atualize este estado quando houver implementação, decisão arquitetural, qualificação
ou release novo; registre a evidência e preserve a distinção entre proposta e entrega.
