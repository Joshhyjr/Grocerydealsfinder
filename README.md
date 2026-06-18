# Grocery Deals Finder

Grocery Deals Finder compares a grocery basket across Halifax-area stores. It consists of:

- a React/Vite frontend deployed to GitHub Pages
- a Cloudflare Worker API with KV-backed price snapshots
- a bundled estimate catalogue used when no approved live snapshot exists
- attributed Open Prices records when recent Halifax data exists
- anonymous community price reports that expire after 14 days

## Why cached snapshots

The website never scrapes a retailer while a shopper waits. Approved retailer APIs, licensed data providers, or a separate collection job publish normalized snapshots to the Worker. The Worker then:

- stores the latest valid snapshot in Cloudflare KV
- serves `/search` and `/basket` from cached data
- keeps serving the last good snapshot if a refresh fails
- refreshes configured provider feeds every six hours
- falls back to clearly labelled estimates before the first live snapshot

This isolates retailer changes from the frontend and prevents one broken provider from taking down results.

## Free and legally cautious data model

The app does not scrape retailer pages. It uses:

- **Open Prices** read-only data with visible attribution
- **Anonymous community reports** containing only product, store, price, package/unit, postal code, and observation date
- **Estimates** when neither source has recent coverage

Community reports are rate-limited, restricted to supported stores, and automatically removed after 14 days. The app does not request names, emails, loyalty details, payment information, or receipt images.

## Local development

Install dependencies:

```bash
npm ci --legacy-peer-deps
```

Run the API:

```bash
cp .dev.vars.example .dev.vars
npm run api:dev
```

Run the frontend in another terminal:

```bash
npm run dev
```

Development URLs:

- Frontend: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- API health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

## API endpoints

Public:

```text
GET /health
GET /search?q=milk&postal_code=B3H2Y7
GET /basket?items=milk,eggs,bread&postal_code=B3H2Y7
POST /community/prices
```

Authenticated administration:

```text
POST /admin/snapshots
POST /admin/refresh
Authorization: Bearer <INGEST_TOKEN>
```

See [worker/PROVIDER_CONTRACT.md](worker/PROVIDER_CONTRACT.md) for the normalized feed and upload schema.

## Deploy the Cloudflare Worker

Authenticate once:

```bash
npx wrangler login
```

Install the ingestion secret:

```bash
npx wrangler secret put INGEST_TOKEN
```

If approved provider feeds share a bearer token:

```bash
npx wrangler secret put PROVIDER_API_TOKEN
```

Deploy:

```bash
npm run api:check
npm run api:test
npm run api:deploy
```

Wrangler provisions the `PRICE_SNAPSHOTS` KV namespace declared in `wrangler.jsonc`. The deployment output provides a URL such as:

```text
https://grocery-deals-api.<account>.workers.dev
```

## Connect GitHub Pages

In the GitHub repository:

1. Open **Settings → Secrets and variables → Actions → Variables**.
2. Add `VITE_API_BASE_URL` with the deployed Worker URL.
3. Re-run the **Deploy to GitHub Pages** workflow.

The Pages workflow injects that variable into the Vite build. If it is absent or the API fails, the frontend still switches to labelled estimate mode.

## Configure approved provider feeds

`PROVIDER_FEED_URLS` in `wrangler.jsonc` accepts a comma-separated list of HTTPS endpoints that return the normalized provider contract.

Example:

```jsonc
"PROVIDER_FEED_URLS": "https://provider.example/halifax-prices,https://retailer.example/catalogue"
```

The Worker fetches all configured feeds on its cron schedule, validates and merges successful payloads, and writes the new snapshot only when at least one feed succeeds.

Do not place API tokens in `wrangler.jsonc`. Store them with `wrangler secret put`.

## Open Prices

The scheduled Worker checks for recent CAD prices within the configured Halifax radius:

```jsonc
"OPEN_PRICES_RADIUS_KM": "30"
```

Open Prices coverage may be sparse. Empty coverage is expected and leaves estimates and community reports in place. Records are visibly attributed to [Open Prices](https://prices.openfoodfacts.org/) and expire locally after 14 days.

## Manual or pipeline ingestion

A trusted data pipeline can upload a snapshot directly:

```bash
curl -X POST "https://grocery-deals-api.example.workers.dev/admin/snapshots" \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @snapshot.json
```

Uploads are limited to 5 MiB and 20,000 products, schema validated, and rejected if prices or required fields are malformed.

## GitHub deployment

- `.github/workflows/deploy-pages.yml` deploys the frontend.
- `.github/workflows/deploy-api.yml` manually deploys the Worker after these Actions secrets are configured:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

## Verification commands

```bash
npm run api:types
npm run api:check
npm run api:test
npm run api:deploy:dry
npm run build
```

## Live-data guidance

Retailer-authorized APIs or licensed feeds are preferable. Retailer websites frequently prohibit automated extraction and change without notice. If browser collection is unavoidable, keep it in a separate scheduled job that publishes normalized snapshots to this API; never run browser automation inside a shopper request.

Open Prices reuse must continue to follow its OdBL requirements. This repository provides implementation guidance, not legal advice.
