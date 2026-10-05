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
32. [Deploy (VPS)](#32-deploy-vps)

**Parte III — Riscos e decisões**

33. [Riscos técnicos](#33-riscos-técnicos)
34. [Decisões de backend](#34-decisões-de-backend)
35. [Regras de desenvolvimento](#35-regras-de-desenvolvimento)
36. [Revisão da experiência social](#36-revisão-da-experiência-social-2026-10-04)
37. [Algoritmo de descoberta](#37-algoritmo-de-descoberta-2026-10-05)

---

# Parte I — Frontend

## 1. Visão do produto

TENNO TALK é uma plataforma social de comunicação entre pessoas de países diferentes. O núcleo é um chat no estilo WhatsApp/Telegram com identidade própria. A diferença é que **cada pessoa escreve no próprio idioma e lê no idioma que escolheu**.

```
Rafael (pt-BR → recebe em pt-BR)            Linh (vi-VN → recebe em vi-VN)
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

- Autenticação simulada: Google, Facebook e email/senha (mock), mais contas demo para desenvolvimento.
- Aceite dos Termos de Uso e da Política de Privacidade (LGPD) na criação da conta.
- Onboarding em 5 passos.
- Lista de conversas com busca e filtros (All / Unread).
- Foco em **conversas entre duas pessoas** (uso inicial do produto).
- Chat com envio otimista, status de entrega, reply, reações, copy e ações.
- Mensagens e tradução mockadas, incluindo falhas e "tradução melhorada".
- Alternância Original / Translation (global e por mensagem).
- Perfil (próprio e de terceiros), edição de perfil, follow.
- Discover.
- Settings completas (com persistência mock).
- Dark mode / light mode / system.
- Layouts mobile e desktop com UX própria em cada um.

**Pós-MVP (Phases 6 e 7)**

Feed, criação de post, likes, comments, Stories, notificações e **grupos** (cada pessoa cria no máximo 1).

**Fora do escopo do frontend inicial**

Backend real, push notifications, chamadas de voz/vídeo, gravação de áudio, editor de stories, criptografia ponta a ponta, **edição e exclusão de mensagens** (decisão de 2026-10-03).

## 3. Stack frontend

| Camada | Escolha | Observação |
|---|---|---|
| Build | **Vite** | SPA pura (sem SSR). |
| UI | **React 19** + **TypeScript** estrito | Mantemos as flags estritas atuais (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`…). |
| Roteamento | **React Router v8**, modo declarativo | `BrowserRouter` + `<Routes>`. Facilita o padrão de *overlay routes* (ver §8). Dados ficam no TanStack Query, então não usamos loaders do router. |
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
| D8 | **Realtime atrás de interface tipada** | `RealtimeClient` com mapa de eventos tipado; o mock vem primeiro e o WebSocket do backend Java depois (§17, §26). |
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
│ 💬 │  [search]        │  │ avatar  Linh · online      📞  ⋯  │   │
│ 🧭 │  [All|Unread|Grp]│  └──────────────────────────────────┘   │
│ 🖼 │  ▸ Linh      09:42│        mensagens (chat-bg)              │
│ 🔔 │  ▸ Travel   08:15│                                         │
│    │  ▸ Rafael     Ontem│  ┌ composer ────────────────────────┐   │
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
│     ├─ overlay.ts              # useOverlayNavigate, useBackgroundLocation, useCloseOverlay
│     └─ OverlayLink.tsx
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
│  │  ├─ hooks/      useConversations, useConversation, useMessages, useSendMessage, useMarkAsRead, useReactToMessage
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
- Uma feature pode importar de `components/`, `hooks/`, `lib/`, `services/`, `stores/` e `types/`. **Features não importam umas das outras**, com três exceções transversais: `translation` (chat, feed e stories usam `TranslatedText`), `auth` (`useMe`/`useCurrentUser`, necessários em todo o app) e `profile` (seguir pessoas e cartões de pessoa, usados por onboarding, Discover e perfil). Se outra dependência cruzada aparecer, o código compartilhado sobe para `components/common` ou `lib/`.
- Stores específicos de uma feature ficam dentro dela (`features/chat/stores`); `src/stores/` guarda só os transversais.
- Componentes acima de ~150 linhas devem ser divididos.

## 8. Mapa de rotas

| Rota | Guard | Mobile | Tablet/Desktop |
|---|---|---|---|
| `/welcome` | `RedirectIfAuthed` | Landing + Continue with Google / Facebook / Email | Card centralizado |
| `/signin`, `/signup` | `RedirectIfAuthed` | Formulário email + senha | Card centralizado |
| `/terms`, `/privacy` | — | Termos de Uso / Política de Privacidade | Página de leitura |
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

Passos do onboarding: `welcome` (inclui o aceite dos termos), `native-language`, `receive-language`, `profile`, `discover`.
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

### 9.1 Welcome / login

Logo TENNO TALK, a proposta em uma frase ("Talk to anyone. In your own language.") e uma animação curta de uma mensagem sendo "recebida" em outro idioma. Opções de entrada:

- **Continue with Google**
- **Continue with Facebook**
- **Continue with email**: `/signin` (email + senha) ou `/signup` (email + senha + confirmação)

Abaixo dos botões fica o texto "By continuing you agree to our Terms of Use and Privacy Policy", com links para `/terms` e `/privacy`. O aceite formal acontece no primeiro passo do onboarding (§9.2).

No MVP tudo é simulado pelo `authService` mock: os botões sociais criam uma conta nova que passa pelo onboarding. Em desenvolvimento há também **contas demo** (Rafael · pt-BR, Linh · vi-VN), já onboardadas. Trocar de conta permite ver a mesma conversa pelos dois lados. Quando o backend existir, os botões sociais fazem redirect de página inteira para o OAuth2 do backend (§30).

### 9.2 Onboarding

Stepper com 5 passos. Progresso no topo, voltar/continuar embaixo (no mobile, fixos acima da safe area).

1. **Welcome & terms:** explica a ideia com um exemplo visual (mensagem PT → VI) e exige o aceite dos **Termos de Uso e da Política de Privacidade** (checkbox obrigatório, com links). O texto informa de forma clara que as mensagens são traduzidas por IA de terceiros. Sem aceite não há como continuar, e o aceite é gravado com a versão dos documentos (`profileService.acceptTerms`).
2. **Native language:** **pré-selecionado a partir do idioma do sistema** (`navigator.languages`, mapeado para o catálogo por `detectSystemLanguage()` em `lib/languages.ts`), com a nota "Detected from your device". É o idioma em que a pessoa escreve, e serve como origem das traduções (não há detecção automática por mensagem). `LanguagePicker` com busca, nome nativo em destaque ("Tiếng Việt") e nome em inglês secundário. Bandeira só como acessório, e por variante regional (pt-BR 🇧🇷, pt-PT 🇵🇹), porque bandeira não é idioma.
3. **Receive language:** pré-selecionado com o idioma nativo e texto explicando "Messages from others will be translated to this language". O usuário pode escolher outro.
4. **Create profile:** nome, username (validação de formato + disponibilidade mock com debounce), avatar (upload local com preview e crop circular simples), bio opcional, país.
5. **Discover people:** 4 a 6 sugestões (`PersonCard` compacto) com Follow / Message, e "Start chatting" ao final.

O rascunho fica em `onboardingDraftStore` (Zustand persistido em `sessionStorage`), para sobreviver a um reload. O submit final chama `profileService.completeOnboarding()` e invalida `me`.

### 9.3 Chats (home)

- Header: título "Chats" (mobile) e botão "New chat" (abre busca de pessoas).
- **StoriesTray** horizontal, com o próprio avatar e "+" no início.
- Busca (filtra localmente por nome/username; busca remota no futuro).
- Filtros: **All / Unread** (o filtro **Groups** entra junto com os grupos, no pós-MVP).
- Lista com: avatar (com dot online), nome, @username opcional (só quando há homônimos ou em grupos), preview da última mensagem **já na forma de exibição do usuário** (traduzida ou original, conforme a preferência; "You: …" para as próprias), horário relativo, ticks da última mensagem própria, badge de não lidas, ícone de silenciado e "typing…" substituindo o preview.
- Empty: "No conversations yet — Find someone from another country and start talking." com CTA para Discover.
- Desktop: sem conversa selecionada, a coluna central mostra um estado vazio leve.

### 9.4 Conversa

- **Header:** voltar (mobile), avatar e nome (clicáveis → perfil no SidePanel), status (online / "last seen 5 min ago" / "typing…"), botão de chamada desabilitado com tooltip "Coming soon", menu (View profile, Search in chat (futuro), Mute, Clear history (futuro), Block (futuro)).
- **Lista de mensagens:** fundo `chat-bg`, divisores de dia ("Today", "Yesterday", data), grupos por remetente, avatar só na última mensagem do grupo recebido (em grupos), indicador de digitação, botão "scroll to bottom" com contador de novas, carregamento de mensagens antigas ao chegar no topo.
- **Composer fixo:** emoji, anexar (imagem/vídeo; arquivo no futuro), textarea com auto-resize (até 6 linhas), microfone desabilitado ("Voice messages coming soon") quando vazio e **send** quando há texto. Reply aparece como uma barra acima do composer. O draft é salvo por conversa.
- **Ações por mensagem:** Reply, React, Copy, Forward, Show original / Show translation, Learning (se ativo). **Editar e excluir estão fora do escopo** por enquanto e não aparecem no menu. Desktop: context menu + botão "⋯" em hover/foco. Mobile: long-press → Drawer.

### 9.5 Discover

Feed vertical de posts estilo "For You" (um post por tela, `scroll-snap`), ordenado pelo algoritmo de descoberta (§37). Sem filtros: idioma, país e interesses entram no ranking. Ações iguais às do Feed, mais "Not interested" e "Hide posts from @x". Paginação infinita com prefetch. A grade de `PersonCard` saiu do Discover (revisto em 2026-10-05); pessoas continuam na busca e no onboarding.

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
| **Account** | Profile (atalho para edit), Username, Email, Password, Connected accounts (Google / Facebook), Terms & Privacy (versão aceita), Delete account (antes do lançamento público, LGPD) |
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
   ├─ BubbleMeta               # hora · DeliveryTicks · TranslationStatusHint
   └─ ReactionChips?
```

- `TranslatedText` recebe o resultado de `useMessageTranslation(message)` e renderiza `primary` e, se houver, `secondary` com rótulo "Original". Cada bloco leva `lang` e `dir="auto"`.
- O `MessageBubble` não busca dados nem conhece serviços. As ações vêm de um `MessageActionsProvider` no nível da `MessageList` (reply, react, forward…), sem prop drilling.
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
  // Sem editedAt/deletedAt: edição e exclusão estão fora do escopo (§34).
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

**IDs:** sempre strings estáveis. Nunca índices de array como `key` ou id. Mocks usam ids legíveis e fixos (`usr_linh`, `conv_rafael_linh`, `msg_lc_0001`). Ids criados no cliente usam `crypto.randomUUID()`.

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
| `failed` | ícone de alerta + "Tap to retry" / Discard (descarta a mensagem que não chegou a ser enviada) |

`delivered` e `read` chegam por realtime (`message.delivered`, `message.read`). No backend futuro eles são derivados dos cursores `last_delivered_message_id` / `last_read_message_id` de cada membro.

O idioma do original é o **idioma nativo do remetente** (`me.nativeLanguage`), pré-selecionado no onboarding a partir do idioma do sistema e editável em Settings. Não há detecção automática por mensagem (decisão de §34; limitação em R17).

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
| Edit / Delete | Fora do escopo por enquanto (§34). Quando entrarem, a edição cria uma revisão nova e o original continua imutável (§27). |
| Retry (falha) | Reenvia com o **mesmo** `clientId` (idempotente). |

## 14. Fluxo de tradução

### 14.1 Responsabilidades

- **Backend (futuro):** traduz com contexto (Claude/ChatGPT, §28), versiona, persiste e emite eventos.
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
- Tradução em espera (ex.: as duas IAs aguardando reautenticação, §28.3): a mensagem já foi entregue e aparece no original com o hint "translating". Depois de ~2 minutos, o hint vira "Translation delayed", sem tom de erro. Quando a tradução chega, ela substitui o original normalmente.
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
  getOrCreateDirectConversation(userId: string): Promise<Conversation>;
}

export const chatService: ChatService = mockChatService;
```

Os hooks chamam `chatService.getConversations()` dentro de `queryFn`; nenhum componente chama serviço diretamente. Na Phase 8, a última linha passa a escolher `httpChatService` (backend Java, §25) via `env.ts`, **sem tocar em componentes nem hooks**. Não criamos stubs HTTP antes da hora.

### 16.2 Banco mock

- `mock/db.ts`: store em memória com coleções (`users`, `conversations`, `messages`, `posts`…), semeado a partir de `mock/seed/`.
- **IDs estáveis e legíveis** no seed. Novos registros usam `crypto.randomUUID()`.
- Persistência em `localStorage` (`tenno.mockdb.v1`), para que mensagens enviadas, follows e preferências sobrevivam ao reload. A versão na chave permite resetar ao mudar o seed.
- Settings → (dev) "Reset demo data".
- **Duas abas = dois processos.** O localStorage chega às outras abas de forma assíncrona e pode perder para o BroadcastChannel. Por isso: (1) cada escrita incrementa uma revisão (`tenno.mockdb.rev`), e um evento recebido espera, em ordem, até a aba enxergar a revisão em que foi publicado (ou 1 s); (2) `update()` usa concorrência otimista (refaz a mudança sobre dados novos se outra aba escreveu no meio); (3) leituras que não mudam nada não escrevem, então uma aba com visão atrasada não sobrescreve as outras. Sem isso, a demo a dois perdia mensagens e traduções de vez em quando.
- O mock **simula a projeção do servidor**: guarda N traduções por mensagem e devolve só a do idioma de recebimento que o usuário logado tinha quando a mensagem foi enviada.

### 16.3 Realismo

- `latency.ts`: atraso aleatório entre 150 e 600ms por chamada. Taxa de falha configurável via `localStorage`/devtools: padrão 0% para chamadas comuns, ~10% para traduções (exercita o retry).
- `mockTranslator.ts`: dicionário de frases do seed nas combinações pt-BR ↔ vi-VN ↔ en-US ↔ es-ES (inclui as do briefing: "Estou com saudade de você." ↔ "Em nhớ anh."). Frases desconhecidas recebem uma pseudo-tradução marcada (ex.: `«vi» texto`) para ficar claro que é mock. Em ~20% das traduções, uma versão 2 "melhorada" chega alguns segundos depois.
- `autoResponder.ts`: depois de um envio, o contato mock passa por sent → delivered (1s) → read (2–4s, se "online"), emite `typing.started` e responde no idioma dele com uma frase do roteiro. Tudo via `mockRealtimeClient`, exercitando o mesmo caminho do realtime real.
- Contas demo: **Rafael** (pt-BR, Brasil), **Linh** (vi-VN, Vietnã), além de ~10 pessoas para Discover (es, en, ja, fr, ar…, incluindo um idioma RTL para testar layout).

## 17. Abstração de realtime

```ts
// services/realtime/realtimeClient.ts
export interface RealtimeEventMap {
  "message.created":      { message: Message };
  "message.updated":      { message: Message };
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
- Nenhum detalhe de transporte vaza para fora do adapter. O adapter real é o `wsRealtimeClient` (WebSocket do backend Java, §26).

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
| Conversa nova | Say hi to Linh 👋 | Write in your language — Linh will read it in Vietnamese. |
| Discover sem resultado | No one found | Try another language or country. |
| Feed | No posts yet | Share your first moment. → Create |
| Perfil sem posts | No posts yet | (próprio) Share your first moment. |
| Notifications | Nothing new | When someone likes or follows you, you'll see it here. |

## 20. Acessibilidade

- Componentes Radix (via shadcn) cuidam de foco, `aria-*` e teclado em menus, dialogs e sheets.
- **Todo botão de ícone tem `aria-label`** (com Tooltip no desktop).
- Inputs com `<Label htmlFor>` (o `Form` do shadcn faz a associação); erros via `aria-describedby`.
- Lista de mensagens com `role="log"` e `aria-live="polite"`; cada mensagem tem um rótulo acessível ("Linh, 09:41: …").
- **`lang` em cada bloco de texto de conteúdo** (mensagens, legendas, nomes de idioma) e `dir="auto"`.
- Teclado:
  - `Enter` envia, `Shift+Enter` quebra linha;
  - `Esc` fecha painel/drawer e cancela reply;
  - `Ctrl/Cmd+K` foca a busca de conversas;
  - `↑`/`↓` navegam na lista de conversas;
  - setas e `Esc` no story viewer;
  - ações de mensagem acessíveis por foco (botão "⋯") e pela tecla de menu de contexto.
- Contraste mínimo AA nos dois temas. **Auditado com axe na Phase 10** (`e2e/a11y.spec.ts`, WCAG 2.1 AA, 8 telas × 2 temas × desktop/celular, zero violações sérias ou críticas). O que a auditoria corrigiu: `--muted-foreground` mais escuro no claro (4,4:1 sobre o fundo do chat) e mais claro no escuro (4,1:1 sobre a linha selecionada); controles "em breve" viraram botões com `aria-disabled` (focáveis, com tooltip) em vez de `<span aria-label>`; input de arquivo do composer rotulado; combobox de país associado ao rótulo; rótulo do próprio story ("Open your stories").
- Imagens com `alt` (avatar: nome da pessoa; mídia: `alt` do upload ou descrição genérica).
- Respeito a `prefers-reduced-motion` e `prefers-reduced-transparency`.
- Alvos de toque ≥ 44px.

## 21. Internacionalização da interface

Há três conceitos distintos de idioma, que não devem ser confundidos no código:

| Conceito | Campo | Afeta |
|---|---|---|
| Idioma nativo | `profile.nativeLanguage` | Idioma em que o usuário escreve e origem das traduções; pré-selecionado a partir do idioma do sistema; mostrado no perfil. |
| Idioma de recebimento | `preferences.translation.receivingLanguage` | Para qual idioma o **backend** traduz o conteúdo dos outros. Uma troca vale **só para as mensagens que chegarem depois dela** (abaixo). |
| Idioma da interface | `preferences.interfaceLanguage` | Textos de botões e menus (i18next) e formatação de datas. |

- **Trocar o idioma de recebimento não retraduz o passado** (decisão de 2026-10-04). Cada mensagem de chat é traduzida uma vez, no envio, para o idioma de recebimento que cada membro tinha **naquele momento**, e é sempre mostrada nesse idioma. As mensagens anteriores à troca continuam no idioma antigo, e nenhuma chamada à IA é feita por abrir uma conversa ou rolar o histórico. O servidor guarda as trocas em `receiving_language_history (user_id, language, since)`, e a projeção usa o idioma vigente em `message.created_at`. A mensagem sem tradução gravada para esse idioma (anomalia de dados antigos) aparece só no original. O "Retry" de uma tradução que falhou usa o mesmo idioma da época. Posts, comentários e stories seguem sob demanda (§28.3, custo).
- i18next configurado na Phase 1 com namespace por feature e **apenas `en`** inicialmente. Todas as strings de UI passam por `t()` desde o início, porque adicionar i18n depois é caro.
- O seletor de idioma da interface aparece em Settings já no MVP (com `en` e, possivelmente, `pt-BR`).
- Os nomes de idiomas usam `Intl.DisplayNames`, com o catálogo de `lib/languages.ts` como fallback.

## 22. Performance

- **Code splitting:** páginas com `React.lazy`. StoryViewer, emoji picker, CreatePost e LearningPanel são carregados sob demanda. O **shell logado** (chat, realtime, navegação) também é lazy, para o welcome não baixá-lo; o **Welcome é eager** (a primeira tela de todo visitante, sem uma ida e volta a mais).
- **Fonte de dados em tempo de build:** `__USE_HTTP__` (define do Vite) é um literal, então o bundler descarta a implementação não usada; com `VITE_DATA_SOURCE=http`, os módulos de mock são marcados sem efeitos colaterais e saem do build.
- **Boot:** um splash estático em `index.html` pinta antes do JS. Visitantes que nunca entraram neste navegador (`tenno.has-session`, só uma dica, não credencial) veem `/welcome`, `/signin` e `/signup` sem esperar a checagem de sessão.
- **Imagens:** `loading="lazy"`, `decoding="async"`, `width`/`height` ou `aspect-ratio` reservados (sem layout shift), thumbnails em grids.
- **Listas:** infinite scroll no feed, no Discover e nas mensagens antigas.
- **Virtualização:** medida na Phase 10 e **adiada**. Com 330 mensagens renderizadas e CPU 4× mais lenta, a rolagem fica a 60 fps (p95 17 ms por quadro). O gargalo real era outro: `retry`/`discard` de `useSendMessage` eram funções novas a cada render e estão no contexto das ações, então cada envio re-renderizava as 330 bolhas seis vezes (1.992 renders). Com `useCallback`, são 6 renders e a mensagem aparece em ~0,4 s (era 1,35 s). Um teste garante a estabilidade. Reavaliar react-virtuoso se conversas passarem de ~1.000 mensagens carregadas.
- **Re-render:** seletores granulares no Zustand; `React.memo` só em `MessageBubble` e `ConversationListItem`; `upsertMessage` preserva a identidade dos objetos.
- **Sem otimização prematura:** nada de `useMemo`/`useCallback` por reflexo, só quando há custo medido ou dependência de memo.
- **Orçamento:** JS + CSS do primeiro carregamento < 200KB gzip. **Medido:** 182,6 KB (build `http`). Lighthouse em `/welcome` atrás do Caddy (HTTP/2, celular simulado): Performance 94–97, Accessibility 100, Best Practices 100, SEO 100; LCP 2,6 s. No `vite preview` (HTTP/1.1) a nota cai para 88 por causa do limite de conexões; a produção usa HTTP/2 e HTTP/3.

## 23. Testes

| Tipo | Ferramenta | Alvo |
|---|---|---|
| Unitário | Vitest | `groupMessages`, `resolveMessageDisplay`, `upsertMessage`/`patchTranslation` (dedupe, versão), `conversationFilters`, formatação de datas, `mockTranslator` |
| Componente | Vitest + Testing Library | `MessageBubble` (3 modos × estados de tradução), `Composer` (Enter/Shift+Enter, reply), guards de rota, `LanguagePicker`, formulários de settings |
| Integração | Vitest + mocks reais | Fluxo enviar → otimista → sent → resposta automática |
| E2E | Playwright (`bun run e2e`, contra o mock) | Onboarding, chat entre duas contas em duas abas, modos de tradução, feed, stories, responsividade (desktop e celular) |
| A11y | axe (`e2e/a11y.spec.ts`) | 8 telas nos dois temas, desktop e celular |
| Pilha | Playwright (`bun run e2e:stack`) | Deploy real (Caddy + SPA + Java + Postgres): realtime por `wss://`, upload, CSP, cookie |
| Backend | JUnit + Testcontainers (`./mvnw test`) | 400+ testes: regras, todos os endpoints (matriz de segurança), WebSocket real, pipeline de tradução, OAuth, backups de dados (export) |

Detalhes e medições em `e2e/README.md`.

Regra: toda função pura de domínio nasce com teste.

## 24. Plano de implementação em fases

O detalhamento (checklist) está no [IMPLEMENTATION.md](IMPLEMENTATION.md).

| Fase | Entrega | Critério de conclusão (resumo) |
|---|---|---|
| **1. Foundation** | Migração para Vite SPA, tokens, layouts, roteamento, providers, tipos, mock db | `dev`/`build`/`lint`/`typecheck`/`test` verdes; navegação mobile/desktop com placeholders; tema sem flash |
| **2. Auth & onboarding** | Login simulado (Google/Facebook/email), termos, SessionGate, onboarding de 5 passos | Novo usuário aceita os termos, completa o onboarding e chega em `/chats`; sessão sobrevive ao reload |
| **3. Chat** | Lista, conversa, composer, envio otimista, realtime mock, auto-responder | Ciclo sending → sent → delivered → read visível; resposta automática chega; falha com retry |
| **4. Translation UX** | 3 modos, override por mensagem, estados, retry, versão, Learning Mode | Troca de modo reflete na hora; falha preserva o original; tradução melhorada substitui sem regressão |
| **5. Profiles, discovery & settings** | Perfil, edição, follow, Discover, Settings completas | **MVP completo** em 360/768/1024/1440px com a11y básica |
| **6. Feed** | Feed, create post, likes, comments, tradução de legendas | Post criado aparece no feed e no perfil; tradução respeita a preferência |
| **7. Stories, notifications & groups** | Tray, viewer, reply/reaction, notificações, grupos (máx. 1 criado por pessoa) | Viewer navegável por toque/teclado; badges atualizam; segundo grupo é bloqueado |
| **8. Backend integration** | Backend Java (Spring Boot + PostgreSQL), OAuth2, serviços HTTP, mídia em disco, worker de tradução (OpenAI/Anthropic via API), deploy na VPS | Mesmos fluxos contra backend real sem alterar componentes |
| **9. Realtime** | `wsRealtimeClient` + WebSocket do backend, presença, typing, recuperação | Duas contas conversam em tempo real em idiomas diferentes |
| **10. Production hardening** | Performance, a11y, e2e, moderação, observabilidade, deploy | Metas atingidas e pipeline verde |

---

# Parte II — Backend futuro

> Esta parte é direcional. Ela será detalhada depois que o frontend (Phases 1–7) estiver estável. Nada aqui deve ser implementado antes disso.
> As decisões de produto que a orientam estão em §34 (registradas em 2026-10-03).

## 25. Arquitetura de backend

**Stack:** Java 21 + Spring Boot 4.1 (Web MVC, Security, OAuth2 Client, WebSocket, Validation, JDBC), PostgreSQL 16, Flyway, Maven. O acesso a dados usa `JdbcClient` com **SQL explícito** em repositórios por módulo, sem JPA (decisão 11 do §34.1): as consultas de projeção (tradução por viewer, cursores, privacidade) ficam legíveis e testadas contra o Postgres real. Tudo roda numa **única VPS** junto com o frontend (§32).

```
Navegador (SPA)
   │ HTTPS /api/*, /oauth2/*        WSS /ws
   ▼                                  ▼
Caddy (TLS automático · serve o build do Vite · proxy reverso)
   │
   ▼
Backend Java (Spring Boot, monolito modular)
   ├─ auth          Spring Security: OAuth2 (Google, Facebook) + email/senha; sessão em cookie
   ├─ users         perfis, preferências, termos aceitos
   ├─ chat          conversas, mensagens, reações, leitura
   ├─ translation   fila em tabela + workers → Translator
   │                  ├─ OpenAiTranslator     (API da OpenAI, principal)
   │                  └─ AnthropicTranslator  (API da Anthropic, reserva)
   ├─ realtime      WebSocket com os eventos do RealtimeEventMap
   ├─ media         MediaStorage → disco da VPS
   └─ feed · stories · notifications (fases 6–7)
   ▼
PostgreSQL (volume)                      /data/media (volume)
```

- **Monolito modular:** pacotes por domínio, espelhando as features do frontend. Um único deployable basta para a escala atual (duas pessoas) e para a VPS.
- **Repositório:** frontend na raiz, backend em `backend/` e infraestrutura em `deploy/` (monorepo).
- **Contrato da API:** REST + JSON. Os DTOs espelham `src/types` (camelCase, datas ISO-8601 em UTC). O OpenAPI é gerado pelo springdoc, e na Phase 8 os tipos do frontend são conferidos contra ele (openapi-typescript). Erros seguem o formato RFC 9457 (Problem Details), que o `toAppError` do frontend converte em `AppError`.
- **Responsabilidades do backend:** autorização, tradução, proteção de credenciais, persistência, contexto da conversa, rate limiting e moderação futura.
- **No frontend:** cada serviço ganha uma implementação HTTP em `src/services/http/` (`httpChatService` etc., `fetch` same-origin + header CSRF), selecionada por `VITE_DATA_SOURCE=http` em `lib/env.ts`. Componentes e hooks não mudam. Mídia local (`blob:`/`data:`) é enviada para `POST /api/media` antes da mensagem, do post, do story ou do avatar.

### 25.1 Mapa da API

| Área | Endpoints |
|---|---|
| Auth | `GET /api/auth/session` · `POST /api/auth/signup` · `POST /api/auth/signin` · `POST /api/auth/signout` · `POST /api/auth/password` · `GET /oauth2/authorization/{google\|facebook}` |
| Eu | `GET /api/me` · `POST /api/me/terms` · `POST /api/me/onboarding` · `PUT /api/me/profile` · `PATCH /api/me/preferences` · `GET /api/me/blocked` · `DELETE /api/me` |
| Pessoas | `GET /api/usernames/{u}/availability` · `GET /api/profiles/{username}` · `PUT\|DELETE /api/profiles/{id}/follow` · `PUT\|DELETE /api/profiles/{id}/block` · `GET /api/people/suggestions` · `GET /api/people/search` |
| Discover | `GET /api/discover` (posts ranqueados, §37) · `POST /api/discover/events` · `DELETE /api/discover/hidden/{posts\|authors}/{id}` |
| Chat | `GET /api/conversations` · `GET /api/conversations/{id}` · `GET\|POST /api/conversations/{id}/messages` · `POST /api/conversations/{id}/read` · `PUT /api/conversations/{id}/mute` · `POST /api/conversations/direct` · `POST /api/conversations/groups` · `POST /api/messages/{id}/reactions` · `POST /api/messages/{id}/forward` |
| Tradução | `POST /api/messages/{id}/translation/retry` · `GET /api/messages/{id}/insight?lang=` · `POST /api/translations/{post\|comment\|story}/{id}?lang=` |
| Feed | `GET /api/feed` · `GET /api/users/{id}/posts` · `GET\|POST /api/posts…` · `PUT\|DELETE /api/posts/{id}/like` · `GET\|POST /api/posts/{id}/comments` |
| Stories | `GET /api/stories/tray` · `POST /api/stories` · `PUT /api/stories/{id}/view` · `POST /api/stories/{id}/reactions` · `POST /api/stories/{id}/replies` |
| Notificações | `GET /api/notifications` · `GET /api/notifications/unread-count` · `POST /api/notifications/read-all` |
| Mídia | `POST /api/media` (multipart `file`) · `GET /api/media/{id}` |
| Admin | `GET /api/admin/ai` · `POST /api/admin/ai/{provider}/check` |
| Realtime | `GET /ws` (WebSocket, mesma sessão) |

IDs malformados respondem 404, como IDs inexistentes. O OpenAPI fica em `/api/openapi`.

## 26. Realtime

- **Spring WebSocket** em `/ws` (sem STOMP), autenticado pela mesma sessão (cookie) no handshake.
- Mensagens JSON `{ "type": "message.created", "payload": { … } }`, exatamente o `RealtimeEventMap` do §17. O adapter do frontend é o `wsRealtimeClient`, que implementa `RealtimeClient`.
- O servidor mantém em memória as conexões de cada usuário (uma instância só; se um dia escalar horizontalmente, entra Redis pub/sub) e envia os eventos **para cada membro individualmente**, já com a tradução projetada no idioma dele.
- **Presença:** conexão aberta = online; `lastSeenAt` gravado ao desconectar.
- **Typing:** cliente → servidor → outro membro, sem persistir.
- **Heartbeat de aplicação:** o navegador não envia frames de ping do WebSocket, então o cliente manda `{"type":"ping"}` a cada 25s e o servidor responde `{"type":"pong"}`. Sem pong em 10s, a conexão é considerada morta.
- **Reconexão (`wsRealtimeClient`):** backoff exponencial com jitter (0,5–1× de min(30s, 1s·2ⁿ)). O evento `offline` do navegador derruba a conexão na hora, e `online` ou a volta à aba reconectam sem esperar o backoff. Um socket morto é **abandonado imediatamente**: numa rede caída, `close()` só dispara `close` depois que o handshake expira, e esperar por ele deixaria o app offline em silêncio.
- **Recuperação de lacunas:** quando o status volta para `open`, a bridge invalida as queries do chat e das notificações (refetch). Isso cobre o que se perdeu sem um endpoint `?after=`; ele pode entrar se o volume crescer. A presença ao vivo é zerada ao desconectar, e os dados refeitos voltam a valer.
- **Evento durante o carregamento:** se um evento chega enquanto a conversa ainda está carregando, a resposta em voo (anterior ao evento) o apagaria. A bridge então espera o carregamento terminar e busca de novo, uma vez por conversa (`refetchIfLoading`); o React Query não cancela um primeiro carregamento ao invalidar.
- **Ordem dos eventos:** `message.created` vai para todos os membros **antes** de qualquer `message.delivered`, para o remetente nunca receber recibo de uma mensagem que ainda não conhece.
- **UI:** o título "Chats" vira "Connecting…" durante a reconexão (na primeira conexão, não).
- A sessão fica no Postgres, então reiniciar o backend não desloga ninguém: os clientes reconectam sozinhos.

## 27. Banco de dados

PostgreSQL com migrations Flyway. As sessões HTTP ficam nas tabelas do Spring Session JDBC.

| Tabela | Colunas-chave |
|---|---|
| `users` | `id (uuid)`, `role (user \| admin)`, `email (unique, nullable)`, `email_verified_at`, `password_hash (argon2id, nullable)`, `username (citext unique)`, `display_name`, `avatar_media_id`, `bio`, `country`, `native_language`, `onboarding_completed_at`, `created_at` |
| `oauth_accounts` | `user_id`, `provider (google \| facebook)`, `provider_user_id`, `email` — único `(provider, provider_user_id)` |
| `terms_acceptances` | `user_id`, `terms_version`, `privacy_version`, `accepted_at`, `ip`, `user_agent` |
| `user_preferences` | `user_id`, `receiving_language`, `interface_language`, `display_mode`, `auto_translate_posts`, `auto_translate_stories`, `learning_mode`, privacidade e notificações |
| `receiving_language_history` | `user_id`, `language`, `since` — PK `(user_id, since)`; uma linha por troca do idioma de recebimento (§21: a tradução de cada mensagem usa o idioma vigente no envio) |
| `user_learning_languages` | `user_id`, `language` |
| `languages` | `code (pk)`, `english_name`, `native_name`, `dir`, `enabled` |
| `conversations` | `id`, `kind (direct \| group)`, `title`, `avatar_media_id`, `created_by`, `direct_key (unique: par ordenado de user ids)`, `updated_at` — **índice único parcial `(created_by) WHERE kind = 'group'`**: no máximo 1 grupo criado por pessoa |
| `conversation_members` | `conversation_id`, `user_id`, `role`, `last_delivered_message_id`, `last_read_message_id`, `muted_until`, `joined_at` |
| `messages` | `id`, `conversation_id`, `sender_id`, `client_id (unique por sender)`, `type`, `original_text`, `original_language`, `reply_to_id`, `created_at` |
| `message_translations` | `message_id`, `target_language`, `text`, `literal_text`, `status`, `version`, `provider`, `attempts`, `error`, `updated_at` — PK `(message_id, target_language)` |
| `translation_jobs` | `id`, `kind`, `ref_id`, `target_language`, `status (pending \| running \| waiting_provider \| done \| failed)`, `run_after`, `attempts`, `locked_at`, `created_at` — fila em tabela (`SELECT … FOR UPDATE SKIP LOCKED`) |
| `ai_provider_status` | `provider (openai \| anthropic)`, `state (ok \| invalid_key \| cooling_down)`, `until`, `last_error`, `checked_at` |
| `media` | `id`, `owner_id`, `kind`, `mime`, `size_bytes`, `width`, `height`, `duration_ms`, `storage_path`, `created_at` |
| `message_media` | `message_id`, `media_id`, `position` |
| `message_reactions` | `message_id`, `user_id`, `emoji` |
| `posts`, `post_media`, `comments`, `likes`, `content_translations`, `stories`, `story_views`, `follows`, `blocks`, `reports`, `notifications` | Conforme o modelo de domínio (§12); entram nas fases 6–7 |
| `interaction_events`, `post_stats`, `post_topics`, `user_affinities`, `hidden_posts`, `hidden_authors`, `user_neighbors`, `discover_sessions`, `classification_jobs` | Algoritmo de descoberta (§37.5) |

Observações:

- **Sem edição e sem exclusão de mensagens por enquanto.** `original_text` nunca recebe UPDATE (garantido pela camada de aplicação). Quando a edição entrar, ela cria uma tabela `message_revisions`, em que o original de cada revisão é imutável e as traduções são por revisão.
- Os ticks de entrega e leitura são **derivados** dos cursores dos membros, e não gravados por mensagem.
- A exclusão da **conta** (direito do titular na LGPD) é diferente de excluir mensagens e precisa existir antes do lançamento público (§31).
- Índices: `messages(conversation_id, created_at desc, id)`, `message_translations(message_id, target_language)`, `translation_jobs(status, run_after)`, `follows` nos dois sentidos.

## 28. IA e pipeline de tradução

### 28.1 Provedores: OpenAI e Anthropic pelas APIs (2026-10-04)

Decisão de produto (2026-10-04): usar as **APIs oficiais**, cobradas por token, com chave de API. Até essa data o backend executava as CLIs dos planos de assinatura (`codex exec` e `claude -p`). Elas exigiam Node na VPS, um login que expirava e reautenticação assistida, além de termos de uso pensados para uso pessoal (R14), e foram removidas.

| Ordem | Provedor | SDK (Java) | Modelo padrão | Variáveis |
|---|---|---|---|---|
| **1. Principal** | OpenAI | `com.openai:openai-java` (Chat Completions) | `gpt-4.1-mini` | `OPENAI_API_KEY`, `OPENAI_TRANSLATION_MODEL` |
| **2. Reserva** | Anthropic | `com.anthropic:anthropic-java` (Messages) | `claude-haiku-4-5` | `ANTHROPIC_API_KEY`, `ANTHROPIC_TRANSLATION_MODEL` |

```java
public interface Translator {
    String id();                                  // "openai", "anthropic"
    TranslationResult translate(TranslationRequest request) throws TranslatorException;
    void check() throws TranslatorException;      // consulta o modelo, sem gastar tokens
}
```

- `FallbackTranslator` compõe os dois: **a OpenAI é a principal** e a **Anthropic só é usada quando a OpenAI falha** (chave, limite, timeout ou resposta inválida). As regras de falha estão em §28.3.
- **Provedor opcional:** cada provedor só é registrado quando a chave dele está definida, como no login social (§30). Sem nenhuma chave, o servidor sobe e as traduções esperam em `waiting_provider`.
- **Chamada:** o prompt é dividido em `system` (instruções fixas) e `user` (idiomas, contexto e mensagem). A resposta usa **saída estruturada** com o schema `{natural, literal}`: `json_schema` strict na OpenAI e `output_config.format` na Anthropic. Não há cache de prompt, porque o `system` (~200 tokens) fica abaixo do mínimo cacheável. O teto de saída é `tenno.ai.max-output-tokens` (4096).
- **Retentativas:** os SDKs rodam com `maxRetries(0)` e timeout `tenno.translation.timeout`. Quem tenta de novo é o `FallbackTranslator`, que fica com a política inteira em um lugar só.
- **Custo:** cada chamada registra no log o provedor, o modelo e os tokens de entrada e saída. Há limite de gasto configurado nos consoles da OpenAI e da Anthropic.
- **Chaves:** ficam no **Infisical** (projeto `tenno-talk`, env `prod`) e entram no processo por `infisical run` no systemd (§32.1). Elas nunca são gravadas em disco na VPS e nunca vão para o frontend.
- **Privacidade:** as mensagens são enviadas à OpenAI e à Anthropic pelas APIs. Pelos termos das APIs, os dados não são usados para treinar modelos, e os provedores podem retê-los por tempo limitado para monitorar abuso. Isso consta nos Termos e na Política de Privacidade.

### 28.2 Pipeline

```
POST /api/conversations/{id}/messages
  1. autentica; valida membership, bloqueio e rate limit
  2. insere a mensagem (idempotente por client_id);
     original_language = idioma nativo do remetente (definido pelo sistema dele)
  3. alvos = idiomas de recebimento dos membros − original_language
  4. insere message_translations(status='pending') + translation_jobs; responde 201
  5. WebSocket: message.created para cada membro, com a tradução dele em 'pending'
Worker (pool pequeno)
  6. pega um job (SKIP LOCKED), marca 'translating' → translation.updated
  7. monta o prompt: instruções de tradução natural (sentido, não palavra por palavra),
     idioma de origem provável, últimas N mensagens da conversa (originais), mensagem-alvo;
     pede JSON { natural, literal }
  8. OpenAI (principal) → em falha, Anthropic (reserva) — regras em §28.3
  9. valida o JSON; grava text/literal/version/provider → translation.updated
 10. falha transitória nos dois → retry com backoff (até 3) → 'failed' + retry manual pelo usuário
     chave/cota indisponível nos dois → job em 'waiting_provider': não conta tentativa e nunca vira 'failed'
```

### 28.3 Falhas de chave e de cota: nada se perde

**Garantia:** uma mensagem **nunca se perde** por falha da IA. Ela é gravada no banco (passo 2) e entregue ao destinatário no original **antes** de qualquer chamada à IA. A tradução é um job separado, que só sai da fila quando é concluída. Se a IA cair no meio, o job continua lá e é retomado.

Cada `Translator` classifica a falha a partir das exceções tipadas do SDK (`ApiErrors`), e o `FallbackTranslator` reage:

| Falha na OpenAI | Classificação | O que acontece |
|---|---|---|
| **Chave** (401, 403) | `AUTH` | A OpenAI vai para `invalid_key` e o administrador é avisado. O job vai **na hora** para a Anthropic. |
| **Rate limit** (429) | `QUOTA` | A OpenAI vai para `cooling_down` pelo tempo do `retry-after` (padrão de 60s). Os jobs vão para a Anthropic. |
| **Créditos esgotados** (OpenAI 429 `insufficient_quota`, Anthropic 402 `billing_error`) | `QUOTA` | `cooling_down` por `tenno.translation.cooldown-default` (15 min), e o administrador é avisado. |
| **Transitória** (5xx, 529 overloaded, rede, timeout, recusa, resposta inválida) | `TRANSIENT` | Mais uma tentativa na OpenAI; depois, Anthropic. |
| **Requisição inválida** (400, 404, 422: modelo errado, por exemplo) | `TRANSIENT` | Igual à transitória, mas registrada como erro. O job falha depois de 3 tentativas, e o `last_error` aparece no painel. |

Enquanto a OpenAI está indisponível, os jobs novos vão direto para a Anthropic, sem esperar timeout. Quando a OpenAI volta a `ok`, ela reassume como principal.

**Os dois indisponíveis** (ex.: as duas chaves inválidas, ou a OpenAI sem chave e a Anthropic em rate limit): o job fica em `waiting_provider`. Ele **não gasta tentativas e nunca vira `failed`**. Assim que qualquer provedor volta, os jobs em espera são reprocessados em ordem de chegada e as traduções chegam aos usuários por `translation.updated`. Do lado do usuário, a conversa continua funcionando no original (§14.5).

**Chave inválida:** não existe login a refazer. O administrador troca a chave no Infisical e reinicia o backend (`systemctl restart tenno-talk`). Na subida, o provedor é verificado e volta a `ok`. **Check now** no painel faz a mesma verificação sem reiniciar: `GET /v1/models/{model}` nos dois provedores, sem gastar tokens. Ela também confirma que o ID do modelo configurado existe.

**Painel de administração** (`/admin/ai`, só para `role = admin`): mostra o estado de cada provedor (`ok`, `invalid_key`, `cooling_down` ou `not_configured`, quando falta a chave), o modelo em uso, a última falha e o tamanho da fila, além do botão **Check now**.

**Saúde:** os cooldowns vencidos voltam sozinhos a `ok` (`recoverExpired`, a cada 30s) e acordam os jobs em espera.

- **Detecção de idioma:** não existe detecção no servidor. O idioma do original é o **idioma nativo do remetente**, pré-selecionado no onboarding a partir do idioma do sistema (`navigator.languages`) e editável em Settings. O prompt informa esse idioma como "provável", então o modelo ainda traduz corretamente se a pessoa escrever em outra língua. Limitação aceita: se o idioma declarado for igual ao do destinatário, a mensagem é marcada como `not_needed` e não é traduzida.
- **Learning Mode:** o `literal` já vem do passo 7; explicação e vocabulário são gerados sob demanda pelo mesmo pipeline.
- **Custo:** cobrado por token. Mitigação: modelos pequenos (`gpt-4.1-mini`, `claude-haiku-4-5`), cache por (mensagem, idioma), tradução de feed/stories só sob demanda, teto de saída, rate limit de tradução (§31), fila com backpressure e limite de gasto nos consoles.

## 29. Storage

- **Disco da VPS**, volume `/data/media`, atrás da interface `MediaStorage` (`LocalDiskMediaStorage`). S3 ou MinIO podem ser adicionados depois, sem mudar o resto.
- Upload multipart pelo backend (`POST /api/media`): validação do MIME real (Apache Tika), nome sanitizado e remoção de EXIF/geolocalização (JPEG e PNG são recodificados). Tipos com script (HTML, SVG, JS) são recusados, e downloads saem com `X-Content-Type-Options: nosniff`. Thumbnails e transcodificação de vídeo ficam para depois.
- Imagem que não pode ser decodificada é recusada (400): sem ler os pixels também não dá para tirar o EXIF, então ela nunca é guardada como veio.
- **Quem pode baixar:** o dono; membros da conversa onde o arquivo foi enviado; quem pode ver o post; quem pode ver o story enquanto ele está ativo; qualquer pessoa autenticada, se for avatar. Por isso o avatar só pode ser uma imagem **do próprio usuário** enviada por `POST /api/media` (`/api/media/{id}`). Uma URL externa ou o arquivo de outra pessoa é recusado; senão um arquivo privado poderia virar público.
- Leitura por `GET /api/media/{id}`, com checagem de permissão (membro da conversa, visibilidade do post) e suporte a `Range` (vídeo).
- **Sem limite de mídia no produto** (decisão). Ainda assim, um **teto técnico** configurável e alto (ex.: 500 MB por arquivo; o padrão do Spring é 1 MB) protege a VPS. Uso de disco monitorado (R15).

## 30. Autenticação

Tudo no **próprio backend Java** (Spring Security). Nenhum serviço externo de autenticação além dos provedores sociais.

- **Métodos:**
  - **Continue with Google** e **Continue with Facebook**: OAuth2 Authorization Code via `spring-boot-starter-oauth2-client`;
  - **email + senha**: argon2id, verificação de e-mail e redefinição de senha (exigem SMTP; ver §34).
- **Sessão:** cookie `SESSION` `HttpOnly; Secure; SameSite=Lax` com sessão no servidor (Spring Session JDBC), declarado explicitamente em `SessionCookieConfig` (as propriedades `server.servlet.session.cookie.*` não chegavam ao cookie do Spring Session no Boot 4). `tenno.cookie-secure=false` só em desenvolvimento local. SPA e API ficam no mesmo domínio (Caddy), então não há CORS e **nenhum token fica em `localStorage`**. CSRF via `CookieCsrfTokenRepository` (cookie `XSRF-TOKEN` + header `X-XSRF-TOKEN`).
- **Fluxo social:** SPA → `GET /oauth2/authorization/{google|facebook}` (redirect de página inteira) → provedor → `/login/oauth2/code/{provider}` → o backend cria ou vincula `users` + `oauth_accounts` → redireciona para `/onboarding/welcome` (conta nova) ou `/chats`.
- **Vinculação:** o mesmo e-mail verificado em Google, Facebook e senha resulta na mesma conta. O Facebook pode não retornar e-mail; nesse caso, a conta nasce sem e-mail. Um e-mail **não verificado** nunca vincula nem é gravado (testado em `OAuthAccountIT`).
- **Provedores opcionais:** cada provedor só é registrado quando `GOOGLE_CLIENT_ID`/`FACEBOOK_CLIENT_ID` e o segredo estão definidos (`OAuthClients`). Sem nenhum, não há login social e o servidor sobe normalmente (antes, um valor vazio no `.env` impedia o boot). `GET /api/auth/providers` diz quais botões o welcome mostra.
- **Termos de Uso e Política de Privacidade (LGPD):** o aceite é obrigatório na criação da conta, qualquer que seja o método, e acontece no **primeiro passo do onboarding**, antes de qualquer dado de perfil ser salvo. Ele fica registrado em `terms_acceptances` com a versão; uma nova versão exige novo aceite.
- **Frontend:** o `authService` real expõe `startOAuth(provider)`, `signInWithPassword`, `signUp`, `signOut` e `getSession` (`GET /api/auth/session`). Falha no login social volta para `/welcome?error=oauth`, que mostra o aviso.
- **Primeiro admin:** `UPDATE users SET role = 'admin' WHERE email = '…'` no Postgres; a role vale a partir do próximo login. O `sessionStore` continua sendo a única interface para a UI.
- **Produção:** o app do Facebook precisa de *App Review*, e o Google de tela de consentimento configurada (domínio verificado).

## 31. Segurança

- **O frontend nunca é fonte de autorização.** Os guards de rota são só UX.
- **Autorização no backend:** Spring Security + checagem de membership em todo acesso a conversa, mensagem e mídia (`ConversationAccessPolicy`). Sem RLS, então **todo endpoint tem teste de autorização**.
- **Validação:** Bean Validation nos DTOs; tamanho máximo do texto da mensagem (ex.: 4.000 caracteres).
- **Rate limit:** Bucket4j em memória (uma instância), por usuário autenticado ou por IP. Respostas 429 com `Retry-After` e `code: rate_limited`. Regras em `RateLimitRules` (por minuto): auth 10 · envio de mensagem/resposta a story 60 · upload 30 · tradução 60 · social (follow, block, like, comentário, reação) 120 · criação (post, story, conversa) 30 · admin 10. Leituras não têm limite. Bloqueio progressivo após falhas de login: depois.
- **"Quem pode me mandar mensagem / comentar":** `everyone`, `followers` ou `nobody`. `followers` significa **pessoas que eu sigo** (rótulo "People I follow"). "Pessoas que me seguem" não protegeria nada, porque qualquer um pode seguir.
- **Visibilidade:** perfil privado mostra posts e stories só a quem segue; bloqueio esconde conteúdo nos dois sentidos. A regra fica numa única função SQL (`Visibility.authorVisible`).
- **Grupos:** no máximo 1 criado por pessoa (índice único parcial + checagem no serviço).
- **Uploads:** MIME real, armazenamento fora da raiz web, servidos só por endpoint autorizado.
- **Block e report:** bloquear pelo perfil; denunciar pessoa, mensagem recebida ou post (`POST /api/reports`, motivos: spam, assédio, ódio, conteúdo sexual, violência, outro). Só se denuncia o que se pode ver; uma denúncia aberta por alvo e pessoa. Admins revisam em **Settings → Reports** (`/admin/reports`).
- **LGPD:**
  - os Termos e a Política informam que as mensagens são processadas pelas APIs de IA de terceiros (OpenAI e Anthropic) para tradução, além da base legal, retenção e direitos do titular;
  - acesso aos dados e **exclusão da conta**: implementados. **Download my data** (`GET /api/me/export`, JSON montado pelo Postgres, sem hash de senha nem dados privados de outras pessoas) e exclusão da conta (os arquivos saem do disco só depois do commit);
  - as APIs da OpenAI e da Anthropic não usam os dados enviados para treinar modelos (termos das APIs).
- **Segredos** (client secrets OAuth, chaves das APIs de IA, senha do banco) só no servidor. Na VPS compartilhada, as chaves de IA ficam no **Infisical** (projeto `tenno-talk`, env `prod`, machine identity própria, só de leitura) e entram na memória do processo por `infisical run`, sem ir para o disco (§32.1). No resto, `.env` fora do git (o `.gitignore` ignora qualquer `.env`, menos `.env.example`) e volumes protegidos.
- **IP real e limite por IP:** o backend usa o `X-Forwarded-For` que o Caddy define, e o Caddy substitui o valor enviado pelo cliente. A porta do backend nunca é publicada. Testado: forjar o cabeçalho através do Caddy não fura o limite de login. Sob carga (300 tentativas simultâneas do mesmo IP): 10 passam, 290 recebem 429.
- **Borda:** Caddy com HTTPS automático, HSTS, CSP (`connect-src` inclui `blob:` e `data:` porque a foto é lida da prévia local logo antes do upload; sem isso, nenhum upload funcionava em produção; `script-src 'self'`; por isso o script de tema é o arquivo `public/theme-init.js`, e não inline), `X-Frame-Options: DENY` e demais headers.
- **Testes de segurança:** `SecurityMatrixIT` descobre todos os endpoints do Spring MVC e verifica que cada um responde 401 sem sessão, 403 sem CSRF nas escritas e 403 nas rotas de admin para quem não é admin. Nunca usar `dangerouslySetInnerHTML` com conteúdo de usuário.
- **VPS:** acesso SSH só por chave, firewall (apenas 80/443/22), fail2ban, atualizações automáticas, Postgres sem porta exposta.
- **Backups:** `pg_dump` diário + cópia de `/data/media` para fora da VPS, com restauração testada.

## 32. Deploy (VPS)

Uma VPS com **Docker Compose** (sugestão mínima: 2 vCPU, 2 GB de RAM, por causa da JVM e do Postgres):

```yaml
services:
  web:       # Caddy com o build do Vite (deploy/Dockerfile.web): 80/443, TLS; proxy /api, /oauth2, /login/oauth2, /ws, /actuator/health → backend
  backend:   # Spring Boot (JRE 21) (backend/Dockerfile), usuário não-root; volume: media; OPENAI_API_KEY/ANTHROPIC_API_KEY do .env
  postgres:  # 16; volume pgdata; sem porta exposta
```

Arquivos: `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/Dockerfile.web`, `deploy/.env.example`, `backend/Dockerfile`, `docker-compose.dev.yml` (só o Postgres, para desenvolvimento) e `.github/workflows/ci.yml`.

- **Domínio único** (ex.: `tennotalk.app`): SPA e API na mesma origem.
- **Frontend:** `vite build` → `dist/` servido pelo Caddy, com fallback de SPA (`try_files {path} /index.html`) e cache imutável para assets com hash.
- **Backend:** imagem multi-stage (build Maven → JRE 21). Migrations Flyway no startup.
- **Configuração:** `.env` não versionado (banco, client ids/secrets OAuth, chaves das APIs de IA, URL pública, SMTP).
- **CI (GitHub Actions):** lint, typecheck, test e build do frontend (mock e http); `./mvnw test` do backend, que roda unitários **e** integração (`*IT`, Testcontainers).
- **CD:** workflow manual **Deploy** (`.github/workflows/deploy.yml`): SSH na VPS, `git checkout` da ref, `docker compose up -d --build` e espera o health. Passo a passo da VPS (hardening, login das IAs, admin, backups, monitoramento) em `deploy/VPS.md`.
- **Backups:** `deploy/backup.sh` (pg_dump custom + mídia, 14 dias, confere o dump) e `deploy/restore.sh`. **Restauração testada** na pilha de produção local: dados e fotos apagados voltaram, e o usuário restaurado entrou e viu a conversa com a foto.
- **PWA:** `manifest.webmanifest` com ícones (inclusive maskable) e `apple-touch-icon`: instalável na tela inicial. Sem service worker (offline não é objetivo).
- **Ícones (2026-10-04):** fonte em `favicon.png` na raiz, preservada fora dos arquivos públicos. `python3 scripts/generate_icons.py` (Python + Pillow) gera favicon PNG de 32 px, ICO de 16/32/48 px e os tamanhos existentes de PWA/Apple em `public/`, com paleta otimizada e transparência quando aplicável. O maskable mantém o desenho na área segura; referências versionadas evitam reutilizar o ícone antigo. O original de alta resolução não é servido como favicon.
- **Ambientes:** local (`docker compose` de desenvolvimento) e produção. Staging é opcional por enquanto.
- **Observabilidade:** logs JSON (`docker logs`), Spring Actuator (health), monitor de uptime externo; Sentry é opcional.

---

### 32.1 Produção atual: VPS compartilhada com a Eldia Labs (2026-10-04)

A TENNO TALK está em **https://tenno.eldialabs.com**, na VPS da Eldia Labs, ao lado dos sites dela, com o modo `deploy/shared-vps` (`./tenno`, ver o README da pasta):

- nginx da Eldia + **um arquivo próprio** (`server_name` exato, `listen 443 ssl;` sem opções de socket) e certificado próprio (`certbot certonly --webroot`, conta Let's Encrypt já existente no servidor). Os sites vizinhos são medidos antes e depois de cada mudança; qualquer diferença desfaz tudo.
- PostgreSQL 14 da VPS (a suíte do backend roda contra o 14 no deploy): banco e usuário `tenno`, sem `CONNECT` nos bancos vizinhos.
- Backend como `.jar` + systemd, só em `127.0.0.1:8090`, `-Xmx384m`.
- **Segredos via Infisical** (2026-10-04): o `ExecStart` faz `infisical login` com uma machine identity só de leitura do projeto `tenno-talk` e sobe a JVM por `infisical run --env=prod`. As chaves de IA entram só na memória do processo. Em `/etc/tenno-talk/tenno.env` ficam apenas `INFISICAL_UNIVERSAL_AUTH_CLIENT_ID`, `INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET` e `INFISICAL_PROJECT_ID` (além da senha do banco). O `./tenno vps provision` e o `./tenno run deploy:prod` gravam esses valores a partir do `vps.env` local (fora do git), pelo stdin do ssh (`remote/set-env.sh`). O deploy recusa começar sem eles ou com o serviço antigo na VPS. É o mesmo padrão do backend da Eldia, mas com uma **identity própria do projeto `tenno-talk`** (Viewer). A identity da Eldia é gerenciada pelo projeto dela e não pode ser compartilhada. Assim, a TENNO não enxerga os segredos da Eldia. Se o Infisical falhar, o serviço não sobe, e o deploy faz rollback.
- Build sempre local; deploy com health check e rollback automático (ensaiados num container Ubuntu 22.04 com a configuração real do nginx: configuração inválida rejeitada sem reload, backend quebrado revertido sozinho).

A pilha com Caddy e containers (acima) continua valendo para uma VPS só da TENNO.

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
| R8 | Latência da tradução (chamada à API) | Mensagens ficam um a dois segundos em "translating" | UI não bloqueia; modelos pequenos; concorrência controlada; fallback entre provedores |
| R9 | `backdrop-blur` do painel lateral em dispositivos fracos | Jank | Fallback sem blur (`prefers-reduced-transparency`, heurística) |
| R10 | Mock divergir da API real | Retrabalho na Phase 8 | `src/types` como contrato; OpenAPI + openapi-typescript; o mock imita a projeção do servidor |
| R11 | Flags estritas do TS × código gerado pelo shadcn | Erros de tipo em `components/ui` | Ajustes pontuais e documentados; não afrouxar o tsconfig |
| R12 | Tradução "melhorada" troca um texto que o usuário está lendo | Estranhamento | Crossfade suave; aplicar só se `version` maior |
| R13 | Conectar desconhecidos de vários países (quando abrir para mais gente) | Spam, assédio | Block/report, privacidade restritiva por padrão, message requests |
| R14 | Custo por token das APIs de IA | Conta alta se o uso crescer ou houver abuso | Modelos pequenos; cache por (mensagem, idioma); tradução de feed/stories sob demanda; `max-output-tokens`; rate limit de tradução; limite de gasto nos consoles; uso de tokens no log |
| R15 | Mídia sem limite de produto numa VPS | Disco cheio derruba banco e app | Teto técnico alto configurável; alerta de uso de disco; mover mídia para object storage se crescer |
| R16 | Facebook Login (App Review, e-mail ausente) | Login social atrasado ou contas sem e-mail | Começar com Google + email/senha; contas sem e-mail suportadas no modelo |
| R17 | Idioma de origem declarado (sem detecção) | Mensagem escrita em outra língua pode não ser traduzida quando os idiomas declarados coincidem | O prompt trata o idioma como "provável"; idioma editável em Settings; detecção pode entrar depois |

## 34. Decisões de backend

### 34.1 Tomadas (2026-10-03)

| # | Tema | Decisão |
|---|---|---|
| 1 | Backend | **Java** (Spring Boot 4, Java 21) + PostgreSQL |
| 2 | Provedores de IA | **OpenAI (principal) + Anthropic (reserva, só quando a OpenAI falha)**, pelas **APIs oficiais** com chave no Infisical (revisto em 2026-10-04; antes eram as CLIs dos planos de assinatura). Chave inválida avisa o admin, e nada do que foi enviado se perde (§28.3) |
| 3 | Privacidade / LGPD | Nos **Termos de Uso e Política de Privacidade**, com aceite obrigatório na criação da conta |
| 4 | Detecção de idioma | Pelo **idioma do sistema** da pessoa (pré-seleção do idioma nativo no onboarding); sem detecção no servidor |
| 5 | Editar / excluir mensagens | **Fora do escopo** por enquanto |
| 6 | Grupos | Cada pessoa **cria no máximo 1 grupo**. Uso inicial: **conversas entre duas pessoas**; grupos ficam para depois do MVP |
| 7 | Login | **OAuth2 no próprio backend**: Google + Facebook + conta própria (email/senha) |
| 8 | Mídia | **Sem limite de produto** por enquanto (só teto técnico de proteção) |
| 9 | Infra | **Uma VPS** com backend + frontend (Docker Compose + Caddy) |
| 10 | Criptografia ponta a ponta | Não se aplica: a tradução acontece no servidor (consequência das decisões 2 e 3; informada nos termos) |
| 11 | Acesso a dados | `JdbcClient` + SQL explícito, sem JPA (Phase 8) |
| 12 | Privacidade "followers" | Significa **pessoas que eu sigo**, para mensagens e comentários (§31) |
| 13 | Feed | Posts de todos os autores visíveis ao viewer, do mais novo para o mais antigo (escala atual: duas pessoas); ranking/seguidos depois |
| 14 | Stories | Duram **24 horas**; o tray mostra autores visíveis (eu → não vistos → vistos) |
| 15 | Notificações | `follow`, `like`, `comment` e `story_reaction`, respeitando as preferências e nunca para a própria ação. Mensagens novas não geram notificação (o chat já tem contador de não lidas) |
| 16 | Avatar | Só uma imagem do próprio usuário enviada ao backend (§29) |
| 17 | Virtualização da lista de mensagens | Adiada: medido sem necessidade com 330 mensagens (§22) |
| 18 | Moderação | Denúncias de pessoa, mensagem e post, revisadas por admin (§31) |
| 19 | Login social | Opcional por provedor; o app funciona só com e-mail e senha (§30) |
| 20 | Discover | Feed vertical de posts ranqueado por um módulo Maven puro (`tenno-recommender`), extensível só por decorators, com garantia de exposição; interesses aprendidos de comportamento, hashtags e IA; sem filtros (2026-10-05, §37) |

### 34.2 Ainda em aberto

1. ~~Quais modelos usar.~~ Resolvido em 2026-10-04: `gpt-4.1-mini` e `claude-haiku-4-5`, configuráveis por variável (§28.1).
2. Provedor e região da VPS; domínio.
3. Texto jurídico dos Termos e da Política (idealmente revisado por alguém da área).
4. Provedor de e-mail transacional (SMTP) para verificação de e-mail e redefinição de senha.
5. Regras de username (tamanho, caracteres, troca).
6. Idiomas da interface no lançamento.
7. Política de mídia antiga (stories expirados mantêm o arquivo por enquanto).
8. Segurança social para quando o app abrir para mais pessoas: message requests, idade mínima, moderação.

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

## 36. Revisão da experiência social (2026-10-04)

Status: release `1821cbe` publicado em `https://tenno.eldialabs.com` com migration V5 e chaves VAPID de produção; Web Push com o app fechado ainda aguarda ensaio em dispositivos reais. Plano detalhado em [PLANO_UX.md](PLANO_UX.md); execução na Phase 11 do [IMPLEMENTATION.md](IMPLEMENTATION.md#phase-11--notificações-e-experiência-social).

### 36.1 Privacidade e bloqueio em conversas existentes

- As regras de mensagens valem em **cada envio direto**, inclusive encaminhamento e resposta a story, não apenas na criação da conversa. A mensagem idempotente já persistida continua consultável, mas uma nova tentativa com outro `clientId` após a restrição é recusada. O destinatário nunca recebe evento ou aviso sobre o bloqueio; o remetente vê apenas erro genérico de envio indisponível.
- Bloqueio e envio direto usam o mesmo lock transacional por par de usuários para que uma confirmação de bloqueio não seja seguida por mensagem que atravessou a checagem numa transação concorrente. A preferência de mensagens é lida com lock compartilhado; a resposta de alteração só chega depois dos envios anteriores terminarem.
- Em grupos, participantes bloqueados deixam de receber eventos diretos de digitação/presença entre si. O bloqueio não encerra o grupo para os demais participantes.
- Uma conta privada exige aprovação de novos seguidores: seguir cria solicitação, aprovar transforma em follow, rejeitar/cancelar remove a solicitação. Seguidores aprovados antes de tornar a conta privada permanecem. Bloquear elimina follows e solicitações nos dois sentidos. O conteúdo usa apenas a tabela de follows aprovados.
- Mudanças de privacidade invalidam imediatamente perfil, Feed, stories e conversas no cliente, com escrita de preferências serializada para impedir que respostas antigas revertam uma seleção mais recente.

Esta revisão evolui as decisões das seções 6, 8, 9, 13, 17 e 26 para resolver notificações ausentes, confiabilidade do chat, espaçamento, comentários/respostas e retorno entre telas:

- Persistir notificações de mensagens e respostas de stories, hoje ausentes no fluxo real do chat; manter uma conexão realtime por sessão autenticada, inclusive durante stories.
- Persistir a fila de saída em IndexedDB com anexos, reenvio automático, idempotência por `clientId` e coordenação entre abas; reidratar após reload sem perder pendências.
- Substituir entrega inferida da escrita no socket/consulta de conversas por ACK autenticado de mensagens recebidas pelo cliente; corrigir recibos fora de ordem e agregação em grupos.
- Distribuir eventos em executor fora da thread HTTP, apoiado em trabalho persistido no PostgreSQL para recuperação após crash. Manter refetch completo na reconexão, sem sequência/delta nesta fase.
- Implementar Web Push com o app fechado, service worker, inscrições por dispositivo e preferências, com envio pela fila do servidor. Push não equivale a confirmação de entrega da mensagem no chat.
- Substituir leitura automática de toda a central por leitura individual e ação explícita de leitura em lote, com recuperação em falha e sincronização entre dispositivos. Distinguir contador de Chats e contador de atividades.
- Aplicar espaçamento consistente a chat/formulários e somar safe area ao padding base quando necessário.
- Padronizar retorno com origem interna e fallback por rota, incluindo estados de carregamento/erro e entrada por URL direta.
- Introduzir `/posts/:postId` e destino de comentário; usar uma única superfície de post/comentários. Mobile com painel inferior contextual; desktop com mídia e comentários lado a lado quando houver espaço.
- Melhorar resposta privada dentro do story, pausando progresso/vídeo durante interação; permitir destino de story específico e preservar drafts/retry.
- Corrigir destinos das notificações e validar ponta a ponta com backend real e duas contas.
- Corrigir primeiro os bugs adicionais de uso real: Feed/bandeja com conteúdo próprio e de quem o usuário segue (autorização separada de distribuição); follow/unfollow atualiza os caches sem reload; stories públicos por perfil/link não dependem da bandeja filtrada.
- Garantir fechar stories em loading, sucesso e erro, com controle sempre visível e alvo de 44 px; investigar clipping/versão publicada, pois o X já existe no viewer carregado local.
- Corrigir digitação na primeira entrada, reconexão e múltiplas sessões, com renovação/expiração efêmeras e UI consistente. Não persistir typing na fila de mensagens. Detalhamento e aceite na seção 10 do PLANO_UX.md.

Escopo confirmado pelo usuário: notificações internas **e push com o app fechado**, fila persistente e reenvio, ACK real e distribuição assíncrona. Stories mantêm respostas privadas; comentários públicos e sincronização incremental ficam fora desta fase. As fases anteriores do checklist registram entregas históricas; seus itens concluídos não comprovam os novos critérios de aceite. A ausência de push e a entrega por socket descritas nas seções anteriores representam o comportamento anterior a esta revisão.

## 37. Algoritmo de descoberta (2026-10-05)

O Discover deixa de ser uma grade de pessoas com filtros e vira um **feed vertical de posts, estilo "For You"**, ordenado por um algoritmo de recomendação. Os filtros (idioma nativo, país, aprendendo, interesses) saem: o algoritmo considera tudo isso. Pessoas continuam na busca e no onboarding (`/api/people/suggestions`, `/api/people/search`).

### 37.1 Requisitos

- **Tudo conta:** comportamento implícito (impressão, tempo de visualização, like, comentário, share, visita ao perfil, follow, conversa, "não tenho interesse"), tópicos do post (hashtags + classificação por IA), idiomas (nativo, aprendendo, recebendo), país, grafo social, engajamento e frescor. Não há catálogo explícito de interesses: eles são aprendidos.
- **Rápido:** p95 < 80 ms no servidor para a primeira página; páginas seguintes < 20 ms (fatia de um snapshot).
- **Desacoplado:** o algoritmo é um módulo Maven puro (`backend/recommender`, JDK sem dependências de runtime), sem Spring nem SQL. O backend só fornece adaptadores.
- **Extensível só por decorators:** o núcleo é congelado. Sinal novo = nova subclasse de `ScoreDecorator` ou `RerankDecorator` + teste de contrato.
- **Antifalha:** o núcleo é total (nunca lança) e tem **garantia de exposição**: nenhum post deixa de ser visto por falha nossa.

### 37.2 Estrutura

`backend/` vira um reactor Maven: `backend/pom.xml` (aggregator), `backend/recommender` (`tenno-recommender`) e `backend/app` (o backend atual, que depende do módulo). O módulo não enxerga o app (não está no classpath); no app, uma regra ArchUnit garante que só `com.tennotalk.discovery` importa `com.tennotalk.recommender`.

Modelo do núcleo (`com.tennotalk.recommender`), todo imutável, com `now` e semente injetados (determinístico):

| Tipo | Papel |
|---|---|
| `Candidate` | post, autor, data, idioma, tipo de mídia, `SparseVector topics` (taxonomia + `tag:*`), `PostStats` (impressões, likes, comentários, shares, hides, dwell) |
| `Viewer` | id, idiomas, país, afinidades (tópicos, autores, países), seguidos, 2º grau, parceiros de conversa, vizinhos, vistos, ocultados |
| `RankRequest` | viewer, candidatos, `limit`, `seed`, orçamento de tempo |
| `Ranking` | `Ranked(postId, score, reasons)` em ordem + `Diagnostics` (falhas, pulos, fallback) |
| `Scorer` / `ScoreDecorator` | score de um candidato; o decorator envolve um `Scorer` interno e só implementa `adjust` |
| `Reranker` / `RerankDecorator` | reordenação da lista (diversidade) |
| `Recommender` | fachada construída por `Recommender.builder()`; único ponto de entrada |
| `SignalUpdater`, `Hashtags`, `Topics` | funções puras de afinidade (decaimento exponencial), extração de hashtags e taxonomia fixa versionada |

### 37.3 Núcleo congelado

```
candidatos ─▶ Sanitize ─▶ HardFilter ─▶ BaseScore ─▶ [decorators de score] ─▶ Sort
           ─▶ [decorators de rerank] ─▶ ExposureFloor ─▶ InvariantCheck ─▶ Ranking
```

- **Sanitize:** descarta ids nulos/duplicados e normaliza números (NaN/∞ → 0).
- **HardFilter:** defesa em profundidade (o SQL já filtra): próprio post, autores ocultados e posts ocultados.
- **BaseScore:** frescor puro (meia-vida). Sozinho já produz um feed válido.
- **ExposureFloor:** reserva `k` de cada `n` posições (padrão 2 de 10) para posts **sub-expostos** (menos de `minImpressions` impressões, padrão 50, e idade < 72 h), escolhidos pelo melhor score entre eles com rodízio de autores. Fica no núcleo, não é decorator.
- **InvariantCheck:** saída sem duplicatas, `size ≤ limit`, só candidatos válidos. Violou → resultado de `BaseScore + ExposureFloor`.

**Envelope antifalha**, aplicado pelo builder a todo decorator, sem como pular: exceção → contribuição 0 daquele decorator; saída não finita ou fora de `[-cap, cap]` → ignorada; orçamento de tempo por requisição (checagem cooperativa) → decorators restantes pulados; circuit breaker por decorator. `Recommender.rank` captura `Throwable` e devolve o fallback cronológico com exposição.

### 37.4 Sinais v1 (decorators)

Pesos em `RankingWeights` (`tenno.discover.weights.*`): `TopicAffinity` (cosseno viewer × post), `AuthorAffinity`, `LanguageExchange` (post no idioma que o viewer aprende; autor nativo desse idioma), `SocialProximity` (seguido, 2º grau, conversa), `CountryAffinity`, `Engagement` (taxa bayesiana por impressão), `CollaborativeNeighbors` (engajado por vizinhos de interesse), `Exploration` (bônus UCB + ruído semeado), `NegativeFeedback` (hides, tópicos ocultados), `SeenPenalty`. Rerankers: `AuthorSpacing` (1 post por autor a cada 4 posições) e `TopicDiversity` (MMR leve).

### 37.5 Dados (migration V7)

| Tabela | Colunas-chave |
|---|---|
| `interaction_events` | `id`, `user_id`, `post_id`, `author_id`, `kind`, `value` (ms de dwell), `client_id` (único por usuário), `created_at`, `processed_at`. Retenção 90 dias |
| `post_stats` | contadores desnormalizados por post (`impressions`, `likes`, `comments`, `shares`, `hides`, `dwell_ms_sum`) |
| `post_topics` | `post_id`, `topic`, `weight`, `source (hashtag \| ai)` |
| `user_affinities` | `user_id`, `key` (`topic:x`, `author:<uuid>`, `country:XX`), `score`, `updated_at` |
| `hidden_posts`, `hidden_authors` | `user_id` + `post_id` / `author_id` (com FK; desfeitos por `DELETE /api/discover/hidden/{posts\|authors}/{id}`) |
| `user_neighbors` | `user_id`, `neighbor_id`, `similarity` (top-K) |
| `discover_sessions` | `id`, `user_id`, `post_ids uuid[]`, `expires_at` (30 min) |
| `classification_jobs` | fila em tabela como `translation_jobs` |

Escrita nunca bloqueia a UI: o cliente envia lotes para `POST /api/discover/events` (idempotente por `clientId`); likes, comentários, follows e mensagens diretas geram eventos nos serviços existentes. Um worker aplica o `SignalUpdater` e atualiza `post_stats` e afinidades. Hashtags são extraídas ao criar o post; um worker classifica legenda + hashtags na taxonomia via OpenAI/Anthropic (porta `TopicClassifier`); sem chave, o job espera e o post segue ranqueável. Um job recalcula vizinhos a cada 15 min. Eventos e afinidades entram no export de dados e são apagados com a conta; a Política de Privacidade precisa mencionar o uso de interações para recomendação.

### 37.6 Leitura

`GET /api/discover?cursor=` → `Page<Post>`:

1. Sem cursor: carrega o `Viewer` (cache de 60 s), busca candidatos em **fontes independentes** (tópicos, autores afins, grafo, vizinhos, frescos, populares, sub-expostos; janela de 14 dias, até 500, sempre com `Visibility.authorVisible`), ranqueia em memória e grava até 300 ids em `discover_sessions`. Falha de uma fonte não derruba as outras.
2. Com cursor (`sessão:offset`): fatia o snapshot, revalida a visibilidade da página e projeta como o Feed. Snapshot esgotado ou expirado → nova sessão sem os já vistos.
3. Qualquer falha do ranking → lista cronológica de posts visíveis. O Discover nunca responde erro por causa do algoritmo.

Métricas: `discover.rank.latency`, `discover.decorator.failures`, `discover.fallback`, `discover.exposure.floor`.

### 37.7 Frontend

`discoverService.getPosts(cursor)` e `trackEvents(events)`. `DiscoverFeed` com `scroll-snap` vertical (tela cheia no mobile, coluna central no desktop, ↑/↓ no teclado), `DiscoverSlide` reaproveitando `MediaCarousel`, ações e legenda traduzida do Feed, menu com "Not interested" e "Hide posts from @x". O rastreamento (`features/discover/lib/engagement.ts`, puro) mede impressão e tempo visível e envia em lotes.

### 37.8 Testes

O módulo tem a suíte mais pesada: propriedades com jqwik (nunca lança, sem duplicatas, limite, filtrados ausentes, determinismo, monotonicidade), caos (decorators que lançam, estouram o tempo, devolvem NaN), simulação de população para a garantia de exposição, kit de contrato obrigatório para todo decorator, cenários nomeados e orçamento de desempenho. No app: ITs de visibilidade, paginação, fallback, eventos e classificação.

### 37.9 Como ficou na implementação (2026-10-05)

- **Eventos dos serviços:** `FeedService`, `ProfileService` e `ReportService` publicam `common.Interaction`; o `InteractionRecorder` grava **depois do commit**, em `try/catch` — registrar um sinal nunca derruba um like, comentário, follow ou denúncia. Clientes só podem enviar `impression`, `dwell`, `share`, `profile_open`, `hide_post` e `hide_author` (não forjam likes). Mensagens diretas não geram `message_author`: o grafo de conversas já entra como `chatPartners` (`SocialProximity`).
- **Leitura:** consultas do ranking rodam fora de transação, com timeout por statement (`DiscoverReads`); cada parte do viewer e cada fonte de candidatos degrada sozinha (métrica `discover.degraded{part}`). O ranking roda num executor limitado com timeout duro (`rank-timeout`, 250 ms): o envelope do módulo é cooperativo, e é o timeout do app que garante que um laço infinito não segura a requisição. Sem cache do viewer (uma carga por sessão basta).
- **Fallbacks em camadas:** ranking seguro do próprio módulo → mais novos entre os candidatos (ranking atrasado/rejeitado) → mais novos visíveis direto do banco (todas as fontes fora) — métrica `discover.fallback{reason}`.
- **IA:** porta `TopicClassifier`, implementada pelos dois adaptadores existentes (mesmo cliente e regras de erro). O laço de fallback do `FallbackTranslator` virou genérico (`ProviderOutcome<T>`), servindo tradução e tópicos com as mesmas regras de chave/cota (§28.3). A taxonomia vem do módulo como parâmetro (o pacote `translation` não importa o recommender).
- **Não feito no v1:** `?explain=true` para admin (as contribuições existem em `Ranked.contributions`, só não há endpoint).
- **Frontend:** `MediaCarousel` ganhou `fill` (tela cheia, tarja preta) e `playing` (autoplay mudo do slide ativo). "Not interested" remove do cache na hora e o toast oferece desfazer.

