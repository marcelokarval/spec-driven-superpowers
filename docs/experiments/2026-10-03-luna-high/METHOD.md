# Método e limites

Dez projetos sintéticos independentes, dez sessões Codex novas. Cada caso recebe
leitura explícita de Accelerate e ASDS: isto testa uso informado da pilha, não
seleção espontânea das skills. Modelo solicitado: gpt-6-luna, esforço high.
CLI oficial instalada 0.160.0, login ChatGPT já existente; nenhuma configuração,
instalação de runtime, chave/API ou projeto real foi alterado.

Prompt A inicia a sessão; B é uma continuação predefinida no mesmo ID. O bootstrap
é idêntico, exceto pelo caminho. Casos não recebem resultados ou critérios esperados.
Cases.json e relatórios ficam fora do workspace autorizado de cada caso. Esse limite
de leitura é instrução; não prova isolamento contra outro processo do mesmo usuário.
Sandbox workspace-write foi solicitado para cada execução. Máximo duas sessões
simultâneas, nenhuma delegação, 240 segundos por turno, sem repetição automática.
Uma interrupção por prazo é censura do experimento, não prova de loop infinito.

## O que foi preservado
- Prompts completos A/B, metadados do lançamento, ID e parâmetros de modelo/esforço.
- Eventos públicos: mensagens, comandos, código de saída, chamadas MCP e alterações.
- Versões textuais dos arquivos sintéticos e hashes pré/pós, por observação a cada
  aproximadamente 0,5 segundo. Não é journal atômico de toda escrita de filesystem.
- Resumos públicos fornecidos pelo modelo; nunca raciocínio interno privado.
- Uso de tokens reportado pela CLI, incluindo cache. Não representa porcentagem da
  franquia semanal ou preço financeiro e não comprova identidade interna do provider.

Outputs brutos de ferramentas e stderr não foram exportados. Categorias de falha
foram extraídas separadamente dos blocos públicos de resultado do transcript nativo.
Os arquivos originais das sessões continuam sob a instalação Codex. O readback de
turn_context confirma a configuração registrada, não os pesos efetivos do modelo.

## Como avaliar
Separar: ativação, perguntas materiais, preservação de decisões/recusas, granularidade,
revisão espontânea versus induzida pelo Prompt B, persistência, dependências,
conclusão integrada e cumprimento do limite. Contagem de arquivos/tarefas não prova
qualidade. Leituras repetidas após erro de shell não são refinamento de tarefas.
Uma investigação negativa pode encerrar sua tarefa sem resolver o objetivo maior.

Nenhum patch no framework será feito durante esta bateria: os resultados avaliam
uma versão fixa. Intervenções adicionais, se necessárias para responder lacunas de
fixtures, serão rotuladas como suplementares e não apagarão A/B ou seus bloqueios.
Os diretórios workspace são fixtures para inspeção; execute somente seus comandos
focados, não uma descoberta indiscriminada de testes em todos os artefatos.

## Ocorrências metodológicas

- Sessão limpa significa conversa nova, sem fork do coordenador; não significa
  ausência de instruções globais normais do Codex.
- Caso 10: o participante buscou texto em toda a documentação do toolkit e alcançou
  a árvore deste experimento. Reconheceu o fato publicamente. O caso permanece
  contaminado: o avaliador não o conta como comparação independente limpa.
- Casos 04 e 10: A interrompido; B original foi depois enviado ao mesmo ID por
  `continue.py`. `skipped.jsonl` preserva a decisão inicial do runner, não o estado final.
- Caso 05: C respondeu à pergunta sobre armazenamento que o B fixo não respondia.
  O protocolo primário permanece dois turnos; o terceiro é extensão identificada.
- Resultados com exit 0 não recebem aprovação automática. Um timeout não prova loop.
