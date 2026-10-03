# TENNO TALK — Checklist de implementação

> Checklist vivo. Marque `[x]` ao concluir e registre desvios do plano no [PLAN.md](PLAN.md).
> Uma fase só está concluída quando **todos** os critérios de "Done when" forem verificados.

Legenda: `[ ]` pendente · `[x]` concluído · `[~]` parcial/adiado (com nota)

---

## Phase 0 — Planning

- [x] Clonar o repositório e criar a branch `rebuild/spa-architecture`
- [x] Escrever o PLAN.md (frontend → backend → riscos/decisões)
- [x] Escrever o IMPLEMENTATION.md
- [x] Registrar as regras de desenvolvimento para agentes (CLAUDE.md / AGENTS.md)
- [x] Registrar as decisões de backend (PLAN.md §34): Java, Claude + ChatGPT pelos planos, LGPD nos termos, idioma pelo sistema, sem editar/excluir, 1 grupo por pessoa, OAuth2 próprio, VPS
- [ ] Decisão sobre o merge na `main` (impacto no Lovable)

---

## Phase 1 — Foundation

### Migração do template
- [x] Remover o TanStack Start/Lovable: `src/server.ts`, `src/start.ts`, `src/router.tsx`, `src/routes/`, `src/routeTree.gen.ts`, `.lovable/`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts`
- [x] Remover dependências: `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/router-plugin`, `@lovable.dev/vite-tanstack-config`, `nitro`, overrides de `rolldown` (se não forem mais necessários)
- [x] Remover componentes shadcn não utilizados (calendar, chart, menubar, navigation-menu, input-otp, resizable, breadcrumb, pagination, carousel…) e suas deps (recharts, react-day-picker…)
- [x] Atualizar o README (como rodar, link para PLAN/IMPLEMENTATION)

### Vite + TypeScript
- [x] `index.html` com meta viewport (`viewport-fit=cover, interactive-widget=resizes-content`), `theme-color` e script inline de tema (sem flash)
- [x] `src/main.tsx` com `createRoot`
- [x] `vite.config.ts` com `@vitejs/plugin-react`, `@tailwindcss/vite`, alias `@` → `src`
- [x] Manter o `tsconfig.json` estrito (incluindo `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] Scripts: `dev`, `build`, `preview`, `lint`, `typecheck` (`tsc --noEmit`), `test`, `format`
- [x] ESLint + Prettier funcionando; regra contra `any` explícito (`@typescript-eslint/no-explicit-any: error`)
- [x] `lib/env.ts` com leitura tipada de `import.meta.env`

### Design system
- [x] `styles.css`: tokens Telegram light/dark em oklch (§5.1), tokens novos (`chat-bg`, `bubble-in/out`, `bubble-meta`, `online`, `unread`, `unread-muted`, `overlay-scrim`) registrados em `@theme inline`
- [x] Remover utilitários futuristas do protótipo (`glass`, `bg-send`, `app-bg`, `shadow-glow`)
- [x] Breakpoints `md` 768, `lg` 1024, `xl` 1440
- [x] Fonte Inter Variable (`@fontsource-variable/inter`) + fallbacks
- [x] Validar o contraste AA dos pares de tokens principais nos dois temas
- [x] Ajustar `components.json` (caminho do CSS, base color)

### Infra de app
- [x] `app/queryClient.ts` com defaults (§11.3) e `onError` global → toast
- [x] `lib/errors.ts` (`AppError`, `toAppError`)
- [x] `app/i18n.ts` (i18next + react-i18next, `en`, namespaces por feature)
- [x] `stores/devicePreferencesStore.ts` (tema, persistido) + `ThemeProvider` (light/dark/system)
- [x] `AppProviders` (Query, Theme, i18n, Tooltip, Toaster/sonner, ErrorBoundary raiz)
- [x] Hooks genéricos: `useMediaQuery`, `useBreakpoint` (substitui `use-mobile.tsx`)

