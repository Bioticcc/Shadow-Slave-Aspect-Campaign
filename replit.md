
  # DND Game Board — Aspects Campaign

  A real-time DND-style game board for tracking characters and their attributes.

  ## Features
  - Real-time character stat synchronization (Health, Essence, Soul Fragments, etc.)
  - Custom character icon uploads (base64, 5MB limit)
  - Stylized character sheets with editable traits (Memories, Attributes, Echoes, Aspect, Flaw)
  - Persistent storage using PostgreSQL
  - Per-user account login system (5 accounts: Tien, Marlin, Nico, Ambrose, DM)
  - Character ownership: users can only edit their own characters; DM can edit all
  - Colored owner tags in Character List (cyan, pink, green, orange, yellow)
  - Class progression system: Beast → Monster → Demon → Devil → Tyrant → Terror → Titan
  - Customizable core prefix (Soul/Steel/Corrupted etc.) for Core and Fragments
  - Soul Fragments act as XP; class-up resets fragments to 0 with new max
  - Essence (mana) bar: base 10, +10 per 100 total lifetime soul fragments
  - Board view (active characters only) and Character List view (all characters with active/inactive toggle)

  ## Accounts
  - Tien / Cleric (cyan tag)
  - Marlin / Bard (pink tag)
  - Nico / Ranger (green tag)
  - Ambrose / Elantrian (orange tag)
  - DM / Wit (yellow tag) — can edit all characters

  ## Tech Stack
  - Frontend: React, Tailwind CSS, Shadcn/UI, Lucide Icons, Framer Motion
  - Backend: Express, Node.js, WebSocket (ws)
  - Database: PostgreSQL (Drizzle ORM)
  - State Management: TanStack Query (React Query)

  ## Database Schema (characters table)
  - id, name, icon, currentHealth, maxHealth, currentEssence, maxEssence
  - trueName, rank, corePrefix, soulCore, soulFragments, soulClass, totalSoulFragments
  - memories, echoes, attributes, aspect, aspectRank, aspectAbilities, aspectAbilityDescription, flaw
  - isActive, owner

  ## Key Files
  - `shared/schema.ts` — DB schema, types, class tiers, accounts, helper functions
  - `server/routes.ts` — API routes + WebSocket + seed
  - `server/storage.ts` — Storage interface (CRUD)
  - `client/src/lib/auth.tsx` — Auth context provider (login/logout, current user)
  - `client/src/components/CharacterSheet.tsx` — Full character sheet dialog (canEdit prop)
  - `client/src/components/CharacterCard.tsx` — Board card with HP, essence, class display
  - `client/src/components/LoginGuard.tsx` — Per-user account login gate + LogoutButton
  - `client/src/pages/Board.tsx` — Main page with Board/Character List tabs
  - `client/src/components/CreateCharacterDialog.tsx` — New character creation (assigns owner)
