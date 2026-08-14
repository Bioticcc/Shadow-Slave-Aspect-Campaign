# RUNNING THE APP (IN BASH):
cd /home/jeezu/dndBoardREPLIT/Dnd-Game-Board/Dnd-Game-Board
docker compose up -d
set -a
source .env
set +a
npm run build
npm run start

npm run dev (THIS ONES FOR TESTING, DONT RUN THIS AND FUNNEL)

# REFRESH POWERSHELL IP
(RUN IN ADMIN POWERSHELL)
$wslIp = (wsl hostname -I).Trim().Split(' ')[0]
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=5000
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5000 connectaddress=$wslIp connectport=5000
netsh interface portproxy show v4tov4

# OPEN TAILSCALE FUNNELw
tailscale status
tailscale funnel 5000
tailscale funnel status

send ...ts.net link to group


# Local Hosting Guide (Replit -> Your Device)

This project can be self-hosted locally while preserving the current UI, mechanics, and realtime behavior.

## What carries over unchanged

- Frontend UI/design (React + Tailwind + shadcn components)
- Game mechanics in client/server code
- Realtime updates over WebSocket (`/ws`)
- Character data model (PostgreSQL + Drizzle schema)

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop (or local PostgreSQL 16+ installed directly)

## 1) Start local PostgreSQL

From this project root:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with:

- DB: `dnd_board`
- User: `dnd_user`
- Password: `dnd_pass`

## 2) Configure local environment

Create `.env` from the template:

```bash
cp .env.example .env
```

Load env vars into your shell before app commands:

```bash
set -a
source .env
set +a
```

Ensure `.env` has a strong `SESSION_SECRET` before sharing outside your LAN.

## 3) Install dependencies and apply schema

```bash
npm install
npm run db:push
```

## 4) Run locally

```bash
npm run dev
```

The app listens on `0.0.0.0:5000`, so devices on your local network can connect using:

```txt
http://YOUR_LOCAL_IP:5000
```

Example: `http://192.168.1.25:5000`

## 5) Copy existing Replit database data

If you want your current live data, export from Replit and import locally.

### On Replit (export)

```bash
pg_dump "$DATABASE_URL" > dnd_board_backup.sql
```

Download `dnd_board_backup.sql` to your machine.

### On your local machine (import)

```bash
psql "postgresql://dnd_user:dnd_pass@localhost:5432/dnd_board" < dnd_board_backup.sql
```

## 6) JSON fallback import (if SQL dump is unavailable)

If you only have table export JSON, you can still import for this project.

Put your file here (project root):

```txt
db-dumps/characters.json
```

Then run:

```bash
mkdir -p db-dumps
set -a
source .env
set +a
npm run db:import:json
```

Or import from a custom path:

```bash
npm run db:import:json -- /absolute/or/relative/path/to/characters.json
```

After import, start the app:

```bash
npm run dev
```

## Local network access notes

- Allow inbound TCP port `5000` in your OS firewall.
- All players must be on the same LAN unless you configure router port forwarding.
- If you later expose it publicly, add HTTPS and stronger auth first.

## Public exposure notes

- This repo now enforces server-side sessions for `/api` and WebSocket access.
- Character write actions are permission-checked server-side (owner or DM).
- Basic abuse controls are enabled (request rate limiting + suspicious path blocking).
- Keep `npm run build && npm run start` for public/tunnel sessions; avoid `npm run dev`.
- Account passwords are validated server-side. You can override defaults with `ACCOUNT_PASSWORD_*` env vars.

## Important security note

Session-based backend auth is now enforced, but tunnel/public hosting is still internet exposure.
Keep backups, use strong `ACCOUNT_PASSWORD_*` values, and run in production mode (`npm run build && npm run start`) when sharing outside LAN.
