# Mapa de mudanças proposto — não aplicado

Este mapa orienta a discussão e a futura especificação da correção. Não é uma lista
de implementação já autorizada nem um segundo plano de produto em execução.
A ordem segue dependências de design; os itens descrevem resultados revisáveis.

## Sequência recomendada

| Ordem | Resultado da mudança | Superfícies ASDS | Superfícies Accelerate | Critério de revisão |
|---|---|---|---|---|
| 1 | Finalidade única: entregar planejamento, sem executar suas tasks | spec asds-core; SKILL; protocol; architecture; README; rules | AGENTS; SKILL; asds-integration; branch matrix; projeções ativas | Nenhuma autoridade ativa atribui implementação/integração de produto ao ASDS |
| 2 | Entrada preserva produto pedido e retorno delimita contribuição | intake; handoff.mjs | entry/routing/rubrica; integração | Pedido de plano não vira edição trivial; pedido de implementação não é falsamente concluído pelo plano |
| 3 | Contrato de entrega distingue plano revisado de progresso futuro | contracts/planning; templates TASKS/task; schema; retorno | Apenas apresentação do retorno | Plano pode ser entregue com checkboxes futuras abertas e sem receipts de código |
| 4 | Hierarquia recursiva e precedência são relações distintas | decomposition; contracts; loadTasks; renderDag; tests | Nenhum segundo grafo | Pais/filhos/netos válidos, sem ciclos; folhas delimitadas; dependências não se perdem no refinamento |
| 5 | DAG legível sem executor/modelo/reservas | extração da compilação de grafo em orchestration; CLI; referências | Sem perfil de execução obrigatório na entrada | Validar/renderizar plano sem abrir sessão ou provar integração de código |
| 6 | Processo de entendimento/decomposição tem fases condicionais explícitas | planning; proposal/design; brainstorming ASDS mode | Entrega apenas contexto; sem entrevista duplicada | Reutiliza respostas; pergunta somente lacunas materiais; decompõe automaticamente resultados independentes |
| 7 | Escrita de microcontratos e revisão de pacote realmente conectadas | writing-plans ASDS mode; reviewer template; SKILL; schema | Não revisar plano novamente no retorno | Revisão aponta defeitos por requisito/task/revisão; correção revalidada antes da entrega |
| 8 | Saída de qualidade equivalente com schema alternativo/sem OpenSpec | activation; openspec-propose/update ASDS modes; load/validate/projection | Preservar recusa no contexto | Índice e contratos entregues sem inicialização indevida ou checklist degradada |
| 9 | Persistência e retomada conservam versão coerente do pacote | escrita/publicação de artefatos; validação pós-escrita; histórico de revisão | Retorno não anuncia sucesso antes do readback | Interrupção não remove o único plano válido; ID e revisão conferidos após retorno |
| 10 | Evals avaliam qualidade e entrega do planejamento | evals; fixtures; runner/revisão; CI apropriada | Evals preservam intenção/ownership/retorno | Boas tasks físicas são examinadas; relato do agente e saída zero não bastam |
| 11 | Projeção no destino escolhido mantém equivalência | contrato de adapter e futura implementação Plane | Apenas encaminhar destino autorizado | Conteúdo e relações equivalentes após readback; falha parcial não vira entrega completa |

## O que preservar

- Recepção direta e handoff v1; contexto e decisões com proveniência.
- Disponibilidade global separada de ativação e armazenamento local.
- Aprovações/recusas anteriores; nenhuma inicialização silenciosa.
- Uma fonte canônica, sem planos paralelos de Superpowers/ASDS/tracker.
- Requisitos/cenários, índices/contratos, IDs estáveis e detecção de ciclos.
- Distinção entre fatos, hipóteses e perguntas realmente materiais.
- Refinamento dentro do escopo sem solicitar nova aprovação apenas pela quantidade.
- Invalidação de revisões afetadas e preservação de evidência histórica.
- Gates estruturais existentes, com descrição fiel de seus limites.

## O que retirar da obrigação do planejador

- Iniciar implementação após gerar artefatos ou após uma aprovação genérica.
- Vincular conclusão ASDS a código integrado e receipts de execução.
- Exigir seleção de executor/modelo, capacidade de spawn, worktrees, reservas e
  ownership de recursos vivos para produzir um plano.
- Qualificar provider/runtime de implementação como pré-requisito de planejamento.
- Apresentar supervisão de workers de produto como ciclo principal do ASDS.

Essas capacidades podem continuar como consumidores/integrações opcionais separados.
Não há recomendação de apagar imediatamente bibliotecas, remover skills globais ou
revogar autorizações do usuário. O objetivo é separar responsabilidade e contrato.

## Decisões de design que precisam ser fechadas na próxima especificação

1. **Formato canônico compatível:** manter `tasks.md`/`tasks/task-ID.md` como formato
   existente ou oferecer aliases explícitos para `TASKS.md`/`TASK-0000.md`. Priorizar
   semântica e compatibilidade; não fazer rename cosmético antes de definir migração.
2. **Estado da entrega:** esquema de revisão/prontidão do plano independente de
   progresso futuro. Definir o que significa parcial, bloqueado, revisado e entregue.
3. **Destino:** local primeiro e projeção Plane posterior, ou entrega diretamente
   em Plane com representação canônica e recibo de readback. Nenhuma publicação
   remota nesta pesquisa; o destino precisa de autorização aplicável.
4. **Revisão proporcional:** quais riscos exigem revisor independente; como declarar
   limites sem transformar indisponibilidade de spawn em impedimento universal.
5. **Consumidor posterior:** como o chamador retoma um pedido original de implementação
   depois de receber o plano, sem atribuir execução ao ASDS e sem ressuscitar v0.
6. **Publicação consistente:** estratégia de atualização multi-arquivo e recuperação
   dentro dos diretórios autorizados, sem backups/instalações alternativas automáticas.

A definição do usuário sobre a finalidade não é uma dessas perguntas: ela já está
resolvida. Essas são escolhas de implementação e compatibilidade para respeitá-la.
Não é necessário pedir que o usuário confirme novamente que ASDS é planejador.

## Gates para considerar essa evolução concluída

- Autoridades e projeções ativas dos dois projetos concordam sobre a finalidade.
- Um pedido de planejamento produz TASKS e contratos no destino autorizado.
- Um destinatário sem histórico entende cada folha sem inventar decisões de produto.
- Decomposição é revisada antes da entrega, cresce quando preciso e preserva cobertura.
- Hierarquia e precedência profundas são representadas/validadas sem confusão.
- Review e readback pertencem à mesma revisão entregue.
- Não há implementação de produto, spawn de executor ou marcação de código concluído
  como efeito colateral de produzir/entregar planejamento.
- Evals de comportamento e artefatos passam; testes estruturais continuam identificados
  como estruturais. Plane só entra na declaração de compatibilidade após prova real.
