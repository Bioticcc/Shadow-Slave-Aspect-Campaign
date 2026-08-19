# D&D Game Board — Aspects Campaign

A real-time campaign board for tracking characters, combat resources, memories,
echoes, and custom attributes.

## Accounts and campaign access

Each hosted installation is an independent campaign with its own PostgreSQL data.
It includes the same five informal accounts—Tien, Marlin, Nico, Ambrose, and DM—so
a trusted friend group can distinguish character ownership. The DM account can
manage every character; the other accounts manage their own characters.

Every installation must define a private `CAMPAIGN_ACCESS_CODE` in `.env`. The host
shares that code only with players invited to that campaign. It prevents visitors
to a public tunnel from authenticating with only the built-in credentials.
`SESSION_SECRET` is a separate host-only value and should never be shared.

## Features

- Real-time character and campaign synchronization over WebSockets
- Character sheets with health, essence, class progression, and soul fragments
- Memory equipment with types, durability, summon state, and armor absorption
- Echo, trait, reforging, remembered-by, and star-seeking systems
- Dice rolls and a shared round log
- PostgreSQL persistence through Drizzle ORM
- Session-based accounts with character ownership and DM permissions
- Board, character list, memory bank, memory trade, and monster manual views

## Technology

- React, Vite, Tailwind CSS, and shadcn/ui
- Express and Node.js
- PostgreSQL and Drizzle ORM
- TanStack Query and WebSockets

## Quick start

```bash
npm install
cp .env.example .env
# Set CAMPAIGN_ACCESS_CODE and SESSION_SECRET in .env before continuing.
docker compose up -d
set -a
source .env
set +a
npm run db:push
npm run dev
```

The application listens on `http://localhost:5000` by default. See
[HOSTING.md](HOSTING.md) for production, network, and data-import instructions.

## Project structure

```text
client/   React frontend
server/   Express API, authentication, persistence, and WebSockets
shared/   Shared database schema, validation, API contracts, and types
script/   Build and data-import utilities
```

## Commands

- `npm run dev` — run the development server
- `npm run check` — type-check the project
- `npm run build` — build the client and server
- `npm run start` — run the production build
- `npm run db:push` — apply the Drizzle schema
- `npm run db:import:json` — import a character JSON export
