# ASDS — orientação para trabalhar neste repositório

## Finalidade definida pelo proprietário

O produto final do ASDS é **entregar planejamento pronto, revisado e persistido**:
um índice TASKS e contratos individuais de tarefas, com cobertura dos requisitos,
fronteiras claras, hierarquia, dependências, bloqueios e paralelismo recomendado.

O ASDS combina OpenSpec e Superpowers para produzir essa entrega. Entendimento,
intake, briefing, onboarding, entrevista, pesquisa e brainstorming são atividades
condicionais: use-as quando resolverem lacunas reais e aproveite contexto já recebido.
A entrega das tarefas é obrigatória quando uma encomenda de planejamento é aceita.

A implementação do trabalho descrito pelas tarefas pertence a um consumidor posterior.
Agentes do planejador podem investigar, redigir, revisar, corrigir e persistir o
planejamento. A presença de papéis chamados executor ou revisor não autoriza executar
o software planejado. Critérios de testes e integração podem constar nos contratos
como instruções futuras, sem exigir sua execução para entregar o plano.

Esta fronteira de produto não impede desenvolver o próprio ASDS quando o usuário
solicitar mudanças neste repositório. Classifique a ação solicitada e respeite seu
escopo; pesquisar o framework, modificar seu código e planejar um projeto-alvo são
encomendas distintas.

## Leitura inicial e continuidade

Antes de evoluir o framework, leia nesta ordem:

1. **[Estado evolutivo do projeto](PROJECT-STATUS.md)** — leitura obrigatória para
   conhecer release, evolução local, pendências, limites e próximos passos.
2. [Índice da pesquisa de fundamentos](docs/research/2026-10-03-planning-core/README.md).
3. [Diagnóstico e fluxo recomendado](docs/research/2026-10-03-planning-core/REPORT.md).
4. [Mapa de mudanças proposto](docs/research/2026-10-03-planning-core/CHANGE-MAP.md).

Para avaliar o comportamento observado e os limites da bateria anterior, consulte
o [relatório Luna/high](docs/experiments/2026-10-03-luna-high/REPORT.md) e seu
[método](docs/experiments/2026-10-03-luna-high/METHOD.md). Leia casos e eventos
específicos conforme a necessidade; não carregue todos os transcripts por padrão.

Use essas pesquisas para manter continuidade, não como prova independente de um
novo experimento. Participantes de avaliações novas não devem receber resultados
anteriores ou critérios reservados ao avaliador.

## Estado da evolução

O estado corrente e suas evidências ficam em [PROJECT-STATUS.md](PROJECT-STATUS.md).
Confirme-os no checkout antes de relatar progresso. Atualize esse documento quando
uma mudança alterar o estágio da evolução; mantenha aqui as instruções de continuidade.

Fontes que ainda descrevem execução são evidência do comportamento existente,
não substituem a finalidade definida pelo proprietário. O mapa de mudanças é
proposta, não prova de implementação nem autorização para publicar, instalar ou
modificar projetos externos. Não trate alternativas discutidas como decisões fechadas.

A instrução de ler o estado não comprova que um harness a carregou ou cumpriu.
Qualificação da entrada natural das skills e leitura do histórico evolutivo são
provas distintas. Declare leitura automática somente com evidência de sessão nova.

## Critérios para orientar mudanças

- Avalie a qualidade dos artefatos entregues: um destinatário sem a conversa deve
  entender o resultado, os limites, as entradas e como demonstrar o aceite de cada folha.
- Revise a decomposição antes da entrega. Separe resultados independentes dentro
  do escopo recebido; aumentar de 20 para 50 tarefas não exige aprovação só pela quantidade.
- Distinga hierarquia de composição de dependências de precedência. Preserve IDs,
  requisitos e decisões ao refinar; não imponha profundidade artificial a tarefas simples.
- Mantenha uma fonte canônica. Arquivos locais e uma projeção autorizada em Plane
  devem preservar conteúdo e relacionamentos; não criar dois planejamentos divergentes.
- Registre lacunas materiais com responsável e trabalho afetado. Preserve decisões
  já resolvidas e use uma revisão com condição de parada; não perseguir perfeição indefinida.
- Confira conteúdo e relações após persistir. Validação estrutural, campos `ready`
  e narrativa do agente não comprovam qualidade semântica ou entrega completa.
- Preserve o último plano coerente durante atualizações e interrupções, respeitando
  a política do proprietário sobre instalações, temporários e backups.
- Teste a finalidade de planejamento. Testes do toolkit e provas de roteamento
  não substituem avaliação dos TASKS e contratos produzidos.

## Escopo e verificação

Respeite instruções superiores, autorizações anteriores e a política de instalação
do proprietário. Não inicialize OpenSpec sem autorização explícita aplicável.
Alterações em Accelerate, exports globais, trackers e releases têm escopo próprio;
não as execute como efeito colateral de editar este repositório.

`rules/AGENTS.md` é um template de adoção para projetos-alvo, não a instrução de
entrada deste checkout. Uma mudança aqui também não atualiza automaticamente as
skills instaladas em outros diretórios.

Para código do toolkit, execute as verificações pertinentes à mudança. Ao rodar
testes Node, selecione explicitamente os arquivos em `tests/`: a pasta
`docs/experiments/` contém fixtures sintéticas com testes e estados deliberadamente
incompletos, que não devem entrar por descoberta indiscriminada. Para documentação,
confira links, coerência das instruções e o diff; não é necessária uma bateria de modelos.

Preserve observações e artefatos existentes. Informe separadamente pesquisa,
proposta, implementação, revisão e publicação; não anuncie ausência de gaps sem
evidência correspondente.
