# Design

## Decisões adotadas

- **Escopo local:** manter pedidos, visões, concessões sintéticas, propostas e registro de operações no armazenamento local do navegador. Nenhum provider real, serviço externo ou identidade de produção participa do fluxo.
- **Armazenamento transacional:** usar IndexedDB para serializar comparação de versão, consumo da permissão e gravação do novo estado/resultado no mesmo commit local. Uma implementação baseada apenas em ler e depois gravar `localStorage` não oferece comparação e gravação atômicas entre abas.
- **Versão:** cada visão começa em `version: 1`; uma aplicação ou recuperação bem-sucedida incrementa exatamente uma vez. Cada proposta registra `expectedVersion`; a operação só pode alterar a visão se essa ainda for a versão atual dentro da transação.
- **Filtros desta rodada:** limitar o contrato aos filtros de status dos pedidos sintéticos, coerente com a nota existente no `README.md`. Não introduzir outros campos ou semânticas de filtro.
- **Proposta e prévia:** a proposta contém `operationId`, `viewId`, versão esperada e filtros pretendidos. Criar ou visualizar uma proposta nunca altera a visão. A prévia mostra valores atuais e propostos e os efeitos sobre os quatro pedidos sintéticos.
- **Idempotência:** canonicalizar o conteúdo semântico da operação (`kind`, `viewId`, versão esperada, filtros pretendidos ou versão alvo de recuperação). O primeiro registro do ID fixa esse conteúdo. Repetição idêntica devolve a proposta ou resultado já registrado, inclusive após aplicação; o mesmo ID com conteúdo ou tipo diferente falha como conflito. Metadados voláteis da concessão não mudam a identidade da operação.
- **Permissão:** a pessoa operadora concede explicitamente uma permissão sintética, separada da proposta, vinculada ao `operationId`, visão e versão esperada, com validade temporal e estado de revogação/consumo. Aplicação e recuperação exigem concessão vigente no momento de execução; proposta e prévia não concedem permissão.
- **Recuperação:** conservar eventos e snapshots anterior/posterior. Recuperar cria uma nova operação compensatória que aponta para snapshot anterior; mostra uma nova prévia e passa pelas mesmas verificações de permissão e versão. Não apagar nem reescrever o histórico original.
- **Falha e retry:** gravar alteração da visão, consumo da permissão e resultado idempotente na mesma transação IndexedDB. Em falha, a transação não deixa alteração parcial; retry com o mesmo ID e conteúdo devolve o resultado existente ou tenta novamente se não houve commit.

## Limites e exclusões

- Sem compartilhamento de visões nesta mudança; a possibilidade futura e a decisão de acesso pendente estão separadas na proposta. Nenhuma política de leitura/edição da equipe foi presumida.
- Sem login, autorização real, provider de IA, sincronização, backend, rede, auditoria remota, migração ou dados reais.
- O identificador e o conteúdo canônico precisam ter formato estável; a implementação deve rejeitar entrada inválida antes de registrar ou conceder permissão.

## Decisão futura de acesso à equipe

O responsável pelo produto deve decidir, antes de especificar e executar compartilhamento, quem pode: localizar/listar uma visão compartilhada; ler filtros e pedidos resultantes; propor; aprovar e aplicar; recuperar; revogar; e administrar membros ou propriedade. Também deve definir escopo da equipe e o que acontece ao remover uma pessoa. Nenhuma tarefa desta mudança depende dessa decisão; toda implementação de compartilhamento fica bloqueada para uma mudança futura.

## Sequência

Execução sequencial. As tarefas de proposta, aplicação e recuperação compartilham os contratos e a persistência da mesma visão e dependem da tarefa anterior. Esta rodada entrega somente documentos de planejamento; código, execução, testes de aplicação e publicação ficam fora do escopo autorizado.
