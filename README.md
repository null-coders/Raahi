# Raahi

Raahi plans trips across India around your **budget**, your **time** and **who you travel with**. It suggests where to go (trending, in season, hidden gems), then builds a day-by-day itinerary that respects opening hours, seasons, roads and distances. It also tells you what it left out, and why.

- 103 destinations and 710 hand-curated places across every region of India
- Real photos for every destination and place (hand-checked Wikimedia Commons photos, credited on screen), and a "Life here" section on the people, homes, food and festivals of each place
- Trips from a few hours to 14 days, and multi-city trips (up to 3 destinations)
- Solo / couple / friends / family, with kids and elders taken into account
- Live weather, maps, Google Maps directions, saved trips, share links, and an "Add a place" screen

---

## Run it on your Mac

You need **Node.js 22 LTS** (20.19 or newer also works). Check with `node -v`; if it's missing or older, install the LTS version from https://nodejs.org.

Unzip `raahi.zip` into your home folder so you get `~/raahi`. Keep it **outside iCloud Drive**: `node_modules` has tens of thousands of files and iCloud would try to sync them all. Then, in Terminal:

```bash
cd ~/raahi
npm install
npm run setup     # creates the SQLite database (Prisma migration), generates the Prisma client, loads all places
npm run dev       # API on :4000, app on http://localhost:5173
```

Open **http://localhost:5173**.

`npm install` may print audit warnings; they come from development tools (the test runner and dev server), not from the app itself.

If `npm run setup` can't finish (for example, a network that blocks Prisma's one-time download from binaries.prisma.sh), the app still runs: it tells you in the terminal and keeps data in JSON files under `server/.data` until setup succeeds.

Optional:

```bash
npm test          # runs the algorithm tests
npm run validate-data   # checks every data file and plans a trip for every destination
npm start         # production build, everything served from http://localhost:4000
```

### Photos

Every destination and place ships with real photos picked from Wikimedia Commons and checked by hand: up to 8 per destination, up to 4 per place, plus three "Life here" photos (people, festivals or homes, food). They live in `data/media/photos.json`, so they load instantly with no API key and no searching.