### Roteamento e layouts
- [x] React Router v7 (modo declarativo) com `AppRoutes` e todas as rotas do §8 como placeholders lazy
- [x] `paths.ts` com construtores de URL
- [x] Overlay routes: `useOverlayNavigate`, `OverlayLink`, renderização com `backgroundLocation`, fallback `/chats` em deep link no desktop
- [x] Guards (placeholders até a Phase 2): `RequireAuth`, `RequireOnboarded`, `RedirectIfAuthed`
- [x] `AppShell` + `NavigationRail` (md+) + `BottomNav` (mobile, com o botão Create central)
- [x] `ChatLayout` (lista + Outlet; mobile alterna entre lista e conversa)
- [x] `ContentColumn` (Discover/Feed/Notifications)
- [x] `SidePanel` (Sheet à direita + scrim com blur + fallback sem blur)
- [x] `RouteErrorBoundary` + `NotFoundPage`
- [x] Safe areas e `100dvh` aplicados no shell

### Domínio e mocks (base)
- [x] `src/types/*` conforme o §12
- [x] `lib/languages.ts` (catálogo com nome nativo, dir, país padrão) + `lib/countries.ts`
- [x] `services/mock/db.ts` (store + persistência versionada + reset) e `latency.ts`
- [x] `lib/ids.ts` (`createClientId`)

### Componentes comuns
- [x] `UserAvatar`, `EmptyState`, `ErrorState`, `PageHeader`, `RelativeTime`, `CountryFlag`, `LanguageLabel`, `InfiniteScrollTrigger`

### Testes
- [x] Substituir o teste de routing do TanStack por testes de rotas do React Router (rota conhecida renderiza a página; desconhecida → NotFound)
- [x] Teste do `ThemeProvider` (system → dark/light)

> Notas: React Router **8** (versão estável atual; mesma API declarativa do v7). Guards são pass-through até a Phase 2. Screenshots conferidos em 390px e 1280px, nos dois temas.

**Done when**
- [x] `bun run dev`, `build`, `lint`, `typecheck` e `test` passam sem erros
- [x] É possível navegar entre todas as rotas placeholder em 360px, 768px, 1024px e 1440px
- [x] Mobile mostra a bottom nav; md+ mostra o rail; perfil/settings abrem no SidePanel em md+ e como página no mobile
- [x] Alternar light/dark/system funciona e não há flash de tema no reload
- [x] Nenhuma referência restante a TanStack Start/Lovable no código

---

## Phase 2 — Authentication and onboarding

- [x] `services/authService.ts` (interface + mock): `startOAuth("google" | "facebook")` (simulado), `signInWithPassword`, `signUp`, `signInAsDemo(userId)` (só em dev), `signOut()`, `getSession()`
- [x] `stores/sessionStore.ts` (persistido): `status`, `userId`, `accessToken`
- [x] `profileService.getMe()` mock + `useMe()` (query `me`)
- [x] `SessionGate` (carrega `me`, mostra `AppSkeleton`) e guards reais
- [x] `WelcomePage`: proposta, animação de exemplo, Continue with Google / Facebook / email, aviso "By continuing you agree…" com links e "Continue as demo" (Lucas pt-BR / Cam vi-VN, só em dev)
- [x] `/signin` e `/signup` (email + senha, rhf + zod)
- [x] `/terms` e `/privacy` (páginas de leitura com texto provisório e versão; o texto definitivo depende de PLAN.md §34.2)
- [x] `OnboardingLayout` com progresso, voltar/continuar (fixos no mobile) e rota `/onboarding/:step`
- [x] `onboardingDraftStore` (sessionStorage)
- [x] Step 1 — Welcome & terms (exemplo visual PT → VI + aceite obrigatório dos Termos e da Política, informando o uso de IA de terceiros; `profileService.acceptTerms(version)`)
- [x] `detectSystemLanguage()` em `lib/languages.ts` (`navigator.languages` → catálogo, com fallback) + testes
- [x] Step 2 — Native language (pré-selecionado pelo idioma do sistema, nota "Detected from your device"; `LanguagePicker` com busca, nome nativo em destaque)
- [x] Step 3 — Receive language (pré-preenchido com o nativo, texto explicativo)
- [x] Step 4 — Create profile (rhf + zod: nome, username com checagem mock e debounce, avatar com preview, bio opcional, país)
- [x] Step 5 — Discover people (sugestões com Follow/Message, "Start chatting")
- [x] `profileService.completeOnboarding()` + invalidar `me` + redirect para `/chats`
- [x] Sign out (limpa sessão, cache do Query e drafts)
- [x] Testes: guards (sem sessão → /welcome; sem onboarding → /onboarding; onboardado em /welcome → /chats), validação do username, termos obrigatórios

