# Validação da revisão social (2026-10-04)

Implementação local da [Phase 11](../IMPLEMENTATION.md#phase-11--notificações-e-experiência-social). Não houve deploy nesta etapa.

- Frontend: typecheck, lint e build concluídos; Vitest 363/363 testes. IndexedDB cobre isolamento entre contas, bytes de anexos, exclusão mútua de abas, retries transitórios e mesmo clientId.
- Backend: suíte Maven completa concluída em PostgreSQL de teste; integração específica de feed/stories por follow, ACK em grupo, notificações concorrentes e comentários idempotentes/paginados. Um segundo ensaio do backend subiu com chaves VAPID temporárias e passou.
- Navegador: E2E mock 17/17 executáveis da suíte principal, mais 4/4 de follow/unfollow e fechar story indisponível em desktop/celular. Dois screenshots locais do painel de comentários em 390 e 1280 px foram inspecionados depois de carregar os comentários.
- Navegador + API real + PostgreSQL descartável: E2E com duas contas verificou que texto e imagem continuam na fila IndexedDB após recarga, preservam os bytes do anexo e chegam exatamente uma vez ao destinatário quando o bloqueio de rede é removido (1/1 teste).
- Favicon: o PNG original (618.116 bytes) foi convertido para o favicon de 32 px (1.559 bytes), `.ico` (4.820 bytes) e ícones de plataforma; `bun run build` inclui os arquivos.

Pendente para validação em produção: configurar VAPID conforme [WEB_PUSH.md](WEB_PUSH.md), publicar backend/frontend com migration V5 e testar push com o app fechado em aparelhos reais e permissão negada. Também falta ensaio físico de teclado e safe area, reconexão de múltiplas abas com anexos offline e reinício deliberado do worker durante uma entrega. Estes itens permanecem abertos no checklist.
