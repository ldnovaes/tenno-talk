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
- [ ] Revisão do plano pelo time e decisão sobre o merge na `main` (impacto no Lovable)

---

## Phase 1 — Foundation

### Migração do template
- [ ] Remover o TanStack Start/Lovable: `src/server.ts`, `src/start.ts`, `src/router.tsx`, `src/routes/`, `src/routeTree.gen.ts`, `.lovable/`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts`
- [ ] Remover dependências: `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/router-plugin`, `@lovable.dev/vite-tanstack-config`, `nitro`, overrides de `rolldown` (se não forem mais necessários)
- [ ] Remover componentes shadcn não utilizados (calendar, chart, menubar, navigation-menu, input-otp, resizable, breadcrumb, pagination, carousel se substituído…) e suas deps (recharts, react-day-picker…)
- [ ] Atualizar o README (como rodar, link para PLAN/IMPLEMENTATION)

### Vite + TypeScript
- [ ] `index.html` com meta viewport (`viewport-fit=cover, interactive-widget=resizes-content`), `theme-color` e script inline de tema (sem flash)
- [ ] `src/main.tsx` com `createRoot`
- [ ] `vite.config.ts` com `@vitejs/plugin-react`, `@tailwindcss/vite`, alias `@` → `src`
- [ ] Manter o `tsconfig.json` estrito (incluindo `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [ ] Scripts: `dev`, `build`, `preview`, `lint`, `typecheck` (`tsc --noEmit`), `test`, `format`
- [ ] ESLint + Prettier funcionando; regra contra `any` explícito (`@typescript-eslint/no-explicit-any: error`)
- [ ] `lib/env.ts` com leitura tipada de `import.meta.env`

### Design system
- [ ] `styles.css`: tokens Telegram light/dark em oklch (§5.1), tokens novos (`chat-bg`, `bubble-in/out`, `bubble-meta`, `online`, `unread`, `unread-muted`, `overlay-scrim`) registrados em `@theme inline`
- [ ] Remover utilitários futuristas do protótipo (`glass`, `bg-send`, `app-bg`, `shadow-glow`)
- [ ] Breakpoints `md` 768, `lg` 1024, `xl` 1440
- [ ] Fonte Inter Variable (`@fontsource-variable/inter`) + fallbacks
- [ ] Validar o contraste AA dos pares de tokens principais nos dois temas
- [ ] Ajustar `components.json` (caminho do CSS, base color)

### Infra de app
- [ ] `app/queryClient.ts` com defaults (§11.3) e `onError` global → toast
- [ ] `lib/errors.ts` (`AppError`, `toAppError`)
- [ ] `app/i18n.ts` (i18next + react-i18next, `en`, namespaces por feature)
- [ ] `stores/devicePreferencesStore.ts` (tema, persistido) + `ThemeProvider` (light/dark/system)
- [ ] `AppProviders` (Query, Theme, i18n, Tooltip, Toaster/sonner, ErrorBoundary raiz)
- [ ] Hooks genéricos: `useMediaQuery`, `useBreakpoint` (substitui `use-mobile.tsx`)

### Roteamento e layouts
- [ ] React Router v7 (modo declarativo) com `AppRoutes` e todas as rotas do §8 como placeholders lazy
- [ ] `paths.ts` com construtores de URL
- [ ] Overlay routes: `useOverlayNavigate`, `OverlayLink`, renderização com `backgroundLocation`, fallback `/chats` em deep link no desktop
- [ ] Guards (placeholders até a Phase 2): `RequireAuth`, `RequireOnboarded`, `RedirectIfAuthed`
- [ ] `AppShell` + `NavigationRail` (md+) + `BottomNav` (mobile, com o botão Create central)
- [ ] `ChatLayout` (lista + Outlet; mobile alterna entre lista e conversa)
- [ ] `ContentColumn` (Discover/Feed/Notifications)
- [ ] `SidePanel` (Sheet à direita + scrim com blur + fallback sem blur)
- [ ] `RouteErrorBoundary` + `NotFoundPage`
- [ ] Safe areas e `100dvh` aplicados no shell

### Domínio e mocks (base)
- [ ] `src/types/*` conforme o §12
- [ ] `lib/languages.ts` (catálogo com nome nativo, dir, país padrão) + `lib/countries.ts`
- [ ] `services/mock/db.ts` (store + persistência versionada + reset) e `latency.ts`
- [ ] `lib/ids.ts` (`createClientId`)

### Componentes comuns
- [ ] `UserAvatar`, `EmptyState`, `ErrorState`, `PageHeader`, `RelativeTime`, `CountryFlag`, `LanguageLabel`, `InfiniteScrollTrigger`