> Notas: a sessão do mock imita o cookie HttpOnly (`tenno.mock-session`); o `sessionStore` não persiste nada e é resolvido no boot pelo `SessionGate`. Um erro `unauthenticated` em qualquer chamada desloga o usuário. Settings ganhou uma versão mínima (lista de seções + Sign out); o conteúdo das seções vem na Phase 5. Regras de username provisórias em `lib/username.ts`.

**Done when**
- [x] Um novo usuário (por Google, Facebook ou email, simulados) aceita os termos, completa os 5 passos e chega em `/chats`
- [x] Não é possível avançar no onboarding sem aceitar os termos
- [x] O idioma nativo vem pré-selecionado com o idioma do sistema
- [x] Um reload no meio do onboarding mantém as respostas
- [x] Um reload no app mantém a sessão; sign out volta para `/welcome` sem dados residuais
- [x] O login demo pula o onboarding
- [x] Todos os inputs têm label, os erros são anunciados e a navegação por teclado funciona

---

## Phase 3 — Chat

### Dados
- [x] Seed: usuários (≥ 12, vários idiomas, incluindo um RTL), conversas diretas (1:1), ~200 mensagens com IDs estáveis e traduções por idioma
- [x] `chatService` (interface + mock) conforme o §16.1, com a projeção da tradução para o viewer
- [x] `chatKeys` + hooks: `useConversations`, `useConversation`, `useMessages` (infinite), `useSendMessage`, `useMarkAsRead`, `useReactToMessage`
- [x] `messageCache.ts`: `upsertMessage`, `patchMessage`, `patchConversationPreview` + testes (dedupe por id/clientId, ordem, identidade preservada)
- [x] `groupMessages.ts` + testes (dias, janela de 5 min, posições)
- [x] `conversationFilters.ts` (All/Unread + busca) + testes

### Realtime mock
- [x] `services/realtime/realtimeClient.ts` (interface + `RealtimeEventMap`)
- [x] `mockRealtimeClient.ts`
- [x] `useRealtimeBridge` no `AppShell` (mensagens → cache; presença/typing → `presenceStore`)
- [x] `stores/presenceStore.ts`
- [x] `autoResponder.ts` (delivered → read → typing → resposta no idioma do contato)

### Lista de conversas
- [x] `ConversationSearch`, `ConversationFilters`, `ConversationList`, `ConversationListItem` (avatar + online, nome, preview, hora, ticks, badge, mute, "typing…")
- [x] `ConversationListSkeleton` e empty states (sem conversas / sem não lidas)
- [x] Estado vazio da coluna central no desktop ("Select a chat")
- [x] Navegação por teclado (↑/↓, Enter) e `Ctrl/Cmd+K`
- [~] Placeholder do `StoriesTray` no topo — o slot `header` existe no `ConversationListPane`; o tray entra na Phase 7

### Conversa
- [x] `ConversationHeader` (voltar no mobile, avatar → perfil no SidePanel, status/typing, call desabilitado, menu)
- [x] `MessageList` (`role="log"`, divisores de dia, grupos, carregar antigas com preservação de scroll, auto-scroll só no fim, `ScrollToBottomButton` com contador)
- [x] `MessageBubble` + `BubbleShell` + `BubbleMeta` + `DeliveryTicks` + conteúdos (text, image, video, file; audio placeholder)
- [x] `TypingIndicator`
- [x] `MessageListSkeleton` e o empty state de conversa nova ("Say hi to …")

### Composer
- [x] `ComposerTextarea` (auto-resize até 6 linhas, Enter envia, Shift+Enter quebra linha)
- [x] `EmojiButton` com picker lazy (frimousse)
- [x] `AttachmentButton` (imagem/vídeo, preview local, envio mock com object URL)
- [x] Botão de voz desabilitado ("coming soon") ↔ botão send
- [x] `composerStore`: draft por conversa (persistido) e reply-target
- [x] `ReplyPreviewBar` (Esc cancela)
- [x] Emissão de typing (throttle 3s, stop após 5s / no envio)

