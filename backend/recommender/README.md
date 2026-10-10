# Testes do algoritmo do Discover

Requer JDK 21. Rodar a partir de `backend/`; não precisa de Docker, banco, chaves de IA nem acesso à produção.

```sh
# Contratos, propriedades, cenários, aprendizado, recuperação e simulação de exposição existente.
./mvnw -pl recommender test

# Tudo acima + teste massivo (também disponível no workflow manual Recommender stress).
./mvnw -pl recommender -Precommender-stress test

# Apenas a carga massiva.
./mvnw -pl recommender -Precommender-stress -Dtest=SocialScaleTest test
```

## O que é verificado

| Cenário | Volume e critérios |
|---|---|
| População heterogênea | 3 sementes × 4.000 sessões × 500 entradas = **6 milhões de avaliações de candidatos**; catálogo de 100 mil posts por semente, 2.000 perfis, 20% sem histórico, seis grupos de idioma/país/tópico, autores prolíficos, posts virais e recém-chegados |
| Contratos em cada sessão | Resultado completo até o limite de 300; sem duplicatas, posts próprios ou ocultados; autores ocultados ausentes; scores finitos; cota mínima de posts subexpostos; diagnósticos sem falhas, sinais desativados ou fallback |
| Concorrência | 8 threads compartilham a mesma instância, sincronizadas na largada; 2.048 rankings comparados integralmente com 256 referências sequenciais, inclusive scores e exposição |
| Orçamento padrão | 2.000 sessões adicionais, com orçamento real de 30 ms; p95 do ranking < 80 ms, menos de 1% de fallback e menos de 1% de sessões com sinais lentos/falhos/desativados |
| Qualidade com controle | 6 grupos × 4 sementes: precisão@20 ≥ 80% no tópico aprendido e ganho ≥ 50 pontos percentuais sobre o núcleo cronológico, em catálogo equilibrado com idade e engajamento iguais |
| Mudança de interesse | `SignalUpdater` recebe likes e feedback negativo; o tópico novo ocupa ≥ 80% do top 20 e o rejeitado ≤ 10%, nos seis grupos e quatro sementes |
| Falha e recuperação | Exceções e NaN em um sinal durante 40 sessões; os sinais saudáveis preservam a ordem, o circuito abre e, após o cooldown simulado, 40 novas sessões comprovam a volta da contribuição |

A suíte massiva usa a tag `stress`, excluída da execução normal e de mutação. Os testes menores de aprendizado e recuperação rodam no CI normal. Não há dependências novas de runtime.

## Relatórios e reprodução

`recommender/target/recommender-stress/*.json` registra semente, volume, p50/p95/p99, throughput, fallback, degradação, processadores disponíveis e heap máximo. A latência mede apenas `rank()`; o throughput inclui geração dos pedidos e verificações. Aquecimento não entra nos números. O Surefire mantém os resultados em `target/surefire-reports/`. O workflow publica ambos como artefatos, inclusive em falhas.

As sementes são `7`, `42`, `20261007` (população), `73` (concorrência) e `91` (orçamento). Uma violação de contrato informa semente e sessão. O relógio de conteúdo é fixo; a latência usa tempo real. Os testes funcionais usam orçamento folgado para não confundir variação de CPU com perda de determinismo. Falhar no teste de orçamento pode indicar saturação da máquina: preserve o relatório e investigue antes de alterar o limite.

## Limites da conclusão

O catálogo representa uma população maior, mas cada pedido contém 500 entradas, como no adaptador atual. A seleção sintética **não executa** o recuperador SQL. A cota de exposição vale para os candidatos elegíveis de cada pedido; ela não prova que todos os posts do catálogo serão recuperados ou vistos.

Passar valida esses contratos e a relevância sintética. Capacidade da rede social inteira exige ainda teste de carga da API com PostgreSQL, paginação, gravação de eventos e workers concorrentes, em ambiente de homologação, além de métricas de relevância com usuários reais. A simulação não mede esse SLA nem justifica extrapolar throughput para a VPS de produção.
