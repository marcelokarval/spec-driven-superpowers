# Resultado operacional — Accelerate → ASDS com Luna/high

A regra de decomposição existe, mas esta bateria não mostrou cumprimento confiável
antes da execução. O caso mais importante é **06**: o coordenador leu o plano amplo,
implementou salvar/listar/abrir/excluir juntos e só anunciou subdivisão quando o
Prompt B a pediu explicitamente. Ao persistir a revisão, apagou o plano antigo e foi
interrompido antes de produzir o substituto. A observação não autoriza “sem gaps”.

## O que este experimento observa

Dez sessões novas, sem histórico de conversa, com `gpt-6-luna` e esforço `high`
explicitamente solicitados na CLI oficial já autenticada por subscription. Há
confirmação da configuração registrada em `turn_context`, por sessão; isso não é
atestado dos pesos internos do provider. A/B são turnos da mesma sessão; C de 05 é
uma intervenção suplementar declarada. Até duas sessões simultâneas. O marco do
código ASDS é `5991b3c182db1953db2a830a12ee955676093178`.

Os participantes receberam o caminho das duas skills, um projeto mínimo sintético
e limites iguais. A bateria avalia uso informado da pilha, não descoberta espontânea.
A leitura normal de instruções globais do harness continua existindo. Os participantes
não recebem a conversa desta sessão, nem deveriam ler resultados dos outros casos.
O caso 10 violou esse último limite numa busca ampla; sua independência ficou comprometida.

## Comparação A → B

| Caso | Prompt A: entendimento e ação | Prompt B: continuidade e efeito | Leitura do resultado |
|---|---|---|---|
| [01](cases/01/REPORT.md) | Explicação conceitual; nenhuma escrita | Explicou granularidade, sem artefatos | Disponibilidade da pilha não ativou projeto |
| [02](cases/02/REPORT.md) | Perguntou qual melhoria tinha prioridade | Persistiu um filtro de status com limpeza como uma tarefa | Boa delimitação de objetivo; não demonstrou ciclo explícito de revisão de granularidade |
| [03](cases/03/REPORT.md) | Alterou só a cor normal do botão e fez checagem estática | Relatou o estado; nenhuma ação nova | Boa proporcionalidade; sem OpenSpec ou plano desnecessário |
| [04](cases/04/REPORT.md) | Assumiu desenho visual e alterou HTML/CSS; interrompido pelo prazo | Criou cinco tarefas, mas também desfez as alterações anteriores | Plano ficou salvo; reversão de código não foi explicitamente pedida |
| [05](cases/05/REPORT.md) | Perguntou se JSON local significava localStorage ou arquivo | Manteve a pergunta porque B não respondeu; nenhum plano nesses dois turnos | Lacuna material legítima e limitação do roteiro fixo; C responde a pergunta |
| [06](cases/06/REPORT.md) | Aceitou T01 ampla como camada de operações, implementou quatro comportamentos sem testes | Prometeu quatro contratos; apagou TASKS.md; prazo encerrou o turno | Refinamento provocado, não espontâneo; persistência incompleta e perda do índice ativo |
| [07](cases/07/REPORT.md) | Aproveitou handoff e recusa de OpenSpec; planejou investigação delimitada antes do filtro/UI | Leu o plano e informou continuidade, sem refazer triagem | Preservou limites e autorizações recebidas |
| [08](cases/08/REPORT.md) | Não encontrou busca no fixture e pediu identificação do alvo | Registrou resultado inconclusivo como relato do usuário e parou | Boa proveniência e contenção; Markdown foi gravado com escapes literais |
| [09](cases/09/REPORT.md) | Perguntou a ordem inicial e não persistiu; agrupou função, seletor e contagem como uma tarefa | Incorporou verbalmente a regra de datas inválidas, mas voltou à pergunta inicial | B não resolveu a decisão de A; atualização persistida não foi demonstrada |
| [10](cases/10/REPORT.md) | Leu contratos e procurou OpenSpec; busca atingiu documentos do experimento; interrompido | Persistiu quatro contratos sequenciais e separou a política de compartilhamento pendente | Estrutura validada; caso contaminado, sem prova independente de comportamento |

## O ponto central: refinou por iniciativa própria?

