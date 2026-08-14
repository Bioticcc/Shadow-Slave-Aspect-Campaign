import fs from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  characters,
  type Memory,
  type Character,
  normalizeEchoes,
  normalizeMemory,
  getProficiencyBonus,
  normalizeStats,
  serializeEchoes,
} from "../shared/schema";

type UnknownRecord = Record<string, unknown>;

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return fallback;
}

function toText(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function toNullableText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return String(value);
}

function maybeParseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function normalizeMemories(value: unknown, proficiencyBonus: number): Memory[] {
  const parsed = maybeParseJson<unknown[]>(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((m) => normalizeMemory(m, proficiencyBonus));
}

function pick<T = unknown>(row: UnknownRecord, camel: string, snake?: string): T | undefined {
  if (camel in row) return row[camel] as T;
  if (snake && snake in row) return row[snake] as T;
  return undefined;
}

function getRowsFromExport(raw: unknown): UnknownRecord[] {
  if (Array.isArray(raw)) {
    return raw as UnknownRecord[];
  }

  if (raw && typeof raw === "object") {
    const obj = raw as UnknownRecord;
    const possibleKeys = ["rows", "data", "characters", "result"];
    for (const key of possibleKeys) {
      const value = obj[key];
      if (Array.isArray(value)) {
        return value as UnknownRecord[];
      }
    }
  }

  throw new Error(
    "Unsupported JSON format. Expected an array or an object containing rows/data/characters/result.",
  );
}

function normalizeRow(row: UnknownRecord): typeof characters.$inferInsert {
  const idRaw = pick(row, "id");
  const id = idRaw == null ? undefined : toNumber(idRaw, 0);
  const totalSoulFragments = toNumber(
    pick(row, "totalSoulFragments", "total_soul_fragments"),
    0,
  );

  return {
    ...(id && id > 0 ? { id } : {}),
    name: toText(pick(row, "name"), "Unknown"),
    icon: toNullableText(pick(row, "icon")),
    currentHealth: toNumber(pick(row, "currentHealth", "current_health"), 8),
    maxHealth: toNumber(pick(row, "maxHealth", "max_health"), 8),
    armorClass: toNumber(pick(row, "armorClass", "armor_class"), 8),
    currentEssence: toNumber(pick(row, "currentEssence", "current_essence"), 10),
    maxEssence: toNumber(pick(row, "maxEssence", "max_essence"), 10),
    trueName: toText(pick(row, "trueName", "true_name"), ""),
    rank: toText(pick(row, "rank"), "Awakened"),
    corePrefix: toText(pick(row, "corePrefix", "core_prefix"), "Soul"),
    soulCore: toText(pick(row, "soulCore", "soul_core"), "Dormant"),
    soulFragments: toNumber(pick(row, "soulFragments", "soul_fragments"), 0),
    soulClass: toText(pick(row, "soulClass", "soul_class"), "Beast"),
    totalSoulFragments,
    memories: normalizeMemories(pick(row, "memories"), getProficiencyBonus(totalSoulFragments)),
    stats: normalizeStats(maybeParseJson(pick(row, "stats"), {})),
    echoes: serializeEchoes(normalizeEchoes(pick(row, "echoes"))),
    inventoryNotes: toText(
      pick(row, "inventoryNotes", "inventory_notes"),
      "",
    ),
    attributes: maybeParseJson<Character["attributes"]>(pick(row, "attributes"), []),
    aspect: toText(pick(row, "aspect"), ""),
    aspectRank: toText(pick(row, "aspectRank", "aspect_rank"), "Divine"),
    aspectAbilities: maybeParseJson<Character["aspectAbilities"]>(
      pick(row, "aspectAbilities", "aspect_abilities"),
      [],
    ),
    aspectAbilityDescription: toText(
      pick(row, "aspectAbilityDescription", "aspect_ability_description"),
      "",
    ),
    flaw: maybeParseJson<Character["flaw"]>(pick(row, "flaw"), {
      name: "",
      description: "",
      effect: "",
    }),
    isActive: toNumber(pick(row, "isActive", "is_active"), 1),
    owner: toText(pick(row, "owner"), "DM"),
  };
}

async function main() {
  const argPath = process.argv[2] ?? "db-dumps/characters.json";
  const resolvedPath = path.resolve(process.cwd(), argPath);

  const rawText = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(rawText);
  const rows = getRowsFromExport(parsed);
  const normalized = rows.map(normalizeRow);

  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE TABLE "characters" RESTART IDENTITY CASCADE;`);
    if (normalized.length > 0) {
      await tx.insert(characters).values(normalized);
    }
    await tx.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('characters', 'id'),
        COALESCE((SELECT MAX(id) FROM characters), 1),
        true
      );
    `);
  });

  console.log(`Imported ${normalized.length} character rows from ${resolvedPath}`);
}

main()
  .catch((err) => {
    console.error("JSON import failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
