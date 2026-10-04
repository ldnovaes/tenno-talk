# Deploy numa VPS compartilhada (`./tenno`)

Para quando a TENNO TALK divide a VPS com outros sites que já têm nginx e PostgreSQL (hoje: a VPS da Eldia Labs). Para uma VPS só da TENNO, use `deploy/docker-compose.yml` (deploy/VPS.md).

| | VPS compartilhada | VPS própria |
|---|---|---|
| Proxy/TLS | nginx existente + arquivo próprio | Caddy |
| Backend | `.jar` + systemd (`tenno-talk.service`), 127.0.0.1:8090 | container |
| Banco | PostgreSQL existente, banco e usuário `tenno` | container |
| Build | na sua máquina (nada é compilado na VPS) | na VPS |

## Comandos

```sh
cp deploy/shared-vps/vps.env.example deploy/shared-vps/vps.env   # endereço, domínio, sites vizinhos
./tenno vps provision              # uma vez (idempotente; pode repetir)
./tenno run deploy:prod            # testes + build + deploy (rollback automático)
./tenno vps status | logs | backup | ssh
```

## Chaves das IAs (Infisical)

A tradução usa as APIs da OpenAI e da Anthropic (PLAN.md §28.1). As chaves ficam no **Infisical**, no projeto `tenno-talk` (ID `12c1b503-6d69-4fbe-a9a7-3601d35e2a7b`, env `prod`). Elas são lidas por uma machine identity **própria desse projeto**, a `vps-prod-eldialabs` (Viewer). Ela não enxerga os segredos da Eldia. O `tenno-talk.service` faz `infisical login` e sobe a JVM por `infisical run --projectId=<tenno-talk>`: as chaves vão direto para a memória do processo, sem passar pelo disco.

A identity da Eldia na VPS não serve: ela é gerenciada pelo projeto da Eldia e não pode entrar no `tenno-talk`.

Uma vez:

1. No projeto `tenno-talk`, crie os segredos `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` no env `prod`. `OPENAI_TRANSLATION_MODEL` e `ANTHROPIC_TRANSLATION_MODEL` são opcionais (padrões: `gpt-4.1-mini` e `claude-haiku-4-5`).
2. Em **Access Control → Machine Identities → `vps-prod-eldialabs` → Authentication → Universal Auth**, copie o **Client ID** e use **Create Client Secret**. O secret aparece **uma vez só**. Dá para restringir os IPs confiáveis ao IP da VPS.
3. No `deploy/shared-vps/vps.env` **local** (fora do git), preencha `TENNO_INFISICAL_CLIENT_ID` e `TENNO_INFISICAL_CLIENT_SECRET`.
4. Rode `./tenno vps provision` (instala o serviço novo) e depois `./tenno run deploy:prod`. Os dois gravam a identity em `/etc/tenno-talk/tenno.env` na VPS (`remote/set-env.sh`, pelo stdin do ssh, nunca pela linha de comando). Você não precisa mexer na VPS.
5. Defina um limite de gasto nos consoles da OpenAI e da Anthropic.

Para trocar o client secret, mude o `vps.env` e rode um deploy (ou o provision).

Para trocar uma chave de IA, mude no Infisical e rode `systemctl restart tenno-talk` na VPS. Na subida, um provedor marcado `invalid_key` é verificado de novo. Também dá para usar **Check now** em `/admin/ai`.

Limpeza da instalação antiga das CLIs, depois do primeiro deploy saudável: `rm -rf /opt/tenno-talk/node /opt/tenno-talk/cli /var/lib/tenno-talk/.codex /var/lib/tenno-talk/.claude`.

## O que o provision faz, e o que ele nunca faz

- Cria o usuário de sistema `tenno`, `/opt/tenno-talk` (releases), `/var/www/tenno-talk`, `/var/lib/tenno-talk` (mídia) e `/etc/tenno-talk/tenno.env` (senha do banco gerada uma vez, `root:tenno 640`).
- Instala a CLI do Infisical, se faltar (a Eldia já instalou). Recusa continuar enquanto o `tenno.env` não tiver a machine identity (abaixo).
- No PostgreSQL existente: usuário e banco `tenno`. Revoga o `CONNECT` público dos bancos vizinhos, para o `tenno` não conseguir nem conectar neles (os donos continuam com acesso).
- Certificado **próprio** com `certbot certonly --webroot` (não altera nenhum arquivo do nginx nem o certificado dos vizinhos), renovado pelo timer do certbot com reload do nginx.
- nginx: **um arquivo novo** (`sites-available/tenno-talk.conf` + snippet de headers). Antes de aplicar: `nginx -t`; se falhar, desfaz e o nginx em execução nem fica sabendo. Aplica com `reload` (nunca `restart`). Mede as respostas HTTP e HTTPS dos sites vizinhos (`TENNO_NEIGHBOR_HOSTS`) antes e depois; qualquer diferença desfaz a mudança.
- O bloco usa `server_name` exato e `listen 443 ssl;` sem `http2`/`default_server` (essas opções valem para todos os sites da porta).
- Backup diário às 03:30 (`/etc/cron.d/tenno-talk-backup`): só o banco `tenno` e a mídia, 14 dias em `/var/backups/tenno-talk`. Copie para fora da VPS.

## Deploy

1. Recusa árvore suja; roda lint, typecheck, testes do frontend, backend no **PostgreSQL 14** (a versão da VPS) e e2e (`--skip-tests` pula).
2. Build local do site (`VITE_DATA_SOURCE=http`) e do `.jar`.
3. `rsync` para `releases/<sha>`.
4. Na VPS (`activate.sh`): troca o link do backend, reinicia, espera o health; se falhar, volta ao release anterior sozinho. Só então troca o site e confere página e API **pelo nginx**. Mantém 5 releases.

## Ensaio

Antes da primeira vez em produção, tudo foi ensaiado num container Ubuntu 22.04 com systemd, com a configuração real do nginx dos vizinhos e um PostgreSQL 14 (`TENNO_VPS_ENV=<arquivo> ./tenno ...` aponta para outra máquina).

## Segurança do servidor (VPS da Eldia, 2026-10-04)

Ajustes feitos no servidor compartilhado, cada um com desfazer automático em 5 minutos até ser verificado:

- **Firewall (`ufw`)**: as regras do provisionamento da Eldia já existiam (22022, 80, 443, 8443, 41641/udp), mas o serviço que as carrega no boot estava desabilitado; depois de um reboot, o servidor ficou sem firewall e o backend da Eldia (8080) acessível direto da internet. Ativado e habilitado no boot. Verificado: SSH, sites, documentação via Tailscale, WhatsApp (Baileys → Java por loopback), exit node; 8080 bloqueada de fora.
- **SSH só com chave** (root inclusive): `/etc/ssh/sshd_config.d/01-key-only.conf`, lido antes do `50-cloud-init.conf` da imagem. Para aceitar senha de novo: `rm /etc/ssh/sshd_config.d/01-key-only.conf && systemctl reload ssh`. Sem nenhuma chave: console web no painel da HostGator (não é afetado).
