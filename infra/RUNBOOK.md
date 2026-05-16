# Deployment Runbook — Hetzner VPS

## What you need
- A Hetzner account (cloud.hetzner.com)
- A domain name with DNS you can edit
- Your `ANTHROPIC_API_KEY` and a strong `ADMIN_SECRET`

---

## 1. Create the server

1. Log in to Hetzner Cloud → **New Project** → **Add Server**
2. Choose:
   - Location: nearest to you
   - Image: **Ubuntu 24.04**
   - Type: **CX22** (2 vCPU / 4 GB RAM, ~€4/mo)
   - SSH keys: add your public key
3. Note the server's IP address.

---

## 2. Point your domain at the server

In your DNS provider, add an A record:

```
api.yourdomain.com  →  <server IP>
```

Wait for it to propagate (usually a few minutes).

---

## 3. Bootstrap the server

```bash
ssh root@<server IP>
curl -fsSL https://raw.githubusercontent.com/you/privacy-policy-analyzer/main/infra/setup.sh | bash
```

Or copy and run it manually. This installs Docker, nginx, certbot, and creates a `deploy` user.

---

## 4. Clone the repo and configure

```bash
ssh deploy@<server IP>
git clone https://github.com/you/privacy-policy-analyzer.git ~/app
cd ~/app
cp .env.example .env
nano .env
```

Set these in `.env`:

```
DATABASE_URL=postgres://postgres:postgres@postgres:5432/term_checker
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_SECRET=<random 32+ char string>
NODE_ENV=production
```

---

## 5. Deploy

```bash
cd ~/app
bash infra/deploy.sh
```

This runs migrations, builds the Docker image, and starts the stack. The postgres port is **not** exposed publicly (the prod compose override removes it).

---

## 6. Enable HTTPS

```bash
sudo bash infra/ssl.sh api.yourdomain.com
```

Your API is now live at `https://api.yourdomain.com`.

---

## 7. Build the extension for production

Back on your local machine:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com \
  npm run build --workspace=packages/extension
```

Load `packages/extension/dist` as an unpacked extension in Chrome.

---

## Ongoing operations

**Deploy an update:**
```bash
ssh deploy@<server IP> "cd ~/app && bash infra/deploy.sh"
```

**View logs:**
```bash
ssh deploy@<server IP> "docker compose -f ~/app/docker-compose.yml logs -f api"
```

**Submit a site for analysis:**
```bash
API_BASE_URL=https://api.yourdomain.com ADMIN_SECRET=your-secret \
  npx tsx packages/admin/src/cli.ts submit https://example.com/privacy
```

**Check API health:**
```bash
curl https://api.yourdomain.com/health
```

**Backups:** Hetzner snapshots (manual) or enable **Volume Backups** in the console. The postgres data is in the `postgres_data` Docker volume — snapshot the whole server to capture it.