### Testes
- [ ] Substituir o teste de routing do TanStack por testes de rotas do React Router (rota conhecida renderiza a página; desconhecida → NotFound)
- [ ] Teste do `ThemeProvider` (system → dark/light)

**Done when**
- [ ] `bun run dev`, `build`, `lint`, `typecheck` e `test` passam sem erros
- [ ] É possível navegar entre todas as rotas placeholder em 360px, 768px, 1024px e 1440px
- [ ] Mobile mostra a bottom nav; md+ mostra o rail; perfil/settings abrem no SidePanel em md+ e como página no mobile
- [ ] Alternar light/dark/system funciona e não há flash de tema no reload
- [ ] Nenhuma referência restante a TanStack Start/Lovable no código

---

## Phase 2 — Authentication and onboarding

- [ ] `services/authService.ts` (interface + mock): `signInAsDemo(userId)`, `signUp(email)`, `signOut()`, `getSession()`
- [ ] `stores/sessionStore.ts` (persistido): `status`, `userId`, `accessToken`
- [ ] `profileService.getMe()` mock + `useMe()` (query `me`)
- [ ] `SessionGate` (carrega `me`, mostra `AppSkeleton`) e guards reais
- [ ] `WelcomePage`: proposta, animação de exemplo, "Create account" e "Continue as demo" (Lucas pt-BR / Cam vi-VN)
- [ ] `OnboardingLayout` com progresso, voltar/continuar (fixos no mobile) e rota `/onboarding/:step`
- [ ] `onboardingDraftStore` (sessionStorage)
- [ ] Step 1 — Welcome (exemplo visual PT → VI)
- [ ] Step 2 — Native language (`LanguagePicker` com busca, nome nativo em destaque)
- [ ] Step 3 — Receive language (pré-preenchido com o nativo, texto explicativo)
- [ ] Step 4 — Create profile (rhf + zod: nome, username com checagem mock e debounce, avatar com preview, bio opcional, país)
- [ ] Step 5 — Discover people (sugestões com Follow/Message, "Start chatting")
- [ ] `profileService.completeOnboarding()` + invalidar `me` + redirect para `/chats`
- [ ] Sign out (limpa sessão, cache do Query e drafts)
- [ ] Testes: guards (sem sessão → /welcome; sem onboarding → /onboarding; onboardado em /welcome → /chats), validação do username

**Done when**
- [ ] Um novo usuário completa os 5 passos e chega em `/chats`
- [ ] Um reload no meio do onboarding mantém as respostas
- [ ] Um reload no app mantém a sessão; sign out volta para `/welcome` sem dados residuais
- [ ] O login demo pula o onboarding
- [ ] Todos os inputs têm label, os erros são anunciados e a navegação por teclado funciona

---

## Phase 3 — Chat

### Dados
- [ ] Seed: usuários (≥ 12, vários idiomas, incluindo um RTL), conversas (diretas + 2 grupos), ~200 mensagens com IDs estáveis e traduções por idioma
- [ ] `chatService` (interface + mock) conforme o §16.1, com a projeção da tradução para o viewer
- [ ] `chatKeys` + hooks: `useConversations`, `useConversation`, `useMessages` (infinite), `useSendMessage`, `useMarkAsRead`, `useReactToMessage`, `useDeleteMessage`
- [ ] `messageCache.ts`: `upsertMessage`, `patchMessage`, `patchConversationPreview` + testes (dedupe por id/clientId, ordem, identidade preservada)
- [ ] `groupMessages.ts` + testes (dias, janela de 5 min, posições)
- [ ] `conversationFilters.ts` (All/Unread/Groups + busca) + testes

### Realtime mock
- [ ] `services/realtime/realtimeClient.ts` (interface + `RealtimeEventMap`)
- [ ] `mockRealtimeClient.ts`
- [ ] `useRealtimeBridge` no `AppShell` (mensagens → cache; presença/typing → `presenceStore`)
- [ ] `stores/presenceStore.ts`
- [ ] `autoResponder.ts` (delivered → read → typing → resposta no idioma do contato)

### Lista de conversas
- [ ] `ConversationSearch`, `ConversationFilters`, `ConversationList`, `ConversationListItem` (avatar + online, nome, preview, hora, ticks, badge, mute, "typing…")
- [ ] `ConversationListSkeleton` e empty states (sem conversas / sem não lidas)
- [ ] Estado vazio da coluna central no desktop ("Select a chat")
- [ ] Navegação por teclado (↑/↓, Enter) e `Ctrl/Cmd+K`
- [ ] Placeholder do `StoriesTray` no topo (dados reais na Phase 7)

