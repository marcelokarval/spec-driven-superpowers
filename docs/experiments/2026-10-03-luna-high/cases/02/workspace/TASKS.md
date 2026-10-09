# Plano: filtrar pedidos por status

**Estado:** planejado; nenhuma implementação iniciada.

## Objetivo

Permitir que a pessoa filtre a lista de pedidos por status e limpe o filtro para voltar à lista completa, sem modificar os pedidos de origem.

## Contexto observado

- `src/app.js` atualmente copia a lista e renderiza todos os pedidos; não aplica filtros.
- `index.html` contém a seção vazia `#filters` e a lista `#orders`.
- `data/orders.json` contém pedidos sintéticos com status `paid`, `pending` e `cancelled`.
- `tests/app.test.mjs` usa o test runner nativo do Node e verifica que `listOrders` preserva os dados e a ordem.

## Tarefa

- [ ] Implementar o filtro por status e a ação para limpar o filtro.

### Escopo previsto

- `src/app.js`: filtrar a lista sem alterar o array de origem ou os objetos dos pedidos; sem filtro ativo, retornar todos na ordem original.
- `index.html` e `src/styles.css`: apresentar um seletor de status acessível e uma ação visível para limpar o filtro; atualizar a lista quando o filtro mudar ou for limpo.
- `tests/app.test.mjs`: cobrir filtro por status, lista completa após limpar e preservação dos dados e da ordem.

### Critérios de aceitação

1. Ao abrir a página sem filtro, todos os pedidos aparecem na ordem de origem.
2. Ao selecionar um status, somente pedidos com esse status aparecem.
3. Ao limpar o filtro, todos os pedidos voltam a aparecer na ordem de origem.
4. Filtrar ou limpar não altera o array de origem, os objetos dos pedidos nem `data/orders.json`.
5. Os controles têm rótulos acessíveis e a ação de limpeza é identificável como “Limpar filtro”.

### Verificação prevista

- Executar `npm test` depois da implementação e confirmar os casos de filtro, limpeza e imutabilidade.
- Fazer uma verificação manual da página: estado inicial, seleção de cada status disponível e retorno à lista completa após limpar.

## Limites

- Não implementar visões salvas, persistência, edição ou exclusão de pedidos.
- Não adicionar dependências para implementar ou testar o filtro.
- Não modificar os registros em `data/orders.json`.
- Este arquivo registra o plano; implementação e verificações ficam para uma autorização posterior.
