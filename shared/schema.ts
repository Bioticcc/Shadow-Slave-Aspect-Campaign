import { pgTable, text, serial, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

type Trait = {
  name: string;
  description: string;
  effect: string;
};

export type MemoryType = "armor" | "weapon" | "tool" | "charm";

export type Memory = {
  name: string;
  description: string;
  effect: string;
  memoryType: MemoryType;
  currentDurability: number;
  maxDurability: number;
  isSummoned: boolean;
};

export const MEMORY_TYPES: MemoryType[] = ["armor", "weapon", "tool", "charm"];

export const CLASS_TIERS = [
  { name: "Beast", maxFragments: 1000 },
  { name: "Monster", maxFragments: 2000 },
  { name: "Demon", maxFragments: 3000 },
  { name: "Devil", maxFragments: 4000 },
  { name: "Tyrant", maxFragments: 5000 },
  { name: "Terror", maxFragments: 6000 },
  { name: "Titan", maxFragments: 7000 },
] as const;

export function getClassTierIndex(className: string): number {
  const idx = CLASS_TIERS.findIndex(t => t.name === className);
  return idx >= 0 ? idx : 0;
}

export function getMaxFragmentsForClass(className: string): number {
  const tier = CLASS_TIERS.find(t => t.name === className);
  return tier ? tier.maxFragments : 1000;
}

export function getEssenceMax(totalSoulFragments: number): number {
  return 10 + Math.floor(totalSoulFragments / 100) * 10;
}

export function computeClassUp(currentClass: string, currentFragments: number, totalSoulFragments: number): {
  newClass: string;
  newFragments: number;
  newTotalFragments: number;
  newMaxEssence: number;
  classedUp: boolean;
} {
  const max = getMaxFragmentsForClass(currentClass);
  const tierIdx = getClassTierIndex(currentClass);
  const isMaxTier = tierIdx >= CLASS_TIERS.length - 1;

  if (currentFragments >= max && !isMaxTier) {
    const nextTierIdx = tierIdx + 1;
    const newClass = CLASS_TIERS[nextTierIdx].name;
    return {
      newClass,
      newFragments: 0,
      newTotalFragments: totalSoulFragments,
      newMaxEssence: getEssenceMax(totalSoulFragments),
      classedUp: true,
    };
  }

  return {
    newClass: currentClass,
    newFragments: isMaxTier ? Math.min(currentFragments, max) : currentFragments,
    newTotalFragments: totalSoulFragments,
    newMaxEssence: getEssenceMax(totalSoulFragments),
    classedUp: false,
  };
}

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  currentHealth: integer("current_health").notNull().default(8),
  maxHealth: integer("max_health").notNull().default(8),
  currentEssence: integer("current_essence").notNull().default(10),
  maxEssence: integer("max_essence").notNull().default(10),
  trueName: text("true_name").notNull(),
  rank: text("rank").notNull(), // "Dreamer", "Awakened", "Master", "Saint", "Sovreign", "##??!??!??!_Null_UnKnown"
  corePrefix: text("core_prefix").notNull().default("Soul"),
  soulCore: text("soul_core").notNull().default("Dormant"),
  soulFragments: integer("soul_fragments").notNull().default(0),
  soulClass: text("soul_class").notNull().default("Beast"),
  totalSoulFragments: integer("total_soul_fragments").notNull().default(0),
  memories: json("memories").$type<Memory[]>().notNull().default([]),
  echoes: text("echoes").notNull().default(""),
  attributes: json("attributes").$type<Trait[]>().notNull().default([]),
  aspect: text("aspect").notNull().default(""),
  aspectRank: text("aspect_rank").notNull().default("Divine"),
  aspectAbilities: json("aspect_abilities").$type<Trait[]>().notNull().default([]),
  aspectAbilityDescription: text("aspect_ability_description").notNull().default(""),
  flaw: json("flaw").$type<Trait>().notNull().default({ name: "", description: "", effect: "" }),
  isActive: integer("is_active").notNull().default(1),
  owner: text("owner").notNull().default("DM"),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true });

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

export type CreateCharacterRequest = InsertCharacter;
export type UpdateCharacterRequest = Partial<InsertCharacter>;

export const ACCOUNTS = [
  { username: "Tien", password: "Cleric", tagColor: "cyan" },
  { username: "Marlin", password: "Bard", tagColor: "pink" },
  { username: "Nico", password: "Ranger", tagColor: "green" },
  { username: "Ambrose", password: "Elantrian", tagColor: "orange" },
  { username: "DM", password: "Wit", tagColor: "yellow" },
] as const;

export type AccountUsername = typeof ACCOUNTS[number]["username"];

export function getAccountByUsername(username: string) {
  return ACCOUNTS.find(a => a.username === username);
}

export function getTagColorForOwner(owner: string): string {
  const account = ACCOUNTS.find(a => a.username === owner);
  return account?.tagColor || "gray";
}

export function normalizeMemory(m: any): Memory {
  return {
    name: m.name || "",
    description: m.description || "",
    effect: m.effect || "",
    memoryType: MEMORY_TYPES.includes(m.memoryType) ? m.memoryType : "tool",
    currentDurability: typeof m.currentDurability === "number" ? m.currentDurability : 10,
    maxDurability: typeof m.maxDurability === "number" ? m.maxDurability : 10,
    isSummoned: !!m.isSummoned,
  };
}

export const WS_EVENTS = {
  UPDATE_CHARACTER: 'update-character',
} as const;

export interface WsMessage<T = unknown> {
  type: keyof typeof WS_EVENTS;
  payload: T;
}
