# TENNO TALK — Plano técnico

> Documento vivo. Antes de implementar qualquer coisa grande, atualize este arquivo.
> Ao concluir uma etapa, atualize o [IMPLEMENTATION.md](IMPLEMENTATION.md).
>
> Convenção: prosa em português; código, identificadores, rotas e strings de UI em inglês.

## Sumário

**Parte I — Frontend**

1. [Visão do produto](#1-visão-do-produto)
2. [Objetivos do MVP](#2-objetivos-do-mvp)
3. [Stack frontend](#3-stack-frontend)
4. [Decisões arquiteturais](#4-decisões-arquiteturais)
5. [Identidade visual](#5-identidade-visual)
6. [Layout e responsividade](#6-layout-e-responsividade)
7. [Estrutura de diretórios](#7-estrutura-de-diretórios)
8. [Mapa de rotas](#8-mapa-de-rotas)
9. [Telas](#9-telas)
10. [Componentes principais](#10-componentes-principais)
11. [Modelo de estado](#11-modelo-de-estado)
12. [Tipos TypeScript principais](#12-tipos-typescript-principais)
13. [Fluxo de mensagens](#13-fluxo-de-mensagens)
14. [Fluxo de tradução](#14-fluxo-de-tradução)
15. [Learning Mode](#15-learning-mode)
16. [Estratégia de mocks](#16-estratégia-de-mocks)
17. [Abstração de realtime](#17-abstração-de-realtime)
18. [Dark mode](#18-dark-mode)
19. [Loading, error e empty states](#19-loading-error-e-empty-states)
20. [Acessibilidade](#20-acessibilidade)
21. [Internacionalização da interface](#21-internacionalização-da-interface)
22. [Performance](#22-performance)
23. [Testes](#23-testes)
24. [Plano de implementação em fases](#24-plano-de-implementação-em-fases)

**Parte II — Backend futuro**

25. [Arquitetura de backend](#25-arquitetura-de-backend)
26. [Realtime](#26-realtime)
27. [Banco de dados](#27-banco-de-dados)
28. [IA e pipeline de tradução](#28-ia-e-pipeline-de-tradução)
29. [Storage](#29-storage)
30. [Autenticação](#30-autenticação)
31. [Segurança](#31-segurança)
32. [Deploy](#32-deploy)

**Parte III — Riscos e decisões**

33. [Riscos técnicos](#33-riscos-técnicos)
34. [Decisões a tomar antes do backend](#34-decisões-a-tomar-antes-do-backend)
35. [Regras de desenvolvimento](#35-regras-de-desenvolvimento)

---

# Parte I — Frontend

## 1. Visão do produto

TENNO TALK é uma plataforma social de comunicação entre pessoas de países diferentes. O núcleo é um chat no estilo WhatsApp/Telegram com identidade própria. A diferença é que **cada pessoa escreve no próprio idioma e lê no idioma que escolheu**.

```
Lucas (pt-BR → recebe em pt-BR)            Cam (vi-VN → recebe em vi-VN)
"Estou com saudade de você."      ──►      "Em nhớ anh."
"Também senti sua falta."         ◄──      "Em cũng nhớ anh."
```

Princípios:

- **A IA é uma intermediária invisível.** O produto deve parecer "um chat onde pessoas de línguas diferentes simplesmente conversam", e não "um chat com Google Translate grudado". Nada de etiquetas gigantes "AI TRANSLATION".
- **O original é imutável e sempre recuperável.** A tradução é uma *representação* da mensagem, nunca uma substituição.
- **A tradução pode melhorar.** O backend pode reprocessar com mais contexto, e a UI aceita uma nova versão da tradução sem perder nada.
- **O chat é o centro.** Discover, Feed e Stories são complementares e servem para encontrar pessoas e manter a conversa viva.
- **Aprender é opcional.** O Learning Mode transforma o app numa ferramenta de idiomas para quem quiser, sem poluir a interface padrão.

## 2. Objetivos do MVP

O MVP é **somente frontend, com camada de mock**. Ele deve ser navegável e convincente como produto real.

**Escopo do MVP (Phases 1 a 5)**

- Autenticação simulada (contas demo).
- Onboarding em 5 passos.
- Lista de conversas com busca e filtros (All / Unread / Groups).
- Chat com envio otimista, status de entrega, reply, reações, copy e ações.
- Mensagens e tradução mockadas, incluindo falhas e "tradução melhorada".
- Alternância Original / Translation (global e por mensagem).
- Perfil (próprio e de terceiros), edição de perfil, follow.
- Discover.
- Settings completas (com persistência mock).
- Dark mode / light mode / system.
- Layouts mobile e desktop com UX própria em cada um.

**Pós-MVP (Phases 6 e 7)**

Feed, criação de post, likes, comments, Stories e notificações.

**Fora do escopo do frontend inicial**

Backend real, push notifications, chamadas de voz/vídeo, gravação de áudio, editor de stories, criptografia.

## 3. Stack frontend

| Camada | Escolha | Observação |
|---|---|---|
| Build | **Vite** | SPA pura (sem SSR). |
| UI | **React 19** + **TypeScript** estrito | Mantemos as flags estritas atuais (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`…). |
| Roteamento | **React Router v7**, modo declarativo | `BrowserRouter` + `<Routes>`. Facilita o padrão de *overlay routes* (ver §8). Dados ficam no TanStack Query, então não usamos loaders do router. |
| Estilo | **Tailwind CSS v4** | Configuração CSS-first (`@theme`), tokens em CSS variables. |
| Componentes | **shadcn/ui** (new-york) + Radix | Já presentes no repositório; reaproveitamos. |
| Ícones | **lucide-react** | |
| Dados assíncronos | **TanStack Query v5** | Cache de servidor, mutações otimistas, infinite queries. |
| Estado global de cliente | **Zustand** | Apenas sessão, preferências do dispositivo e UI efêmera. |
| Formulários | **react-hook-form** + **zod** | Já presentes. |
| Datas | **date-fns** | Locale conforme o idioma da interface. |
| Toasts | **sonner** | Já presente. |
| Drawers mobile | **vaul** | Já presente (base do `Drawer` do shadcn). |
| Carrossel | **embla-carousel** | Já presente. |
| Error boundaries | **react-error-boundary** | |
| i18n da interface | **i18next** + **react-i18next** | Strings via `t()` desde o dia 1; só `en` no início (ver §21). |
| Emoji picker | **frimousse** | Leve, sem estilo, carregado sob demanda. |
| Animação | **motion** (Framer Motion) | Somente onde melhora a experiência (ver §5). |
| Fonte | **Inter Variable** (`@fontsource-variable/inter`) | Cobre os diacríticos do vietnamita. Fallback `system-ui, "Noto Sans", sans-serif` para CJK, tailandês, árabe etc. |
| Bandeiras | SVG (`country-flag-icons`) | O Windows não renderiza emoji de bandeira. |
| Testes | **Vitest** + **Testing Library**; Playwright na Phase 10 | Vitest já configurado. |
| Package manager | **bun** (lockfile atual) | `npm` também funciona. |

**Migração do template atual.** O repositório nasceu de um template Lovable em TanStack Start (SSR + TanStack Router por arquivos + `@lovable.dev/vite-tanstack-config`). Na Phase 1 ele é convertido em SPA Vite com React Router. Reaproveitamos `src/components/ui/*`, `src/lib/utils.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js` e as dependências compatíveis. Removemos `server.ts`, `start.ts`, `router.tsx`, `routes/`, `routeTree.gen.ts`, `.lovable/`, os helpers de erro do Lovable e o nitro. **Consequência:** o editor e a preview do Lovable deixam de funcionar para este repositório. Por isso o trabalho acontece numa branch separada até a decisão de merge.

## 4. Decisões arquiteturais

| # | Decisão | Motivo |
|---|---|---|
| D1 | **SPA**, sem SSR | App autenticado e altamente interativo; SSR traria flash de tema, acesso a `window`/`localStorage` e hidratação do Zustand sem benefício de SEO. |
| D2 | **Feature-first** (`src/features/*`) | Cada domínio mantém seus componentes, hooks, lógica pura e query keys. `components/` fica só com UI genérica. |
| D3 | **Serviços com interface + implementação trocável** | Componentes nunca sabem se o dado é mock ou API. A troca acontece num único ponto por serviço (§16). |
| D4 | **Query = estado do servidor; Zustand = estado do cliente** | Sem duplicação. Perfil e preferências da conta vêm do servidor (query `me`); Zustand guarda só a sessão e o que é do dispositivo (§11). |
| D5 | **Mensagem com tradução projetada para quem lê** | Em grupos, cada membro tem um idioma de recebimento. A API devolve a mensagem já com a tradução do *viewer*, não um `translatedText` global (§12). |
| D6 | **Tradução versionada** | `originalText` é imutável; a tradução tem `version` e pode ser substituída por uma melhor (§14). |
| D7 | **Toda escrita de mensagem no cache passa por `upsertMessage`** | Reconcilia envio otimista, resposta HTTP e eco do realtime sem duplicatas (§13). |
| D8 | **Realtime atrás de interface tipada** | `RealtimeClient` com mapa de eventos tipado; o mock vem primeiro e o Supabase (ou outro) depois (§17). |
| D9 | **Overlay routes para perfil/settings/stories/create** | No desktop, perfil e configurações abrem como painel lateral sobre a tela atual (com blur no fundo) e continuam endereçáveis por URL (§8). |
| D10 | **Lógica de exibição como funções puras** | `groupMessages`, `resolveMessageDisplay` e `upsertMessage` são puras e testadas unitariamente; os componentes só renderizam. |
| D11 | **Nada de `useTranslation()` próprio** | Colide com o hook do react-i18next. Usamos `useMessageTranslation`, `useContentTranslation` e `useTranslationPreferences`. |
| D12 | **Sem pasta `utils/`** | Duplica o papel de `lib/`. Helpers genéricos ficam em `lib/`; lógica de domínio fica em `features/*/lib`. |
| D13 | **Texto multilíngue sempre com `lang` e `dir="auto"`** | Leitores de tela pronunciam o idioma certo e o suporte a RTL vem pronto. CSS com propriedades lógicas (`ms-`, `me-`, `ps-`, `pe-`). |

## 5. Identidade visual

**Direção:** moderna, limpa e familiar. A paleta é inspirada no Telegram. Sem visual futurista: nada de glassmorphism, glow ou gradientes neon. A personalidade vem de tipografia, espaço, avatares fortes e microinterações.

### 5.1 Tokens de cor

Valores de referência em hex. Na implementação eles são convertidos para `oklch` em `src/styles.css`, com `:root` (light) e `.dark`.

> O protótipo do Lovable (commit `c0cbc48`, "Aplicou estilo Telegram") já trocou o tema futurista por uma paleta Telegram **clara** em `src/styles.css`: primary `oklch(0.64 0.13 237)` ≈ `#229ED9`, superfícies `#F0F2F5`, texto `#17212B`, sem blur. Ela é o ponto de partida do light theme. Na Phase 1, os valores abaixo e os do protótipo são reconciliados (validando o contraste), o tema escuro é adicionado e os utilitários remanescentes (`glass`, `bg-send`, `shadow-glow`) são removidos.

| Token | Light | Dark (night blue) | Uso |
|---|---|---|---|
| `--background` | `#FFFFFF` | `#17212B` | Fundo geral, sidebar/lista |
| `--foreground` | `#0F1419` | `#F5F5F5` | Texto principal |
| `--muted-foreground` | `#707579` | `#7F91A4` | Texto secundário, horários |
| `--primary` | `#3390EC` | `#5288C1` | Ações, links, ticks lidos, item ativo |
| `--primary-strong` | `#2B7FD4` | `#6AB2F2` | Hover/realce |
| `--chat-bg` | `#EEF2F5` | `#0E1621` | Fundo da área de mensagens |
| `--bubble-in` | `#FFFFFF` | `#182533` | Bolha recebida |
| `--bubble-out` | `#E3F1FF` | `#2B5278` | Bolha enviada |
| `--bubble-meta` | `#8A96A3` | `#7DA8D3` | Hora/ticks dentro da bolha |
| `--online` | `#4FAE4E` | `#4FAE4E` | Indicador online |
| `--unread` | `#3390EC` | `#5288C1` | Badge de não lidas |
| `--unread-muted` | `#C4C9CC` | `#3E546A` | Badge de conversa silenciada |
| `--border` | `#E6E9EC` | `#101921` | Divisores |
| `--overlay-scrim` | `rgb(0 0 0 / 0.25)` | `rgb(0 0 0 / 0.45)` | Fundo do painel lateral |
| `--destructive` | `#E53935` | `#EF5350` | Erro, excluir |

A bolha enviada usa azul claro, e não o verde do Telegram, para não parecer clone.

### 5.2 Forma, tipografia e espaço

- **Tipografia:** Inter Variable. Escala: 12 (meta), 13 (secundário), 15 (mensagem e lista), 17 (títulos de tela), 22–28 (headers de perfil). Mensagens com `line-height` 1.4.
- **Raios:** bolhas com 16px e cantos "agrupados": o canto do lado do remetente diminui para 6px nas mensagens do meio do grupo. Cards e inputs com 12px. Botões primários em pílula.
- **Avatares:** 48px na lista, 40px no header da conversa, 96–112px no perfil. Anel colorido para story não visto e dot verde para online.
- **Espaço:** grid de 4px, listas arejadas (itens de 72px), conteúdo central com `max-w` para não esticar no desktop largo.
- **Sombras:** mínimas. Só popovers, sheets e o botão de "scroll to bottom".

### 5.3 Tradução sem ruído

- A mensagem traduzida aparece como mensagem normal.
- No modo *Original + Translation*, o original fica **na mesma bolha**, abaixo de um rótulo pequeno "Original" em `muted-foreground` e `text-sm`.
- Indicador de tradução: no máximo um ícone `Languages` de 12px no meta da bolha, visível só no modo *Original + Translation* ou em hover/foco.
- O estado "traduzindo" é um shimmer sutil no texto, sem spinner.

### 5.4 Movimento

`motion` só onde ajuda: entrada de mensagem nova (fade + 4px de deslocamento), crossfade quando a tradução chega, indicador ativo da bottom nav, progresso dos stories, reações. Animações de sheet/dialog/drawer vêm do Radix/vaul com `tw-animate-css`. Sempre respeitar `prefers-reduced-motion`.

## 6. Layout e responsividade

### 6.1 Breakpoints

Definidos em `@theme` no Tailwind v4:

| Nome | Largura | Layout |
|---|---|---|
| base | 320px+ | Mobile: uma tela por vez + bottom nav |
| `md` | 768px+ | Tablet: rail compacto + lista + conversa |
| `lg` | 1024px+ | Desktop: rail + 2 colunas |
| `xl` | 1440px+ | Desktop largo: colunas mais generosas |

Diferenças de *estrutura* (ex.: perfil como página × painel) usam `useBreakpoint()` (baseado em `matchMedia` + `useSyncExternalStore`). Diferenças de *estilo* usam apenas classes responsivas do Tailwind.

### 6.2 Mobile (< 768px)

É um app nativo de mensagens, e não um desktop espremido.

- **Bottom nav:** Chats · Discover · **Create (+)** · Feed · Profile. Badge de não lidas em Chats. Notifications fica num sino no header do Feed.
- A conversa ocupa **a tela inteira** e esconde a bottom nav. Header com botão voltar.
- Perfil, settings, notifications e create são páginas cheias com transição lateral.
- Ações de mensagem por **long-press**, abrindo um `Drawer` (vaul) com reações rápidas no topo e a lista de ações.
- Viewport: `100dvh`, `env(safe-area-inset-*)`, meta `interactive-widget=resizes-content` para o composer acompanhar o teclado virtual.
- Alvos de toque com no mínimo 44×44px.

### 6.3 Tablet (768px+)

Rail de ícones (64px) + lista de conversas (300px) + conversa. Perfil e settings já abrem como painel lateral.

### 6.4 Desktop (1024px+)

```
┌────┬──────────────────┬─────────────────────────────────────────┐
│Rail│  Chats (360px)   │  Conversa                               │
│    │  [stories]       │  ┌ header ──────────────────────────┐   │
│ 💬 │  [search]        │  │ avatar  Cam · online      📞  ⋯  │   │
│ 🧭 │  [All|Unread|Grp]│  └──────────────────────────────────┘   │
│ 🖼 │  ▸ Cam      09:42│        mensagens (chat-bg)              │
│ 🔔 │  ▸ Travel   08:15│                                         │
│    │  ▸ Lucas     Ontem│  ┌ composer ────────────────────────┐   │
│ 👤 │                  │  │ 😊 📎  Message…             ➤    │   │
│ ⚙  │                  │  └──────────────────────────────────┘   │
└────┴──────────────────┴─────────────────────────────────────────┘
```

- **Rail:** logo, Chats, Discover, Feed, Notifications; embaixo, avatar (perfil) e Settings.
- **Duas colunas:** lista à esquerda e conversa no centro. Não existe terceira coluna fixa.
- Em Discover, Feed e Notifications, a área ao lado do rail mostra uma coluna central (`max-w` ~640px) sobre `chat-bg`.
- **Painel lateral direito:** perfil, info do contato, edição de perfil e settings abrem num `Sheet` à direita (~420px). O restante da tela fica atrás de um scrim com `backdrop-blur-sm` + `--overlay-scrim`. Com `prefers-reduced-transparency` (ou em dispositivos fracos) usamos só o escurecimento, sem blur.

### 6.5 Desktop largo (1440px+)

Lista com 400px. As bolhas têm `max-width` relativo à coluna (~65%, com teto de 640px) para manter linhas legíveis.

## 7. Estrutura de diretórios

```
src/
├─ main.tsx                      # bootstrap (createRoot)
├─ styles.css                    # Tailwind v4 + tokens + utilitários
├─ app/
│  ├─ App.tsx                    # providers + AppRoutes
│  ├─ queryClient.ts             # QueryClient + QueryCache/MutationCache onError
│  ├─ i18n.ts                    # i18next (interface)
│  ├─ providers/
│  │  ├─ AppProviders.tsx
│  │  └─ ThemeProvider.tsx
│  └─ router/
│     ├─ AppRoutes.tsx           # <Routes> principal + overlay routes
│     ├─ paths.ts                # construtores de URL tipados
│     ├─ guards.tsx              # RequireAuth, RequireOnboarded, RedirectIfAuthed
│     └─ overlay.tsx             # useOverlayNavigate, OverlayLink, useBackgroundLocation
├─ components/
│  ├─ ui/                        # shadcn gerado
│  └─ common/                    # UI genérica do produto
│     ├─ UserAvatar.tsx          # anel de story + dot online
│     ├─ EmptyState.tsx
│     ├─ ErrorState.tsx
│     ├─ RouteErrorBoundary.tsx
│     ├─ LanguageLabel.tsx
│     ├─ CountryFlag.tsx
│     ├─ RelativeTime.tsx
│     ├─ InfiniteScrollTrigger.tsx
│     └─ PageHeader.tsx
├─ layouts/
│  ├─ AppShell.tsx               # rail (md+) / bottom nav (mobile) + Outlet + realtime bridge
│  ├─ NavigationRail.tsx
│  ├─ BottomNav.tsx
│  ├─ ChatLayout.tsx             # lista + Outlet da conversa
│  ├─ ContentColumn.tsx          # coluna central de Discover/Feed/Notifications
│  ├─ SidePanel.tsx              # Sheet direito + scrim com blur
│  ├─ AuthLayout.tsx
│  └─ OnboardingLayout.tsx
├─ pages/                        # páginas finas por rota (lazy), só composição
│  ├─ WelcomePage.tsx  OnboardingPage.tsx
│  ├─ ChatsPage.tsx  ConversationPage.tsx
│  ├─ DiscoverPage.tsx  FeedPage.tsx  CreatePostPage.tsx
│  ├─ NotificationsPage.tsx  StoryViewerPage.tsx
│  ├─ ProfilePage.tsx  EditProfilePage.tsx  SettingsPage.tsx
│  └─ NotFoundPage.tsx
├─ features/
│  ├─ auth/            components/ hooks/ (useSession, useMe, useSignIn, useSignOut)
│  ├─ onboarding/      components/ hooks/ stores/onboardingDraftStore.ts
│  ├─ chat/
│  │  ├─ components/
│  │  │  ├─ conversation-list/   ConversationList, ConversationListItem, ConversationFilters, ConversationSearch, ConversationListSkeleton
│  │  │  ├─ conversation/        ConversationHeader, MessageList, MessageGroup, DayDivider, TypingIndicator, ScrollToBottomButton
│  │  │  ├─ message/             MessageBubble, BubbleShell, BubbleMeta, DeliveryTicks, ReplyQuote, ReactionChips, content/*
│  │  │  ├─ actions/             MessageActionsMenu, MessageActionsDrawer, ReactionPicker
│  │  │  └─ composer/            Composer, ComposerTextarea, AttachmentButton, EmojiButton, ReplyPreviewBar
│  │  ├─ hooks/      useConversations, useConversation, useMessages, useSendMessage, useMarkAsRead, useReactToMessage, useDeleteMessage
│  │  ├─ lib/        queryKeys.ts, groupMessages.ts, messageCache.ts (upsertMessage, patchMessage), conversationFilters.ts
│  │  └─ stores/     composerStore.ts
│  ├─ translation/
│  │  ├─ components/ TranslatedText, TranslationStatusHint, SeeTranslationButton, LearningPanel
│  │  ├─ hooks/      useTranslationPreferences, useMessageTranslation, useContentTranslation, useTranslationInsight
│  │  ├─ lib/        resolveMessageDisplay.ts, queryKeys.ts
│  │  └─ stores/     translationViewStore.ts   # overrides por mensagem
│  ├─ discover/        components/ (PersonCard, DiscoverFilters, PersonCardSkeleton) hooks/ lib/
│  ├─ profile/         components/ (ProfileHeader, ProfileStats, ProfileTabs, MediaGrid, EditProfileForm, ProfileSkeleton) hooks/ lib/
│  ├─ feed/            components/ (FeedList, PostCard, MediaCarousel, TranslatedCaption, PostActions, CommentsSheet, create/*) hooks/ lib/
│  ├─ stories/         components/ (StoriesTray, StoryViewer, StoryProgress, StoryOverlayText, StoryReplyInput) hooks/ lib/
│  ├─ notifications/   components/ (NotificationList, NotificationItem) hooks/ lib/
│  └─ settings/        components/ (SettingsNav, sections/*) hooks/ lib/
├─ hooks/                       # genéricos, sem domínio
│  ├─ useBreakpoint.ts  useMediaQuery.ts  useDebouncedValue.ts
│  ├─ useIntersectionObserver.ts  useLongPress.ts
├─ lib/
│  ├─ utils.ts                  # cn()
│  ├─ errors.ts                 # AppError, toAppError
│  ├─ dates.ts                  # formatação relativa, dia, hora
│  ├─ languages.ts              # catálogo de idiomas (código, nome nativo, dir)
│  ├─ countries.ts
│  ├─ ids.ts                    # createClientId()
│  ├─ storage.ts                # wrappers seguros de localStorage/sessionStorage
│  └─ env.ts                    # leitura tipada de import.meta.env
├─ services/
│  ├─ authService.ts  chatService.ts  profileService.ts  discoverService.ts
│  ├─ feedService.ts  storyService.ts  notificationService.ts  translationService.ts
│  ├─ mock/
│  │  ├─ db.ts                  # store em memória + persistência
│  │  ├─ latency.ts             # atraso e falhas simuladas
│  │  ├─ mockTranslator.ts      # dicionário + pseudo-tradução
│  │  ├─ autoResponder.ts       # contatos que respondem
│  │  ├─ seed/                  # users.ts, conversations.ts, messages.ts, posts.ts, stories.ts…
│  │  └─ implementations/       # mockChatService.ts, mockProfileService.ts…
│  └─ realtime/
│     ├─ realtimeClient.ts      # interface + RealtimeEventMap
│     ├─ mockRealtimeClient.ts
│     └─ useRealtimeBridge.ts   # eventos → cache do Query / presenceStore
├─ stores/                      # stores globais transversais
│  ├─ sessionStore.ts
│  ├─ devicePreferencesStore.ts
│  └─ presenceStore.ts
├─ types/                       # contrato de domínio
│  ├─ api.ts  user.ts  language.ts  conversation.ts  message.ts
│  ├─ post.ts  story.ts  notification.ts  preferences.ts  media.ts
└─ test/
   └─ setup.ts
```

Regras:

- `pages/` **não contém lógica.** Uma página lê params, escolhe o layout e compõe componentes de features.
- Uma feature pode importar de `components/`, `hooks/`, `lib/`, `services/`, `stores/` e `types/`. **Features não importam umas das outras**, com uma exceção: `translation`, que é transversal (chat, feed e stories usam `TranslatedText`). Se outra dependência cruzada aparecer, o código compartilhado sobe para `components/common` ou `lib/`.
- Stores específicos de uma feature ficam dentro dela (`features/chat/stores`); `src/stores/` guarda só os transversais.
- Componentes acima de ~150 linhas devem ser divididos.

## 8. Mapa de rotas

| Rota | Guard | Mobile | Tablet/Desktop |
|---|---|---|---|
| `/welcome` | `RedirectIfAuthed` | Landing + login simulado | Card centralizado |
| `/onboarding/:step` | `RequireAuth` | Passo em tela cheia | Card centralizado |
| `/` | — | → `/chats` | → `/chats` |
| `/chats` | `RequireOnboarded` | Lista | Lista + "Select a chat to start messaging" |
| `/chats/:conversationId` | `RequireOnboarded` | Conversa em tela cheia | Lista + conversa |
| `/discover` | `RequireOnboarded` | Grid de pessoas | Coluna central |
| `/feed` | `RequireOnboarded` | Stories + posts | Coluna central |
| `/notifications` | `RequireOnboarded` | Página | Coluna central |
| `/create` | `RequireOnboarded` | Página (*overlay*) | `Dialog` sobre a tela atual |
| `/stories/:userId` | `RequireOnboarded` | Viewer fullscreen (*overlay*) | Viewer fullscreen sobre a tela atual |
| `/u/:username` | `RequireOnboarded` | Página (*overlay*) | `SidePanel` à direita |
| `/u/:username/edit` | `RequireOnboarded` (próprio) | Página | `SidePanel` |
| `/settings` | `RequireOnboarded` | Lista de seções | `SidePanel` com lista de seções |
| `/settings/:section` | `RequireOnboarded` | Seção | `SidePanel` com navegação interna |
| `*` | — | NotFound | NotFound |

Passos do onboarding: `welcome`, `native-language`, `receive-language`, `profile`, `discover`.
Seções de settings: `account`, `language`, `translation`, `appearance`, `privacy`, `notifications`.

### 8.1 Overlay routes

Perfil, settings, create e stories precisam de URL própria (deep link, botão voltar) e, no desktop, devem abrir **sobre** a tela atual.

1. Links para essas rotas usam `<OverlayLink>` / `useOverlayNavigate()`, que navegam com `state: { backgroundLocation: location }`.
2. O `AppRoutes` renderiza `<Routes location={backgroundLocation ?? location}>` para as rotas principais e, quando há `backgroundLocation`, um segundo `<Routes>` só com as rotas de overlay (dentro de `SidePanel`, `Dialog` ou viewer).
3. **Deep link no desktop** (sem `backgroundLocation`): usamos `/chats` como fundo e abrimos o overlay.
4. **Mobile:** ignoramos o fundo; a rota de overlay vira página cheia.
5. Fechar o overlay chama `navigate(-1)` quando veio de dentro do app, ou navega para o fundo no caso de deep link.

### 8.2 Guards e boot

```
<SessionGate>                 # lê sessionStore; se autenticado, carrega query `me` (skeleton do app)
  /welcome                    # RedirectIfAuthed
  /onboarding/:step           # RequireAuth
  <RequireOnboarded>          # me.onboardingCompletedAt != null, senão → /onboarding/welcome
    <AppShell>                # rail/bottom nav + useRealtimeBridge
      /chats …
```

Todas as páginas usam `React.lazy`, com `Suspense` (fallback = skeleton da rota) e `RouteErrorBoundary`.

### 8.3 Construtores de URL

`app/router/paths.ts` centraliza as URLs, para que nenhum componente monte string de rota à mão:

```ts
export const paths = {
  chats: () => "/chats",
  conversation: (id: string) => `/chats/${id}`,
  profile: (username: string) => `/u/${username}`,
  settings: (section?: SettingsSection) => (section ? `/settings/${section}` : "/settings"),
  story: (userId: string) => `/stories/${userId}`,
  // …
} as const;
```

## 9. Telas

### 9.1 Welcome / login simulado

Logo TENNO TALK, a proposta em uma frase ("Talk to anyone. In your own language."), uma animação curta de uma mensagem sendo "recebida" em outro idioma e o botão **Continue**. No MVP, o login simulado tem duas opções: **criar conta nova** (passa pelo onboarding) ou **entrar como conta demo** (Lucas · pt-BR, Cam · vi-VN), já onboardadas. Trocar de conta permite ver a mesma conversa pelos dois lados.

### 9.2 Onboarding

Stepper com 5 passos. Progresso no topo, voltar/continuar embaixo (no mobile, fixos acima da safe area).

1. **Welcome:** explica a ideia com um exemplo visual (mensagem PT → VI).
2. **Native language:** `LanguagePicker` com busca, nome nativo em destaque ("Tiếng Việt") e nome em inglês secundário. Bandeira só como acessório, e por variante regional (pt-BR 🇧🇷, pt-PT 🇵🇹), porque bandeira não é idioma.
3. **Receive language:** pré-selecionado com o idioma nativo e texto explicando "Messages from others will be translated to this language". O usuário pode escolher outro.
4. **Create profile:** nome, username (validação de formato + disponibilidade mock com debounce), avatar (upload local com preview e crop circular simples), bio opcional, país.
5. **Discover people:** 4 a 6 sugestões (`PersonCard` compacto) com Follow / Message, e "Start chatting" ao final.

O rascunho fica em `onboardingDraftStore` (Zustand persistido em `sessionStorage`), para sobreviver a um reload. O submit final chama `profileService.completeOnboarding()` e invalida `me`.

### 9.3 Chats (home)

- Header: título "Chats" (mobile) e botão "New chat" (abre busca de pessoas).
- **StoriesTray** horizontal, com o próprio avatar e "+" no início.
- Busca (filtra localmente por nome/username; busca remota no futuro).
- Filtros: **All / Unread / Groups**.
- Lista com: avatar (com dot online), nome, @username opcional (só quando há homônimos ou em grupos), preview da última mensagem **já na forma de exibição do usuário** (traduzida ou original, conforme a preferência; "You: …" para as próprias), horário relativo, ticks da última mensagem própria, badge de não lidas, ícone de silenciado e "typing…" substituindo o preview.
- Empty: "No conversations yet — Find someone from another country and start talking." com CTA para Discover.
- Desktop: sem conversa selecionada, a coluna central mostra um estado vazio leve.

### 9.4 Conversa

- **Header:** voltar (mobile), avatar e nome (clicáveis → perfil no SidePanel), status (online / "last seen 5 min ago" / "typing…"), botão de chamada desabilitado com tooltip "Coming soon", menu (View profile, Search in chat (futuro), Mute, Clear history (futuro), Block (futuro)).
- **Lista de mensagens:** fundo `chat-bg`, divisores de dia ("Today", "Yesterday", data), grupos por remetente, avatar só na última mensagem do grupo recebido (em grupos), indicador de digitação, botão "scroll to bottom" com contador de novas, carregamento de mensagens antigas ao chegar no topo.
- **Composer fixo:** emoji, anexar (imagem/vídeo; arquivo no futuro), textarea com auto-resize (até 6 linhas), microfone desabilitado ("Voice messages coming soon") quando vazio e **send** quando há texto. Reply aparece como uma barra acima do composer. O draft é salvo por conversa.
- **Ações por mensagem:** Reply, React, Copy, Forward, Show original / Show translation, Learning (se ativo), Delete; Edit visível porém desabilitado. Desktop: context menu + botão "⋯" em hover/foco. Mobile: long-press → Drawer.

### 9.5 Discover

Grid responsivo (1 coluna mobile, 2 tablet, 2–3 desktop) de `PersonCard`:

```
┌───────────────────────────────┐
│ (avatar)  Cam Nguyen          │
│           @cam · 🇻🇳 Vietnam   │
│ Native    Vietnamese          │
│ Learning  Portuguese, English │
│ "Love coffee and photography" │
│ [ Message ]  [ Follow ]       │
└───────────────────────────────┘
```

Barra de filtros preparada (Country, Native language, Learning language, Interests). No MVP só existe o filtro por idioma nativo; os outros entram no futuro. Paginação infinita.

### 9.6 Perfil

Header estilo rede social: avatar grande, nome, @username, bio, país, idiomas (Native / Learning), seguidores e seguindo. Botões **Follow** + **Message** (outros) ou **Edit profile** + Settings (próprio). Tabs **Posts** / Media / Tagged (só Posts no MVP; as outras com empty state "Coming soon"). Grid de mídia 3 colunas com cantos suaves, indicador de vídeo e de múltiplas mídias. No desktop abre no SidePanel; no mobile é página.

### 9.7 Feed (pós-MVP)

StoriesTray no topo e posts em coluna única: header (avatar, nome, @username, timestamp, menu), mídia (carrossel), legenda com tradução, ações (Like, Comment, Share) e contadores. Infinite scroll. Empty: "No posts yet — Share your first moment."

### 9.8 Create post (pós-MVP)

Passos: selecionar mídia (até 10, imagem/vídeo) → legenda + preview → publicar (com barra de progresso). Espaço reservado (desabilitado) para localização e marcação de pessoas. No desktop é `Dialog`; no mobile, página.

### 9.9 Stories (pós-MVP)

Tray com avatar circular, anel (gradiente da marca para não visto, cinza para visto) e username. **Viewer:** mídia fullscreen, barras de progresso por item, usuário + timestamp, toque à esquerda/direita para navegar, segurar para pausar, swipe down para fechar (mobile), setas e Esc (desktop), reply (vira DM com referência ao story), reação rápida. Texto sobreposto com toggle Original / Translated. Sem editor complexo no MVP: criar story é só "upload + texto opcional".

### 9.10 Notifications (pós-MVP)

Lista agrupada (Today / This week / Earlier). Tipos: like, comment, follow, story reaction, new message. Cada item tem avatar do ator, texto, miniatura (se houver) e ação contextual (Follow back, View). Badge no rail e no sino do Feed. Sem push neste momento.

### 9.11 Settings

| Seção | Campos |
|---|---|
| **Account** | Profile (atalho para edit), Username, Email, Password (mock) |
| **Language** | Native language, Preferred receiving language, Interface language |
| **Translation** | Display mode (Translation only / Original + Translation / Original only), Automatically translate posts, Automatically translate stories, Learning Mode |
| **Appearance** | Light / Dark / System (preview ao vivo) |
| **Privacy** | Profile visibility, Who can message me, Who can comment, Blocked users |
| **Notifications** | Messages, Comments, Likes, Followers |

Formulários com react-hook-form + zod. Toggles salvam na hora (mutação otimista + toast discreto em caso de erro). Campos de texto têm botão Save.

## 10. Componentes principais

### 10.1 Árvore do chat

```
ChatLayout
├─ ConversationListPane
│  ├─ StoriesTray
│  ├─ ConversationSearch
│  ├─ ConversationFilters
│  └─ ConversationList → ConversationListItem (memo)
└─ <Outlet/> → ConversationPage
   ├─ ConversationHeader
   ├─ MessageList (role="log")
   │  ├─ LoadOlderTrigger
   │  ├─ DayDivider
   │  ├─ MessageGroup
   │  │  └─ MessageBubble (memo)
   │  ├─ TypingIndicator
   │  └─ ScrollToBottomButton
   └─ Composer
      ├─ ReplyPreviewBar
      ├─ EmojiButton (picker lazy)
      ├─ AttachmentButton
      ├─ ComposerTextarea
      └─ SendButton / VoiceButton(disabled)
```

### 10.2 MessageBubble

Composição de peças pequenas, cada uma testável isoladamente:

```
MessageBubble  ({ message, position: "single"|"first"|"middle"|"last", isOwn, showAvatar })
└─ BubbleShell                 # lado, cor (in/out), raio por posição, foco/seleção
   ├─ ForwardedLabel?          # futuro
   ├─ ReplyQuote?              # mensagem citada (clicável → rola até ela)
   ├─ MessageContent           # switch por content.type
   │  ├─ TextContent           # → TranslatedText
   │  ├─ ImageContent          # grid 1–4 + caption → TranslatedText
   │  ├─ VideoContent          # poster + play + duração
   │  ├─ AudioContent          # waveform estática + play (futuro)
   │  └─ FileContent           # ícone, nome, tamanho
   ├─ BubbleMeta               # hora · "edited" · DeliveryTicks · TranslationStatusHint
   └─ ReactionChips?
```

- `TranslatedText` recebe o resultado de `useMessageTranslation(message)` e renderiza `primary` e, se houver, `secondary` com rótulo "Original". Cada bloco leva `lang` e `dir="auto"`.
- O `MessageBubble` não busca dados nem conhece serviços. As ações vêm de um `MessageActionsProvider` no nível da `MessageList` (reply, react, delete…), sem prop drilling.
- `React.memo` em `MessageBubble` é justificado: a lista é longa e recebe patches frequentes de cache (status, traduções, reações). Como `upsertMessage` mantém a identidade dos objetos não alterados, o memo realmente evita re-render.

### 10.3 Componentes comuns

`UserAvatar` (tamanhos sm/md/lg/xl, iniciais de fallback com cor derivada do id, anel de story, dot online), `EmptyState`, `ErrorState`, `RouteErrorBoundary`, `LanguageLabel` (nome nativo + nome no idioma da interface), `CountryFlag` (SVG + `aria-label` com o nome do país), `RelativeTime` (atualiza a cada minuto e expõe a data completa em `title`/`<time dateTime>`), `InfiniteScrollTrigger` (IntersectionObserver), `PageHeader` (título, voltar, ações; sticky no mobile).

### 10.4 Componentes do shadcn usados

Button, Input, Textarea, Avatar, Badge, Dialog, Sheet, Drawer, DropdownMenu, ContextMenu, Popover, Tooltip, Tabs, ToggleGroup, Switch, RadioGroup, Select, Command (busca do LanguagePicker), Form, Label, ScrollArea, Separator, Skeleton, Sonner. Componentes do template que não forem usados (calendar, chart, menubar…) são removidos na Phase 1 para reduzir ruído.

## 11. Modelo de estado

### 11.1 Divisão

| Onde | O quê | Por quê |
|---|---|---|
| **TanStack Query** | `me` (perfil + preferências da conta), conversations, messages (infinite por conversa), profiles, discover, posts, comments, stories, notifications, translation insights | Dado do servidor: cache, refetch, invalidação, otimismo. |
| **Zustand: `sessionStore`** (persistido) | `status`, `userId`, `accessToken` (placeholder) | Necessário antes de qualquer query; decide guards. |
| **Zustand: `devicePreferencesStore`** (persistido) | `theme` | Preferência do dispositivo, não da conta. |
| **Zustand: `presenceStore`** | usuários online, digitando por conversa | Efêmero e de alta frequência; vem só do realtime. |
| **Zustand: `composerStore`** (drafts persistidos) | draft e reply-target por conversa | UI local que sobrevive à navegação. |
| **Zustand: `translationViewStore`** | overrides "show original/translation" por mensagem | UI local que sobrevive a unmount (virtualização). |
| **Zustand: `onboardingDraftStore`** (sessionStorage) | respostas do onboarding até o submit | Multi-step com reload. |
| **Estado local (`useState`)** | menus abertos, foco, inputs não persistidos | Escopo do componente. |
| **URL** | conversa ativa, overlay aberto, seção de settings, filtros do Discover | Endereçável e funciona com voltar. |

### 11.2 Mudança em relação ao rascunho inicial

O rascunho colocava `currentUser` e `translationPreferences` no Zustand. **Aqui ficam na query `me`**, porque:

- O idioma de recebimento é usado **pelo backend** para traduzir, então é dado de servidor.
- O modo de exibição e o Learning Mode devem seguir a conta entre dispositivos.
- Duplicar em Zustand criaria duas fontes de verdade.

O `SessionGate` carrega `me` no boot, então ele está sempre disponível dentro do app. `useMe()` e `useTranslationPreferences()` são selects sobre essa query. As mutações de preferências são otimistas (`setQueryData` + rollback).

### 11.3 Query keys

Uma factory por feature (`features/*/lib/queryKeys.ts`):

```ts
export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  conversation: (id: string) => [...chatKeys.all, "conversation", id] as const,
  messages: (conversationId: string) => [...chatKeys.all, "messages", conversationId] as const,
};
```

Configuração global do `QueryClient`: `staleTime` 30s (conversations/messages são mantidos frescos pelo realtime), `retry` 1 para queries e 0 para mutações, `refetchOnWindowFocus` só para conversas e notificações, e `QueryCache`/`MutationCache` com `onError` → `toast.error(toAppError(e).message)`, exceto quando `meta.silent` está ligado.

## 12. Tipos TypeScript principais

Os arquivos de `src/types/` são o **contrato** entre UI e serviços. Os mocks os produzem; na Phase 8, mappers convertem DTOs da API para esses tipos.

```ts
// types/api.ts
export type ISODateString = string;
export interface Page<T> { items: T[]; nextCursor: string | null }

// types/language.ts
export type LanguageCode = string;          // BCP-47: "pt-BR", "vi-VN", "en-US"
export type CountryCode = string;           // ISO 3166-1 alpha-2: "BR", "VN"
export interface Language {
  code: LanguageCode;
  englishName: string;                      // "Vietnamese"
  nativeName: string;                       // "Tiếng Việt"
  dir: "ltr" | "rtl";
  defaultCountry: CountryCode | null;       // para bandeira opcional
}

// types/user.ts
export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
export interface UserProfile extends User {
  bio: string | null;
  country: CountryCode;
  nativeLanguage: LanguageCode;
  learningLanguages: LanguageCode[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isOnline: boolean;
  lastSeenAt: ISODateString | null;
}
export interface CurrentUser extends UserProfile {
  email: string;
  onboardingCompletedAt: ISODateString | null;
  preferences: UserPreferences;
}

// types/preferences.ts
export type TranslationDisplayMode = "translation" | "both" | "original";
export interface TranslationPreference {
  receivingLanguage: LanguageCode;
  displayMode: TranslationDisplayMode;
  autoTranslatePosts: boolean;
  autoTranslateStories: boolean;
  learningMode: boolean;
}
export type Audience = "everyone" | "followers" | "nobody";
export interface UserPreferences {
  interfaceLanguage: LanguageCode;
  translation: TranslationPreference;
  privacy: { profileVisibility: "public" | "private"; whoCanMessage: Audience; whoCanComment: Audience };
  notifications: { messages: boolean; comments: boolean; likes: boolean; followers: boolean };
}

// types/media.ts
export interface MediaAttachment {
  id: string;
  kind: "image" | "video" | "audio" | "file";
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  mimeType: string;
  sizeBytes: number;
  alt: string | null;
}

// types/message.ts
export type DeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type TranslationStatus = "not_needed" | "pending" | "translating" | "translated" | "failed";

/** Texto original. Imutável. */
export interface OriginalText {
  text: string;
  language: LanguageCode;
}

/** Tradução para UM idioma-alvo. Pode ser substituída por versão maior. */
export interface ContentTranslation {
  targetLanguage: LanguageCode;
  text: string | null;
  status: TranslationStatus;
  version: number;
  updatedAt: ISODateString;
}

export type MessageContent =
  | { type: "text"; body: OriginalText }
  | { type: "image"; media: MediaAttachment[]; caption: OriginalText | null }
  | { type: "video"; media: MediaAttachment; caption: OriginalText | null }
  | { type: "audio"; media: MediaAttachment }
  | { type: "file"; media: MediaAttachment; fileName: string }
  | { type: "story_reply"; storyId: string; body: OriginalText };

export interface MessageReference {
  messageId: string;
  senderId: string;
  preview: string;                          // já na forma de exibição do viewer
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  id: string;
  clientId: string | null;                  // reconciliação do envio otimista
  conversationId: string;
  senderId: string;
  content: MessageContent;
  /** Tradução para o idioma de recebimento DO VIEWER (texto ou legenda). */
  translation: ContentTranslation | null;
  replyTo: MessageReference | null;
  reactions: ReactionSummary[];
  deliveryStatus: DeliveryStatus;           // relevante para mensagens próprias
  createdAt: ISODateString;
  editedAt: ISODateString | null;
  deletedAt: ISODateString | null;
}

/** Learning Mode — carregado sob demanda. */
export interface TranslationInsight {
  messageId: string;
  targetLanguage: LanguageCode;
  natural: string;
  literal: string;
  explanation: string | null;
  vocabulary: { term: string; meaning: string; note: string | null }[];
  pronunciation: string | null;
}

// types/conversation.ts
export interface ConversationMember {
  user: User;
  role: "member" | "admin";
  receivingLanguage: LanguageCode;
  lastReadMessageId: string | null;
}
export interface Conversation {
  id: string;
  kind: "direct" | "group";
  title: string | null;                     // grupos; direct usa o outro membro
  avatarUrl: string | null;
  members: ConversationMember[];
  lastMessage: Message | null;
  unreadCount: number;
  mutedUntil: ISODateString | null;
  updatedAt: ISODateString;
}

// types/post.ts
export interface Post {
  id: string;
  author: User;
  media: MediaAttachment[];
  caption: OriginalText | null;
  captionTranslation: ContentTranslation | null;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: ISODateString;
}
export interface Comment {
  id: string;
  postId: string;
  author: User;
  body: OriginalText;
  translation: ContentTranslation | null;
  createdAt: ISODateString;
}

// types/story.ts
export interface Story {
  id: string;
  author: User;
  media: MediaAttachment;
  overlayText: OriginalText | null;
  overlayTranslation: ContentTranslation | null;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  viewedByMe: boolean;
}
export interface StoryTrayItem {
  user: User;
  stories: Story[];
  hasUnseen: boolean;
}

// types/notification.ts
interface NotificationBase { id: string; actor: User; createdAt: ISODateString; readAt: ISODateString | null }
export type Notification = NotificationBase & (
  | { type: "like"; postId: string }
  | { type: "comment"; postId: string; commentId: string }
  | { type: "follow" }
  | { type: "story_reaction"; storyId: string; emoji: string }
  | { type: "new_message"; conversationId: string; messageId: string }
);
```

### 12.1 Diferenças em relação ao modelo do briefing

| Briefing | Plano | Motivo |
|---|---|---|
| `originalText` + `originalLanguage` | `content.body: OriginalText` | Agrupa texto e idioma; o mesmo tipo serve para legendas de imagem, posts, comentários e stories. |
| `translatedText` + `translatedLanguage` na mensagem | `translation: ContentTranslation` **projetada para o viewer** | Em grupos, cada membro recebe num idioma. O servidor guarda N traduções e envia ao cliente só a dele. |
| `translationStatus` | `translation.status` com `not_needed` | Mesmo idioma não precisa de tradução nem de hint visual. |
| — | `translation.version` | Permite aceitar uma tradução melhor e descartar eventos atrasados. |
| `deliveryStatus` | + `failed` | Envio pode falhar; a UI oferece retry sem perder o texto. |
| — | `clientId` | Reconciliação do otimismo e idempotência no servidor. |
| Learning Mode na mensagem | `TranslationInsight` separado | Não infla o payload padrão; gerado sob demanda. |

**IDs:** sempre strings estáveis. Nunca índices de array como `key` ou id. Mocks usam ids legíveis e fixos (`usr_cam`, `conv_lucas_cam`, `msg_lc_0001`). Ids criados no cliente usam `crypto.randomUUID()`.

## 13. Fluxo de mensagens

### 13.1 Envio (optimistic update)

```
Composer.submit
  └─ useSendMessage.mutate({ conversationId, text, replyTo })
       onMutate:
         clientId = createClientId()
         optimistic = { id: "tmp_"+clientId, clientId, deliveryStatus: "sending",
                        content: { type:"text", body:{ text, language: me.nativeLanguage } },
                        translation: null, createdAt: now }
         upsertMessage(qc, optimistic)          # aparece imediatamente
         patchConversationPreview(qc, optimistic)  # sobe na lista
         composerStore.clear(conversationId)
       mutationFn: chatService.sendMessage({ clientId, … })
       onSuccess(serverMessage):
         upsertMessage(qc, serverMessage)       # substitui por clientId → "sent"
       onError:
         patchMessage(qc, clientId, { deliveryStatus: "failed" })
```

Ciclo de status visível na bolha:

| Status | Indicador |
|---|---|
| `sending` | relógio |
| `sent` | ✓ |
| `delivered` | ✓✓ |
| `read` | ✓✓ em `--primary` |
| `failed` | ícone de alerta + "Tap to retry" / Delete |

`delivered` e `read` chegam por realtime (`message.delivered`, `message.read`). No backend futuro eles são derivados dos cursores `last_delivered_message_id` / `last_read_message_id` de cada membro.

O idioma enviado no original (`me.nativeLanguage`) é apenas uma **dica**. O servidor detecta o idioma real (o usuário pode escrever em outra língua) e devolve o `OriginalText` corrigido.

### 13.2 `upsertMessage`: um único ponto de escrita

Todas as fontes (otimista, resposta HTTP, `message.created` do realtime, refetch) passam por `features/chat/lib/messageCache.ts`:

- Procura a mensagem por `id` **ou** por `clientId`.
- Se existe: faz merge preservando referências inalteradas, para não quebrar o `React.memo`.
- Se não existe: insere na posição correta por `createdAt` (otimistas sempre ao final).
- Resolve a **corrida do eco**: o `message.created` da própria mensagem pode chegar antes da resposta HTTP; nos dois casos o resultado é uma única mensagem.
- Atualiza o `lastMessage`/`unreadCount` da conversa em `chatKeys.conversations()`.

### 13.3 Recebimento

`message.created` (realtime) → `upsertMessage`. Se a conversa está aberta e o usuário está no fim da lista, rola e agenda `markAsRead`. Caso contrário, incrementa o contador do "scroll to bottom" e o `unreadCount`. A mensagem recebida normalmente chega com `translation.status = "translating"`, e a tradução vem depois por `translation.updated` (§14).

### 13.4 Leitura

`useMarkAsRead(conversationId)`: quando a última mensagem recebida fica visível (IntersectionObserver), chama `chatService.markAsRead(conversationId, lastMessageId)` com debounce de 500ms e zera o `unreadCount` no cache de forma otimista.

### 13.5 Paginação

- `useMessages(conversationId)` é uma `useInfiniteQuery`. Cada página traz até 50 mensagens ordenadas, com cursor `(createdAt, id)`. A página 0 é a mais recente.
- Chegar ao topo dispara `fetchNextPage` (mensagens mais antigas). A posição de scroll é preservada medindo `scrollHeight` antes e depois.
- Auto-scroll para novas mensagens só quando o usuário já está a menos de ~120px do fim.
- Virtualização (react-virtuoso) só quando medirmos necessidade (§22).

### 13.6 Agrupamento

`groupMessages(messages, { now, locale })` é pura e testada:

1. Divide por dia (Today / Yesterday / data).
2. Dentro do dia, agrupa mensagens consecutivas do mesmo remetente com intervalo < 5 min.
3. Marca a posição de cada uma no grupo (`single | first | middle | last`), usada para raio e avatar.

### 13.7 Outras ações

| Ação | Comportamento MVP |
|---|---|
| Reply | `composerStore.setReplyTo`; barra acima do composer; `Esc` cancela. |
| React | Picker com 6 emojis rápidos + "mais"; otimista (`reaction.created`). |
| Copy | Copia o **texto exibido** (com opção "Copy original" quando estiver traduzido); toast "Copied". |
| Forward | Dialog para escolher conversas; reenvia o original. |
| Delete | "Delete for me" no MVP; "for everyone" depende de decisão de produto (§34). |
| Edit | Visível, desabilitado ("Coming soon"). A semântica de edição está em §27. |
| Retry (falha) | Reenvia com o **mesmo** `clientId` (idempotente). |

## 14. Fluxo de tradução

### 14.1 Responsabilidades

- **Backend (futuro):** detecta o idioma, traduz com contexto, versiona, persiste e emite eventos.
- **Frontend:** **só envia e recebe estados.** Nunca chama provedor de IA. Toda interação passa por `translationService`.

```ts
// services/translationService.ts
export interface TranslationService {
  retryMessageTranslation(messageId: string): Promise<ContentTranslation>;
  getTranslationInsight(messageId: string, targetLanguage: LanguageCode): Promise<TranslationInsight>;
  translateContent(ref: { kind: "post" | "comment" | "story"; id: string }, targetLanguage: LanguageCode): Promise<ContentTranslation>;
}
```

### 14.2 Ciclo de vida de uma tradução

```
pending ──► translating ──► translated (v1) ──► translated (v2, melhor contexto)
                 │
                 └──► failed ──(Retry translation)──► translating ──► translated
not_needed  (idioma de origem == idioma de recebimento)
```

Regras no cliente (`patchTranslation` em `messageCache.ts`):

- `originalText` **nunca** é alterado por eventos de tradução.
- Um evento só é aplicado se `incoming.version >= current.version`; eventos atrasados são descartados.
- Enquanto `pending`/`translating`, a conversa continua utilizável: nada bloqueia o envio, o scroll ou outras mensagens.

### 14.3 Resolução da exibição

`resolveMessageDisplay(input)` é uma função pura em `features/translation/lib`:

```ts
interface DisplayInput {
  original: OriginalText;
  translation: ContentTranslation | null;
  isOwn: boolean;
  mode: TranslationDisplayMode;            // preferência global
  override: "original" | "translation" | null; // escolha por mensagem
}
interface DisplayResult {
  primary: { text: string; language: LanguageCode; kind: "original" | "translation" };
  secondary: { text: string; language: LanguageCode; kind: "original" | "translation" } | null;
  hint: "translating" | "failed" | null;
  canToggle: boolean;
}
```

| Situação | Primário | Secundário | Hint |
|---|---|---|---|
| Mensagem própria | original | — (tradução sob demanda: "Show translation" mostra o que o outro recebeu) | — |
| `not_needed` | original | — | — |
| `translation` + `translated` | tradução | — | — |
| `both` + `translated` | tradução | original, com rótulo "Original" | — |
| `original` + `translated` | original | — | — |
| qualquer modo + `pending`/`translating` | original | — | `translating` (shimmer) |
| qualquer modo + `failed` | original | — | `failed` ("Retry translation") |
| override presente | conforme override | — | — |

### 14.4 Hooks

| Hook | Retorno | Fonte |
|---|---|---|
| `useTranslationPreferences()` | `TranslationPreference` + `update(partial)` | select de `me` + mutação otimista |
| `useMessageTranslation(message)` | `{ display, showOriginal(), showTranslation(), reset(), retry(), isRetrying }` | `resolveMessageDisplay` + `translationViewStore` + mutação de retry |
| `useContentTranslation(ref, original, existing)` | `{ display, requestTranslation(), status }` | query `translationKeys.content(ref, lang)`, habilitada por auto-translate ou clique em "See translation" |
| `useTranslationInsight(messageId)` | query do insight | habilitada só quando o LearningPanel abre |

### 14.5 Experiência

- Por padrão, o usuário só vê a mensagem no idioma dele. Nada indica "IA".
- Tocar/clicar numa mensagem (menu de ações) oferece **Show original** / **Show translation**. A troca é um crossfade de 150ms na mesma bolha, e a altura anima suavemente.
- No modo *Original + Translation*, a bolha mostra:

  ```
  Eu também estava com saudade de você.
  ─────────
  Original
  Em cũng nhớ anh.                     09:41 ✓✓
  ```

  O original fica em `text-sm` e `muted-foreground`, com divisor sutil.
- A tradução que chega depois (de `translating` para `translated`) faz crossfade do original para a tradução **mantendo a âncora de scroll** quando o usuário está no fim.
- Falha: o original aparece normalmente e "Retry translation" fica discreto no meta.
- Feed, comentários e stories: legenda em outro idioma mostra "See translation" (ou já traduz, se `autoTranslatePosts`/`autoTranslateStories` estiver ligado), com "See original" para voltar. O original nunca é sobrescrito.

## 15. Learning Mode

Opcional (Settings → Translation → Learning Mode). Desligado por padrão.

- **Ligado:** as mensagens recebidas traduzidas ganham a ação **"Learn"** no menu de ações, e um ícone discreto (`GraduationCap` de 12px) aparece no meta em hover/foco. A bolha **não muda** de aparência.
- "Learn" abre o `LearningPanel` (Popover no desktop, Drawer no mobile):

  ```
  Natural      Estou com saudade de você.
  Original     Em nhớ anh.          🔊 (futuro)
  Literal      Eu sinto sua falta.
  ── futuro ──
  Explanation  "nhớ" significa lembrar/sentir falta…
  Vocabulary   em · nhớ · anh
  ```
- Os dados vêm de `useTranslationInsight(messageId)` → `translationService.getTranslationInsight`, sob demanda e cacheados.
- A estrutura (`TranslationInsight`) já prevê explicação, vocabulário e pronúncia; no MVP, o mock preenche só `natural`, `original` e `literal`.
- Futuro: salvar vocabulário, praticar e destacar palavras na bolha (ativação explícita).

## 16. Estratégia de mocks

### 16.1 Serviços com contrato

Cada serviço exporta uma **interface** e **uma instância**. Componentes e hooks só conhecem a instância:

```ts
// services/chatService.ts
export interface ChatService {
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation>;
  getMessages(conversationId: string, cursor: string | null): Promise<Page<Message>>;
  sendMessage(input: SendMessageInput): Promise<Message>;
  markAsRead(conversationId: string, messageId: string): Promise<void>;
  react(messageId: string, emoji: string): Promise<void>;
  deleteMessage(messageId: string, scope: "me"): Promise<void>;
  getOrCreateDirectConversation(userId: string): Promise<Conversation>;
}

export const chatService: ChatService = mockChatService;
```

Os hooks chamam `chatService.getConversations()` dentro de `queryFn`; nenhum componente chama serviço diretamente. Na Phase 8, a última linha passa a escolher `httpChatService` (ou `supabaseChatService`) via `env.ts`, **sem tocar em componentes nem hooks**. Não criamos stubs HTTP antes da hora.

### 16.2 Banco mock

- `mock/db.ts`: store em memória com coleções (`users`, `conversations`, `messages`, `posts`…), semeado a partir de `mock/seed/`.
- **IDs estáveis e legíveis** no seed. Novos registros usam `crypto.randomUUID()`.
- Persistência em `localStorage` (`tenno.mockdb.v1`), para que mensagens enviadas, follows e preferências sobrevivam ao reload. A versão na chave permite resetar ao mudar o seed.
- Settings → (dev) "Reset demo data".
- O mock **simula a projeção do servidor**: guarda N traduções por mensagem e devolve só a do idioma de recebimento do usuário logado.

### 16.3 Realismo

- `latency.ts`: atraso aleatório entre 150 e 600ms por chamada. Taxa de falha configurável via `localStorage`/devtools: padrão 0% para chamadas comuns, ~10% para traduções (exercita o retry).
- `mockTranslator.ts`: dicionário de frases do seed nas combinações pt-BR ↔ vi-VN ↔ en-US ↔ es-ES (inclui as do briefing: "Estou com saudade de você." ↔ "Em nhớ anh."). Frases desconhecidas recebem uma pseudo-tradução marcada (ex.: `«vi» texto`) para ficar claro que é mock. Em ~20% das traduções, uma versão 2 "melhorada" chega alguns segundos depois.
- `autoResponder.ts`: depois de um envio, o contato mock passa por sent → delivered (1s) → read (2–4s, se "online"), emite `typing.started` e responde no idioma dele com uma frase do roteiro. Tudo via `mockRealtimeClient`, exercitando o mesmo caminho do realtime real.
- Contas demo: **Lucas** (pt-BR, Brasil), **Cam** (vi-VN, Vietnã), além de ~10 pessoas para Discover (es, en, ja, fr, ar…, incluindo um idioma RTL para testar layout).

## 17. Abstração de realtime

```ts
// services/realtime/realtimeClient.ts
export interface RealtimeEventMap {
  "message.created":      { message: Message };
  "message.updated":      { message: Message };
  "message.deleted":      { conversationId: string; messageId: string };
  "message.delivered":    { conversationId: string; messageIds: string[] };
  "message.read":         { conversationId: string; readerId: string; upToMessageId: string };
  "translation.updated":  { conversationId: string; messageId: string; translation: ContentTranslation };
  "reaction.created":     { conversationId: string; messageId: string; userId: string; emoji: string };
  "reaction.deleted":     { conversationId: string; messageId: string; userId: string; emoji: string };
  "user.online":          { userId: string };
  "user.offline":         { userId: string; lastSeenAt: string };
  "typing.started":       { conversationId: string; userId: string };
  "typing.stopped":       { conversationId: string; userId: string };
  "notification.created": { notification: Notification };
}

export type RealtimeStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

export interface RealtimeClient {
  connect(session: { userId: string; accessToken: string | null }): void;
  disconnect(): void;
  getStatus(): RealtimeStatus;
  onStatusChange(handler: (status: RealtimeStatus) => void): () => void;
  subscribe<K extends keyof RealtimeEventMap>(event: K, handler: (payload: RealtimeEventMap[K]) => void): () => void;
  emitTyping(conversationId: string, isTyping: boolean): void;
}

export const realtimeClient: RealtimeClient = mockRealtimeClient;
```

- **`translation.updated`** foi adicionado à lista do briefing; é essencial para traduções assíncronas e "melhoradas".
- `useRealtimeBridge()`, montado uma única vez no `AppShell`, é o **único** lugar que traduz eventos em efeitos:
  - mensagens/traduções/reações → `messageCache` (Query);
  - online/typing → `presenceStore`;
  - notificações → cache de notifications + badge.
- No reconnect, invalida `chatKeys.conversations()` e as mensagens da conversa aberta para recuperar lacunas.
- O typing é emitido pelo composer com throttle de 3s e `typing.stopped` após 5s de inatividade ou envio.
- Nenhum tipo do Supabase vaza para fora do adapter.

## 18. Dark mode

- Estratégia de classe: `.dark` no `<html>` (`@custom-variant dark (&:is(.dark *))`, já presente).
- `devicePreferencesStore.theme`: `"light" | "dark" | "system"` (padrão `system`).
- `ThemeProvider` aplica a classe e escuta `prefers-color-scheme` quando o tema é `system`.
- Um **script inline no `index.html`** lê o tema persistido e aplica a classe antes do primeiro paint (sem flash).
- `<meta name="theme-color">` acompanha o tema (barra do navegador mobile).
- Componentes usam **somente tokens semânticos**; cores hardcoded são proibidas fora de `styles.css`.

## 19. Loading, error e empty states

### Loading

Skeletons em vez de spinners:

| Skeleton | Onde |
|---|---|
| `AppSkeleton` | boot (SessionGate carregando `me`) |
| `ConversationListSkeleton` | lista de chats |
| `MessageListSkeleton` | abrir conversa |
| `PersonCardSkeleton` | Discover |
| `ProfileSkeleton` | perfil |
| `FeedPostSkeleton` | Feed |
| `NotificationSkeleton` | Notifications |

Os skeletons servem de fallback do `Suspense` (rotas lazy) e do estado `isPending` das queries. Spinners pequenos só dentro de botões durante mutações.

### Erros

- `lib/errors.ts`: classe `AppError { code: "network" | "not_found" | "forbidden" | "validation" | "rate_limited" | "unknown"; message: string; retryable: boolean }`, mais `toAppError(unknown)`.
- Serviços (mock e reais) lançam `AppError`.
- **Toast** (sonner) para erros simples, de forma centralizada (`QueryCache`/`MutationCache`).
- **Error boundaries:** uma raiz (tela "Something went wrong" + reload) e uma por rota (`RouteErrorBoundary`, com "Try again" que reseta a query). Erros de mensagem individual aparecem na bolha (ex.: falha de envio), não em toast.
- **Nunca** usar `alert()`/`confirm()` do navegador. Confirmações usam `AlertDialog`.

### Empty states

Componente `EmptyState { icon, title, description, action? }`:

| Contexto | Título | Descrição / CTA |
|---|---|---|
| Chats | No conversations yet | Find someone from another country and start talking. → Discover |
| Chats (Unread) | You're all caught up | — |
| Conversa nova | Say hi to Cam 👋 | Write in your language — Cam will read it in Vietnamese. |
| Discover sem resultado | No one found | Try another language or country. |
| Feed | No posts yet | Share your first moment. → Create |
| Perfil sem posts | No posts yet | (próprio) Share your first moment. |
| Notifications | Nothing new | When someone likes or follows you, you'll see it here. |

## 20. Acessibilidade

- Componentes Radix (via shadcn) cuidam de foco, `aria-*` e teclado em menus, dialogs e sheets.
- **Todo botão de ícone tem `aria-label`** (com Tooltip no desktop).
- Inputs com `<Label htmlFor>` (o `Form` do shadcn faz a associação); erros via `aria-describedby`.
- Lista de mensagens com `role="log"` e `aria-live="polite"`; cada mensagem tem um rótulo acessível ("Cam, 09:41: …").
- **`lang` em cada bloco de texto de conteúdo** (mensagens, legendas, nomes de idioma) e `dir="auto"`.
- Teclado:
  - `Enter` envia, `Shift+Enter` quebra linha;
  - `Esc` fecha painel/drawer e cancela reply;
  - `Ctrl/Cmd+K` foca a busca de conversas;
  - `↑`/`↓` navegam na lista de conversas;
  - setas e `Esc` no story viewer;
  - ações de mensagem acessíveis por foco (botão "⋯") e pela tecla de menu de contexto.
- Contraste mínimo AA nos dois temas (validar tokens com ferramenta na Phase 1).
- Imagens com `alt` (avatar: nome da pessoa; mídia: `alt` do upload ou descrição genérica).
- Respeito a `prefers-reduced-motion` e `prefers-reduced-transparency`.
- Alvos de toque ≥ 44px.

## 21. Internacionalização da interface

Há três conceitos distintos de idioma, que não devem ser confundidos no código:

| Conceito | Campo | Afeta |
|---|---|---|
| Idioma nativo | `profile.nativeLanguage` | Dica do idioma em que o usuário escreve; mostrado no perfil. |
| Idioma de recebimento | `preferences.translation.receivingLanguage` | Para qual idioma o **backend** traduz o conteúdo dos outros. |
| Idioma da interface | `preferences.interfaceLanguage` | Textos de botões e menus (i18next) e formatação de datas. |

- i18next configurado na Phase 1 com namespace por feature e **apenas `en`** inicialmente. Todas as strings de UI passam por `t()` desde o início, porque adicionar i18n depois é caro.
- O seletor de idioma da interface aparece em Settings já no MVP (com `en` e, possivelmente, `pt-BR`).
- Os nomes de idiomas usam `Intl.DisplayNames`, com o catálogo de `lib/languages.ts` como fallback.

## 22. Performance

- **Code splitting:** todas as páginas com `React.lazy`. StoryViewer, emoji picker, CreatePost e LearningPanel são carregados sob demanda.
- **Imagens:** `loading="lazy"`, `decoding="async"`, `width`/`height` ou `aspect-ratio` reservados (sem layout shift), thumbnails em grids.
- **Listas:** infinite scroll no feed, no Discover e nas mensagens antigas.
- **Virtualização:** preparada, mas não implementada de início. A `MessageList` é desenhada para aceitar react-virtuoso (boa com listas reversas e alturas variáveis) quando medirmos necessidade (> ~300 mensagens renderizadas ou frame drops).
- **Re-render:** seletores granulares no Zustand; `React.memo` só em `MessageBubble` e `ConversationListItem`; `upsertMessage` preserva a identidade dos objetos.
- **Sem otimização prematura:** nada de `useMemo`/`useCallback` por reflexo, só quando há custo medido ou dependência de memo.
- **Orçamento inicial:** JS do primeiro carregamento < 200KB gzip; LCP < 2.5s em 4G simulado (medir na Phase 10).

## 23. Testes

| Tipo | Ferramenta | Alvo |
|---|---|---|
| Unitário | Vitest | `groupMessages`, `resolveMessageDisplay`, `upsertMessage`/`patchTranslation` (dedupe, versão), `conversationFilters`, formatação de datas, `mockTranslator` |
| Componente | Vitest + Testing Library | `MessageBubble` (3 modos × estados de tradução), `Composer` (Enter/Shift+Enter, reply), guards de rota, `LanguagePicker`, formulários de settings |
| Integração | Vitest + mocks reais | Fluxo enviar → otimista → sent → resposta automática |
| E2E | Playwright (Phase 10) | Onboarding, chat entre duas contas, troca de modo de tradução, responsividade |
| A11y | axe (Phase 10) | Páginas principais nos dois temas |

Regra: toda função pura de domínio nasce com teste.

## 24. Plano de implementação em fases

O detalhamento (checklist) está no [IMPLEMENTATION.md](IMPLEMENTATION.md).

| Fase | Entrega | Critério de conclusão (resumo) |
|---|---|---|
| **1. Foundation** | Migração para Vite SPA, tokens, layouts, roteamento, providers, tipos, mock db | `dev`/`build`/`lint`/`typecheck`/`test` verdes; navegação mobile/desktop com placeholders; tema sem flash |
| **2. Auth & onboarding** | Login simulado, SessionGate, onboarding de 5 passos | Novo usuário completa o onboarding e chega em `/chats`; sessão sobrevive ao reload |
| **3. Chat** | Lista, conversa, composer, envio otimista, realtime mock, auto-responder | Ciclo sending → sent → delivered → read visível; resposta automática chega; falha com retry |
| **4. Translation UX** | 3 modos, override por mensagem, estados, retry, versão, Learning Mode | Troca de modo reflete na hora; falha preserva o original; tradução melhorada substitui sem regressão |
| **5. Profiles, discovery & settings** | Perfil, edição, follow, Discover, Settings completas | **MVP completo** em 360/768/1024/1440px com a11y básica |
| **6. Feed** | Feed, create post, likes, comments, tradução de legendas | Post criado aparece no feed e no perfil; tradução respeita a preferência |
| **7. Stories & notifications** | Tray, viewer, reply/reaction, notificações | Viewer navegável por toque/teclado; badges atualizam |
| **8. Backend integration** | Supabase, serviços reais, storage, worker de tradução | Mesmos fluxos contra backend real sem alterar componentes |
| **9. Realtime** | Adapter real, presença, typing, recuperação | Duas contas conversam em tempo real em idiomas diferentes |
| **10. Production hardening** | Performance, a11y, e2e, moderação, observabilidade, deploy | Metas atingidas e pipeline verde |

---

# Parte II — Backend futuro

> Esta parte é direcional. Ela será detalhada depois que o frontend (Phases 1–7) estiver estável. Nada aqui deve ser implementado antes disso.

## 25. Arquitetura de backend

```
Browser (SPA)
   │  HTTPS (REST/RPC)              WebSocket
   ▼                                   ▼
Supabase API (PostgREST + RPC)     Supabase Realtime (Broadcast + Presence)
   │                                   ▲
   ▼                                   │ broadcast
PostgreSQL (RLS) ──► fila (pgmq) ──► Translation Worker (Edge Function / serviço)
   ▲                                   │
   └─────────── message_translations ◄─┘──► Provedor de LLM (chave só no servidor)
Supabase Storage (avatars, post-media, story-media, chat-media)
```

- **Supabase** como base: PostgreSQL, Auth, Storage e Realtime.
- **Camada de tradução própria**, isolada do resto (Edge Function ou serviço worker em container), para trocar de provedor ou modelo sem impacto no app.
- Operações com regras de negócio (enviar mensagem, completar onboarding, follow com notificação) via **RPC/Edge Functions** com validação, e não por inserts diretos do cliente.
- O backend é responsável por: autorização, tradução, proteção de chaves, persistência, contexto da conversa, rate limiting e moderação futura.

## 26. Realtime

- **Broadcast por conversa** (`conversation:{id}`), emitido pelo servidor depois de persistir. É preferível a Postgres Changes em escala e permite enviar a tradução **projetada por membro**: um canal por usuário (`user:{id}`) para eventos que dependem do idioma do viewer, como `translation.updated`.
- **Presence** para online/offline e typing.
- O adapter `supabaseRealtimeClient` implementa `RealtimeClient` (§17), mapeando canais e eventos para o `RealtimeEventMap`.
- Recuperação de lacunas: no reconnect, o cliente refaz o fetch incremental (`after: lastSeenCursor`).

## 27. Banco de dados

Entidades (nomes provisórios):

| Tabela | Colunas-chave |
|---|---|
| `users` | gerida pelo Supabase Auth |
| `profiles` | `id (= users.id)`, `username (unique, citext)`, `display_name`, `avatar_path`, `bio`, `country`, `native_language`, `onboarding_completed_at` |
| `languages` | `code (pk)`, `english_name`, `native_name`, `dir`, `enabled` |
| `user_language_preferences` | `user_id`, `receiving_language`, `interface_language`, `display_mode`, `auto_translate_posts`, `auto_translate_stories`, `learning_mode` |
| `user_learning_languages` | `user_id`, `language`, `level` |
| `conversations` | `id`, `kind`, `title`, `avatar_path`, `created_by`, `last_message_id`, `updated_at` |
| `conversation_members` | `conversation_id`, `user_id`, `role`, `last_delivered_message_id`, `last_read_message_id`, `muted_until`, `joined_at` |
| `messages` | `id`, `conversation_id`, `sender_id`, `client_id (unique por sender)`, `type`, `reply_to_id`, `current_revision`, `created_at`, `deleted_at` |
| `message_revisions` | `message_id`, `revision`, `original_text`, `original_language (detectado)`, `declared_language`, `created_at` — **cada revisão é imutável** |
| `message_translations` | `message_id`, `revision`, `target_language`, `text`, `literal_text`, `status`, `version`, `model`, `error`, `updated_at` — PK `(message_id, revision, target_language)` |
| `message_media` | `message_id`, `media_id`, `position` |
| `message_reactions` | `message_id`, `user_id`, `emoji` |
| `media` | `id`, `owner_id`, `bucket`, `path`, `kind`, `mime`, `size`, `width`, `height`, `duration_ms`, `status` |
| `posts` / `post_media` | `posts(id, author_id, caption_text, caption_language, created_at)` |
| `content_translations` | `(content_kind, content_id, target_language)`, `text`, `version` — legendas, comentários e stories |
| `comments` | `id`, `post_id`, `author_id`, `body_text`, `body_language`, `created_at` |
| `likes` | `post_id`, `user_id` |
| `stories` / `story_views` | `stories(id, author_id, media_id, overlay_text, overlay_language, expires_at)` |
| `follows` | `follower_id`, `followee_id` |
| `blocks` | `blocker_id`, `blocked_id` |
| `reports` | `reporter_id`, `target_kind`, `target_id`, `reason`, `status` |
| `notifications` | `id`, `recipient_id`, `actor_id`, `type`, `payload jsonb`, `read_at` |

Observações:

- **"originalText é imutável" × "edit no futuro":** a edição cria uma **nova revisão**. O texto de cada revisão nunca muda, e as traduções são por revisão. A UI mostra a revisão atual com o indicador "edited".
- Os ticks de entrega e leitura são **derivados** dos cursores dos membros, e não gravados por mensagem.
- Índices: `messages(conversation_id, created_at desc, id)`, `message_translations(message_id, target_language)`, `follows` nos dois sentidos.

## 28. IA e pipeline de tradução

```
send_message RPC
  1. valida membership, bloqueio, rate limit
  2. insere messages + message_revisions (idempotente por client_id)
  3. calcula alvos = {receiving_language dos membros} − {idioma de origem}
  4. insere message_translations(status = 'pending') para cada alvo
  5. enfileira job (pgmq) e faz broadcast de message.created
Worker
  6. detecta o idioma de origem (corrige o declarado se preciso)
  7. monta o contexto: últimas N mensagens (originais), tom/relacionamento, glossário da conversa
  8. chama o LLM com prompt de tradução natural (sentido, não palavra por palavra) + versão literal opcional
  9. grava text/version/status; em falha: status='failed', retry com backoff
 10. broadcast translation.updated no canal de cada membro com aquele idioma
Reprocessamento
 11. jobs de "melhoria" podem retraduzir com mais contexto → version+1 → novo evento
```

- **Chaves de IA só no servidor.** O navegador nunca chama o provedor.
- **Provedor abstraído** (`Translator` interface no worker), o que permite trocar modelo ou provedor e fazer testes A/B.
- **Custo:** cache por (mensagem, revisão, idioma); grupos com muitos idiomas geram fan-out, então é preciso limitar ou priorizar. Feed, comentários e stories são traduzidos **sob demanda** e cacheados em `content_translations`.
- **Learning Mode:** `TranslationInsight` gerado sob demanda, cacheado e com rate limit próprio.
- **Moderação futura:** o mesmo pipeline pode classificar conteúdo (spam, abuso) antes ou depois de traduzir.

## 29. Storage

| Bucket | Acesso | Conteúdo |
|---|---|---|
| `avatars` | público | avatares (redimensionados) |
| `post-media` | público ou assinado, conforme a visibilidade do perfil | fotos/vídeos de posts |
| `story-media` | assinado, expira junto com o story | stories |
| `chat-media` | **privado**, URLs assinadas de curta duração, RLS por membership | mídia de conversas |

- Upload via URL assinada emitida pelo servidor depois de validar tipo, tamanho e cota.
- Validação de MIME real (magic bytes) no servidor e remoção de EXIF/geolocalização de imagens.
- Thumbnails e versões redimensionadas; transcodificação de vídeo numa fase posterior.

## 30. Autenticação

- **Supabase Auth:** email (magic link / OTP) + OAuth (Google, Apple). Senha opcional.
- O `authService` do frontend vira adapter (`signIn`, `signOut`, `getSession`, `onAuthStateChange`), e o `sessionStore` continua sendo a única interface para a UI.
- Tokens gerenciados pelo SDK. Nada de chaves secretas no bundle: só a `anon key`, que é pública por design e é protegida pelas policies de RLS.
- O onboarding completo é um estado do perfil (`onboarding_completed_at`), verificado pelo guard e também pelo servidor.

## 31. Segurança

- **O frontend nunca é fonte de autorização.** Os guards de rota são só UX.
- **Row Level Security** em todas as tabelas: membros leem e escrevem só nas próprias conversas; perfis privados restringem posts e stories; bloqueios são aplicados em mensagens, comentários, follows e Discover.
- **Validação no servidor** com schemas zod compartilhados em RPC/Edge Functions (tamanho de mensagem, campos, formatos).
- **Rate limiting:** envio de mensagens, criação de conversas, follows, traduções manuais (retry, insights) e uploads.
- **Upload validation:** MIME, tamanho, dimensões, cota por usuário.
- **Privacidade:** "Who can message me" e "Who can comment" aplicados no servidor. Recomendado um inbox de **message requests** para pessoas que não se seguem (§34).
- **Block system** e **report system**, com fila de moderação.
- Proteção de conteúdo enviado à IA: minimizar o contexto, sem dados pessoais desnecessários e com contrato de não-treinamento com o provedor.
- Headers de segurança (CSP, HSTS) no deploy do frontend; sanitização na renderização (React escapa por padrão; nunca usar `dangerouslySetInnerHTML` com conteúdo de usuário).

## 32. Deploy

- **Frontend:** build estático (Vite) em Vercel / Netlify / Cloudflare Pages, com fallback de SPA (`/* → /index.html`), cache imutável para assets com hash, preview deploy por PR.
- **Backend:** Supabase gerenciado (projetos separados para dev, staging e prod). Migrations versionadas (Supabase CLI) e Edge Functions com deploy via CI.
- **CI:** lint → typecheck → test → build em cada PR; e2e (Playwright) contra preview em staging.
- **Observabilidade:** Sentry (frontend e funções), logs estruturados do worker de tradução, métricas de latência e custo de tradução.
- **Variáveis de ambiente:** só `VITE_*` públicas no frontend (URL do Supabase, anon key, flags). Segredos (chaves de IA, service role) só no backend.

---

# Parte III — Riscos e decisões

## 33. Riscos técnicos

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | Migrar do TanStack Start para SPA desconecta o Lovable | Editor e preview do Lovable deixam de funcionar | Trabalhar em branch; decidir o merge conscientemente |
| R2 | Eco do realtime chega antes da resposta HTTP | Mensagens duplicadas | `upsertMessage` deduplica por `id`/`clientId`; `client_id` único no banco |
| R3 | Scroll reverso + paginação + tradução assíncrona | Saltos de scroll, layout shift | Preservar âncora ao carregar antigas; manter âncora no fim quando a tradução chega; virtualização com lib própria para chat |
| R4 | Teclado virtual e viewport no iOS Safari | Composer coberto, saltos | `dvh`, `interactive-widget=resizes-content`, safe-area, testes em dispositivo real |
| R5 | Multi-escrita (vietnamita, CJK, tailandês, árabe) | Fontes quebradas, layout errado em RTL | Inter + fallbacks; `dir="auto"`; propriedades lógicas; conta seed RTL |
| R6 | Bandeira ≠ idioma; Windows não renderiza emoji de bandeira | UX confusa, "BR" no lugar da bandeira | Nome nativo do idioma como principal; bandeiras SVG por variante regional |
| R7 | Colisão de nomes `useTranslation` (i18n × tradução) | Imports errados, confusão | Nomenclatura definida (D11) |
| R8 | Custo e latência da IA (grupos multilíngues, auto-tradução de feed) | Conta alta, mensagens demorando | Projeção por viewer, cache, tradução sob demanda para feed/stories, limites por plano |
| R9 | `backdrop-blur` do painel lateral em dispositivos fracos | Jank | Fallback sem blur (`prefers-reduced-transparency`, heurística) |
| R10 | Mock divergir da API real | Retrabalho na Phase 8 | `src/types` como contrato; mappers DTO → domínio; o mock imita a projeção do servidor |
| R11 | Flags estritas do TS × código gerado pelo shadcn | Erros de tipo em `components/ui` | Ajustes pontuais e documentados; não afrouxar o tsconfig |
| R12 | Tradução "melhorada" troca um texto que o usuário está lendo | Estranhamento | Crossfade suave; aplicar só se `version` maior |
| R13 | Conectar desconhecidos de vários países | Spam, assédio | Message requests, block/report desde cedo, privacidade restritiva por padrão |

## 34. Decisões a tomar antes do backend

1. **Criptografia ponta a ponta × tradução no servidor.** São incompatíveis: para traduzir, o servidor precisa ler o conteúdo. Decidir explicitamente (e comunicar na política de privacidade) antes de qualquer schema.
2. **Provedor e modelo de IA**, custo estimado por mensagem, quem paga, limites do plano gratuito.
3. **Contexto enviado à IA:** quantas mensagens, retenção pelo provedor, opt-out de treinamento, conformidade com LGPD/GDPR e consentimento do usuário.
4. **Detecção de idioma:** confiar no idioma declarado, detectar no servidor ou combinar os dois (recomendado: detectar, usando o declarado como dica).
5. **Edição e exclusão:** re-traduzir em cada edição? Mostrar histórico? "Delete for everyone" com janela de tempo?
6. **Grupos:** tamanho máximo, número máximo de idiomas por grupo, read receipts em grupo.
7. **Segurança social:** inbox de *message requests* para quem não se segue? Idade mínima? Política de moderação e de denúncias?
8. **Login:** métodos (magic link, Google, Apple, senha) e regras de username (tamanho, caracteres, troca).
9. **Idiomas da interface** no lançamento.
10. **Mídia:** limites de tamanho e duração, formatos aceitos, retenção de stories (24h?) e de mídia de chat.
11. **Infra:** região de hospedagem (latência Brasil ↔ Vietnã), Broadcast × Postgres Changes, worker em Edge Function × serviço dedicado.

## 35. Regras de desenvolvimento

- Não criar componentes gigantes (~150 linhas é o sinal para dividir).
- Não duplicar lógica: funções puras em `features/*/lib` ou `lib/`.
- Não chamar API/serviços diretamente em componentes; sempre via hooks (Query/mutations).
- Não colocar chaves secretas no frontend.
- Não usar `any`. Se for inevitável, comentar o motivo; preferir `unknown` + narrowing.
- Não criar abstrações sem uso concreto.
- Preferir código simples e legível, com nomes claros.
- Manter separação entre UI (components), domínio (features/*/lib, types) e acesso a dados (services).
- Pensar mobile primeiro em toda tela.
- Nunca usar índice de array como `key` ou id.
- Strings de UI sempre via `t()`.
- Cores só por tokens semânticos.
- Antes de implementar algo grande, atualizar o **PLAN.md**. Ao concluir uma etapa, atualizar o **IMPLEMENTATION.md**.
