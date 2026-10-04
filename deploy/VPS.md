# Deploy na VPS

Guia de operação de produção (PLAN.md §32). Tudo roda numa VPS com Docker Compose: `web` (Caddy + SPA), `backend` (Java + CLIs de IA) e `postgres`.

## 1. Servidor

Mínimo sugerido: 2 vCPU, 4 GB de RAM e 40 GB de disco (Ubuntu 24.04 LTS).

```sh
# Usuário sem senha, acesso só por chave
adduser --disabled-password deploy && usermod -aG sudo,docker deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy: /home/deploy/.ssh

# SSH: sem senha e sem root
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall: só 22, 80 e 443 (o Postgres e o backend não são publicados pelo compose)
ufw default deny incoming && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable

# Tentativas de login por força bruta e atualizações de segurança automáticas
apt install -y fail2ban unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades

# Docker
curl -fsSL https://get.docker.com | sh
```

**Importante:** o backend confia no `X-Forwarded-For` que o Caddy define (limite de requisições por IP). Por isso a porta 8080 nunca pode ser publicada: só o Caddy fala com o backend. Testado: um cliente que forja `X-Forwarded-For` através do Caddy continua limitado.

## 2. Primeiro deploy

```sh
sudo mkdir -p /opt/tenno-talk && sudo chown deploy: /opt/tenno-talk
git clone <repositório> /opt/tenno-talk && cd /opt/tenno-talk/deploy
cp .env.example .env && chmod 600 .env   # domínio, senha do banco, OAuth
docker compose up -d --build
```

O DNS do domínio precisa apontar para a VPS antes: o Caddy obtém o certificado sozinho.

Depois:

1. **Login das IAs** (uma vez; as credenciais ficam nos volumes `ai-codex` e `ai-claude`):
   `docker compose exec backend codex login --device-auth` e `docker compose exec backend claude setup-token`.
   Desative o uso dos dados para treinamento nas duas contas.
2. **Admin:** crie sua conta pelo app e rode
   `docker compose exec postgres psql -U tenno -c "UPDATE users SET role='admin' WHERE email='voce@exemplo.com'"`.
   Saia e entre de novo. Em **Settings → AI providers** dá para refazer o login das IAs pelo celular.
3. **OAuth:** registre `https://<domínio>/login/oauth2/code/google` e `.../facebook` nos apps do Google e do Facebook.

## 3. Atualizar

```sh
cd /opt/tenno-talk && git pull && cd deploy && docker compose up -d --build
```

Ou pelo GitHub Actions: workflow **Deploy** (manual), que faz o mesmo por SSH. Segredos do repositório: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (chave privada só para deploy) e `VPS_KNOWN_HOSTS` (saída de `ssh-keyscan <host>`).

As migrations (Flyway) rodam sozinhas na inicialização do backend.

## 4. Backups

```sh
sudo crontab -e
15 3 * * * /opt/tenno-talk/deploy/backup.sh >> /var/log/tenno-backup.log 2>&1
```

`backup.sh` gera `db.dump` (pg_dump, formato custom) e `media.tar.gz` em `/var/backups/tenno-talk/<data>`, mantém 14 dias e confere se o dump pode ser lido. **Copie a pasta para fora da VPS** (rclone para um bucket, por exemplo).

Restaurar: `deploy/restore.sh /var/backups/tenno-talk/<data>` (pede confirmação, para o backend, troca banco e mídia e sobe de novo). Faça um teste de restauração a cada trimestre.

## 5. Monitoramento

- **Uptime:** um monitor externo (UptimeRobot, Better Stack…) em `https://<domínio>/actuator/health`. Ele responde `DOWN` (503) se o disco tiver menos de `DISK_ALERT_THRESHOLD` livres (padrão 2 GB): mídia não tem limite de produto (R15).
- **IAs:** `Settings → AI providers` mostra o estado de cada provedor e a fila de traduções. Quando um login cai, o aviso aparece nos logs (`docker compose logs backend | grep -i reauth`).
- **Logs:** `docker compose logs -f backend`.
