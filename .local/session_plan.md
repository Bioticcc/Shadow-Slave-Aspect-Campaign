# Objective
Add a class progression system driven by soul fragments, make soul fragments editable via text input, and add an Essence (mana) bar tied to lifetime fragment accumulation.

# Tasks

### T001: Update Database Schema
- **Blocked By**: []
- **Details**:
  - Add `currentEssence` (integer, default 10) and `maxEssence` (integer, default 10) columns to the characters table
  - Add `soulClass` (text, default "Beast") to track current class
  - Add `totalSoulFragments` (integer, default 0) to track lifetime accumulated fragments (never resets, used to compute essence max)
  - Files: `shared/schema.ts`
  - Run `npm run db:push` to sync DB
  - Acceptance: New columns exist in database

### T002: Add Class Progression Logic (shared utility)
- **Blocked By**: [T001]
- **Details**:
  - Create shared helper functions for class system:
    - `getClassForFragments(totalFragments)` — returns current class name based on total lifetime fragments
    - `CLASS_TIERS` constant: Beast (1000), Monster (2000), Demon (3000), Devil (4000), Tyrant (5000), Terror (6000), Titan (7000)
    - `getMaxFragmentsForClass(className)` — returns the threshold for the current class
    - `getEssenceMax(totalFragments)` — returns 10 + (Math.floor(totalFragments / 100) * 10)
  - When soul fragments reach the class threshold, auto-advance class: reset current fragments to 0, increase totalSoulFragments, set new class, recalculate essence max
  - Files: `shared/schema.ts` (add constants/helpers)

### T003: Update CharacterSheet — Soul Fragments & Class
- **Blocked By**: [T002]
- **Details**:
  - Soul Fragments block: show current/max based on current class threshold
  - Add editable text input for soul fragments in edit mode
  - Display current class name boldly below soul fragments in blue
  - When fragments hit max via +1/+10 buttons, trigger class-up: reset fragments to 0, update class, update totalSoulFragments
  - Files: `client/src/components/CharacterSheet.tsx`

### T004: Add Essence Bar to CharacterSheet
- **Blocked By**: [T001]
- **Details**:
  - Add an Essence bar directly below the Health bar, same visual style but with a purple/violet theme
  - Same +/- increment/decrement buttons as health
  - Display currentEssence / maxEssence
  - Max essence is computed from totalSoulFragments (10 base + 10 per 100 total fragments)
  - In edit mode, allow editing max essence manually as override
  - Files: `client/src/components/CharacterSheet.tsx`

### T005: Update CharacterCard (Board View)
- **Blocked By**: [T002]
- **Details**:
  - Optionally show the character's class on the board card (below rank)
  - Files: `client/src/components/CharacterCard.tsx`
  - Acceptance: Class visible on board cards
