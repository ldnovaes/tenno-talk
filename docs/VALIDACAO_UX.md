# Validação da revisão social (2026-10-04)

Implementação da [Phase 11](../IMPLEMENTATION.md#phase-11--notificações-e-experiência-social). Release `1821cbe` publicado em `https://tenno.eldialabs.com` em 2026-10-04.

- Frontend: typecheck, lint e build concluídos; Vitest 363/363 testes. IndexedDB cobre isolamento entre contas, bytes de anexos, exclusão mútua de abas, retries transitórios e mesmo clientId.
- Backend: suíte Maven completa concluída em PostgreSQL de teste; integração específica de feed/stories por follow, ACK em grupo, notificações concorrentes e comentários idempotentes/paginados. Um segundo ensaio do backend subiu com chaves VAPID temporárias e passou.
- Navegador: E2E mock 17/17 executáveis da suíte principal, mais 4/4 de follow/unfollow e fechar story indisponível em desktop/celular. Dois screenshots locais do painel de comentários em 390 e 1280 px foram inspecionados depois de carregar os comentários.
- Navegador + API real + PostgreSQL descartável: E2E com duas contas verificou que texto e imagem continuam na fila IndexedDB após recarga, preservam os bytes do anexo e chegam exatamente uma vez ao destinatário quando o bloqueio de rede é removido (1/1 teste).
- Favicon: o PNG original (618.116 bytes) foi convertido para o favicon de 32 px (1.559 bytes), `.ico` (4.820 bytes) e ícones de plataforma; `bun run build` inclui os arquivos.
- Deploy: backup do banco e mídia concluído antes da migration. Pipeline completo passou (363 testes frontend, suíte backend em PostgreSQL 14 e 21 testes E2E mock); o release ativou com health `UP`, página e API HTTP 200. Migration V5 aplicada com sucesso. Pela URL pública, `/sw.js` respondeu 200 como JavaScript com `Cache-Control: no-cache` e `/favicon.png` respondeu 200 com 1.559 bytes. As variáveis VAPID estão no processo da JVM e fora do Git; a branch `feat/ai-provider-apis` foi publicada no remoto.

Pendente para validação em produção: testar push com o app fechado em aparelhos reais e permissão negada conforme [WEB_PUSH.md](WEB_PUSH.md). Também falta ensaio físico de teclado e safe area, reconexão de múltiplas abas com anexos offline e reinício deliberado do worker durante uma entrega. Estes itens permanecem abertos no checklist.
