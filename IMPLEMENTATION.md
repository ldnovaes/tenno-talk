# TENNO TALK — Checklist de implementação

> Checklist vivo. Marque `[x]` ao concluir e registre desvios do plano no [PLAN.md](PLAN.md).
> Uma fase só está concluída quando **todos** os critérios de "Done when" forem verificados.

Legenda: `[ ]` pendente · `[x]` concluído · `[~]` parcial/adiado (com nota)

Próxima revisão de experiência: [Phase 11 — Notificações e experiência social](#phase-11--notificações-e-experiência-social), detalhada em [PLANO_UX.md](PLANO_UX.md).

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
- [x] `WelcomePage`: proposta, animação de exemplo, Continue with Google / Facebook / email, aviso "By continuing you agree…" com links e "Continue as demo" (Rafael pt-BR / Linh vi-VN, só em dev)
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

> Notas: a sessão do mock passou a ser por aba (`sessionStorage`) e os eventos do servidor mock trafegam entre abas via `BroadcastChannel`. Com isso, Rafael numa aba e Linh em outra conversam em tempo real, com tradução, ticks e "digitando…". O respondedor automático só responde por quem não está aberto em nenhuma aba. Reagir pelo menu agora usa itens do próprio menu, que fecham ao escolher (bug encontrado nos testes).

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

> Concluída em 2026-10-03 (código + testes). Itens que dependem da VPS, de SMTP ou de contas reais ficam abertos abaixo.

### Projeto e infraestrutura local
- [x] `backend/`: Spring Boot 4.1 + Java 21 + Maven (Web MVC, Security, OAuth2 Client, WebSocket, Validation, **JDBC/JdbcClient** em vez de JPA, Actuator, Flyway, springdoc)
- [x] `docker-compose.dev.yml` (Postgres 16) para desenvolvimento local
- [x] Monolito modular por pacotes (`auth`, `users`, `chat`, `translation`, `realtime`, `media`, `feed`, `stories`, `notifications`, `admin`, `ratelimit`)
- [x] Erros no formato Problem Details (RFC 9457) com `code` + `fieldErrors` + mapeamento no frontend (`problemToAppError`)

### Banco
- [x] Migrations Flyway conforme o PLAN.md §27 (incluindo `oauth_accounts`, `terms_acceptances`, `translation_jobs`, índice único parcial de 1 grupo por criador)
- [ ] Seeds de desenvolvimento (o fluxo real de cadastro + onboarding já cobre o uso a dois)

### Autenticação
- [x] Spring Security com sessão em cookie (Spring Session JDBC) + CSRF por cookie; cookie `SESSION` HttpOnly/SameSite/Secure declarado explicitamente
- [x] OAuth2 Google e Facebook (`/oauth2/authorization/{provider}`), criação/vinculação de conta; falha volta para `/welcome?error=oauth`
- [x] Email + senha (argon2id), cadastro, login (bloqueio progressivo: depois; o rate limit já cobre força bruta)
- [ ] Verificação de e-mail e redefinição de senha (depende do SMTP, §34.2)
- [x] Aceite de termos versionado (`terms_acceptances`) obrigatório antes do perfil
- [x] `authService` real no frontend (`startOAuth` com redirect, `signInWithPassword`, `signUp`, `signOut`, `getSession`)

### API e serviços
- [x] Endpoints REST de todas as áreas (PLAN.md §25.1), mensagens idempotentes por `client_id`
- [x] Autorização por membership/visibilidade + `SecurityMatrixIT` (todo endpoint: 401 anônimo, 403 sem CSRF, 403 admin)
- [x] Rate limit (Bucket4j) em login, cadastro, envio, tradução, upload, ações sociais, criação e admin (`RateLimitRules`)
- [ ] OpenAPI (springdoc em `/api/openapi`) → conferir os tipos do frontend com openapi-typescript
- [x] Implementações HTTP no frontend (`src/services/http/*`), selecionadas por `VITE_DATA_SOURCE=http`; os DTOs já espelham `src/types`, então não há mappers
- [x] Feed (posts, likes, comentários com "who can comment"), stories (tray, view, reação, resposta por DM, 24h), notificações (preferências, push realtime)

### Tradução (ChatGPT + Claude pelos planos)
- [x] Interface `Translator` (erros de login, cota e transitório) + `CliTranslator` por provedor (ChatGPT via `codex exec`, **principal**; Claude via `claude -p`, **reserva**) + `FallbackTranslator`
- [ ] Confirmar no servidor as flags de cada CLI e a seleção de modelo (comandos configuráveis em `tenno.ai.providers`)
- [x] Fila `translation_jobs` (SKIP LOCKED) + worker com lote limitado, timeout e retry com backoff
- [x] Estado `waiting_provider`: jobs aguardam sem gastar tentativas quando os dois provedores estão indisponíveis; retomada automática quando um volta
- [x] `ai_provider_status` (ok / needs_reauth / reauth_pending / cooling_down) + roteamento direto para o Claude enquanto o ChatGPT estiver indisponível
- [x] Reautenticação automática (status da CLI) e assistida (login por link/código, aviso ao admin no log; e-mail depende do SMTP)
- [x] Painel `/admin/ai` (role admin): estado dos provedores, fila, última falha, "Check now" e "Log in again" com link e código
- [x] Teste: login do ChatGPT cai → traduções seguem pelo Claude; os dois caem → nada se perde e tudo é traduzido após a reautenticação (`TranslationPipelineIT`, `AdminAiIT`)
- [x] Prompt com contexto (últimas N mensagens, idioma provável, anti-injeção) e saída JSON `{ natural, literal }` validada
- [ ] Health check das CLIs no Actuator + aviso antecipado de login prestes a expirar
- [ ] Desativar o uso de dados para treinamento nas contas Claude e ChatGPT (configuração manual nas contas)
- [ ] Revisar os termos das assinaturas antes de abrir o app para mais pessoas (R14)

### Mídia
- [x] `MediaStorage` + `LocalDiskMediaStorage`, upload multipart, MIME real (Tika), tipos com script recusados, remoção de EXIF; thumbnail: depois
- [x] `GET /api/media/{id}` com autorização (conversa, post, story ativo, avatar), `nosniff` e suporte a `Range`
- [x] Avatar só pode ser imagem do próprio usuário (impede tornar público um arquivo alheio)
- [x] Teto técnico de upload configurável (`MAX_UPLOAD_SIZE`, sem limite de produto); alerta de disco: Phase 10

### Deploy na VPS
- [x] `deploy/docker-compose.yml`: web (Caddy + SPA: TLS, CSP, proxy `/api`, `/oauth2`, `/login/oauth2`, `/ws`), backend (JRE 21 + Node + CLIs, não-root), postgres
- [x] Imagem multi-stage do backend (build verificado: Java 21, `codex` e `claude` presentes); volumes `pgdata`, `media`, `ai-codex`, `ai-claude`
- [ ] Login das CLIs no servidor (uma vez) com credenciais persistidas
- [x] `.env.example`; `.env` de produção fora do git
- [ ] Domínio e DNS
- [ ] Hardening da VPS (SSH por chave, firewall 80/443/22, fail2ban, atualizações automáticas)
- [ ] Backups (`pg_dump` diário + `/data/media`) com restauração testada
- [x] CI: GitHub Actions (frontend lint/typecheck/test/build; backend `./mvnw test` com Testcontainers)
- [ ] CD: GHCR → deploy via SSH

### Testes do backend
- [x] 360+ testes: unitários (parser, prompt, classificador de erros, fallback, regras, rate limit, mídia, cookie) e integração contra Postgres real (Auth, Profile, Chat, TranslationPipeline, Feed, Stories, Notifications, Media, AdminAi, RateLimit, SecurityMatrix, RealtimeWebSocket com servidor e sockets reais)
- [x] Smoke test do frontend em modo http contra o backend real (Playwright): cadastro → onboarding → discover → follow → conversa → mensagens persistidas

**Done when**
- [x] Os fluxos das Phases 2–7 funcionam contra o backend real **sem alterações em componentes ou hooks** (realtime no navegador: Phase 9)
- [ ] Login com Google, Facebook e email/senha funciona em produção, com aceite de termos registrado
- [x] Mensagens são traduzidas pelo ChatGPT e, com o ChatGPT indisponível, pelo Claude (testado com CLIs simuladas)
- [x] Com as duas IAs sem login, nenhuma mensagem ou tradução se perde, e a fila é processada assim que uma delas é reautenticada
- [x] Nenhum segredo no bundle do frontend (só `VITE_DATA_SOURCE` é lido)
- [x] Testes de autorização impedem acesso a conversas de terceiros

---

## Phase 9 — Realtime

> Concluída em 2026-10-03.

- [x] Backend: WebSocket em `/ws` autenticado pela sessão; envelope `{ type, payload }` igual ao `RealtimeEventMap`; origem restrita à URL pública
- [x] Registro de conexões por usuário (vários dispositivos) e envio por membro (tradução projetada)
- [x] Frontend: `wsRealtimeClient` implementando `RealtimeClient`, selecionado por `VITE_DATA_SOURCE=http`
- [x] Presença (online/offline, last seen) e typing (só entre membros da conversa)
- [x] Delivered/read derivados dos cursores e emitidos pelo servidor (`message.created` sempre antes do recibo)
- [x] `translation.updated` emitido pelo worker de tradução
- [x] Heartbeat ping/pong de aplicação, reconexão com backoff + jitter, `offline`/`online`/visibilidade, socket morto abandonado na hora
- [x] Recuperação no reconnect por invalidação do chat e das notificações (sem `?after=`; ver PLAN.md §26)
- [x] Indicador discreto "Connecting…" no título da lista
- [x] Teste e2e com duas contas em navegadores diferentes contra o backend real (Playwright): mensagem ao vivo, ✓✓ entregue, ✓✓ lido, typing, mensagem enviada durante offline chega uma única vez, reinício do backend sem perder a sessão

**Done when**
- [x] Duas contas com idiomas diferentes conversam em tempo real, cada uma lendo no próprio idioma (tradução real depende das CLIs logadas no servidor; o caminho foi testado com CLIs simuladas)
- [x] Typing, online e read receipts funcionam
- [x] Derrubar e restaurar a conexão não perde mensagens nem as duplica

---

## Phase 10 — Production hardening

> Concluída em 2026-10-04 no que depende de código. Abertos: itens que exigem a VPS, contas reais ou texto jurídico.

### Performance
- [x] Medir a `MessageList`: 330 mensagens a 60 fps com CPU 4×; react-virtuoso adiado (PLAN.md §22). A medição achou re-renders de todas as bolhas a cada envio (callbacks instáveis no contexto): corrigido, 1.992 → 6 renders, envio 1,35 s → 0,4 s, com teste
- [x] Orçamento de bundle: 182,6 KB gzip no primeiro carregamento (shell logado lazy, welcome eager, sem mock no build real)
- [x] Lighthouse em `/welcome` atrás do Caddy: Performance 94–97, Accessibility 100, Best Practices 100, SEO 100 (splash estático, sessão não bloqueia páginas públicas)

### Qualidade e acessibilidade
- [x] Auditoria axe sem violações sérias/críticas em 8 telas, dois temas, desktop e celular (corrigidos: contraste do texto secundário, `aria` dos botões "em breve", rótulos)
- [x] Playwright e2e (mock): onboarding, chat entre duas contas, modos de tradução, feed, stories, responsividade; estável em execuções repetidas
- [x] Playwright da pilha de produção (`e2e:stack`): Caddy + SPA + Java + Postgres, `wss://`, upload, CSP, cookie
- [x] Mock confiável com duas abas: revisões, entrega ordenada de eventos, concorrência otimista, sem escrita em leitura

### Produto e LGPD
- [x] Block/report de ponta a ponta: denúncia de pessoa, mensagem e post; revisão em `/admin/reports`
- [x] Exclusão de conta (arquivos removidos só após o commit) e exportação de dados (Download my data)
- [ ] Termos de Uso e Política de Privacidade definitivos (revisão jurídica, §34.2)

### Segurança e operação
- [x] Rate limits validados sob carga (300 tentativas: 10 passam, 290 recebem 429) e sem bypass por `X-Forwarded-For` forjado através do Caddy; 1.000 leituras simultâneas sem erro
- [x] Headers no Caddy (CSP, HSTS, frame-ancestors, nosniff), CSP validada na pilha real (corrigido: `connect-src` bloqueava todos os uploads)
- [x] Revisão de dependências: `bun audit` limpo após atualização compatível; vulnerabilidades eram só de ferramentas de build
- [x] Login social opcional por provedor (antes, um `.env` com OAuth vazio impedia o boot) e correção do `ClassCastException` no login Google/Facebook, com testes de OAuth (identidade, vinculação, e-mail não verificado)
- [x] Imagem corrompida → 400 (antes 500; nunca guardada sem remover o EXIF)
- [x] `.env` ignorado pelo git em qualquer pasta
- [x] Monitoramento: health público cai para DOWN com pouco disco (testado); estado das IAs e fila em `/admin/ai`; guia de uptime em `deploy/VPS.md`
- [ ] Sentry (opcional)
- [x] PWA: manifest, ícones e instalação (sem service worker)
- [x] Favicon fornecido em 2026-10-04: versões otimizadas para aba, Apple e PWA; geração reproduzível em `scripts/generate_icons.py`, original preservado na raiz e referências versionadas

### Deploy
- [x] Deploy reproduzível: a pilha de produção sobe do zero a partir do repositório (`docker compose up -d --build`)
- [x] Backup e restauração: `backup.sh`/`restore.sh`, **restauração testada** (dados e fotos voltaram, usuário restaurado entrou e viu a conversa)
- [x] CD: workflow manual **Deploy** por SSH, com espera do health
- [x] Guia da VPS (`deploy/VPS.md`): hardening, login das IAs, admin, OAuth, backups, monitoramento
- [ ] Executar na VPS real: domínio/DNS, hardening, login das CLIs, cron de backup com cópia externa, monitor de uptime

**Done when**
- [x] Metas de performance e acessibilidade atingidas
- [x] Deploy reproduzível, com backup restaurado com sucesso pelo menos uma vez (pilha local; repetir na VPS)
- [x] Checklist de segurança do PLAN.md §31 verificado (exceto o que depende da VPS e do texto jurídico)

---

## Produção: VPS compartilhada (2026-10-04)

- [x] `./tenno` (mesmo formato do `./eldialabs`): `vps provision`, `run deploy:prod`, `vps status|logs|backup|ssh|ai-login`
- [x] Ensaio completo num container Ubuntu 22.04 com o nginx real dos vizinhos e PostgreSQL 14 (provision idempotente, deploy, e2e da pilha, rollback, configuração inválida rejeitada sem reload)
- [x] Suíte do backend no PostgreSQL 14 (405 testes)
- [x] Provision na VPS real: certificado próprio, nginx sem alterar os 7 sites vizinhos (comparados antes/depois), banco isolado
- [x] Primeiro deploy (`38c064b`) com todos os testes: https://tenno.eldialabs.com no ar, backend só em 127.0.0.1
- [ ] Criar a conta de admin (cadastro no app + promoção no banco)
- [ ] ~~Login das IAs pelas CLIs~~ substituído pelas chaves de API no Infisical (seção abaixo)
- [ ] Copiar `/var/backups/tenno-talk` para fora da VPS

---

## Tradução por API (2026-10-04)

Troca das CLIs dos planos de assinatura (`codex`, `claude`) pelas APIs da OpenAI (principal) e da Anthropic (reserva). Decisões em PLAN.md §28.1 e §28.3.

- [x] PLAN.md atualizado (§25, §27, §28.1, §28.3, §31, §32, §32.1, R8, R14, §34)
- [x] SDKs oficiais `openai-java` e `anthropic-java` (convivem com o Jackson 3 do Boot 4)
- [x] `OpenAiTranslator` (Chat Completions, `json_schema` strict) e `AnthropicTranslator` (Messages, `output_config`), system + user, sem retries no SDK, uso de tokens no log
- [x] `ApiErrors`: 401/403 → chave; 429 → cooldown pelo `retry-after`; créditos esgotados → cooldown padrão + aviso; 5xx/529/rede → transitório
- [x] Provedor sem chave não é registrado; estado `invalid_key`; `ProviderHealthService` (aviso ao admin, **Check now** pelo modelo, verificação na subida)
- [x] Migration V3 (`openai`/`anthropic`, estados novos, jobs em espera retomados); removidos `CliTranslator`, `ProcessRunner`, `ErrorClassifier`, `OutputParser`, `ReauthService` e o endpoint `/reauth`
- [x] Testes: os dois SDKs contra um servidor stub local, `ApiErrors`, `FakeTranslators` nos testes de integração (suíte completa do backend: 402 testes)
- [x] Painel `/admin/ai`: modelo, `invalid_key`/`not_configured`, dica do Infisical, sem login; Política de Privacidade atualizada e versão dos termos `2026-10-04` (novo aceite)
- [x] Deploy: `tenno-talk.service` com `infisical run`; provision sem Node/CLIs e exigindo a machine identity; `ai-login` removido; imagem Docker sem Node; `.env.example` com as chaves
- [x] Infisical: `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` no projeto `tenno-talk` (env `prod`); "Injecting 2 Infisical secrets" na subida
- [x] provision e deploy gravam a identity do Infisical no `tenno.env` da VPS a partir do `vps.env` local (`remote/set-env.sh`, pelo stdin do ssh); o deploy para cedo se faltar a identity ou se o serviço da VPS ainda for o antigo
- [x] Identity `vps-prod-eldialabs` criada no projeto `tenno-talk` (Viewer). A da Eldia não serve: é gerenciada pelo projeto dela
- [x] Client ID + Client Secret dessa identity em `TENNO_INFISICAL_CLIENT_ID`/`_SECRET` no `vps.env` local
- [x] `./tenno vps provision` (vizinhos inalterados) e `./tenno run deploy:prod` (`eee9b13`, todos os testes + e2e 17/17; migration V3 aplicada)
- [ ] Limite de gasto nos consoles da OpenAI e da Anthropic
- [x] Smoke em produção: jobs parados retomados e traduzidos com `provider=openai` (`AI usage` ~230 tokens de entrada / ~20 de saída); os dois provedores em `ok`; as duas chaves aceitas (modelo consultado, HTTP 200)
- [ ] Primeira tradução real pela Anthropic (só acontece quando a OpenAI falhar)
- [x] Limpar `/opt/tenno-talk/{node,cli}` e `/var/lib/tenno-talk/{.codex,.claude}` na VPS (~1 GB)

---

## Phase 11 — Notificações e experiência social

> Planejada em 2026-10-04. Decisões em [PLAN.md §36](PLAN.md#36-revisão-da-experiência-social-2026-10-04), diagnóstico, contratos e aceite em [PLANO_UX.md](PLANO_UX.md). Release `1821cbe` publicado na VPS com VAPID configurado e migration V5; ensaio em dispositivos reais pendente.

- [x] Inspecionar os fluxos atuais e documentar o plano de implementação
- [x] Registrar escopo confirmado: push incluído, stories privados, melhorias de confiabilidade do chat e manutenção do refetch completo
- [ ] 11.0 — Reproduzir os problemas com duas contas, registrar evidências visuais e baseline de latência
- [ ] 11.0a — Garantir fechar stories em loading, sucesso, erro e expirado; validar contraste, safe area, nomes longos e retorno em dispositivo real
- [x] 11.0b — Filtrar Feed/bandeja por conteúdo próprio + contas seguidas no backend/mock, antes da paginação e respeitando acesso/bloqueios
- [ ] 11.0b — Atualizar caches após follow/unfollow e separar consulta direta de stories da bandeja; testar três contas e requisições antigas em voo
- [x] 11.0c — Corrigir emissão de typing com socket fechado/reconnect, renovação, stop, timeout e agregação por sessão
- [ ] 11.0c — Validar digitação no header/lista/conversa com duas contas, grupo, IME e múltiplas abas; manter eventos efêmeros fora da fila persistente
- [x] 11.1 — Manter conexão e assinantes no escopo autenticado, inclusive em stories, e recuperar eventos por refetch completo
- [x] 11.1 — Substituir entrega por socket/GET por ACK real, validar destinatários e corrigir recibos fora de ordem/grupos
- [x] 11.1 — Distribuir em executor fora do HTTP com trabalho persistido, recuperação após reinício e controle de saturação
- [x] 11.2 — Persistir saída em IndexedDB antes de limpar o composer; incluir blobs/IDs de uploads e migração do armazenamento
- [x] 11.2 — Reidratar/reconciliar pendências, reenviar automaticamente, coordenar abas/worker e tratar falhas permanentes, quota e sessão (teste real de reload com texto e anexo; ensaio físico multitab ainda em 11.9)
- [x] 11.3 — Criar notificações de mensagens/respostas com idempotência e paridade HTTP/mock
- [x] 11.3 — Implementar leitura individual/em lote segura, paginação, recuperação em falha, integração com leitura do chat e sincronização entre dispositivos
- [x] 11.4 — Implementar service worker, inscrições por dispositivo, permissão explícita e preferências de Web Push
- [x] 11.4 — Configurar par VAPID exclusivo na VPS fora do Git, publicar release `1821cbe` e confirmar service worker/health/migration V5 pela URL pública
- [ ] 11.4 — Validar push com app fechado, retry/expiração, clique seguro e revogação no logout em dispositivos reais
- [x] 11.5 — Padronizar retorno por origem interna/fallback, incluindo links diretos e estados de loading/erro
- [x] 11.5 — Aplicar escala de espaçamento a chat, campos e formulários; corrigir composição de safe area e validar teclado
- [x] 11.6 — Criar rota de post/comentário e visualizador único reutilizado pelo Feed, perfil e notificações
- [x] 11.6 — Paginar/localizar comentários, implementar envio otimista idempotente, drafts e erros/retry sem duplicação
- [ ] 11.7 — Melhorar respostas privadas a stories: pausa de timer/vídeo, gestos, teclado, drafts por story, saída persistente e confirmação inline
- [x] 11.7 — Implementar destino exato de story e estados de conteúdo expirado/indisponível
- [x] 11.8 — Conectar notificações internas/push ao alvo correto, sino nos headers mobile e avisos discretos acessíveis
- [ ] 11.9 — Completar E2E no backend com duas contas, offline, leitura concorrente, múltiplas abas, ACK e restart do worker (teste real de outbox texto/anexo e testes unitários/IT/E2E mock executados)
- [ ] 11.9 — Validar visual, acessibilidade, navegação, push com app fechado e teclado/safe area em dispositivos; registrar evidências e pendências
- [x] 11.10 — Revalidar bloqueio em cada envio direto (inclusive conversa antiga, encaminhamento e resposta a story), ocultar eventos em tempo real entre bloqueados e usar erro genérico
- [x] 11.10 — Conta privada exige solicitação de seguir e aprovação; pedido pendente não libera posts/stories; bloqueio remove follows e pedidos nos dois sentidos
- [x] 11.10 — Autorizar download direto de mídia de story pelas mesmas regras de privacidade e bloqueio do story; exigir revalidação de mídia em cache após mudar o acesso
- [x] 11.10 — Serializar mudanças rápidas de preferências no cliente e invalidar caches de perfis, Feed, stories e chat após alterações de privacidade/bloqueio
- [ ] 11.10 — Confirmar privacidade, bloqueio, pedidos de seguir e ausência de push após bloqueio em dois dispositivos reais
- [x] 11.11 — Pedido de seguir como notificação (`follow_request`/`follow_accepted`, migration V8) com Confirm/Delete na central, retração ao decidir/cancelar/bloquear/tornar público e paridade HTTP/mock (PLAN.md §36.2)
- [x] 11.11 — Central de notificações no layout de lista do app (`NotificationItem`, `SectionTitle`, `AvatarListSkeleton`, paginação no fim) e mesmo texto na lista, no toast e no push do servidor
- [x] 11.11 — Convite de push na central (permissão só no toque, adiamento de 30 dias, orientação de Tela de Início no iOS)
- [ ] 11.11 — Validar com o backend real e VAPID: pedido de seguir chega como push com o app fechado e o clique abre `/notifications`

**Done when**

- [ ] Interações elegíveis produzem notificação e contador sem reload; leitura/falha/reconexão mantêm consistência
- [ ] Seguir/deixar de seguir altera Feed e bandeja sem reload; conteúdo público por perfil/link mantém as permissões corretas
- [ ] Fechar stories permanece visível e funcional em todos os estados e dispositivos previstos
- [ ] Digitação aparece na primeira entrada, recupera após reconnect e expira sem indicadores fantasmas
- [ ] Push chega com app fechado em dispositivos suportados e autorizados, sem comprometer notificações internas quando a permissão é negada
- [ ] Mensagens/anexos pendentes sobrevivem a reload e reenviam automaticamente sem duplicação ou vazamento entre contas
- [ ] Estado entregue depende de ACK; socket/GET/aceitação pelo serviço de push não geram confirmação fictícia
- [ ] POST não espera distribuição; jobs sobrevivem a reinício e eventos repetidos são reconciliados
- [ ] Tocar na notificação abre o post, comentário, story, perfil ou mensagem corretos
- [ ] Comentários usam uma única superfície e preservam contexto, scroll e draft, com envio/retry confiáveis
- [ ] Responder a story mantém o viewer estável e pausado até encerrar a interação
- [ ] Chat e formulários mantêm respiro e ações acessíveis em todas as larguras previstas e com teclado aberto
- [ ] Todas as telas oferecem retorno/fechamento seguro ou navegação principal na raiz, inclusive por link direto
- [ ] Critérios da matriz de validação do PLANO_UX.md verificados; nenhuma etapa declarada concluída apenas por teste mock

## Phase 12 — Algoritmo de descoberta

> Planejada em 2026-10-05. Desenho em [PLAN.md §37](PLAN.md#37-algoritmo-de-descoberta-2026-10-05). Branch `feat/discover-algorithm`.

### 12.1 Módulo `tenno-recommender`
- [x] Reactor Maven: `backend/pom.xml` aggregator, `backend/app` (git mv) e `backend/recommender`; Dockerfile, deploy.sh, CI e README ajustados
- [x] Modelo imutável (`Candidate`, `Viewer`, `RankRequest`, `Ranking`, `SparseVector`, `PostStats`, `Diagnostics`)
- [x] Núcleo congelado: Sanitize, HardFilter, BaseScore, ExposureFloor, InvariantCheck, fallback total
- [x] Envelope antifalha: `Guarded` automático, orçamento de tempo, limites, circuit breaker
- [x] Decorators v1 de score e rerank (§37.4) e `RankingWeights`
- [x] `SignalUpdater`, `Hashtags`, `Topics`
- [x] Testes: propriedades (jqwik), caos, simulação de exposição, kit de contrato obrigatório, cenários, desempenho, PIT ≥ 90% (94,7% medido)

### 12.2 Dados e sinais (backend)
- [x] Migration V7 (§37.5)
- [x] `POST /api/discover/events` idempotente e com rate limit; eventos gerados por like, comentário, follow e mensagem direta
- [x] Worker de sinais (`post_stats` + afinidades) e job de vizinhos
- [x] Hashtags ao criar post; worker de classificação de tópicos por IA (OpenAI/Anthropic, espera sem chave)
- [x] Export de dados e exclusão de conta com eventos/afinidades; retenção de 90 dias

### 12.3 Leitura (backend)
- [x] Pacote `discovery`: `ViewerLoader`, fontes de candidatos independentes, sessões, `GET /api/discover`, fallback cronológico, métricas
- [x] Remover o discover de pessoas (`ProfileService.discover`)
- [x] ArchUnit da fronteira; `DiscoverIT`, `DiscoverEventsIT`, `TopicClassificationIT`, matriz de segurança, export

### 12.4 Frontend
- [x] `discoverService.getPosts`/`trackEvents` (mock + http) e tipos
- [x] `engagement.ts` (puro) + `useEngagementTracker`, `useDiscoverFeed`, `useNotInterested`
- [x] `DiscoverFeed`, `DiscoverSlide`, `DiscoverSlideMenu`; remover filtros e grade de pessoas; strings i18n
- [~] Testes Vitest e e2e (mock) feitos; `e2e/stack/socialReach.spec.ts` atualizado para postar antes de abrir o Discover, ainda não rodado contra a pilha real

> Notas: 246 testes no módulo (propriedades jqwik, caos, simulação de população, contratos, cenários, desempenho ~1,3 ms para 500 candidatos); ITs `DiscoverIT`, `DiscoverEventsIT`, `DiscoverFallbackIT`, `TopicClassificationIT` e ArchUnit no app. Desvios do plano em [PLAN.md §37.9](PLAN.md#379-como-ficou-na-implementação-2026-10-05).

**Done when**

- [x] Um post novo aparece no Discover de outra conta mesmo sem nenhum sinal de interesse
- [ ] Like, tempo de visualização e "Not interested" mudam o ranking da sessão seguinte
- [x] Privacidade e bloqueio nunca vazam pelo Discover, inclusive mudando no meio da sessão
- [x] Um decorator sabotado (lança, NaN, lento) não muda a validade nem a disponibilidade do Discover
- [ ] Primeira página com p95 < 80 ms e páginas seguintes < 20 ms no servidor
- [x] Lint, typecheck, testes (frontend e reactor) e build verdes

## Troca de idioma não retraduz o passado (2026-10-04)

Antes, abrir uma conversa depois de trocar o idioma de recebimento traduzia de novo as 30 mensagens visíveis (e mais 30 a cada rolagem), gastando IA com o histórico. Regra nova em PLAN.md §21.

- [x] `receiving_language_history` (migration V4, com o idioma atual de cada usuário desde a criação da conta) e gravação a cada troca (onboarding e Settings)
- [x] Projeção e alvos do envio usam o idioma vigente em `message.created_at` (`ReceivingLanguages`); a tradução sob demanda ao abrir a conversa foi removida
- [x] Mensagem sem tradução gravada para o idioma da época aparece só no original (não fica "pending" para sempre)
- [x] Mock no mesmo modelo (`receivingLanguageHistory`, versão 7 do banco local)
- [x] Testes: backend 407 (inclui troca e volta de idioma sem nenhuma chamada nova à IA), frontend 357
