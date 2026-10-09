# Revisões do pacote partial-r1

**SYNTHETIC — NÃO É REVIEW VIVO**. Autor/revisor ilustrativo `fixture-author`.
Modo: self-review declarada, risco ordinary-low e nenhuma política de independência.
Evidência viva: nenhuma. Fingerprint SHA-256 do candidato: `35e5f61f82a4856aec865ccc08176ee1d1341037df7210bbbbceae34bfc37423`
(brief, índice e contratos, pares caminho NUL hash LF ordenados; exclui este
review e manifest para evitar circularidade).

## 1. Fidelidade
Encomenda S01 confrontada com R01–R04: 0001 cobre R01/R04; 0002 cobre R02/R04;
0003 cobre R03/R04; P01 integra resultados. D04 preserva recusa de inicialização.
Pedido original continua não implementado. Revisão partial-r1.
Veredito ilustrativo: partial: B01 impede cenário de exportação exato; 0001 permanece utilizável.

## 2. Qualidade (depois da fidelidade, mesma revisão)
Listagem e exportação têm entregas independentes e caminhos disjuntos. Guia
depende de ambas; agregado não recebe executor. Interface do reader/erro,
entradas vazias e preservação são explícitas sem acesso à conversa.
Veredito ilustrativo: partial: não aprovar 0002/0003 antes da decisão D02 e revalidação dos exemplos.

## Correção e parada
Orçamento ilustrativo: duas rodadas. Nenhum achado corrigido/review vivo alegado.
B01 permanece aberto; proprietário decide formato, autor revisa 0002/0003 e ambos os gates afetados.
Metadados de precedência explicitam motivo e output requerido de 0001/0002;
fingerprint sintético atualizado, sem alegar nova revisão viva.
Não contar testes regex/estruturais como julgamento semântico.

## Readback ilustrativo
Destino: esta pasta-modelo, autorizado apenas como fixture desta tarefa T01.
Estado: matched dos arquivos-modelo por testes de hashes, não certificação viva
de entrega externa. Reviews acima são sintéticos; jamais completar software.
