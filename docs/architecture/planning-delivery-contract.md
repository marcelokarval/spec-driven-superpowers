# Contrato canônico de entrega de planejamento

Versão interna: `asds.planning-delivery/1`. Retorno planejado: `asds.planning-return/1`.
Estado desta especificação: contrato de produto e modelos de referência T01, não
migração do runtime legado nem prova de entrega real em um projeto-alvo.

## 1. Produto e autoridade

ASDS entrega **planejamento pronto, revisado e persistido**, nunca executa as
tarefas do projeto-alvo. Pode investigar, escrever, corrigir e conferir o pacote;
comandos de implementação e testes nas folhas são instruções para um consumidor
posterior. Desenvolver o toolkit ASDS mediante autorização é outra encomenda.

Preservar separadamente `originalRequestedProduct` (tipo, texto, fonte, estado do
pedido original) e `planningContribution` (produto de planejamento, limites,
execução não realizada). Um pedido original de implementação permanece
`not_fulfilled` ao entregar somente seu plano. Não retornar software completed.
Para pedido de planejamento, o atendimento pode encerrar com `planning_delivered`.

Precedência de autoridade: instruções superiores e escopo/autorização explícita
vigentes → AGENTS local e finalidade do proprietário → requisitos/decisões
aceitos com fontes → contrato de produto → adaptação de templates. Conflitos
materiais são registrados, não resolvidos por revogar recusa, inventar aprovação
ou ampliar escopo. Fontes legadas orientadas à execução descrevem comportamento
existente, não redefinem a finalidade. Decisões preservam ID, fonte, responsável,
razão e trabalho afetado; hipótese não é decisão aprovada.

Não inicializar OpenSpec, publicar tracker, instalar, abrir executor, reservar
recurso, criar worktree ou escolher modelo como requisito de produzir o plano.
Destino deve ter autorização identificável. Falta de autorização de destino
bloqueia entrega, não autoriza fallback remoto. Uma projeção é derivada fiel da
fonte canônica; divergência requer reconciliação, nunca dois planos concorrentes.

## 2. Pacote e composição

`tasks.md` é o índice canônico; `tasks/task-ID.md` são contratos canônicos.
Não renomear cosmeticamente para TASKS nem criar um segundo plano. O índice liga
exatamente uma vez todos os contratos; IDs estáveis e caminhos relativos permitem
leitura fora da conversa. `planning-manifest.json` referencia esses artefatos e
fontes já existentes (proposal/design/specs podem ser reutilizados). Não exige um
documento por camada ou o schema OpenSpec para preservar qualidade equivalente.

Um agregado (`nodeType: package`) descreve resultado composto, interfaces,
exclusões e aceite do conjunto; não recebe executor. Uma folha (`nodeType: task`)
entrega resultado independente com fronteira explícita. `parentId` expressa
**composição**, `dependsOn` expressa **precedência** e não inclui automaticamente
pai/filho. Ambas relações devem ser acíclicas, referenciar IDs existentes e ter
razão legível. Profundidade acompanha necessidade, sem teto artificial nem nível
obrigatório em tarefa simples. Dependências de agregados devem ser explicitamente
expandidas/explicadas antes de recomendar execução; exemplos usam folhas.

Toda folha contém Outcome, Inputs com fontes/decisões/interfaces, Scope and
dependencies com caminhos autorizados e somente leitura, Acceptance positivo,
negativo e preservação, Verification futura com comando/assertivas/revisão a
registrar e Definition of done futura. Não há limiar de palavras ou regex que
prove uma fronteira adequada. Resultado separável vira outra folha, não checklist
de chamadas de ferramenta. Critérios do agregado não se reduzem à contagem de
checkboxes. `implementationStatus: not_started` e todas as checkboxes futuras
ficam abertas mesmo quando o **planejamento** está delivered.

Paralelismo é recomendação derivada do DAG e conflitos conhecidos, não dispatch,
reserva ou promessa de concorrência. Recursos compartilhados podem impor ordem
sem fundir resultados independentes. Bloqueio tem ID, responsável, questão,
consequência, tarefas afetadas e condição concreta de resolução; não bloqueia
folhas independentes sem razão.