### Envio e ações
- [x] Envio otimista completo (§13.1) com falha → `failed` + retry com o mesmo `clientId` + discard (descarta o que não foi enviado)
- [x] `markAsRead` por visibilidade (debounce) zerando o `unreadCount`
- [x] `MessageActionsProvider` + `MessageActionsMenu` (context menu + botão "⋯" em hover/foco) + `MessageActionsDrawer` (long-press no mobile, `useLongPress`)
- [x] Reply (com `ReplyQuote` clicável que rola até a mensagem)
- [x] Reactions (picker rápido + chips, otimista)
- [x] Copy (texto exibido / original) com toast
- [x] Forward (dialog de seleção de conversas)
- [x] Sem Edit/Delete no menu (fora do escopo, PLAN.md §34)
- [x] `getOrCreateDirectConversation` (usado por "Message" no Discover/Perfil)

> Notas: a sessão do mock passou a ser por aba (`sessionStorage`) e os eventos do servidor mock trafegam entre abas via `BroadcastChannel`. Com isso, Lucas numa aba e Cam em outra conversam em tempo real, com tradução, ticks e "digitando…". O respondedor automático só responde por quem não está aberto em nenhuma aba. Reagir pelo menu agora usa itens do próprio menu, que fecham ao escolher (bug encontrado nos testes).

**Done when**
- [x] Enviar uma mensagem mostra a bolha imediatamente e o status evolui sending → sent → delivered → read
- [x] O contato mock digita e responde no idioma dele; a conversa sobe na lista e o badge aparece quando a conversa não está aberta
- [x] Simular uma falha de envio mostra o retry; o retry não duplica a mensagem
- [x] Carregar mensagens antigas não faz o scroll saltar
- [x] No mobile, a conversa ocupa a tela inteira (sem bottom nav), o composer acompanha o teclado e o long-press abre as ações
- [x] Os testes de `groupMessages`, `upsertMessage` e `conversationFilters` passam

---

## Phase 4 — Translation UX

- [x] `translationService` (interface + mock): `retryMessageTranslation`, `getTranslationInsight`, `translateContent`
- [x] `mockTranslator.ts` (dicionário pt-BR/vi-VN/en-US/es-ES, pseudo-tradução marcada, falha ~10%, "tradução melhorada" v2 em ~20%)
- [x] Mensagens recebidas chegam como `translating` e são atualizadas por `translation.updated`
- [x] `patchTranslation` no `messageCache` (nunca toca o original; aplica só `version >=`) + testes
- [x] `resolveMessageDisplay` + testes cobrindo toda a tabela do §14.3
- [x] `translationViewStore` (overrides por mensagem)
- [x] `useTranslationPreferences` (select de `me` + mutação otimista)
- [x] `useMessageTranslation`
- [x] `TranslatedText` (primária + secundária "Original" na mesma bolha, `lang`, `dir="auto"`, crossfade com `motion`, respeitando reduced motion)
- [x] `TranslationStatusHint` (shimmer em "translating"; "Retry translation" discreto em falha)
- [x] Ações "Show original" / "Show translation" no menu da mensagem
- [x] Mensagem própria: "Show translation" mostra o que o destinatário recebeu
- [x] Preview da lista de conversas respeitando o modo de exibição
- [x] Settings → seção Translation (display mode, auto-translate posts/stories, Learning Mode) funcional
- [x] Learning Mode: ação "Learn" + `LearningPanel` (Popover desktop / Drawer mobile) com Natural / Original / Literal via `useTranslationInsight`; slots para explicação/vocabulário/pronúncia
- [x] Manter a âncora de scroll quando uma tradução chega e o usuário está no fim
- [x] Teste de componente: `MessageBubble` nos 3 modos × (`not_needed`, `translating`, `translated`, `failed`)

