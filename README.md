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
```

Por padrão o frontend usa a camada de mock (`VITE_DATA_SOURCE=mock`).