## 3. Estados de produto (não estados de execução)

| Estado | Significado e condição |
|---|---|
| `draft` | Encomenda/contexto em elaboração; não consumível como plano aprovado. |
| `reviewing` | Candidato identificado submetido à fidelidade e depois qualidade. |
| `ready` | Revisões atuais suficientes, defeitos materiais resolvidos e pacote coerente; falta comprovar entrega no destino. |
| `delivered` | ready + persistência/readback integral da revisão e destino autorizados; nenhuma lacuna material. |
| `partial` | Subconjunto explicitamente utilizável entregue; escopo excluído/bloqueado localizado, sem declarar pacote inteiro ready. |
| `blocked` | Não há subconjunto utilizável entregue ou falta gate global material; registrar próximo responsável e evidência. |
| `superseded` | Revisão substituída por outra identificada; não é o candidato corrente. |

`cancelled` é **resultado do atendimento**, não estado do pacote; registrar a
interrupção e qual revisão coerente permaneceu, sem fabricar entrega. Transições
normais: draft → reviewing → ready → delivered. Defeito/material change devolve
candidato a draft/reviewing e invalida gates afetados. Partial/blocked podem voltar
a draft/reviewing após resolução. Uma revisão entregue não é editada mantendo
seus reviews válidos; nova revisão deve ser identificada e só supersede a anterior
quando coerente. Nada aqui escolhe como armazenar revisões históricas.

## 4. Manifest e rastreabilidade C01–C16

Campos obrigatórios do manifest:

- `schemaVersion`, `returnVersion`, `packageId`, `revision`, `state`, `synthetic`;
- `originalRequestedProduct`, `planningContribution`, `attendanceOutcome`;
- `authority` (origem da encomenda, destino/autorização, fontes normativas e limites);
- `references`: IDs únicos, caminhos, papel e SHA-256 de bytes UTF-8 dos artefatos;
- `tasks`: IDs, tipo, composição, precedência, requisitos e progresso futuro;
- `decisions`, `blockers`, `parallelism` com justificativas;
- `layers` cobrindo exatamente C01–C16, cada qual com status, razão e referências;
- `reviewPolicy`, `reviews` ordenadas fidelidade → qualidade, revisão e evidências;
- `readback`: revisão, destino, conjunto de referências, estado e limitações,
  explicitamente distinto de evidência de execução.

Statuses das camadas: `satisfied` (trabalho feito com evidência), `reused` (fonte
existente reavaliada e preservada), `not_applicable` (razão específica), `blocked`
(lacuna/defeito material com responsável). Presença de campo não prova satisfação.
C07–C16 não desaparecem em encomenda aceita; reuse é possível, mas N/A não pode
mascarar ausência de especificação, contratos, revisão ou readback obrigatório.

| Camada | Conteúdo e saída observável |
|---|---|
| C01 | Encomenda: produto original, contribuição ASDS, destinatário e destino. |
| C02 | Contexto/onboarding: fontes pertinentes e convenções identificadas. |
| C03 | Briefing: requisitos, exclusões e restrições com fontes. |
| C04 | Lacunas/entrevista: só perguntar escolhas materiais não respondidas. |
| C05 | Pesquisa: fatos acessíveis com evidência e incerteza explícita. |
| C06 | Alternativas/brainstorming: trade-offs quando existe escolha real. |
| C07 | Especificação: cenários positivos, negativos e preservações cobertos. |
| C08 | Design: interfaces, riscos e decisões suficientes para decompor. |
| C09 | Decomposição: fronteiras e composição justificadas. |
| C10 | Relações: DAG, bloqueios e paralelismo recomendado. |
| C11 | Microcontratos: índice e todas as folhas context-free. |
| C12 | Revisão de fidelidade: encomenda/fontes/recusas preservadas na revisão atual. |
| C13 | Revisão de qualidade: granularidade, interfaces, viabilidade e consumo sem histórico. |
| C14 | Correção/convergência: achados materiais e repercussões revalidados. |
| C15 | Persistência/readback: arquivos/conteúdo/IDs/relações/revisão conferidos. |
| C16 | Entrega: estado, referências, limitações e trabalho restante claros. |

