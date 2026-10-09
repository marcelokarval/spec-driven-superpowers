# Pedidos — fixture sintético
Aplicação mínima local, sem dependências, rede, credenciais ou banco. Não é um projeto de produção.
- src/app.js: lista de pedidos e renderização textual; filtros ainda não implementados.
- src/styles.css: botão Salvar e seus estados.
- index.html: página estática.
- data/orders.json: quatro registros sintéticos.
- tests/app.test.mjs: comportamento atual. Executar: node --test tests/app.test.mjs.
- Visões salvas futuras: nome obrigatório, ID único, JSON local, versão inicial1; listar não modifica dados; abrir restaura filtro de status; excluir visão não exclui pedidos.
