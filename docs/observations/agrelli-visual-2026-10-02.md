# Observação de campo — Agrelli, correção visual

Sessão: `01a0f970-29c5-75e2-b1e5-e12901b0a3b6`.
Projeto efetivo: `/home/marcelo-karval/Backup/Projetos/agrelli/crm-arthuragrelli`.
Artefato canônico observado: `docs/agrelli/identidade-analitica/TASKS.md`.
Observação autorizada pelo proprietário; sem mensagens à sessão, mudanças no
projeto observado, execução dos testes dele ou mutações em trackers.

## Recorte e proveniência

O recorte começa no ordinal 6637 do transcript, em 2026-10-02 às 20:23:30 UTC
(17:23:30 America/Bahia). Nele, o proprietário solicita plano/tasks conforme
Accelerate, fornece a matriz de modelos e exige DAG para aprovação e revisão limpa.
Aprovação explícita: ordinal 6750, 20:38:24 UTC (17:38:24 local).
Uma autorização adicional, 20:42:16 UTC, permite usar cobalto apenas no ambiente
selecionado; não deve ser generalizada para outras organizações/configurações.
Não atribuir todas as decisões históricas desta longa sessão ao novo protocolo.

As evidências são mensagens públicas, metadados de chamadas e artefatos indicados.
Mensagens cifradas entre agentes não são decifradas nem inferidas. Um parâmetro
`model` prova a seleção solicitada, não o modelo efetivamente servido pelo provider.
`fork_turns: none` prova a opção de não herdar o histórico; não prova isolamento
do filesystem ou adequação integral do pacote de contexto.

## Sequência observada

- 20:23:43–20:24:02: releitura das skills globais Accelerate/ASDS e da referência
  `orchestration.md`, além do plano existente e das regras do projeto.
- 20:24:29: inventário do plano, Sol 6.1 medium, `fork_turns: none`.
- 20:26:08: revisão do plano, Astra low, `fork_turns: none`.
- 20:28–20:30: atualização do TASKS existente; DAG apresentado antes de execução.
  A sessão preserva a continuidade sem inicializar OpenSpec. A resposta separa
  preparação documental de aprovação antecipada de código.
- 20:38:24: aprovação humana do DAG e da continuidade nos documentos existentes.
- 20:39:21 / 20:41:28: V00 executor Sol 6.1 medium / revisor Astra low.
- 20:44:13 / 20:49:37: V01 executor Astra low / revisor Astra medium.
- 20:50:36 / 20:53:30: V02 executor Astra low / revisor Astra medium.
- 20:51:51: V03 executor Sol 6.1 medium despachado.
- 20:52:18: V08 executor Luna high despachado.

Os dez spawns acima declaram `fork_turns: none`. Não foi observada revisão de
V03/V08 nesse recorte; não preencher esses papéis por inferência da matriz.
TASKS registra V00 e V01 aceitas pelo root e V02 liberada. Isso é disposição
registrada pelo coordenador; este observador não repetiu testes nem revisão visual.

## DAG e fronteiras

V00 → V01 → V02 → V03 → V04 → V05 → V06 → V07.
V01 também libera V08. V07 alimenta a integração T08-I da frente Jornada;
V09 depende dessa integração e de T06/T07, evitando o ciclo V09 ↔ T08-I.
V10 depende de V08/V09. O plano distingue vitrine sintética de produto integrado.

O plano prevê um escritor por vez no checkout compartilhado, com leituras
independentes paralelas e reservas para browser/build/porta/outputs. V03 foi
**despachada** antes do retorno observado da revisão V02: verificar se o trabalho
foi preparação permitida ou implementação dependente. Spawn não é início de escrita,
e a ordenação isolada das chamadas não comprova violação.

## Comparação com a primeira sessão

| Dimensão | Prop4You P4Y-131 | Agrelli visual |
| --- | --- | --- |
| Planejamento | OpenSpec criado após autorização | TASKS/SDD existentes, continuidade sem OpenSpec |
| Tracker | Plane governado por regra local, parent/filhos lidos no provider | Nenhuma operação Plane confirmada neste recorte |
| Aprovação | Autorização de implementação e criação do OpenSpec | Aprovação explícita do DAG pedida pelo usuário e recebida |
| Papéis | Root executor e um revisor observado | Pares por complexidade, modelos/esforços/fork explícitos |
| DAG | Microcontratos com decisões futuras abertas; validação ad hoc | DAG visual e classes no TASKS; dependência entre sessões explícita |
| Núcleo executável | Não observado uso do novo scheduler/journal | Leitura de orchestration.md confirmada; execução do scheduler/journal não comprovada |
| Encerramento | Primeiro turno parcial; 132 em QA, parent aberto | Execução em andamento no recorte inicial |

## Hipóteses de alto valor a acompanhar

1. Mesma semântica precisa funcionar com OpenSpec e com planos existentes, sem
   migração obrigatória ou duas fontes de progresso. Formato do documento não
   deve determinar a qualidade da coordenação.
2. Permissão para planejar, aprovar DAG, executar código e alterar configuração
   são decisões separadas; preservar as já dadas sem ampliar seus limites.
3. Diferenciar elegibilidade para preparar, implementar, revisar e integrar. Um
   worker pode existir antes de receber permissão para escrever; o futuro adaptador
   precisa representar essas fases em vez de usar apenas running/done.
4. Papéis solicitados, sessão criada, modelo efetivo, candidato revisado e aceite
   root precisam de evidências separadas. Esta sessão oferece melhores metadados
   de spawn, mas isso não elimina a necessidade de conferir o resultado.
5. Dependências entre sessões e recursos compartilhados exigem ownership verificável;
   uma tabela dentro de uma sessão não impede outra de escrever nos mesmos recursos.
6. Medir retrabalho, espera por revisão, rodadas por candidato e entregas efetivamente
   aceitas. Não converter número de agentes em produtividade ou ROI comprovado.

## Estado

Coleta limitada de duas horas encerrada. Último ordinal coletado: 8801. O processo
não mantém monitoramento contínuo ativo. Foram registradas mensagens públicas e metadados, sem raciocínio
privado, segredos ou conteúdo cifrado de despachos. Eventos não são conclusões
automáticas. Nenhuma correção está sendo induzida nas duas sessões observadas.


## Consolidação posterior — 2026-10-03

A resposta pública final do recorte, em 2026-10-02 22:52:15 UTC, relata divergências
visuais adicionais: opacidade de loading, disabled azul em vez de cinza, raio de
badge, switch escuro e ausência de checkbox/icon button. Alturas foram consideradas
corretas. A própria sessão reconheceu que a aprovação do formato pill não havia
virado exceção explícita no DESIGN.md. Trata-se de relato público observado, não
reinspeção independente da UI nesta sessão.

Esse recorte estava limitado a análise pelo usuário; não o classificamos como
nova interrupção indevida da implementação. O aprendizado é rastrear o detalhe
aprovado até o contrato e sua evidência: revisar apenas um design incompleto pode
repetir a omissão. A evolução operational-continuity adiciona approvalCriteria e
exige evidência ligada à revisão integrada para os critérios declarados, mas não
consegue descobrir automaticamente os critérios omitidos. A reconciliação das
fontes originais continua sendo responsabilidade do coordenador e do revisor.