Places you add from the app get photos by live lookup (Wikipedia and Commons). To look those up once and cache them, run `npm run photos`. For travel-photography results on those lookups, add a free [Pexels](https://www.pexels.com/api/) or [Unsplash](https://unsplash.com/developers) key to `server/.env`:

```
PEXELS_API_KEY=your-key
```

Every photo is credited on screen (hover a photo to see its author and licence).

### Must try: food and experiences

Each destination has 4–6 things you shouldn't leave without trying: street food, signature dishes, sweets, drinks and experiences (a dawn boat ride on the Ganga, chole bhature in Delhi, a houseboat night in Alleppey). There are 526 in all, with where to find them and a rough price. They show on every destination page, under each itinerary, and as "A taste of India" on the home page.

- Texts: `data/musttry/*.json`, one file per region. Each item is `[name, kind, where, price in ₹, description, photo key]`.
- Photos: `data/media/musttry-photos.json`, picked by hand from Wikimedia Commons for each photo key. A dish shared by several places (momos, kachori) has a few photos, so each place shows a different one. The few dishes with no good free photo show an illustrated card instead of a wrong picture.

### The database

Raahi uses **Prisma 7 with SQLite** (`server/prisma/raahi.db`). The schema is `server/prisma/schema.prisma`, the tables are created by the migration in `server/prisma/migrations`, and the app connects through Prisma's better-sqlite3 driver adapter (`server/src/db.ts`), so no native Prisma engine runs inside the app. To browse the data: `cd server && npx prisma studio`.

To use PostgreSQL instead: change `provider` to `"postgresql"` in the schema, set `DATABASE_URL` in `server/.env`, swap the adapter in `server/src/db.ts` for `@prisma/adapter-pg`, and create a fresh migration with `npx prisma migrate dev`.

### Putting it online

**Static site (Netlify, what myraahi.netlify.app uses).** Build with `npm run build -w web` and upload the contents of `web/dist` (it already contains `_redirects`, so links like `/trip?r=…` open directly). Or connect the repo to Netlify: `netlify.toml` has the build settings. Everything works without a server: trips are planned in the browser from the bundled data, maps load OpenStreetMap tiles, and weather comes straight from Open-Meteo and refreshes itself every 10 minutes (and whenever you come back to the tab). No API keys are needed.

**With the Raahi server (optional).** The server adds things a static site can't keep: places that people add, problem reports, and "Trending" from real plans. Host the repo on any Node host (Render, Railway, Fly.io; Node 22): build command `npm install && npm run setup`, start command `npm run start -w server`. Then rebuild the site with its address:

```bash
VITE_API_URL=https://your-raahi-server.onrender.com npm run build -w web
```

The site then talks to that server and falls back to the bundled data if it's ever unreachable. The server already allows cross-site requests (CORS). Free hosts often put idle servers to sleep, so the first request after a while can take ~30 seconds; the fallback keeps the app usable meanwhile.

For heavy map traffic, set `VITE_TILE_URL` to a tile provider with your own key (MapTiler, Stadia); the default uses OpenStreetMap's public tiles with an Esri fallback.

---

## How it's built

```
raahi/
├── data/                  Curated destinations and places (one JSON file per region); data/media/photos.json
├── packages/planner/      All the algorithms. Pure TypeScript, no I/O, fully tested
├── packages/media/        Finds real photos (Wikipedia, Commons, Pexels, Unsplash)
├── server/                Express API, Prisma 7 + SQLite, weekly refresh jobs
└── web/                   React + Vite + Tailwind + Framer Motion + Leaflet
```

The API is deliberately thin: it validates the request (Zod), calls the planner, and returns JSON. The same planner runs in the browser too, which is why the "What if…" sliders re-plan instantly.

### Screens

| Screen | What it does |
| --- | --- |
| Discover | Search, Trending now (with the reason), In season, Hidden gems, explore by type and region |
| Destination | Photo hero, quick facts, live weather, **Life here** (people, food, festivals), places, map |
| Plan a trip | Destinations, dates, trip length, start point, companions, budget, interests, pace, popular ↔ off-beat |
| Itinerary | Day tabs, timeline with times and travel legs, synced map, costs, what-if sliders, left out & why |
| How Raahi decided | Every step of the pipeline, the resource-allocation split and algorithm timings |
| Place | Photos, hours, fees, tips, nearby places, Google Maps, "Something's wrong?" report |
| Saved | Trips saved on this device |
| Add a place | Add a place on the map. It joins the planner immediately |

---

## The DSA behind it (DSA-II, Units 2 & 3)

| Topic | Unit | Where it runs | File |
| --- | --- | --- | --- |
| Adjacency list graph | 2 | Places as vertices, roads as weighted edges | `packages/planner/src/graph.ts` (`Graph`) |
| DFS, connected components | 2 | Drops places cut off by closed roads (e.g. Kunzum Pass in winter) | `dfsReachable`, `connectedComponents` |
| BFS | 2 | "Nearby places" on the place page (2 hops) | `bfsWithinHops`, `discover.ts` → `nearbyPlaces` |
| Dijkstra (binary heap) | 2 | Shortest times from your start point | `dijkstra` |
| Floyd–Warshall | 2 | Travel time between every pair of places | `floydWarshall` |
| Kruskal (union-find), Prim | 2 | Road network backbone, and splitting stops into days (MST clustering) | `kruskal`, `prim`, `mstClusters` |
| 0/1 Knapsack, two capacities | 3 | Picks the best set of places within budget **and** time | `dp.ts` → `knapsack2D` |
| LCS | 3 | Plan similarity; the tests use it to prove "Show me another plan" really changes the stops | `lcs`, `planSimilarity` |
| Resource allocation (multistage DP) | 3 | Shares days between cities in a multi-city trip | `resourceAllocation` |
| Min-heap / top-K | — | Trending list, Dijkstra's priority queue | `heap.ts` |
| Trie | — | Search-as-you-type over all destinations and places | `trie.ts` |

Bellman–Ford is not used because travel times are never negative, so Dijkstra is correct and faster. Matrix-chain multiplication has no natural place in trip planning.

**Pipeline** (`packages/planner/src/plan.ts`):

1. Filter by date, season, weekly closures, group (kids or elders) and opening hours
2. Build the road graph and run DFS to find reachable places
3. Dijkstra and Floyd–Warshall for travel times
4. Score each place for this traveller (interests, companions, popular ↔ off-beat)
5. Knapsack DP picks the best set of places for the budget and time
6. Kruskal MST groups the picks into days; nearest neighbour + 2-opt orders each day; every stop is checked against opening hours
7. Select → schedule → reselect: stops that real opening hours push out are swapped for others, and gaps are filled
8. Explain everything left out, with the reason

The tests (`npm test`) check the DP against brute force on 200 random cases, Dijkstra against Floyd–Warshall, Kruskal against Prim, and that every plan stays inside opening hours and budget.

---

## Adding destinations

Each file in `data/` is an array of destinations, each with its places. The keys are short to keep files readable; `packages/planner/src/data.ts` documents every key. After editing, run `npm run validate-data` (it checks coordinates, categories and hours, and plans a trip for every destination), then `npm run seed` to load the changes into the database.

You can also add single places from the app's **Add a place** screen.

## About the data

Places, opening hours, fees and travel times are curated estimates. Hours and fees change, so check before you go. Travel times are estimated from straight-line distance and terrain, except where real roads are listed (Spiti, Ladakh), and the app labels them as estimates. Raahi scores (1–10) are curated quality scores, not user reviews.

Map data and tiles © OpenStreetMap contributors. Weather by Open-Meteo (live, no key). Photos © their authors on Wikimedia Commons (licence shown on each photo) / Pexels / Unsplash.
