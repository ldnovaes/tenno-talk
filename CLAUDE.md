# TENNO TALK — instruções para agentes

Antes de trabalhar neste repositório, leia:

- [PLAN.md](PLAN.md): arquitetura, decisões e contratos (fonte da verdade).
- [IMPLEMENTATION.md](IMPLEMENTATION.md): checklist por fase; mostra o que já foi feito e o que vem a seguir.

## Fluxo de trabalho

- Antes de implementar algo grande, atualize o PLAN.md.
- Ao concluir uma etapa, marque o item no IMPLEMENTATION.md.
- Prosa e documentação em português; código, identificadores, rotas e strings de UI em inglês.
- O branch `main` sincroniza com o Lovable. Trabalhe em branches e não reescreva histórico publicado.

## Regras de desenvolvimento

- Não criar componentes gigantes (~150 linhas = dividir).
- Não duplicar lógica; funções puras em `features/*/lib` ou `lib/`, com testes.
- Não chamar serviços/API diretamente em componentes; sempre via hooks (TanStack Query).
- Componentes não sabem se o dado é mock ou real: tudo passa por `src/services/*`.
- Zustand só para estado de cliente (sessão, preferências do dispositivo, UI); dado do servidor fica no Query.
- Nunca chamar provedor de IA no navegador; nunca colocar chaves secretas no frontend.
- Sem `any` (use `unknown` + narrowing); não afrouxar o tsconfig.
- Sem abstrações sem uso concreto; código simples, nomes claros.
- Nunca usar índice de array como `key`/id.
- Strings de UI via `t()` (i18next); cores só via tokens semânticos.
- Texto de conteúdo do usuário sempre com `lang` e `dir="auto"`.
- Mobile first em toda tela.