### Conversa
- [ ] `ConversationHeader` (voltar no mobile, avatar → perfil no SidePanel, status/typing, call desabilitado, menu)
- [ ] `MessageList` (`role="log"`, divisores de dia, grupos, carregar antigas com preservação de scroll, auto-scroll só no fim, `ScrollToBottomButton` com contador)
- [ ] `MessageBubble` + `BubbleShell` + `BubbleMeta` + `DeliveryTicks` + conteúdos (text, image, video, file; audio placeholder)
- [ ] `TypingIndicator`
- [ ] `MessageListSkeleton` e o empty state de conversa nova ("Say hi to …")

### Composer
- [ ] `ComposerTextarea` (auto-resize até 6 linhas, Enter envia, Shift+Enter quebra linha)
- [ ] `EmojiButton` com picker lazy (frimousse)
- [ ] `AttachmentButton` (imagem/vídeo, preview local, envio mock com object URL)
- [ ] Botão de voz desabilitado ("coming soon") ↔ botão send
- [ ] `composerStore`: draft por conversa (persistido) e reply-target
- [ ] `ReplyPreviewBar` (Esc cancela)
- [ ] Emissão de typing (throttle 3s, stop após 5s / no envio)

### Envio e ações
- [ ] Envio otimista completo (§13.1) com falha → `failed` + retry com o mesmo `clientId` + delete
- [ ] `markAsRead` por visibilidade (debounce) zerando o `unreadCount`
- [ ] `MessageActionsProvider` + `MessageActionsMenu` (context menu + botão "⋯" em hover/foco) + `MessageActionsDrawer` (long-press no mobile, `useLongPress`)
- [ ] Reply (com `ReplyQuote` clicável que rola até a mensagem)
- [ ] Reactions (picker rápido + chips, otimista)
- [ ] Copy (texto exibido / original) com toast
- [ ] Forward (dialog de seleção de conversas)
- [ ] Delete for me (AlertDialog de confirmação)
- [ ] Edit visível e desabilitado
- [ ] `getOrCreateDirectConversation` (usado por "Message" no Discover/Perfil)

**Done when**
- [ ] Enviar uma mensagem mostra a bolha imediatamente e o status evolui sending → sent → delivered → read
- [ ] O contato mock digita e responde no idioma dele; a conversa sobe na lista e o badge aparece quando a conversa não está aberta
- [ ] Simular uma falha de envio mostra o retry; o retry não duplica a mensagem
- [ ] Carregar mensagens antigas não faz o scroll saltar
- [ ] No mobile, a conversa ocupa a tela inteira (sem bottom nav), o composer acompanha o teclado e o long-press abre as ações
- [ ] Os testes de `groupMessages`, `upsertMessage` e `conversationFilters` passam

---

## Phase 4 — Translation UX

- [ ] `translationService` (interface + mock): `retryMessageTranslation`, `getTranslationInsight`, `translateContent`
- [ ] `mockTranslator.ts` (dicionário pt-BR/vi-VN/en-US/es-ES, pseudo-tradução marcada, falha ~10%, "tradução melhorada" v2 em ~20%)
- [ ] Mensagens recebidas chegam como `translating` e são atualizadas por `translation.updated`
- [ ] `patchTranslation` no `messageCache` (nunca toca o original; aplica só `version >=`) + testes
- [ ] `resolveMessageDisplay` + testes cobrindo toda a tabela do §14.3
- [ ] `translationViewStore` (overrides por mensagem)
- [ ] `useTranslationPreferences` (select de `me` + mutação otimista)
- [ ] `useMessageTranslation`
- [ ] `TranslatedText` (primária + secundária "Original" na mesma bolha, `lang`, `dir="auto"`, crossfade com `motion`, respeitando reduced motion)
- [ ] `TranslationStatusHint` (shimmer em "translating"; "Retry translation" discreto em falha)
- [ ] Ações "Show original" / "Show translation" no menu da mensagem
- [ ] Mensagem própria: "Show translation" mostra o que o destinatário recebeu
- [ ] Preview da lista de conversas respeitando o modo de exibição
- [ ] Settings → seção Translation (display mode, auto-translate posts/stories, Learning Mode) funcional
- [ ] Learning Mode: ação "Learn" + `LearningPanel` (Popover desktop / Drawer mobile) com Natural / Original / Literal via `useTranslationInsight`; slots para explicação/vocabulário/pronúncia
- [ ] Manter a âncora de scroll quando uma tradução chega e o usuário está no fim
- [ ] Teste de componente: `MessageBubble` nos 3 modos × (`not_needed`, `translating`, `translated`, `failed`)

