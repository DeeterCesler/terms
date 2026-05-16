# Term Checker

A privacy policy analyzer: crawls and AI-summarizes privacy policies for websites, surfaced via a Chrome extension popup.

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
- `ANTHROPIC_API_KEY` — your Anthropic API key
- `ADMIN_SECRET` — a random secret (32+ chars) for protecting admin routes

### 3. Start Postgres

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

The API will be available at `http://localhost:3000`.

### 6. Submit a site for analysis

```bash
API_BASE_URL=http://localhost:3000 ADMIN_SECRET=your-secret \
  npx tsx packages/admin/src/cli.ts submit https://example.com/privacy
```

Check status:

```bash
API_BASE_URL=http://localhost:3000 ADMIN_SECRET=your-secret \
  npx tsx packages/admin/src/cli.ts status example.com
```

### 7. Load the Chrome extension

1. Build the extension: `npm run build --workspace=packages/extension`
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select `packages/extension/dist`

The extension icon will appear in your toolbar. Navigate to any analyzed site and click it.

## Admin CLI

```bash
# Alias for convenience (after building)
alias tca="npx tsx packages/admin/src/cli.ts"

tca submit https://example.com/privacy    # Register + queue a site
tca reprocess example.com                 # Re-crawl (skips if unchanged)
tca reprocess example.com --force         # Force re-analysis
tca status example.com                    # Show latest analysis
tca list                                  # List all sites
tca list --queue --status=pending         # Show pending queue items
tca bulk ./urls.txt                       # Submit many URLs from a file
```

## Project Structure

```
packages/
  shared/     Zod schemas + TypeScript types
  api/        Express REST API + background worker
  admin/      CLI tool for managing sites
  extension/  Chrome MV3 popup extension
```

## API

Public endpoints (rate-limited):
- `GET /api/v1/check/:domain` — latest analysis for a domain
- `GET /api/v1/check/:domain/history` — all past analyses
- `GET /health`

Admin endpoints (require `X-Admin-Secret` header):
- `POST /admin/sites` — register a new site
- `POST /admin/sites/:domain/reprocess` — re-crawl/re-analyze
- `GET /admin/sites` — list all sites
- `GET /admin/queue` — view processing queue
- `DELETE /admin/sites/:domain` — remove a site