**06A é um contraexemplo direto à expectativa principal.** A tarefa existente dizia
“Implementar todas as visões salvas com nome, IDs, JSON, abrir, listar e excluir”.
O participante identificou os quatro comportamentos e preferiu agrupá-los porque
ficariam na mesma camada de persistência. Isso não demonstra indivisibilidade das
entregas. A regra atual em `references/planning.md`, seção Adaptive decomposition,
manda revisar granularidade antes do dispatch e separar resultados entregáveis
independentemente. O caminho sem OpenSpec não deveria eliminar essa avaliação.

Em 06B, a intenção de dividir apareceu **depois da intervenção explícita**. O teste
não comprova quatro contratos persistidos: o arquivo foi removido e nenhum substituto
estava presente ao fim do turno. A versão anterior, inclusive T00 concluída, está em
[versions/8336…txt](cases/06/versions/8336fbdd34df550281cce729144473daebebfca0cbc96eed9c9553df2babc978.txt).
O código de A permaneceu. Não reconstruí o plano no workspace: isso esconderia o estado
que estamos medindo.

**Não houve prova de um loop de aperfeiçoamento até “tasks perfeitas”.** Ler referências,
repetir um comando após erro e perguntar novamente por decisão ainda não respondida
não são ciclos de refinamento semântico. Também não é adequado concluir loop infinito
porque três turnos iniciais bateram no prazo. O critério útil é prontidão verificável,
com correções delimitadas e condição de parada, não perfeição aberta.

Casos 02 e 07 criaram tarefas com resultados e verificações concretas; a diferença de
uma versus duas tarefas reflete também a investigação sobre carregamento dos dados.
Contagem de tarefas não mede, sozinha, granularidade. Em 09, compartilhar o arquivo foi
usado para justificar uma tarefa única: compartilhar recurso normalmente exige ordem
ou exclusão de escrita; não impede contratos separados para resultados independentes.
A hipótese de paralelismo também depende de confirmar a interface entre HTML e módulo.

## Persistência e limites da ação

1. **06B — substituição insegura.** O evento público de exclusão e o hash final provam
   que TASKS.md ficou ausente. O prazo imposto pelo avaliador é a causa da interrupção,
   mas a estratégia de apagar antes de substituir tornou essa interrupção destrutiva
   para o plano ativo. Este teste não prova corrupção de um armazenamento ASDS transacional:
   o participante editava Markdown diretamente, sem usar `decompose`/`refine`.
2. **04B — inferência de desfazimento.** “Não implemente; registre somente as tarefas”
   foi interpretado como permissão para restaurar HTML/CSS originais. A intenção pode
   ter sido alinhar o estado ao novo pedido, mas o pedido não mandava desfazer A. Ação
   e interpretação pública estão preservadas, permitindo discutir a regra com precisão.
3. **08B — sem readback de formato suficiente.** `tasks.md` contém sequências literais
   `\\n` em uma linha, em vez de linhas Markdown. O conteúdo semântico distingue relato
   e medição, mas a escrita não deixou o documento no formato anunciado.
4. **06A — implementação parcial sem verificação pertinente.** O modelo disse claramente
   que não adicionou nem executou testes e manteve T01 aberta. Isso evita falsa conclusão,
   mas não entrega o próximo resultado pronto solicitado. O AGENTS do caso não proibia
   testes locais; a decisão de não verificar partiu do participante.

## Perguntar ou decidir: diferenças observadas

05 perguntou localStorage versus arquivo; 06 assumiu localStorage para uma aplicação
estática semelhante. Há diferenças de contexto (planejamento novo versus plano aprovado),
portanto isso não é uma comparação causal controlada. Ainda assim, evidencia que o
limiar de decisão material não ficou consistente entre os fluxos.

02 perguntou prioridade útil. 09 pediu ordem inicial útil, mas bloqueou toda a persistência,
inclusive o título independente e a regra já esclarecida. O framework poderia registrar
partes conhecidas e marcar apenas o comportamento dependente como bloqueado, sem inventar
uma resposta. A instrução experimental também mandava encerrar quando faltasse decisão
material; por isso não se atribui todo esse bloqueio exclusivamente ao ASDS.

07 preservou a recusa de OpenSpec e não pediu aprovações repetidas. 01/03 mostram que
não é necessário ativar toda a pilha para conversa ou alteração mínima. 08 encerrou
investigação negativa sem iniciar novas hipóteses automaticamente.

## Limitações da bateria e recomendações para a próxima discussão