**Done when**
- [ ] Trocar o display mode em Settings reflete imediatamente em todas as mensagens e previews
- [ ] Show original / Show translation funciona por mensagem e sobrevive ao scroll
- [ ] Uma tradução com falha mantém o original visível e "Retry translation" funciona
- [ ] Uma tradução v2 substitui a v1 sem flicker; um evento atrasado de v1 é ignorado
- [ ] Com Learning Mode desligado não há nenhum vestígio visual dele; ligado, o painel abre com os três blocos
- [ ] Nenhuma bolha exibe etiqueta do tipo "AI TRANSLATION"

---

## Phase 5 — Profiles, discovery and settings (MVP)

### Perfil
- [ ] `profileService` (interface + mock): `getProfile(username)`, `updateProfile`, `follow`, `unfollow`, `getFollowers/Following` (estrutura), `checkUsername`
- [ ] `ProfileHeader`, `ProfileStats`, ações (Follow/Message × Edit profile/Settings)
- [ ] `ProfileTabs` (Posts; Media/Tagged com "Coming soon") + `MediaGrid` (usa os posts do seed)
- [ ] `ProfileSkeleton`, perfil inexistente → estado "User not found"
- [ ] `EditProfileForm` (rhf + zod) em `/u/:username/edit`
- [ ] Follow/unfollow otimista (contadores e botão)
- [ ] Perfil no SidePanel (desktop/tablet) e como página (mobile); o header da conversa abre o perfil do contato

### Discover
- [ ] `discoverService` (interface + mock) paginado + filtro por idioma nativo
- [ ] `PersonCard`, `PersonCardSkeleton`, grid responsivo, infinite scroll
- [ ] `DiscoverFilters` (idioma nativo ativo; Country/Learning/Interests estruturados e desabilitados)
- [ ] Message → `getOrCreateDirectConversation` → navega para a conversa
- [ ] Empty state de filtro sem resultado

### Settings
- [ ] `SettingsNav` + rotas `/settings/:section` (SidePanel com navegação interna em md+; páginas no mobile)
- [ ] Account (atalho para edit profile, username, email, password mock)
- [ ] Language (native, receiving, interface)
- [ ] Translation (já feita na Phase 4; integrar na navegação)
- [ ] Appearance (Light/Dark/System com preview)
- [ ] Privacy (visibility, who can message, who can comment, blocked users: lista mock com unblock)
- [ ] Notifications (toggles)
- [ ] Sign out e (dev) "Reset demo data"
- [ ] Toggles com salvamento otimista; campos de texto com Save; erros via toast

### Qualidade do MVP
- [ ] Revisão de a11y básica: labels, foco visível, ordem de tab, `aria-label` em ícones, alt em imagens
- [ ] Revisão de empty/loading/error em todas as telas do MVP
- [ ] Revisão responsiva em 320, 360, 768, 1024 e 1440px nos dois temas
- [ ] Revisão de i18n: nenhuma string de UI hardcoded

**Done when (MVP)**
- [ ] Todos os itens do MVP funcionam com mocks: auth simulada, onboarding, lista de conversas, chat, envio, mensagens e tradução mockadas, alternância Original/Translation, perfil, discover, settings, dark mode, layouts mobile e desktop
- [ ] Iniciar uma conversa a partir do Discover e do Perfil funciona
- [ ] Alterar o idioma de recebimento em Settings muda as traduções exibidas (o mock reprojeta)
- [ ] Lint, typecheck e testes verdes

---

## Phase 6 — Feed

- [ ] `feedService` (interface + mock): `getFeed(cursor)`, `getPost`, `likePost`/`unlikePost`, `getComments`, `addComment`, `createPost` (com progresso simulado)
- [ ] Seed de posts (imagens/vídeos, legendas em vários idiomas)
- [ ] `FeedList` (infinite) + `FeedPostSkeleton` + empty state "No posts yet"
- [ ] `PostCard`: header, `MediaCarousel` (embla, indicador de páginas), legenda, ações, contadores
- [ ] `TranslatedCaption` com "See translation" / "See original" e auto-translate pela preferência (`useContentTranslation`)
- [ ] Like otimista (com animação de coração no double-tap no mobile)
- [ ] `CommentsSheet` (Drawer no mobile / Sheet no desktop) com comentários traduzíveis e envio
- [ ] Share (copiar link / Web Share API no mobile)
- [ ] `/create`: `MediaPicker` (até 10, imagem/vídeo), `CaptionEditor`, `PostPreview`, publicar com progresso; Dialog no desktop, página no mobile
- [ ] Slots desabilitados para localização e marcação de pessoas
- [ ] O post criado entra no topo do feed e no grid do perfil (atualização de cache)

