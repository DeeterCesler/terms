# Policy Checker

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

#### Pipeline stages

Every site moves through three categories. `scripts/status.ts` prints a snapshot of all three:

| Category | Meaning | Source of truth |
|---|---|---|
| **1. Candidate** | On the wishlist, no `sites` row yet | `policy_candidates` |
| **2. Raw fetched, not analyzed** | `policies` row exists, no `done` `policy_analyses` row | `policies` ∖ done `policy_analyses` |
| **3. Analyzed** | Live in `policy_analyses` with `status='done'` | `policy_analyses` |

```bash
npx tsx scripts/status.ts            # head of each bucket
npx tsx scripts/status.ts --all      # full lists
```

#### Category 1 → 2 (fetch raw text only)

Fetch a single site's raw text and store it (no analysis yet):

```bash
npx tsx scripts/fetch-and-store.ts [--headless] \
  --url <policyUrl> --domain <domain> \
  [--policy-type privacy_policy|terms_of_service|...] [--product <name>]
```

For a bulk batch from a `<url> <domain> [policy_type] [product]` per-line file (static first, headless fallback on thin/error):

```bash
bash scripts/run-fetch-store-batch.sh < scripts/p1-batch-urls.txt
# writes /tmp/fetch-store-report.md with OK / THIN / FAILED sections
```

#### Category 2 → 3 (analyze existing raw text)

Use this when raw text is already in the DB and just needs an analysis. Reuses the existing `policy_id` (no duplicate `policies` row).

```bash
# 1. Pick N category-2 rows; dumps raw text to /tmp/bucket2/<domain>-<policy_type>.txt
#    and prints policy_id + url + path for each.
npx tsx scripts/pick-bucket2.ts [N=5] \
  [--min-chars 5000] [--max-chars 500000] \
  [--policy-type privacy_policy] [--order desc|asc]

# 2. Read each text file, produce a JSON matching the analysis schema,
#    save it to /tmp/bucket2/<domain>-analysis.json

# 3. Insert (one call per site, with the policy_id from step 1)
npx tsx scripts/analyze-existing.ts \
  --policy-id <uuid> \
  --analysis-file /tmp/bucket2/<domain>-analysis.json
```

#### Category 1 → 3 (fresh fetch + analyze in one go)

Skips the DB lookup — fetch fresh and insert the analysis against a new `policies` row.

```bash
# 1. Fetch
npx tsx scripts/fetch-text.ts [--headless] <policyUrl> /tmp/<domain>.policy.txt

# 2. Analyze and write /tmp/<domain>.analysis.json

# 3. Insert
npx tsx scripts/insert-direct.ts \
  --domain <domain> --url <policyUrl> \
  --text-file /tmp/<domain>.policy.txt \
  --analysis-file /tmp/<domain>.analysis.json \
  --name "<display name>"
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
