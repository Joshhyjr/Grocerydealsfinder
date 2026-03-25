# Grocery Deals Finder

Grocery Deals Finder is a two-part project:

- a React/Vite frontend in this repo under `src/app`
- a FastAPI + Python scraping backend that lives alongside the project files

The frontend is now connected to the backend for live grocery search suggestions, basket comparison, saved-list reruns, and store-by-store pricing views.

## What Is Implemented

### Frontend

- Live item suggestions from the backend on the home page
- Live basket comparison results on the results page
- Saved shopping lists with local persistence
- Dark mode state persistence
- Store explorer page powered by live backend basket data
- Budget + postal code flow carried from search into results

### Backend

- FastAPI API layer with:
  - `GET /search`
  - `GET /basket`
  - `GET /cache/status`
  - `DELETE /cache/{query}`
  - `GET /health`
- SQLite cache with 1-hour TTL
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

The `--legacy-peer-deps` flag is currently needed because the repo has an existing React 18 / `react-leaflet` peer mismatch.

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
6. Review live basket totals by store
7. Save the list if needed
8. Re-run saved lists from the saved-lists page

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

## Known Limitations

- Walmart currently needs its selector updated
- The frontend “Map View” is currently a live store explorer, not a true geographic map, because the backend does not yet expose store coordinates
- `src/app/data/groceryData.ts` still exists from the original mock UI scaffold, but live result pages now use the backend instead

## Verification Completed

Implemented and verified:

- frontend build passes with `npm run build`
- frontend pages call the live backend
- Loblaws, No Frills, RCSS, and Flipp return live results
- basket comparison works through the UI/backend integration

## Extra Documentation

For the full architecture, schema, backend flow, and data model, see:

- `PROJECT_SCHEMA.md`