**Done when**
- [ ] O feed carrega páginas infinitamente sem layout shift
- [ ] Criar um post o exibe imediatamente no feed e no perfil
- [ ] A legenda em outro idioma respeita "auto-translate posts"; o original nunca é sobrescrito
- [ ] Likes e comentários atualizam contadores de forma otimista

---

## Phase 7 — Stories and notifications

### Stories
- [ ] `storyService` (interface + mock): `getTray()`, `getUserStories(userId)`, `markViewed`, `reactToStory`, `replyToStory`, `createStory` (upload + texto opcional)
- [ ] `StoriesTray` real em Chats e Feed (anel visto/não visto, "+" para o próprio)
- [ ] `StoryViewer` (overlay route `/stories/:userId`): fullscreen, `StoryProgress`, toque esquerda/direita, segurar para pausar, swipe down para fechar, setas/Esc, avanço automático entre usuários
- [ ] `StoryOverlayText` com Original/Translated (respeita "auto-translate stories")
- [ ] `StoryReplyInput` (cria mensagem `story_reply` na conversa direta) + reação rápida
- [ ] Pré-carregamento do próximo item

### Notifications
- [ ] `notificationService` (interface + mock): lista paginada, `markAllRead`, contador
- [ ] `NotificationList` agrupada (Today / This week / Earlier) + `NotificationItem` por tipo + skeleton + empty
- [ ] Badge no rail e no sino do header do Feed (mobile)
- [ ] `notification.created` via realtime mock (ex.: o auto-responder curte um post)

**Done when**
- [ ] O viewer é navegável por toque e teclado; o progresso pausa ao segurar
- [ ] Responder a um story cria a mensagem na conversa correspondente
- [ ] Os badges de notificação atualizam em tempo real (mock) e zeram ao abrir a lista

---

## Phase 8 — Backend integration

> Antes de começar: detalhar a Parte II do PLAN.md e resolver as decisões do §34.

- [ ] Projeto Supabase (dev/staging/prod) + Supabase CLI + migrations versionadas
- [ ] Schema conforme o §27 (incluindo `message_revisions`, `message_translations`, `content_translations`, `blocks`, `reports`)
- [ ] Policies de RLS para todas as tabelas + testes de policy
- [ ] RPCs/Edge Functions: `send_message` (idempotente por `client_id`), `mark_as_read`, `complete_onboarding`, `follow`, `get_or_create_direct_conversation`, com validação zod e rate limit
- [ ] Supabase Auth (magic link + OAuth) e `authService` real
- [ ] Mappers DTO → tipos de domínio (`src/types`) por serviço
- [ ] Implementações reais: `chatService`, `profileService`, `discoverService`, `feedService`, `storyService`, `notificationService`, `translationService`
- [ ] Seleção mock × real via `lib/env.ts`
- [ ] Storage: buckets do §29, upload por URL assinada, validação, thumbnails
- [ ] Worker de tradução (fila + LLM + contexto + versionamento + retry) conforme o §28
- [ ] Seeds de desenvolvimento no banco
- [ ] Os testes de serviços rodam contra o mock e (em CI) contra o staging

**Done when**
- [ ] Todos os fluxos das Phases 2–7 funcionam contra o backend real **sem alterações em componentes ou hooks**
- [ ] Nenhuma chave secreta no bundle (verificado no build)
- [ ] As policies de RLS impedem acesso a conversas de terceiros (teste automatizado)

---

## Phase 9 — Realtime

- [ ] `supabaseRealtimeClient` implementando `RealtimeClient`
- [ ] Canais por conversa (Broadcast) + canal por usuário para eventos projetados (`translation.updated`)
- [ ] Presence: online/offline, last seen
- [ ] Typing via broadcast efêmero
- [ ] Delivered/read derivados dos cursores e emitidos pelo servidor
- [ ] Recuperação de lacunas no reconnect (fetch incremental)
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
- [ ] Block/report/moderação de ponta a ponta; message requests (se decidido)
- [ ] Rate limits validados sob carga
- [ ] Observabilidade: Sentry (frontend e funções), métricas de latência e custo de tradução
- [ ] Headers de segurança (CSP, HSTS), revisão de dependências
- [ ] PWA opcional (manifest, ícones, instalação)
- [ ] CI/CD: lint → typecheck → test → build → e2e em preview; deploy de produção
- [ ] Política de privacidade e termos refletindo o uso de IA (§34)

**Done when**
- [ ] Metas de performance e acessibilidade atingidas
- [ ] Pipeline de deploy verde e reproduzível
- [ ] Checklist de segurança do §31 verificado
