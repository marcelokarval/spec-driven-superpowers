DAG atual — 4 tasks (Planejamento ASDS)

Legenda: ✅ executada/aceita no recorte · 🟨 parcial · 📝 contrato preparado · ▶️ pronta agora · ⬜ não executada · 🚫 bloqueada
Os estados abaixo representam a projeção do planejamento ASDS; as checkboxes formais em tasks.md permanecem abertas até execução reconciliada.

0001 📝 CSV contract and fixture design
 ├─ 0002 ⬜ Read-only own-orders CSV handler
 └─ 0003 ⬜ Accessible authenticated CSV download UI

[0002 + 0003]
 └─ 0004 ⬜ Ownership integration and regression acceptance

O que já foi executado e o que falta

Task	Estado atual	Falta
0001	📝 Microcontrato preparado	Revisão, admissão, implementação e prova
0002	⬜ Contrato planejado	Concluir dependências (0001) e executar
0003	⬜ Contrato planejado	Concluir dependências (0001) e executar
0004	⬜ Contrato planejado	Concluir dependências (0002, 0003) e executar

Próxima frente

1. Admitir 0001: revisar microcontrato, issue governante e escopo.
2. Convergir em 0002, 0003 → 0004.
