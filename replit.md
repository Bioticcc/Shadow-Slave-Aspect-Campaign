
  # DND Game Board — Aspects Campaign

  A real-time DND-style game board for tracking characters and their attributes.

  ## Features
  - Real-time character stat synchronization (Health, Essence, Soul Fragments, etc.)
  - Custom character icon uploads (base64, 5MB limit)
  - Stylized character sheets with editable traits (Memories, Attributes, Echoes, Aspect, Flaw)
  - Persistent storage using PostgreSQL
  - Password login guard (SigmaGoon18, stored in localStorage key `campaign_auth`)
  - Class progression system: Beast → Monster → Demon → Devil → Tyrant → Terror → Titan
  - Soul Fragments act as XP; class-up resets fragments to 0 with new max
  - Essence (mana) bar: base 10, +10 per 100 total lifetime soul fragments
  - totalSoulFragments tracks lifetime accumulation (never resets on class-up)

  ## Tech Stack
  - Frontend: React, Tailwind CSS, Shadcn/UI, Lucide Icons, Framer Motion
  - Backend: Express, Node.js, WebSocket (ws)
  - Database: PostgreSQL (Drizzle ORM)
  - State Management: TanStack Query (React Query)

  ## Database Schema (characters table)
  - id, name, icon, currentHealth, maxHealth, currentEssence, maxEssence
  - trueName, rank, soulCore, soulFragments, soulClass, totalSoulFragments
  - memories, echoes, attributes, aspect, aspectRank, aspectAbilities, aspectAbilityDescription, flaw

  ## Key Files
  - `shared/schema.ts` — DB schema, types, class tier constants & helper functions
  - `server/routes.ts` — API routes + WebSocket + seed
  - `server/storage.ts` — Storage interface (CRUD)
  - `client/src/components/CharacterSheet.tsx` — Full character sheet dialog
  - `client/src/components/CharacterCard.tsx` — Board card with HP, class display
  - `client/src/components/LoginGuard.tsx` — Password gate (hideClose dialog)
