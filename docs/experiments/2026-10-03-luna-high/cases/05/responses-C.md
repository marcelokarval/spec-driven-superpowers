Vou usar a skill `openspec-propose` para estruturar a proposta e conferir o formato. Vou assumir o `localStorage` como persistência JSON, registrar explicitamente os limites sem servidor/sincronização/identidade/provider, e revisar a decomposição antes de gravar os contratos. Permanecerei só nos artefatos de planejamento; não vou implementar nem rodar testes de produto.

---

A checagem encontrou duas limitações de ferramenta: este projeto ainda não tem uma raiz `openspec/`, e o comando `openspec` não está disponível no ambiente (`command not found`). Não vou instalar dependências. Vou verificar se o validador ASDS já disponível no toolkit consegue validar contratos locais; se não, informarei a limitação sem afirmar que o pacote foi validado.

---

O projeto sintético não tinha uma raiz OpenSpec própria; a primeira detecção havia alcançado o toolkit ancestral. Já configurei a raiz dentro do caso e confirmei que a CLI agora aponta para o workspace correto. A mudança ficará agrupada em dois contratos: persistência JSON e integração da interface; o segundo depende do primeiro porque usa a mesma interface de repositório.