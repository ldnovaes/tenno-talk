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
./tenno vps ai-login codex         # uma vez: login do ChatGPT (link + código)
./tenno vps ai-login claude        # uma vez: login do Claude
./tenno run deploy:prod            # testes + build + deploy (rollback automático)
./tenno vps status | logs | backup | ssh
```

## O que o provision faz, e o que ele nunca faz

- Cria o usuário de sistema `tenno`, `/opt/tenno-talk` (releases, Node 22 e as CLIs de IA, sem pacote de sistema), `/var/www/tenno-talk`, `/var/lib/tenno-talk` (mídia, credenciais das CLIs) e `/etc/tenno-talk/tenno.env` (senha do banco gerada uma vez, `root:tenno 640`).
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
