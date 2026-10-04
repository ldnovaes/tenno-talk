# Testes end-to-end

## Suíte principal (`bun run e2e`)

Roda contra o **mock** (o Vite sobe sozinho em `:4173`), em dois perfis: desktop (1280×860) e celular (Pixel 7).

| Arquivo | O que cobre |
|---|---|
| `onboarding.spec.ts` | cadastro por e-mail, aceite obrigatório dos termos, onboarding completo, sessão após reload |
| `chat.spec.ts` | duas pessoas (duas abas) conversando ao vivo, cada uma no próprio idioma; recibo de leitura; "ver original" |
| `translationModes.spec.ts` | os modos de exibição mudam todas as mensagens |
| `feed.spec.ts` | curtir, comentar, abrir e navegar stories pelo teclado |
| `responsive.spec.ts` | celular: uma tela por vez com barra inferior, sem rolagem horizontal; desktop: duas colunas e painel lateral |
| `a11y.spec.ts` | axe (WCAG 2.1 AA) sem violações sérias ou críticas em 8 telas, nos temas claro e escuro |

As configurações do mock (latência curta, sem falhas aleatórias) ficam em `support.ts`.

## Pilha de produção (`bun run e2e:stack`)

`e2e/stack/` testa o deploy de verdade: Caddy (TLS, HTTP/2, CSP) + build do SPA + backend Java + PostgreSQL. Duas contas novas conversam ao vivo por `wss://`, uma envia foto, e o teste confere a CSP (nenhum erro no console) e os atributos do cookie de sessão.

```sh
cd deploy
cp .env.example .env            # DOMAIN=localhost (ou localhost:8444 se a porta 443 estiver ocupada)
docker compose up -d --build
cd .. && STACK_URL=https://localhost bun run e2e:stack
```

## Medições (2026-10-04)

- **Bundle** (build `http`): 182,6 KB gzip no primeiro carregamento. O shell logado é carregado sob demanda, e nenhum código de mock entra no build real.
- **Lighthouse** em `/welcome` atrás do Caddy (celular simulado, 4G lento): Performance 94–97, Accessibility 100, Best Practices 100, SEO 100.
- **Lista de mensagens** com 330 mensagens e CPU 4× mais lenta: rolagem a 60 fps (p95 17 ms por quadro); mensagem enviada aparece em ~0,4 s (0,26 s numa conversa curta). Virtualização ainda não é necessária (PLAN.md §22).