> Notas: o `LearningPanel` abre como Dialog no desktop (em vez de Popover) e Drawer no mobile. Em "Original + Translation", um ícone `Languages` de 12px aparece no meta; nos outros modos, só em hover/foco. A lista de mensagens agora observa o tamanho do conteúdo para continuar presa ao fim quando as alturas mudam (troca de modo, tradução chegando, imagens). Os defaults de preferências foram para `lib/preferences.ts`, porque features não podem importar do mock.

**Done when**
- [x] Trocar o display mode em Settings reflete imediatamente em todas as mensagens e previews
- [x] Show original / Show translation funciona por mensagem e sobrevive ao scroll
- [x] Uma tradução com falha mantém o original visível e "Retry translation" funciona
- [x] Uma tradução v2 substitui a v1 sem flicker; um evento atrasado de v1 é ignorado
- [x] Com Learning Mode desligado não há nenhum vestígio visual dele; ligado, o painel abre com os três blocos
- [x] Nenhuma bolha exibe etiqueta do tipo "AI TRANSLATION"

---

## Phase 5 — Profiles, discovery and settings (MVP)

### Perfil
- [x] `profileService` (interface + mock): `getProfile(username)`, `updateProfile`, `follow`, `unfollow`, `getFollowers/Following` (estrutura), `checkUsername`
- [x] `ProfileHeader`, `ProfileStats`, ações (Follow/Message × Edit profile/Settings)
- [x] `ProfileTabs` (Posts; Media/Tagged com "Coming soon")
- [~] `MediaGrid` com os posts — a aba Posts mostra o estado vazio; o grid entra com os posts na Phase 6
- [x] `ProfileSkeleton`, perfil inexistente → estado "User not found"
- [x] `EditProfileForm` (rhf + zod) em `/u/:username/edit`
- [x] Follow/unfollow otimista (contadores e botão)
- [x] Perfil no SidePanel (desktop/tablet) e como página (mobile); o header da conversa abre o perfil do contato

### Discover
- [x] `discoverService` (interface + mock) paginado + filtro por idioma nativo
- [x] `PersonCard`, `PersonCardSkeleton`, grid responsivo, infinite scroll
- [x] `DiscoverFilters` (idioma nativo ativo; Country/Learning/Interests estruturados e desabilitados)
- [x] Message → `getOrCreateDirectConversation` → navega para a conversa
- [x] Empty state de filtro sem resultado

### Settings
- [x] `SettingsNav` + rotas `/settings/:section` (SidePanel com navegação interna em md+; páginas no mobile)
- [x] Account (atalho para edit profile, username, email, password, connected accounts Google/Facebook, versão dos termos aceita; tudo mock)
- [x] Language (native, receiving, interface)
- [x] Translation (já feita na Phase 4; integrar na navegação)
- [x] Appearance (Light/Dark/System com preview)
- [x] Privacy (visibility, who can message, who can comment, blocked users: lista mock com unblock)
- [x] Notifications (toggles)
- [x] Sign out e (dev) "Reset demo data"
- [x] Toggles com salvamento otimista; campos de texto com Save; erros via toast

### Qualidade do MVP
- [x] Revisão de a11y básica: labels, foco visível, ordem de tab, `aria-label` em ícones, alt em imagens
- [x] Revisão de empty/loading/error em todas as telas do MVP
- [x] Revisão responsiva em 320, 360, 768, 1024 e 1440px nos dois temas
- [x] Revisão de i18n: nenhuma string de UI hardcoded

> Notas: bug encontrado nas capturas e corrigido: links diretos para rotas-overlay no desktop renderizavam o painel antes de carregar o usuário (`OverlayGate`). Settings ganhou "Delete account" (direito de exclusão da LGPD), troca de senha (ou criação, para contas sociais), contas conectadas e versão dos termos aceita. Perfil ganhou "Block" com confirmação. `PersonCard` e `useUsernameAvailability` ficam em `features/profile` (transversal); as páginas passam o `onMessage` do chat.

**Done when (MVP)**
- [x] Todos os itens do MVP funcionam com mocks: auth simulada, onboarding, lista de conversas, chat, envio, mensagens e tradução mockadas, alternância Original/Translation, perfil, discover, settings, dark mode, layouts mobile e desktop
- [x] Iniciar uma conversa a partir do Discover e do Perfil funciona
- [x] Alterar o idioma de recebimento em Settings muda as traduções exibidas (o mock reprojeta)
- [x] Lint, typecheck e testes verdes

