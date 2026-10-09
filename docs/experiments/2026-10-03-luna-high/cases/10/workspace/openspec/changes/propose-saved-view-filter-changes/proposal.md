# Proposta: propostas de alteração de filtros de visões salvas

## Por quê

Permitir que a IA sugira ajustes em uma visão salva sem poder aplicá-los implicitamente. O operador precisa entender a diferença, autorizar a operação sobre a versão vigente e recuperar o estado anterior com trilha local.

## O que muda

- Adicionar propostas identificadas e imutáveis de mudança de filtro, com prévia comparando estado atual e pretendido.
- Exigir uma concessão local de permissão, explícita, vigente, de uso único e vinculada à proposta, visão e versão esperada para aplicar.
- Rejeitar conflito de versão e reutilização de ID com conteúdo diferente; repetição do mesmo ID e conteúdo devolve o resultado anterior.
- Registrar localmente as operações e snapshots necessários para uma recuperação compensatória, também sujeita a prévia, permissão e versão atual.
- Manter a execução com dados sintéticos locais, sem provider real, autenticação de produção ou chamadas externas.

## Capacidades

### Novas capacidades

- `saved-view-filter-proposals`: criar, pré-visualizar, autorizar, aplicar e recuperar mudanças de filtros de visões salvas.

### Capacidades modificadas

Nenhuma. O projeto não tem uma especificação de capacidade existente; a nota em `README.md` descreve visões futuras, não um contrato implementado.

## Impacto

Planeja mudanças em `src/app.js`, `index.html`, `src/styles.css` e `tests/app.test.mjs`, com persistência sintética local e controle transacional de versão. Nenhum desses arquivos de aplicação será alterado nesta rodada.

## Opção futura separada: compartilhar com a equipe

O compartilhamento em equipe fica registrado como possibilidade futura e fora do escopo executável desta mudança. Ainda falta a decisão do responsável sobre quem pode descobrir/listar, visualizar, propor mudanças, autorizar/aplicar, recuperar e revogar o acesso. Até essa decisão, não se define visibilidade de dados compartilhados, papéis, herança, transferência de propriedade nem comportamento de remoção de membros.

Essa decisão não altera nem reabre os contratos de proposta, prévia, permissão vigente, versão atual, idempotência e recuperação local definidos acima. Os contratos próprios de compartilhamento, seu modelo de dados, interface, testes e tarefas executáveis devem ser especificados em uma etapa separada depois da decisão de acesso.
