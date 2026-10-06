# Testes end-to-end

## Suíte principal (`bun run e2e`)

Roda contra o **mock**, usando o **build de produção** (`vite build` + `vite preview` em `:4173`, nunca o servidor de desenvolvimento, que recarrega a página ao otimizar dependências no meio do teste), em dois perfis: desktop (1280×860) e celular (Pixel 7).

| Arquivo                    | O que cobre                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onboarding.spec.ts`       | cadastro por e-mail, aceite obrigatório dos termos, onboarding completo, sessão após reload                                                                                                |
| `chat.spec.ts`             | duas pessoas (duas abas) conversando ao vivo, cada uma no próprio idioma; recibo de leitura; "ver original"                                                                                |
| `translationModes.spec.ts` | os modos de exibição mudam todas as mensagens                                                                                                                                              |
| `feed.spec.ts`             | curtir, comentar, abrir e navegar stories pelo teclado                                                                                                                                     |
| `responsive.spec.ts`       | celular: uma tela por vez com barra inferior, sem rolagem horizontal; desktop: duas colunas e painel lateral                                                                               |
| `a11y.spec.ts`             | axe (WCAG 2.1 AA) sem violações sérias ou críticas em 20 telas (todas as seções de Settings, conversa e post em árabe, viewer de story, edição de perfil, admin), nos temas claro e escuro |
| `discover.spec.ts`         | um post por tela, teclado e rolagem; "Not interested" e desfazer                                                                                                                           |
| `followRequests.spec.ts`   | perfil privado, pedido de seguir confirmado pelas notificações                                                                                                                             |
| `socialUx.spec.ts`         | deixar de seguir tira os posts do feed sem esconder os stories de um perfil público; story que não carrega ainda fecha                                                                     |
| `cursor.spec.ts`           | cursores de ponteiro e "não permitido" nos recursos em breve                                                                                                                               |
| `chatActions.spec.ts`      | responder e reagir pelo menu (desktop) e pelo toque longo (celular)                                                                                                                        |
| `groups.spec.ts`           | grupo criado pela interface, cada membro lendo no próprio idioma; limite de um grupo por pessoa                                                                                            |
| `stories.spec.ts`          | reação vira mensagem na DM do autor, confirmação dentro do viewer; resposta privada; espaço pausa sem fechar; criar story                                                                  |
| `settings.spec.ts`         | tema sem piscar no reload; "Who can message me" fecha a conversa do outro lado; novo idioma de recebimento vale para as próximas mensagens                                                 |
| `notifications.spec.ts`    | follow chega ao vivo; "marcar tudo como lido" numa aba atualiza a outra                                                                                                                    |
| `navigation.spec.ts`       | contador do sino em cima do ícone (rail no desktop, cabeçalho no celular), sem toast; o rail marca a seção atual                                                                           |
| `account.spec.ts`          | editar perfil, baixar os dados (JSON), excluir a conta                                                                                                                                     |
| `admin.spec.ts`            | admin chega às páginas pelo Settings; quem não é admin é barrado                                                                                                                           |
| `rtl.spec.ts`              | original em árabe com `lang="ar"` e direção RTL dentro da interface LTR                                                                                                                    |

As configurações do mock (latência curta, sem falhas aleatórias) ficam em `support.ts`.

## Pilha de produção (`bun run e2e:stack`)

`e2e/stack/` testa o deploy de verdade: Caddy (TLS, HTTP/2, CSP) + build do SPA + backend Java + PostgreSQL. Duas contas novas conversam ao vivo por `wss://`, uma envia foto, e o teste confere a CSP (nenhum erro no console) e os atributos do cookie de sessão.

`privacy.spec.ts` repete os caminhos de privacidade que falharam em produção em 05/10 (bloquear, desbloquear e "People I follow"; remetente privado e pedido de seguir pendente) e confere o badge de Chats do outro lado (PLAN.md §31.1).

`groups.spec.ts` cria um grupo com três contas novas: o "Who can message me" de cada membro vale para entrar no grupo, cada pessoa cria um só grupo e as mensagens chegam ao vivo. `followRequests.spec.ts` aprova um pedido de seguir pelas notificações e recusa outro em Settings, com o badge subindo ao vivo dos dois lados. `accountSwitch.spec.ts` sai da conta com uma mensagem ainda na outbox: outra conta entra no mesmo navegador sem ver nem enviar a pendência, que sai uma única vez quando a conta de origem volta a entrar (PLANO_UX §3.1, item 8).

O banco da pilha sobrevive entre execuções. Por isso, os testes criam contas novas a cada vez e localizam o que criaram pelo `@username`, nunca só pelo nome exibido.

`outbox.spec.ts` também pode rodar contra frontend, API e PostgreSQL locais. Ele bloqueia temporariamente os POSTs de mensagem e mídia, recarrega a página e confirma que texto e anexo são enviados uma única vez quando a rede volta. O teste requer `STACK_URL` apontando para o frontend HTTP conectado à API real.

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