---

## Phase 6 — Feed

- [x] `feedService` (interface + mock): `getFeed(cursor)`, `getPost`, `likePost`/`unlikePost`, `getComments`, `addComment`, `createPost` (com progresso simulado)
- [x] Seed de posts (imagens/vídeos, legendas em vários idiomas)
- [x] `FeedList` (infinite) + `FeedPostSkeleton` + empty state "No posts yet"
- [x] `PostCard`: header, `MediaCarousel` (embla, indicador de páginas), legenda, ações, contadores
- [x] `TranslatedCaption` com "See translation" / "See original" e auto-translate pela preferência (`useContentTranslation`)
- [x] Like otimista (com animação de coração no double-tap no mobile)
- [x] `CommentsSheet` (Drawer no mobile / Sheet no desktop) com comentários traduzíveis e envio
- [x] Share (copiar link / Web Share API no mobile)
- [x] `/create`: `MediaPicker` (até 10, imagem/vídeo), `CaptionEditor`, `PostPreview`, publicar com progresso; Dialog no desktop, página no mobile
- [x] Slots desabilitados para localização e marcação de pessoas
- [x] O post criado entra no topo do feed e no grid do perfil (atualização de cache)

> Notas: o rail do desktop ganhou o botão "Create" (antes só existia o "+" da bottom nav no mobile). Curtidas e comentários geram notificações no mock (consumidas na Phase 7). "Who can comment" e perfis privados são aplicados no servidor mock. O grid do perfil abre o post num dialog.

**Done when**
- [x] O feed carrega páginas infinitamente sem layout shift
- [x] Criar um post o exibe imediatamente no feed e no perfil
- [x] A legenda em outro idioma respeita "auto-translate posts"; o original nunca é sobrescrito
- [x] Likes e comentários atualizam contadores de forma otimista

---

## Phase 7 — Stories, notifications and groups

### Stories
- [x] `storyService` (interface + mock): `getTray()`, `getUserStories(userId)`, `markViewed`, `reactToStory`, `replyToStory`, `createStory` (upload + texto opcional)
- [x] `StoriesTray` real em Chats e Feed (anel visto/não visto, "+" para o próprio)
- [x] `StoryViewer` (overlay route `/stories/:userId`): fullscreen, `StoryProgress`, toque esquerda/direita, segurar para pausar, swipe down para fechar, setas/Esc, avanço automático entre usuários
- [x] `StoryOverlayText` com Original/Translated (respeita "auto-translate stories")
- [x] `StoryReplyInput` (cria mensagem `story_reply` na conversa direta) + reação rápida
- [x] Pré-carregamento do próximo item

### Notifications
- [x] `notificationService` (interface + mock): lista paginada, `markAllRead`, contador
- [x] `NotificationList` agrupada (Today / This week / Earlier) + `NotificationItem` por tipo + skeleton + empty
- [x] Badge no rail e no sino do header do Feed (mobile)
- [x] `notification.created` via realtime mock (ex.: o auto-responder curte um post)

### Groups
- [x] `chatService.createGroup` (mock) com regra de **no máximo 1 grupo criado por pessoa** (erro claro na UI ao tentar o segundo)
- [x] Fluxo de criar grupo (nome, avatar, adicionar membros)
- [x] Header e info do grupo (membros e idiomas de cada um)
- [x] Filtro **Groups** na lista de conversas
- [x] Avatar e nome do remetente nas mensagens de grupo; tradução por membro (o mock projeta o idioma de cada um)

> Notas: bugs encontrados e corrigidos: tocar no texto do story ("See original") navegava para o próximo story; o anel de story não visto ficava escondido pelo anel branco do avatar. Os testes passaram a usar o `QueryClient` real do app (com os toasts globais de erro), o que revelou que o aviso de "um grupo por pessoa" não era testado de verdade. O visualizador usa uma cópia fixa da bandeja para não pular se ela for recarregada. Em grupos, as próprias mensagens não mostram tradução, porque cada membro recebe num idioma.

