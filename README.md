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

### Demo entre duas pessoas (mock)

1. Abra `http://localhost:5173/welcome` e entre como **Lucas** (pt-BR).
2. Abra **outra aba** no mesmo endereço e entre como **Cam** (vi-VN).
3. Conversem: cada um escreve no próprio idioma e lê no seu, em tempo real.

A sessão do mock é por aba; os dados ficam no `localStorage` do navegador.
Contatos que não estão abertos em nenhuma aba respondem automaticamente.
