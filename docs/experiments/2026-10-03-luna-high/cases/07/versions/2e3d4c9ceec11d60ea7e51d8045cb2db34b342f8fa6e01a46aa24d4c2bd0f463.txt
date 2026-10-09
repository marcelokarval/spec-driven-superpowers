# Planejamento — filtro de pedidos por status

## Contexto e limites

- Objetivo recebido: filtrar pedidos por status e limpar o filtro.
- Projeto: este fixture sintético.
- Escopo: UI local e função pura.
- Restrições: nenhuma alteração aos dados; sem banco ou rede.
- Decisão explícita: este planejamento pode ser registrado em `TASKS.md`; criação de OpenSpec foi recusada.
- Execução de implementação não está autorizada neste encaminhamento.

## Evidências observadas

- `README.md:2-7`: aplicação local sem dependências, rede ou banco; filtros ainda não implementados; identifica o teste existente.
- `src/app.js:1-2`: `listOrders` copia a lista e `renderOrders` produz texto, sem lógica de filtro.
- `index.html:1`: há uma seção `#filters` e uma lista `#orders`, mas nenhum script ou carregamento de pedidos.
- `tests/app.test.mjs:3-4`: cobertura atual verifica apenas cópia e preservação da ordem por `listOrders`.
- `data/orders.json` contém registros sintéticos com status `paid`, `pending` e `cancelled`; permanecerá somente como entrada de leitura.

## Resultado pretendido

Uma pessoa consegue selecionar um status, ver somente os pedidos correspondentes e limpar a seleção para voltar a ver todos. O filtro é determinístico e puro: status vazio ou sem seleção resulta na lista completa, na mesma ordem, sem mutar a entrada. A UI usa a mesma regra e não persiste estado nem altera registros.

## Tarefas propostas

### T1 — Definir o caminho local de leitura e inicialização da UI

- **Tipo:** investigação.
- **Depende de:** nenhuma.
- **Resultado observável:** decisão documentada no próprio trabalho de implementação sobre como a página obtém a lista existente sem rede, banco, duplicação ou alteração dos dados; definir também o ponto de inicialização e atualização da UI.
- **Limites:** inspecionar somente os arquivos deste fixture relevantes ao carregamento e renderização. Não implementar, não modificar dados e não introduzir dependências.
- **Aceitação:** escolha compatível com `index.html` estático e com os limites recebidos; identifica o contrato entre entrada de pedidos, filtro puro e renderização; se as opções locais forem inviáveis sem ampliar escopo, interrompe e reporta a decisão necessária.
- **Verificação planejada:** registrar arquivos e evidências locais que sustentam a escolha; nenhuma execução de programa é necessária para esta investigação.

### T2 — Implementar filtro puro, controle de status e limpeza

- **Tipo:** implementação.
- **Depende de:** T1 integrada e sem ampliação dos limites.
- **Resultado observável:** a UI filtra a lista pelo status selecionado e um controle “Limpar filtro” restaura a lista completa; a função de filtro pode ser chamada independentemente do DOM.
- **Escopo esperado de escrita:** `src/app.js`, `index.html`, `src/styles.css` e `tests/app.test.mjs`, ajustado apenas se T1 demonstrar que um destes arquivos não é necessário. Nenhum arquivo em `data/` será escrito.
- **Aceitação:**
  - status selecionado retorna apenas pedidos daquele status;
  - valor vazio/sem seleção retorna todos os pedidos, preservando a ordem;
  - filtrar e limpar não modificam a lista de entrada nem os pedidos;
  - limpar restaura a visualização completa e o estado do controle;
  - a UI fornece rótulo acessível para seleção e limpeza;
  - nenhuma persistência, chamada de rede, banco ou dependência nova é introduzida.
- **Verificação planejada:** acrescentar testes de unidade para correspondência, status vazio, preservação de ordem e ausência de mutação; verificar também o fluxo de seleção e limpeza da UI conforme o mecanismo local escolhido em T1. Comando existente: `node --test tests/app.test.mjs`.
- **Definição de pronto:** comportamento e UI satisfazem as afirmações acima; testes pertinentes passam; `data/orders.json` continua sem alteração.

## Decisões e pendências

- Resolvido pelo handoff: escopo restrito a UI e função pura; sem alterar dados, banco ou rede; status vazio mostra todos; planejamento autorizado; OpenSpec recusado.
- Pendente para T1: mecanismo local já compatível com a página estática para fornecer os registros à UI. A evidência atual não mostra inicialização ou carregamento existente, então o plano não presume uma API de entrada nem adiciona um mecanismo de dados por conta própria.
- Nenhuma implementação, edição de dados, execução de testes ou criação de OpenSpec foi realizada nesta etapa.