**Done when**
- [x] O viewer é navegável por toque e teclado; o progresso pausa ao segurar
- [x] Responder a um story cria a mensagem na conversa correspondente
- [x] Os badges de notificação atualizam em tempo real (mock) e zeram ao abrir a lista
- [x] Criar um grupo funciona; tentar criar um segundo é bloqueado

---

## Phase 8 — Backend integration

> Antes de começar: detalhar a Parte II do PLAN.md e fechar os itens em aberto do §34.2.

### Projeto e infraestrutura local
- [ ] `backend/`: Spring Boot 3 + Java 21 + Maven (Web, Security, OAuth2 Client, WebSocket, Validation, Data JPA, Actuator, Flyway, springdoc)
- [ ] `deploy/docker-compose.dev.yml` (Postgres 16) para desenvolvimento local
- [ ] Monolito modular por pacotes (`auth`, `users`, `chat`, `translation`, `realtime`, `media`, …)
- [ ] Erros no formato Problem Details (RFC 9457) + mapeamento no `toAppError` do frontend

### Banco
- [ ] Migrations Flyway conforme o PLAN.md §27 (incluindo `oauth_accounts`, `terms_acceptances`, `translation_jobs`, índice único parcial de 1 grupo por criador)
- [ ] Seeds de desenvolvimento

### Autenticação
- [ ] Spring Security com sessão em cookie (Spring Session JDBC) + CSRF por cookie
- [ ] OAuth2 Google e Facebook (`/oauth2/authorization/{provider}`), criação/vinculação de conta
- [ ] Email + senha (argon2id), cadastro, login, bloqueio progressivo
- [ ] Verificação de e-mail e redefinição de senha (depende do SMTP, §34.2)
- [ ] Aceite de termos versionado (`terms_acceptances`) obrigatório antes do perfil
- [ ] `GET /api/me` e `authService` real no frontend (`startOAuth` com redirect, `signInWithPassword`, `signUp`, `signOut`, `getSession`)

### API e serviços
- [ ] Endpoints REST para conversas, mensagens (idempotente por `client_id`), leitura, reações, perfis, discover, preferências
- [ ] `ConversationAccessPolicy` + teste de autorização em todo endpoint
- [ ] Rate limit (Bucket4j) em login, cadastro, envio, retry de tradução e upload
- [ ] OpenAPI (springdoc) → conferir os tipos do frontend (openapi-typescript)
- [ ] Implementações HTTP no frontend (`httpChatService`, `httpProfileService`, …) + mappers DTO → domínio, selecionadas em `lib/env.ts`

### Tradução (Claude + ChatGPT pelos planos)
- [ ] Interface `Translator` (exceções de login, cota e transitória) + `CodexCliTranslator` (ChatGPT, **principal**) + `ClaudeCliTranslator` (**reserva**) + `FallbackTranslator`
- [ ] Confirmar as flags de cada CLI, a seleção de modelo e o modo sem ferramentas (somente texto)
- [ ] Fila `translation_jobs` (SKIP LOCKED) + workers com concorrência limitada, timeout e retry com backoff
- [ ] Estado `waiting_provider`: jobs aguardam sem gastar tentativas quando os dois provedores estão sem login ou sem cota; retomada automática quando um volta
- [ ] `ai_provider_status` (ok / needs_reauth / reauth_pending / cooling_down) + roteamento direto para o Claude enquanto o ChatGPT estiver indisponível
- [ ] Reautenticação automática (refresh em segundo plano) e assistida (login por link/código + aviso ao admin por e-mail e notificação)
- [ ] Token de longa duração do Claude (`claude setup-token`) e credenciais persistidas do Codex
- [ ] Painel `/admin/ai` (role admin): estado dos provedores, fila em espera, última falha, botão Reauthenticate
- [ ] Teste: derrubar o login do ChatGPT → as traduções seguem pelo Claude; derrubar os dois → nada se perde e tudo é traduzido após a reautenticação
- [ ] Prompt com contexto (últimas N mensagens, idioma provável) e saída JSON `{ natural, literal }` validada
- [ ] Health check leve das duas CLIs no Actuator + aviso antecipado de login prestes a expirar
- [ ] Desativar o uso de dados para treinamento nas contas Claude e ChatGPT
- [ ] Revisar os termos das assinaturas antes de abrir o app para mais pessoas (R14)

