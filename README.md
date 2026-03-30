# Grocery Deals Finder

Grocery Deals Finder is a two-part project:

- a React/Vite frontend in this repo under `src/app`
- a FastAPI + Python scraping backend that lives alongside the project files

The frontend is now connected to the backend for live grocery suggestions, basket comparison, saved-list reruns, and a postal-code-aware store locator experience.

## What Is Implemented

### Frontend

- Live item suggestions from the backend on the home page
- Live basket comparison results on the results page
- Saved shopping lists with local persistence and in-place item editing
- Active comparison list editing directly from the results page
- Dark mode enabled by default for new users, with persisted theme preference
- Store explorer page powered by live backend basket data
- Registry-backed nearest-store metadata enrichment when the backend does not yet provide full store location details
- OpenStreetMap store locator centered on the selected or best local store
- Store visibility filtered to roughly 20 minutes from the entered postal code, while always keeping the best overall deal visible
- Budget + postal code flow carried from search into results

### Backend

- FastAPI API layer with:
  - `GET /search`
  - `GET /basket`
  - `GET /cache/status`
  - `DELETE /cache/{query}`
  - `GET /health`
- SQLite cache with 1-hour TTL (Time to live)
- Background cache warmer scheduler
- Unit price normalization to per-100g / per-100ml
- Basket comparison across stores
- Request-based scrapers for:
  - Loblaws
  - No Frills
  - Real Canadian Superstore
  - Flipp
- Existing Playwright Walmart scraper still included

## Current Scraper Status

- `Loblaws`: working
- `No Frills`: working
- `Real Canadian Superstore`: working
- `Flipp`: working
- `Walmart`: currently failing because Walmart’s live site search selector has changed

That means live comparison currently works with the four non-Walmart sources.

## Project Structure

### Frontend Repo

- `src/app/pages/HomePage.tsx`
- `src/app/pages/ResultsPage.tsx`
- `src/app/pages/MapViewPage.tsx`
- `src/app/pages/SavedListsPage.tsx`
- `src/app/context/GroceryContext.tsx`
- `src/app/data/api.ts`
- `src/app/routes.tsx`

### Backend Files

- `api.py`
- `grocery_search.py`
- `basket.py`
- `normalize.py`
- `cache.py`
- `scheduler.py`
- `pcx_storefront.py`
- `walmart_scrapper.py`
- `loblaws_scrapper.py`
- `nofrills_scrapper.py`
- `rcss_scrapper.py`
- `flipp_scrapper.py`

## Setup

### Frontend

From this repo:

```bash
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is currently needed because the repo is on React 19 while some older UI dependencies still declare React 18-era peer ranges.

### Backend

The Python backend uses a local virtual environment. In the current setup it is:

```bash
./grocery-env
```

If you need FastAPI or related packages installed:

```bash
cd /path/to/backend
source ./grocery-env/bin/activate
pip install fastapi uvicorn requests playwright
```

## Running The App

You need two terminals.

### Terminal 1: Run FastAPI Backend

```bash
cd /path/to/backend
source ./grocery-env/bin/activate
uvicorn api:app --app-dir . --host 127.0.0.1 --port 8000 --reload
```

Backend will be available at:

- [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Terminal 2: Run Frontend

```bash
npm run dev
```

Frontend will usually be available at:

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

## Main User Flow

1. Open the frontend
2. Enter a budget
3. Enter a postal code
4. Add grocery items
5. Click `Find Deals`
6. Review live basket totals for stores within about 20 minutes of that postal code
7. Remove items from the active comparison if needed
8. Open `Store Explorer` to inspect the selected stores on OpenStreetMap
9. Save the list if needed
10. Re-run or edit saved lists from the saved-lists page

## API Endpoints

### Search

```text
GET /search?q=milk&postal_code=B3K9Z0
```

Returns live combined search results across configured sources.

### Basket

```text
GET /basket?items=milk,eggs,bread&postal_code=B3K9Z0
```

Returns ranked basket totals per store using the cheapest available match per item.

Frontend enrichment currently adds:

- region-backed store metadata when needed
- distance and approximate drive-time estimates
- best-deal and nearest-store flags
- 20-minute visibility filtering, except the best overall deal remains visible

### Cache Status

```text
GET /cache/status
```

Returns current cache entries.

### Cache Invalidate

```text
DELETE /cache/{query}?postal_code=B3K9Z0
```

Invalidates cached results for a query.

### Health

```text
GET /health
```

Returns API health plus scraper availability.

## Cache + Scheduler

The backend uses SQLite cache storage in:

- `grocery_cache.db`

Cache behavior:

- TTL: 1 hour
- scheduler refreshes every 55 minutes
- postal code is included in cache key behavior

Warm terms:

- beef
- chicken
- milk
- eggs
- bread
- pork
- salmon
- cheese
- butter
- pasta

Run the scheduler with:

```bash
cd /path/to/backend
source ./grocery-env/bin/activate
python scheduler.py
```

## Live Data Notes

- Loblaws-family stores are now request-based, not Playwright-based
- Flipp returns flyer deals and includes expiry dates
- Unit prices are normalized in backend search results
- Sponsored products are filtered out where supported
- Results are sorted cheapest first, null prices last
- The frontend can enrich basket results with store registry metadata so postal-code-based distance rules still work before the backend sends full location fields

## Known Limitations

- Walmart currently needs its selector updated
- Store distance and drive-time filtering are approximate today and depend on registry/default coordinates when the backend does not provide exact store locations
- The OpenStreetMap embed is intentionally simple: the selected store is centered, but marker-rich multi-store interaction still depends on backend location quality
- `src/app/data/groceryData.ts` still exists from the original mock UI scaffold, but live result pages now use the backend instead

## Verification Completed

Implemented and verified:

- frontend build passes with `npm run build`
- frontend pages call the live backend
- Loblaws, No Frills, RCSS, and Flipp return live results
- basket comparison works through the UI/backend integration
- results and map views apply the 20-minute local-store rule while preserving the best overall deal
- saved lists and active comparison lists support item-level editing
- OpenStreetMap store locator renders from the current frontend flow

## Extra Documentation

For the full architecture, schema, backend flow, and data model, see:

- `PROJECT_SCHEMA.md`
