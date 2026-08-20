# Hosting guide

## Quick hosting runbook

Run the production app from Bash:

```bash
cd /home/jeezu/dndBoardREPLIT/Dnd-Game-Board/Dnd-Game-Board
docker compose up -d
set -a
source .env
set +a
npm run build
npm run start
```

Open and verify the Funnel:

```bash
tailscale status
tailscale funnel 5000
tailscale funnel status
```

For local testing only, use `npm run dev`. Do not use the development server with
the public Funnel.

When WSL's IP changes, refresh the proxy from an Administrator PowerShell window:

```powershell
$wslIp = (wsl hostname -I).Trim().Split(' ')[0]
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=5000
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5000 connectaddress=$wslIp connectport=5000
netsh interface portproxy show v4tov4
```

Share the resulting `*.ts.net` URL with the group.

## Prerequisites

- Node.js 20+
- npm
- Docker with Compose, or a PostgreSQL 16+ server

## Local database

From the project root, start the included PostgreSQL service:

```bash
docker compose up -d
```

The default development database is available at `localhost:5432`. Its database,
user, and password values are defined in `docker-compose.yml` and `.env.example`.

## Environment

Create and load a local environment file:

```bash
cp .env.example .env
set -a
source .env
set +a
```

Set a private `CAMPAIGN_ACCESS_CODE` to share with invited players and a strong,
host-only `SESSION_SECRET`. Account password overrides are optional for trusted
groups using the built-in accounts as informal ownership labels.

## Install and initialize

```bash
npm install
npm run db:push
```

## Development

```bash
npm run dev
```

The server listens on `0.0.0.0:5000` by default. Other devices on the same network
can connect through `http://YOUR_LOCAL_IP:5000` if the operating-system firewall
allows inbound TCP traffic on that port.

## Production

```bash
npm run build
npm run start
```

Use the production build for public or tunneled access. Do not expose the Vite
development server to the internet.

## Import character data

Place a JSON export at `db-dumps/characters.json`, then run:

```bash
npm run db:import:json
```

To import another path:

```bash
npm run db:import:json -- /path/to/characters.json
```

For a PostgreSQL dump, restore it directly into the configured database:

```bash
psql "$DATABASE_URL" < dnd_board_backup.sql
```

## Tailscale Funnel

When Tailscale is installed and authenticated, the production server can be shared
through a Funnel:

```bash
tailscale funnel 5000
tailscale funnel status
```

On Windows with the server running inside WSL, refresh the port proxy after the WSL
address changes:

```powershell
$wslIp = (wsl hostname -I).Trim().Split(' ')[0]
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=5000
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5000 connectaddress=$wslIp connectport=5000
```

Public exposure is still internet exposure. Keep backups, use strong credentials,
and terminate TLS through a trusted proxy or tunnel.
