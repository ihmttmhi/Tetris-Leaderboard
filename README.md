# UTS Tetris Elite Leaderboard

A real-time TETR.IO leaderboard for the UTS Tetris Elite club. The app polls each member's stats from the TETR.IO API and displays live rankings across multiple game modes, weekly position changes, and a news feed of recent achievements.

**Live site:** [tetris-leaderboard-online.onrender.com](https://tetris-leaderboard-online.onrender.com/)

## Features

- **Multi-mode leaderboard** — Sort and view by Tetra League (TR), 40 Lines, Blitz, Quick Play, Expert QP, and All-Time QP
- **Real-time updates** — Backend polls TETR.IO every 500ms per player; frontend receives updates via Server-Sent Events (SSE)
- **Weekly Change arrows** — Green up / red down / gray bar icons showing rank movement since the most recent Monday 12am EST. The "since" date updates automatically every Monday.
- **Latest News feed** — Pulls from each member's TETR.IO news API: rank-ups, 40L PBs, Blitz PBs, QP PBs (last 7 days)
- **Mode-specific columns** — Each mode displays the exact columns shown on TETR.IO's official leaderboard pages
- **Replay links** — Click record values (40L, Blitz, QP, Expert QP) to watch the replay on TETR.IO
- **Dark/Light mode** — Sun/moon SVG toggle (defaults to dark mode)
- **Search** — Filter players by name or username

## Architecture

```
tetris-leaderboard/
  backend/
    server.js       Express server, TETR.IO API polling, SSE, REST endpoints
    history.js      Weekly snapshots, Change column logic, TETR.IO news API
    members.json    Club member list (realName, username, grade)
  frontend/
    src/
      App.jsx       Main app: leaderboard table, news box, dark mode, routing
      Bracket.jsx   Tournament Bracket page (maintenance placeholder)
      Resources.jsx Resources page (maintenance placeholder)
      index.css     Global styles, CSS custom properties for theming
      main.jsx      React entry point with BrowserRouter
```

## Backend

### `server.js`

- **Express server** with Helmet, CORS, and rate limiting (60 req/min per IP)
- **`loadMembers()`** — Reads `members.json` on startup
- **`fetchOneUser(member)`** — Calls `ch.tetr.io/api/users/{username}/summaries` to get all game mode stats in one request
- **`rotatingUpdater()`** — Polls one member every 500ms (configurable via `REQUEST_DELAY_MS`), cycling through all members continuously
- **`buildLeaderboard()`** — Sorts members by TR, computes club ranks, triggers weekly rollover check, attaches movement arrows and highlights
- **`notifyClients()`** — Pushes updated leaderboard to all connected SSE clients after each player fetch
- **API endpoints:**
  - `GET /api/leaderboard` — Full leaderboard JSON
  - `GET /api/leaderboard/stream` — SSE stream for real-time updates
- Serves the built frontend from `frontend/dist/` with cache headers (immutable for hashed assets, no-cache for `index.html`)

### `history.js`

- **Weekly snapshots** — Stores rank positions at the start of each week (Monday 00:00 EST). Up to 8 snapshots retained.
- **`weekStartKey(date)`** — Calculates the most recent Monday in `America/Toronto` timezone
- **`maybeRollover(ranks, names, letterRanks, pbs)`** — Called each poll cycle; if the current week key differs from the latest snapshot, creates a new snapshot
- **`getMovement(username, currentRank)`** — Compares current rank against the previous week's snapshot to produce `{ dir: "up"|"down"|"same"|"new", delta }`
- **`getBaselineWeek()`** — Returns the current week's Monday date for the Change column's "since ..." label (via `weekStartKey()`)
- **`fetchAllNews(members)`** — Every 5 minutes, fetches each member's TETR.IO news feed (`/api/news/user_{id}`) for rank-ups and PBs from the last 7 days
- **GitHub persistence** — Stores `history.json` on a dedicated `leaderboard-data` branch via the GitHub Contents API. Survives Render redeploys. Falls back to a local file if `GITHUB_TOKEN` is not set.

### Mode-specific stats collected

| Mode | Stats |
|------|-------|
| **Tetra League** | TR, Letter Rank, PPS, APM, VS, Glicko, Record (W/L + %), World Ranking |
| **40 Lines** | Time, PPS, Pieces, Finesse (faults + %), KPP, KPS, Replay ID |
| **Blitz** | Score, PPS, Pieces, Level, Finesse (faults + %), SPP, Replay ID |
| **Quick Play** | Altitude, PPS, APM, KOs, Time, Climb Speed (avg + peak), Replay ID |
| **Expert QP** | Same as Quick Play |
| **All-Time QP** | Best altitude + replay (no additional stats) |

## Frontend

### `App.jsx`

- **Leaderboard component** — Renders the sortable table with mode-specific columns
- **Highlights component** — "LATEST NEWS" box showing recent achievements with relative timestamps, expandable via "Show more" button
- **Movement component** — Renders up/down/same SVG arrow icons in the Change column
- **ReplayCell component** — Wraps stat values with a link to `tetr.io/#R:{replayId}` when available
- **Sort mode buttons** — TR, 40L, Blitz, Quick Play, Expert QP, All-Time QP
- **Column configurations** — `MODE_COLUMNS` maps each sort mode to its set of `<td>` generators, matching TETR.IO's official column layout
- **Username links** — Each username links to the player's mode-specific TETR.IO profile page (e.g., `/league`, `/40l`, `/blitz`)
- **Dark mode** — CSS custom properties toggle between dark and light themes; defaults to dark

### `index.css`

- CSS custom properties for theming: `--bg-color`, `--text-color`, `--table-border`, `--table-header-bg`, `--table-row-even`, `--table-row-odd`, `--footer-color`
- Light mode overrides via `body.light-mode`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `FRONTEND_URL` | No | `*` | Allowed CORS origins (comma-separated) |
| `REQUEST_DELAY_MS` | No | `500` | Delay between TETR.IO API calls (ms, min 500) |
| `GITHUB_TOKEN` | Yes* | — | GitHub PAT with `repo` scope for persisting history |
| `GITHUB_REPO` | No | `ihmttmhi/Tetris-Leaderboard` | GitHub repo for history storage |
| `HISTORY_BRANCH` | No | `leaderboard-data` | Git branch for history.json |
| `WEEK_TZ` | No | `America/Toronto` | Timezone for weekly rollover calculation |

\* Without `GITHUB_TOKEN`, history resets on every Render redeploy.

## Setup

### Prerequisites
- Node.js (v18+)

### Install dependencies
```bash
cd tetris-leaderboard/backend && npm install
cd ../frontend && npm install
```

### Run locally
```bash
# Terminal 1: Backend
cd tetris-leaderboard/backend
echo "PORT=3001" > .env
node server.js

# Terminal 2: Frontend
cd tetris-leaderboard/frontend
VITE_API_URL=http://localhost:3001 npx vite
```

### Build for production
```bash
cd tetris-leaderboard/frontend
npm run build
```
The backend serves the built frontend from `frontend/dist/`.

## Deployment

Deployed on [Render](https://render.com/) (free tier). UptimeRobot pings the API endpoint every 5 minutes to prevent spin-down.

**Build command:** `cd tetris-leaderboard/frontend && npm install && npm run build && cd ../backend && npm install`
**Start command:** `cd tetris-leaderboard/backend && node server.js`

## Adding Members

Edit `tetris-leaderboard/backend/members.json`:
```json
{
  "realName": "Display Name",
  "username": "tetr_io_username",
  "grade": "M3"
}
```
The `username` must match the player's TETR.IO username exactly (case-insensitive). The `grade` field is the club's internal grading.

## Data Persistence

Weekly snapshots and the Change column baseline are stored in `history.json` on the `leaderboard-data` branch:
- [View history.json](https://github.com/ihmttmhi/Tetris-Leaderboard/blob/leaderboard-data/history.json)

The file contains:
```json
{
  "snapshots": [
    {
      "weekStart": "2026-06-16",
      "ranks": { "username": 1, ... },
      "names": { "username": "Display Name", ... }
    }
  ]
}
```

## License

Private project for UTS Tetris Elite club.
