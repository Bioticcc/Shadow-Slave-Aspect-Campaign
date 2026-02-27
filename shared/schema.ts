import { pgTable, text, serial, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

type Trait = {
  name: string;
  description: string;
  effect: string;
};

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  currentHealth: integer("current_health").notNull().default(8),
  maxHealth: integer("max_health").notNull().default(8),
  trueName: text("true_name").notNull(),
  rank: text("rank").notNull(), // "Dreamer", "Awakened", "Master", "Saint", "Sovreign", "##??!??!??!_Null_UnKnown"
  soulCore: text("soul_core").notNull().default("Dormant"),
  soulFragments: integer("soul_fragments").notNull().default(0),
  memories: json("memories").$type<Trait[]>().notNull().default([]),
  echoes: text("echoes").notNull().default(""),
  attributes: json("attributes").$type<Trait[]>().notNull().default([]),
  aspect: text("aspect").notNull().default(""),
  aspectRank: text("aspect_rank").notNull().default("Divine"),
  aspectAbilities: json("aspect_abilities").$type<Trait[]>().notNull().default([]),
  aspectAbilityDescription: text("aspect_ability_description").notNull().default(""),
  flaw: json("flaw").$type<Trait>().notNull().default({ name: "", description: "", effect: "" }),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true });

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

export type CreateCharacterRequest = InsertCharacter;
export type UpdateCharacterRequest = Partial<InsertCharacter>;

export const WS_EVENTS = {
  UPDATE_CHARACTER: 'update-character',
} as const;

export interface WsMessage<T = unknown> {
  type: keyof typeof WS_EVENTS;
  payload: T;
}