Referências incluem índice, contratos, fontes e reviews; o manifest não inclui seu
próprio hash para evitar circularidade. Recebimento pode registrar seu hash
externamente. Reviews registram fingerprint do candidato (fontes/índice/contratos),
excluindo o próprio review e o manifest autorreferente. Hash confere identidade,
não verdade semântica. Mudança de fontes ou contratos invalida review afetado.

## 5. Revisão proporcional e finita

Primeiro fidelidade, depois qualidade da **mesma revisão**. Revisor deve confrontar
requisitos e decisões reais, não certificar significado via regex/boolean ready.
Registrar identidade/papel, modo, revisão/fingerprint, escopo lido, achados por
requisito/task, resolução e veredito. Reabrir apenas impacto da correção sem
omitir gates obrigatórios; fixar orçamento de rodadas e condição de parada antes
do loop. Defeito material remanescente no limite resulta partial/blocked, não pass.

Em trabalho ordinary-low de baixo risco, sem política exigindo independência,
permite-se **self-review declarada** com limites; nunca chamá-la independent.
Trabalho sensível, auth, billing, destrutivo ou high-risk exige **independent
review real**, identidade/evidência verificável e separação do autor. Política
local pode exigir independent mesmo no baixo risco. Indisponibilidade do revisor
nesses casos bloqueia ready/delivered; não rebaixa risco nem inventa aprovação.

Os exemplos são **synthetic**, incluindo encomenda, autorização, reviews e
readback ilustrativos. `liveEvidence: null` não é prova de revisão viva. Pass nos
testes de integridade destes fixtures não certifica qualidade semântica nem
entrega real. Uma instância real não pode transportar synthetic como evidência.

## 6. Readback, retorno e compatibilidade

Após persistir, reabrir o destino exato e comparar conjunto de arquivos, bytes,
IDs, composição, precedência, decisões, revisão e referências dos reviews. Falha
parcial deve listar o que foi/ficou entregue. Readback não executa comandos
futuros nem requer receipts de código. Ready antes da escrita não é delivered.

Entrada wire v1 permanece exatamente com sete chaves de contexto: `objective`,
`project`, `scope`, `constraints`, `risks`, `references`, `authorizations`; o
`protocolVersion: 1` opcional já suportado permanece. Não adicionar campos internos
à entrada v1 nem alterar significado de autorizações. Produto original é derivado
com fonte ou explicitamente esclarecido, nunca inferido por apagar a intenção.

`asds.planning-delivery/1` e `asds.planning-return/1` são versões separadas internas/
de retorno, **não protocolVersion 2** de entrada. Novo retorno deve identificar
contribuição de planejamento, estado, revisão, refs/readback, limitações e trabalho
original restante. Consumidor antigo não pode interpretar planning_delivered como
software completed; negociar adapter ou reportar incompatibilidade, sem retrofit
silencioso. T01 não modifica `lib/handoff.mjs`, templates ou schemas legados.

## 7. Persistência ainda não selecionada

Contrato define invariantes de conservação do último plano coerente e readback,
não escolhe armazenamento, cópias, staging, snapshots ou mecanismo transacional.
**T09** decide isso com autorização humana específica para exceções; não criar
cópias excepcionais/backups/worktrees por dedução deste documento. As pastas de
exemplos abaixo são fixtures documentais distintos, não staging de runtime.

## Fontes e modelos

- [Autoridade local](../../AGENTS.md)
- [Estado evolutivo](../../PROJECT-STATUS.md)
- [Pesquisa e limites](../research/2026-10-03-planning-core/REPORT.md)
- [Mapa de mudanças proposto](../research/2026-10-03-planning-core/CHANGE-MAP.md)
- [Modelos e instrução de leitura](../../examples/planning-delivery/README.md)