### Mídia
- [ ] `MediaStorage` + `LocalDiskMediaStorage` (`/data/media`), upload multipart, MIME real (Tika), thumbnail, remoção de EXIF
- [ ] `GET /api/media/{id}` com autorização e suporte a `Range`
- [ ] Teto técnico de upload configurável (sem limite de produto) e alerta de disco

### Deploy na VPS
- [ ] `deploy/docker-compose.yml`: caddy (TLS, SPA, proxy `/api`, `/oauth2`, `/login/oauth2`, `/ws`), backend (JRE 21 + Node + CLIs), postgres
- [ ] Imagem multi-stage do backend; volumes `pgdata`, `media`, `cli-credentials`
- [ ] Login das CLIs no servidor (uma vez) com credenciais persistidas
- [ ] `.env` de produção fora do git; domínio e DNS
- [ ] Hardening da VPS (SSH por chave, firewall 80/443/22, fail2ban, atualizações automáticas)
- [ ] Backups (`pg_dump` diário + `/data/media`) com restauração testada
- [ ] CI/CD: GitHub Actions → GHCR → deploy via SSH

**Done when**
- [ ] Todos os fluxos das Phases 2–7 funcionam contra o backend real **sem alterações em componentes ou hooks**
- [ ] Login com Google, Facebook e email/senha funciona em produção, com aceite de termos registrado
- [ ] Mensagens são traduzidas pelo ChatGPT e, com o ChatGPT indisponível, pelo Claude
- [ ] Com as duas IAs sem login, nenhuma mensagem ou tradução se perde, e a fila é processada assim que uma delas é reautenticada
- [ ] Nenhum segredo no bundle do frontend (verificado no build)
- [ ] Testes de autorização impedem acesso a conversas de terceiros

---

## Phase 9 — Realtime

- [ ] Backend: WebSocket em `/ws` autenticado pela sessão; envelope `{ type, payload }` igual ao `RealtimeEventMap`
- [ ] Registro de conexões por usuário e envio por membro (tradução projetada)
- [ ] Frontend: `wsRealtimeClient` implementando `RealtimeClient`, selecionado em `lib/env.ts`
- [ ] Presença (online/offline, last seen) e typing
- [ ] Delivered/read derivados dos cursores e emitidos pelo servidor
- [ ] `translation.updated` emitido pelos workers de tradução
- [ ] Heartbeat, reconexão com backoff e fetch incremental (`?after=`) no reconnect
- [ ] Indicador discreto de conexão ("Connecting…") no header da lista
- [ ] Teste manual e2e com duas contas em navegadores diferentes

**Done when**
- [ ] Duas contas com idiomas diferentes conversam em tempo real, cada uma lendo no próprio idioma
- [ ] Typing, online e read receipts funcionam
- [ ] Derrubar e restaurar a conexão não perde mensagens nem as duplica

---

## Phase 10 — Production hardening

- [ ] Medir a `MessageList`; adotar react-virtuoso se necessário
- [ ] Orçamento de bundle (< 200KB gzip no primeiro carregamento) e análise de chunks
- [ ] Lighthouse (performance, a11y, best practices) ≥ 90 nas telas principais
- [ ] Auditoria axe sem violações críticas nos dois temas
- [ ] Playwright e2e: onboarding, chat entre duas contas, modos de tradução, feed, stories, responsividade
- [ ] Block/report de ponta a ponta
- [ ] Exclusão de conta e exportação de dados (LGPD)
- [ ] Termos de Uso e Política de Privacidade definitivos (uso de IA de terceiros, retenção, direitos do titular)
- [ ] Rate limits validados sob carga
- [ ] Monitoramento: uptime, disco, cotas e falhas das CLIs de IA; Sentry opcional
- [ ] Headers de segurança no Caddy (CSP, HSTS), revisão de dependências
- [ ] PWA opcional (manifest, ícones, instalação)

**Done when**
- [ ] Metas de performance e acessibilidade atingidas
- [ ] Deploy reproduzível na VPS, com backup restaurado com sucesso pelo menos uma vez
- [ ] Checklist de segurança do PLAN.md §31 verificado
