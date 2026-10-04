# TENNO TALK

Talk to anyone. In your own language.

Chat social com tradução automática por IA: cada pessoa escreve no próprio idioma e lê no idioma que escolheu. O original nunca se perde.

- Arquitetura e decisões: [PLAN.md](PLAN.md)
- Checklist de desenvolvimento: [IMPLEMENTATION.md](IMPLEMENTATION.md)

## Frontend

Requisitos: [Bun](https://bun.sh) 1.3+ (ou Node 22+ com npm).

```sh
bun install
bun run dev        # http://localhost:5173
bun run test       # Vitest
bun run lint
bun run typecheck
bun run build
bun run e2e        # Playwright contra o mock (e2e/README.md)
```

Por padrão o frontend usa a camada de mock (`VITE_DATA_SOURCE=mock`).

### Demo entre duas pessoas (mock)

1. Abra `http://localhost:5173/welcome` e entre como **Rafael** (pt-BR).
2. Abra **outra aba** no mesmo endereço e entre como **Linh** (vi-VN).
3. Conversem: cada um escreve no próprio idioma e lê no seu, em tempo real.

A sessão do mock é por aba; os dados ficam no `localStorage` do navegador.
Contatos que não estão abertos em nenhuma aba respondem automaticamente.

## Backend (Java)

Requisitos: Java 21 e Docker (Postgres local e testes com Testcontainers).

```sh
docker compose -f docker-compose.dev.yml up -d     # Postgres em localhost:5432
cd backend
COOKIE_SECURE=false ./mvnw spring-boot:run          # http://localhost:8080
./mvnw test                                          # unitários + integração (Postgres real via Testcontainers)
```

Com o backend no ar, rode o frontend contra ele:

```sh
VITE_DATA_SOURCE=http bun run dev   # o Vite repassa /api, /oauth2, /login/oauth2 e /ws para :8080
```

As traduções usam as CLIs `codex` (ChatGPT, principal) e `claude` (reserva), logadas com os planos de assinatura, nunca com chaves de API (PLAN.md §28). Sem as CLIs, as mensagens continuam funcionando e as traduções esperam na fila.

## Produção (uma VPS)

Guia completo: [deploy/VPS.md](deploy/VPS.md) (servidor, primeiro deploy, backups, monitoramento).

```sh
cd deploy
cp .env.example .env        # domínio, senha do banco, OAuth
docker compose up -d --build
```

Depois do primeiro deploy:

1. Faça login nas CLIs dentro do container (uma vez; as credenciais ficam em volumes):
   `docker compose exec backend codex login --device-auth` e `docker compose exec backend claude setup-token`.
2. Promova sua conta a admin:
   `docker compose exec postgres psql -U tenno -c "UPDATE users SET role='admin' WHERE email='voce@exemplo.com'"`.
3. Acompanhe os provedores em **Settings → AI providers** (`/admin/ai`), inclusive para refazer o login pelo celular.
