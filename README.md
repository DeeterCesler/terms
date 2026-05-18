# Term Checker

A privacy policy analyzer: privacy policies are fetched, analyzed by Claude (locally), and inserted directly into a Postgres database. A Chrome extension popup surfaces the stored analysis. The deployed API is read-only — there is no server-side LLM call.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` — Postgres connection string (Neon, Docker, etc.)
- `ADMIN_SECRET` — random secret (32+ chars) for protecting admin GET/DELETE endpoints

### 3. Start Postgres (skip if using Neon)

```bash
docker-compose up postgres
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. Start the API

```bash
npm run dev:api
```

The API will be available at `http://localhost:3000`. It only serves read endpoints; writes happen via the local-analysis flow below.

### 6. Analyze a site (local Claude flow)

The full per-site flow:

1. **Fetch policy text:**
   ```bash
   npx tsx scripts/fetch-text.ts [--headless] <policyUrl> /tmp/<domain>.policy.txt
   ```
2. **Analyze it yourself** (or hand the text to Claude) and produce a JSON object matching the analysis schema. Write it to `/tmp/<domain>.analysis.json`.
3. **Insert into the DB:**
   ```bash
   npx tsx scripts/insert-direct.ts \
     --domain <domain> \
     --url <policyUrl> \
     --text-file /tmp/<domain>.policy.txt \
     --analysis-file /tmp/<domain>.analysis.json \
     --name "<display name>"
   ```

For bulk fetching (step 1 only) given a `<url> <domain>` per-line file:

```bash
bash scripts/run-batch.sh < scripts/batch-urls.txt
```

### 7. Load the Chrome extension

1. Build the extension: `npm run build --workspace=packages/extension`
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select `packages/extension/dist`

The extension icon will appear in your toolbar. Navigate to any analyzed site and click it.

## Admin CLI

The CLI is read-only after the API was stripped to read-only. To add a site, use the local-analysis flow above.

```bash
alias tca="npx tsx packages/admin/src/cli.ts"

tca status example.com    # Show latest analysis from the DB
tca list                  # List all sites
```

## Project Structure

```
packages/
  shared/     Zod schemas + TypeScript types
  api/        Express REST API (read-only public + admin GETs)
  admin/      CLI tool for inspecting the DB
  extension/  Chrome MV3 popup extension
```

## API

Public endpoints (rate-limited):
- `GET /api/v1/check/:domain` — latest analysis for a domain
- `GET /api/v1/check/:domain/history` — all past analyses
- `GET /health`

Admin endpoints (require `X-Admin-Secret` header):
- `GET /admin/sites` — list all sites
- `GET /admin/sites/:domain/sources` — list policy sources for a site
- `DELETE /admin/sites/:domain` — remove a site
- `GET|POST|DELETE /admin/candidates[...]` — manage the wishlist of sites to eventually analyze