- Uma amostra por cenário, sem grupo comparativo de outro modelo ou sem ASDS. Não
  sustenta taxa geral de confiabilidade, nem atribuição de causa ao modelo isoladamente.
- O limite de 240 segundos censura especialmente pedidos complexos. Não usar tempo
  esgotado como reprovação semântica nem presumir como o turno terminaria sem interrupção.
- Erros de shell, em particular `Argument list too long`, afetaram vários casos.
  Alguns recorreram a MCP/node_repl. Latência inclui inicialização e falhas do harness;
  contagem de comandos não representa número de revisões de tarefas.
- Isolamento por instrução foi insuficiente no caso 10. Uma próxima bateria deve
  restringir fontes legíveis, sem expor a árvore onde vivem os resultados e critérios.
- B foi predefinido: em 05 e 09 não respondeu à dúvida material levantada em A. C de
  05 corrige esse limite de roteiro de forma explícita, sem apagar A/B.
- O experimento não executa equipes/revisores, Plane, integração de código, navegador
  ou publicação. Não prova o ciclo operacional inteiro de produção.

As prioridades sugeridas, ainda **não implementadas nesta bateria**, são:

1. Tornar visível a decisão de granularidade antes de executar, inclusive no plano
   existente sem OpenSpec: resultados independentes, decisão de dividir/manter e prova
   de prontidão. Agrupamento por camada ou arquivo não basta como justificativa.
2. Persistir revisões preservando o índice antigo até a nova versão estar completa e
   verificada. Testar cancelamento entre operações e retomada com tarefas concluídas.
3. Distinguir nova restrição prospectiva de pedido explícito para desfazer trabalho.
4. Permitir plano parcial com bloqueios locais, preservando decisões e tarefas prontas;
   adotar condição de parada finita para revisão semântica e readback de persistência.
5. Repetir os casos críticos após uma mudança específica, com fontes isoladas e orçamento
   de tempo adequado; comparar resultados e limites, sem exigir textos idênticos.

Os arquivos dos participantes não foram corrigidos pelo avaliador. O framework e as
skills permanecem na versão observada. A pasta conserva inclusive os fracassos para
que a próxima discussão parta dos eventos reais, não só da conclusão do coordenador.

## Fechamento da coleta

Foram executados **21 turnos em 10 sessões**: 17 terminaram com saída CLI zero;
04A, 06B, 10A e 05C atingiram 240 segundos e foram interrompidos. Saída zero não
significa aprovação semântica. Todos os 21 contextos registram Luna/high. Foram
observadas 178 conclusões de comandos de shell, 49 com saída não zero; chamadas MCP
e edições por ferramenta são registradas separadamente. A soma dos tempos de turno
foi 2.308,38 segundos, não o tempo de parede, pois houve paralelismo.

**05C:** depois da resposta sobre localStorage, leu referências e anunciou dois
contratos por camada, persistência e interface. Persistiu `openspec/config.yaml` e
`openspec/changes/saved-filter-views/.openspec.yaml`, mas nenhum contrato, proposal,
design ou spec. O prazo interrompeu a preparação. A validação ASDS posterior do
avaliador falha como esperado: o pacote está incompleto. O anúncio não conta como
plano persistido nem como revisão de granularidade concluída.

**10B:** persistiu quatro contratos, com sequência 0001 → 0002 → 0003 → 0004,
preservando compartilhamento como escopo futuro dependente de política de acesso.
O avaliador repetiu ASDS e OpenSpec estrito em leitura, ambos com saída zero e
hashes do workspace inalterados. O contrato 0001 ainda reúne persistência, snapshots,
listagem e abertura apesar de `boundary.review.verdict: ready`; o 0002 reúne proposta
e prévia. Isso merece revisão semântica e mostra o limite da validação estrutural.
O participante escolheu IndexedDB para transação atômica entre abas: é decisão de
design documentada por ele, não uma exigência explícita do prompt. Não houve execução
para provar essa propriedade. A contaminação de leitura de A continua valendo para B.

Leia [coordinator-verification.json](coordinator-verification.json) para os comandos,
saídas e limites dessa conferência. O temporário externo criado por 10 foi removido
pelo próprio participante; ausência confirmada. Skills conferidas por hash permanecem
iguais; nenhum arquivo rastreado do framework foi modificado. Evidências e fixtures
permanecem nesta pasta por serem a entrega solicitada, sem commit ou publicação.
