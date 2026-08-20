import { pgTable, text, serial, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type Trait = {
  name: string;
  description: string;
  effect: string;
  /** Nested choices turn a normal trait into an expanded attribute. */
  subAttributes?: Trait[];
  activeSubAttribute?: string;
  rememberedBy?: RememberedPerson[];
  reforging?: ReforgingTracker;
  starSeeking?: StarSeekingAttribute;
};

export type RememberedPerson = {
  name: string;
  effect: string;
  nameKnown: boolean;
  effectKnown: boolean;
};

export type ReforgingMonster = {
  name: string;
  reforgedCount: number;
  totalRequired: number | null;
};

export type ReforgingTracker = {
  goalName: string;
  goalNumber: number;
  monsters: ReforgingMonster[];
};

export type StarSeekingForm = {
  id: string;
  name: string;
  armorBonus: number;
  description: string;
  isWeapon?: boolean;
  damageType?: string;
  hasUnknownEffect?: boolean;
};

export type StarSeekingLimb = {
  id: string;
  name: string;
  effect: string;
  replacement: string;
  attackAttribute: keyof CharacterStats;
  isProficient: true;
  activeFormId: string;
  transformEssenceCost: number;
  hitModifier: number;
  damageDie: string;
  diceCount: number;
  damageModifier: number;
  forms: StarSeekingForm[];
  proficiencyManaged?: boolean;
};

export type StarSeekingAttribute = {
  limbs: StarSeekingLimb[];
};

export type MemoryType = "armor" | "weapon" | "tool" | "charm";
export const MEMORY_CORES = [
  "dormant",
  "awakened",
  "ascended",
  "transcended",
  "supreme",
  "sacred",
  "divine",
] as const;
export type MemoryCore = typeof MEMORY_CORES[number];
export const MEMORY_TIERS = [1, 2, 3, 4, 5, 6, 7] as const;
export const ARMOR_DEXTERITY_BONUS_MODES = ["full", "half", "none"] as const;
export type ArmorDexterityBonusMode = typeof ARMOR_DEXTERITY_BONUS_MODES[number];

export type WeaponDamage = {
  attackStat?: StatKey;
  statModifierManaged?: boolean;
  hitModifier: number;
  damageDie: string;
  diceCount: number;
  damageModifier: number;
};

export type Memory = {
  name: string;
  description: string;
  effect: string;
  memoryType: MemoryType;
  core: MemoryCore;
  tier: number;
  essenceCost: number;
  armorClass?: number;
  armorDexterityBonus?: ArmorDexterityBonusMode;
  isDamageDealing: boolean;
  currentDurability: number;
  maxDurability: number;
  healRate: number;
  isSummoned: boolean;
  isProficient?: boolean;
  weaponDamage?: WeaponDamage;
};

export type EchoDamageMove = {
  name: string;
  description: string;
  hitModifier: number;
  damageDie: string;
  diceCount: number;
  damageModifier: number;
};

export type Echo = {
  name: string;
  armorClass: number;
  description: string;
  damageMoves: EchoDamageMove[];
  core: MemoryCore;
  tier: number;
  currentHealth: number;
  maxHealth: number;
  healRate: number;
  summonCost: number;
  isSummoned: boolean;
};

export type SheetCounterTarget = "attribute" | "memory" | "echo";

export type SheetCounter = {
  id: string;
  targetType: SheetCounterTarget;
  targetIndex: number;
  value: number;
};

export function normalizeSheetCounters(value: unknown): SheetCounter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<SheetCounter>;
    if (raw.targetType !== "attribute" && raw.targetType !== "memory" && raw.targetType !== "echo") return [];
    const targetIndex = Number.isFinite(Number(raw.targetIndex)) ? Math.max(0, Math.floor(Number(raw.targetIndex))) : 0;
    const counterValue = Number.isFinite(Number(raw.value)) ? Math.floor(Number(raw.value)) : 0;
    return [{
      id: typeof raw.id === "string" && raw.id ? raw.id : `counter-${index}`,
      targetType: raw.targetType,
      targetIndex,
      value: counterValue,
    }];
  });
}

export const MEMORY_TYPES: MemoryType[] = ["armor", "weapon", "tool", "charm"];

export type CharacterStats = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export const STAT_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export type StatKey = typeof STAT_KEYS[number];
export type StatTrainingLevel = "proficient" | "expertise";
export type StatAllocationRecord = {
  milestone: number;
  stat: StatKey;
  amount: number;
  className: string;
};
export type StatProgression = {
  processedMilestones: number;
  allocationClass?: string;
  milestoneVersion?: number;
  allocationHistory?: StatAllocationRecord[];
  training: Partial<Record<StatKey, StatTrainingLevel>>;
  saveProficiencies?: Partial<Record<StatKey, boolean>>;
  checkProficiencies?: Record<string, boolean>;
  physicalChoice?: StatKey;
  mentalChoice?: StatKey;
  titanApplied: boolean;
};

export const DEFAULT_STATS: CharacterStats = {
  strength: 0,
  dexterity: 0,
  constitution: 0,
  intelligence: 0,
  wisdom: 0,
  charisma: 0,
};

export const CLASS_TIERS = [
  { name: "Beast", maxFragments: 1000 },
  { name: "Monster", maxFragments: 2000 },
  { name: "Demon", maxFragments: 3000 },
  { name: "Devil", maxFragments: 4000 },
  { name: "Tyrant", maxFragments: 5000 },
  { name: "Terror", maxFragments: 6000 },
  { name: "Titan", maxFragments: 7000 },
] as const;

export const CLASS_PROGRESSION_DESCRIPTIONS: Record<string, string> = {
  Beast: "Every 100 cumulative fragments grants +1 to any stat.",
  Monster: "You feel stronger. Every 100 fragments grants +1 to a highest stat, or +2 to a stat at least 5 below it. Choose a physical stat for proficiency; existing proficiency becomes expertise.",
  Demon: "Every 100 fragments grants +2 to any stat. Choose a mental stat for proficiency; existing proficiency becomes expertise.",
  Devil: "Every 100 fragments grants +2 to any stat, or +3 to one of your two lowest stats.",
  Tyrant: "Every 100 fragments grants +3 to any stat.",
  Terror: "Every 100 fragments grants +4 to any stat.",
  Titan: "At 7,000 cumulative fragments, every stat automatically increases by 5.",
};

export function getClassTierIndex(className: string): number {
  const idx = CLASS_TIERS.findIndex(t => t.name === className);
  return idx >= 0 ? idx : 0;
}

export function getMaxFragmentsForClass(className: string): number {
  const tier = CLASS_TIERS.find(t => t.name === className);
  return tier ? tier.maxFragments : 1000;
}

export function getClassForFragments(fragments: number): string {
  const value = Math.max(0, fragments || 0);
  if (value >= 21000) return "Titan";
  if (value >= 15000) return "Terror";
  if (value >= 10000) return "Tyrant";
  if (value >= 6000) return "Devil";
  if (value >= 3000) return "Demon";
  if (value >= 1000) return "Monster";
  return "Beast";
}

export function getCumulativeFragmentsForProgress(currentClass: string, currentFragments: number): number {
  const tierIndex = getClassTierIndex(currentClass);
  const completedClassFragments = CLASS_TIERS
    .slice(0, tierIndex)
    .reduce((total, tier) => total + tier.maxFragments, 0);
  const currentMaximum = CLASS_TIERS[tierIndex]?.maxFragments ?? 1000;
  return completedClassFragments + Math.max(0, Math.min(currentFragments || 0, currentMaximum));
}

export function getEssenceMax(totalSoulFragments: number): number {
  return 10 + Math.floor(totalSoulFragments / 100) * 10;
}

export function getEssenceMaxForProgress(currentClass: string, currentFragments: number): number {
  return getEssenceMax(getCumulativeFragmentsForProgress(currentClass, currentFragments));
}

export function getProficiencyBonus(currentFragments: number): number {
  const shards = Math.max(0, currentFragments || 0);
  if (shards >= 7000) return 12;
  if (shards >= 6000) return 11;
  if (shards >= 5300) return 10;
  if (shards >= 4400) return 9;
  if (shards >= 3500) return 8;
  if (shards >= 2700) return 7;
  if (shards >= 2100) return 6;
  if (shards >= 1600) return 5;
  if (shards >= 1000) return 4;
  if (shards >= 400) return 3;
  return 2;
}

export function computeClassUp(currentClass: string, currentFragments: number, _totalSoulFragments?: number): {
  newClass: string;
  newFragments: number;
  newTotalFragments: number;
  newMaxEssence: number;
  classedUp: boolean;
} {
  const currentTierIndex = getClassTierIndex(currentClass);
  const currentMaximum = CLASS_TIERS[currentTierIndex]?.maxFragments ?? 1000;
  const canClassUp = currentTierIndex < CLASS_TIERS.length - 1;
  const classedUp = canClassUp && currentFragments >= currentMaximum;
  const newClass = classedUp ? CLASS_TIERS[currentTierIndex + 1].name : currentClass;
  const newFragments = classedUp ? 0 : Math.max(0, Math.min(currentFragments, currentMaximum));
  const newTotalFragments = getCumulativeFragmentsForProgress(newClass, newFragments);
  return {
    newClass,
    newFragments,
    newTotalFragments,
    newMaxEssence: getEssenceMaxForProgress(newClass, newFragments),
    classedUp,
  };
}

export function normalizeStatProgression(value: unknown, currentFragments: number, currentClass = "Beast"): StatProgression {
  const raw = value && typeof value === "object" ? value as Partial<StatProgression> : null;
  const availableMilestones = currentClass === "Titan" ? 0 : Math.floor(Math.max(0, currentFragments) / 100);
  const savedProgression = !!raw
    && typeof raw.processedMilestones === "number"
    && typeof raw.allocationClass === "string"
    && (raw.milestoneVersion === 2 || raw.milestoneVersion === 3);
  const trainingRaw = raw?.training && typeof raw.training === "object" ? raw.training : {};
  const training: Partial<Record<StatKey, StatTrainingLevel>> = {};
  for (const key of STAT_KEYS) {
    const level = trainingRaw[key];
    if (level === "proficient" || level === "expertise") training[key] = level;
  }
  const saveProficienciesRaw = raw?.saveProficiencies && typeof raw.saveProficiencies === "object" ? raw.saveProficiencies : {};
  const saveProficiencies: Partial<Record<StatKey, boolean>> = {};
  for (const key of STAT_KEYS) {
    if (saveProficienciesRaw[key] === true) saveProficiencies[key] = true;
  }
  const checkProficienciesRaw = raw?.checkProficiencies && typeof raw.checkProficiencies === "object" ? raw.checkProficiencies : {};
  const checkProficiencies: Record<string, boolean> = {};
  for (const [key, proficient] of Object.entries(checkProficienciesRaw)) {
    if (proficient === true) checkProficiencies[key] = true;
  }
  const allocationHistory = Array.isArray(raw?.allocationHistory)
    ? raw.allocationHistory.filter((record): record is StatAllocationRecord => {
      if (!record || typeof record !== "object") return false;
      const candidate = record as Partial<StatAllocationRecord>;
      return typeof candidate.milestone === "number"
        && STAT_KEYS.includes(candidate.stat as StatKey)
        && typeof candidate.amount === "number"
        && typeof candidate.className === "string";
    }).map((record) => ({
      milestone: Math.max(1, Math.floor(record.milestone)),
      stat: record.stat,
      amount: Math.max(0, Math.floor(record.amount)),
      className: record.className,
    }))
    : [];
  return {
    processedMilestones: savedProgression && raw!.allocationClass === currentClass
      ? Math.min(availableMilestones, Math.max(0, Math.floor(raw!.processedMilestones!)))
      : availableMilestones,
    allocationClass: currentClass,
    milestoneVersion: 3,
    allocationHistory,
    training,
    saveProficiencies,
    checkProficiencies,
    physicalChoice: STAT_KEYS.includes(raw?.physicalChoice as StatKey) ? raw?.physicalChoice : undefined,
    mentalChoice: STAT_KEYS.includes(raw?.mentalChoice as StatKey) ? raw?.mentalChoice : undefined,
    titanApplied: typeof raw?.titanApplied === "boolean" ? raw.titanApplied : false,
  };
}

export function rollbackStatAllocations(
  progression: StatProgression,
  currentFragments: number,
  currentClass: string,
  stats: CharacterStats,
): { progression: StatProgression; stats: CharacterStats } {
  const availableMilestones = currentClass === "Titan" ? 0 : Math.floor(Math.max(0, currentFragments) / 100);
  const nextStats = { ...stats };
  const history = progression.allocationHistory || [];
  const retainedHistory: StatAllocationRecord[] = [];

  for (const record of history) {
    if (record.className === currentClass && record.milestone > availableMilestones) {
      nextStats[record.stat] -= record.amount;
    } else {
      retainedHistory.push(record);
    }
  }

  return {
    stats: nextStats,
    progression: {
      ...progression,
      processedMilestones: Math.min(progression.processedMilestones, availableMilestones),
      allocationHistory: retainedHistory,
    },
  };
}

export type StatAllocation = { milestone: number; options: Partial<Record<StatKey, number>>; label: string };

export function getNextStatAllocation(progression: StatProgression, currentFragments: number, currentClass: string, stats: CharacterStats): StatAllocation | null {
  if (currentClass === "Titan") return null;
  const available = Math.floor(Math.max(0, currentFragments) / 100);
  const milestone = progression.processedMilestones + 1;
  if (milestone > available) return null;
  const options: Partial<Record<StatKey, number>> = {};
  if (currentClass === "Beast") {
    for (const key of STAT_KEYS) options[key] = 1;
    return { milestone, options, label: "+1 to any stat" };
  }
  if (currentClass === "Monster") {
    const highest = Math.max(...STAT_KEYS.map((key) => stats[key]));
    for (const key of STAT_KEYS) {
      if (stats[key] === highest) options[key] = 1;
      else if (highest - stats[key] >= 5) options[key] = 2;
    }
    return { milestone, options, label: "+1 to highest, or +2 if 5 below highest" };
  }
  if (currentClass === "Demon") {
    for (const key of STAT_KEYS) options[key] = 2;
    return { milestone, options, label: "+2 to any stat" };
  }
  if (currentClass === "Devil") {
    const ordered = STAT_KEYS.map((key, index) => ({ key, index, value: stats[key] }))
      .sort((a, b) => a.value - b.value || a.index - b.index);
    const lowestTwo = new Set(ordered.slice(0, 2).map(({ key }) => key));
    for (const key of STAT_KEYS) options[key] = lowestTwo.has(key) ? 3 : 2;
    return { milestone, options, label: "+2 to any stat, or +3 to lowest" };
  }
  if (currentClass === "Tyrant") {
    for (const key of STAT_KEYS) options[key] = 3;
    return { milestone, options, label: "+3 to any stat" };
  }
  for (const key of STAT_KEYS) options[key] = 4;
  return { milestone, options, label: "+4 to any stat" };
}

export function getPendingStatAllocationCount(progression: StatProgression, currentFragments: number, currentClass: string): number {
  if (currentClass === "Titan") return 0;
  return Math.max(0, Math.floor(Math.max(0, currentFragments) / 100) - progression.processedMilestones);
}

export function getStatTrainingBonus(progression: StatProgression, stat: StatKey, proficiencyBonus: number): number {
  const level = progression.training[stat];
  return level === "expertise" ? proficiencyBonus * 2 : level === "proficient" ? proficiencyBonus : 0;
}

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  accentColor: text("accent_color").notNull().default("#b45353"),
  currentHealth: integer("current_health").notNull().default(8),
  maxHealth: integer("max_health").notNull().default(8),
  armorClass: integer("armor_class").notNull().default(8),
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
  stats: json("stats").$type<CharacterStats>().notNull().default(DEFAULT_STATS),
  statProgression: json("stat_progression").$type<StatProgression>().notNull().default({} as StatProgression),
  echoes: text("echoes").notNull().default(""),
  inventoryNotes: text("inventory_notes").notNull().default(""),
  attributes: json("attributes").$type<Trait[]>().notNull().default([]),
  aspect: text("aspect").notNull().default(""),
  aspectRank: text("aspect_rank").notNull().default("Divine"),
  aspectAbilities: json("aspect_abilities").$type<Trait[]>().notNull().default([]),
  aspectAbilityDescription: text("aspect_ability_description").notNull().default(""),
  flaw: json("flaw").$type<Trait>().notNull().default({ name: "", description: "", effect: "" }),
  sheetCounters: json("sheet_counters").$type<SheetCounter[]>().notNull().default([]),
  isActive: integer("is_active").notNull().default(1),
  owner: text("owner").notNull().default("DM"),
});

export const memoryBank = pgTable("memory_bank", {
  id: serial("id").primaryKey(),
  memory: json("memory").$type<Memory>().notNull(),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true });

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;
export type MemoryBankMemory = typeof memoryBank.$inferSelect;

export type CreateCharacterRequest = InsertCharacter;
export type UpdateCharacterRequest = Partial<InsertCharacter>;

export const ACCOUNTS = [
  { username: "Tien", tagColor: "cyan" },
  { username: "Marlin", tagColor: "pink" },
  { username: "Nico", tagColor: "green" },
  { username: "Ambrose", tagColor: "orange" },
  { username: "DM", tagColor: "yellow" },
] as const;

export type AccountUsername = typeof ACCOUNTS[number]["username"];

export function getAccountByUsername(username: string) {
  return ACCOUNTS.find(a => a.username === username);
}

export function getTagColorForOwner(owner: string): string {
  const account = ACCOUNTS.find(a => a.username === owner);
  return account?.tagColor || "gray";
}

export const DAMAGE_DICE = ["D4", "D6", "D8", "D10", "D12", "D20", "D100"] as const;

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeStats(value: unknown): CharacterStats {
  const raw = (value && typeof value === "object") ? (value as Record<string, unknown>) : {};
  return {
    strength: toNumber(raw.strength, 0),
    dexterity: toNumber(raw.dexterity, 0),
    constitution: toNumber(raw.constitution, 0),
    intelligence: toNumber(raw.intelligence, 0),
    wisdom: toNumber(raw.wisdom, 0),
    charisma: toNumber(raw.charisma, 0),
  };
}

export function getArmorDexterityBonus(
  dexterityModifier: number,
  mode: ArmorDexterityBonusMode = "full",
): number {
  if (mode === "none") return 0;
  if (mode === "half") return Math.trunc(dexterityModifier / 2);
  return dexterityModifier;
}

export function normalizeMemory(m: any, proficiencyBonus = 2): Memory {
  const memoryType: MemoryType = MEMORY_TYPES.includes(m.memoryType) ? m.memoryType : "tool";
  const coreRaw = typeof m?.core === "string" ? m.core.toLowerCase() : "";
  const core: MemoryCore = MEMORY_CORES.includes(coreRaw as MemoryCore) ? (coreRaw as MemoryCore) : "dormant";
  const tierRaw = toNumber(m?.tier, 1);
  const tier = Math.max(1, Math.min(7, tierRaw));
  const hasDamageConfig = !!m?.weaponDamage;
  const rawDamageToggle = typeof m?.isDamageDealing === "boolean" ? m.isDamageDealing : hasDamageConfig;
  const isDamageDealing = memoryType === "weapon" ? true : rawDamageToggle;
  const usesProficiency = memoryType === "weapon" || memoryType === "armor";
  const hasSavedProficiency = typeof m?.isProficient === "boolean";
  const isAmenkahShard = String(m?.name || "").trim().toLowerCase() === "shard of amenkah";
  const isProficient = usesProficiency
    ? (hasSavedProficiency ? m.isProficient : !isAmenkahShard)
    : undefined;

  const mem: Memory = {
    name: m.name || "",
    description: m.description || "",
    effect: m.effect || "",
    memoryType,
    core,
    tier,
    essenceCost: Math.max(0, toNumber(m?.essenceCost, 0)),
    isDamageDealing,
    currentDurability: typeof m.currentDurability === "number" ? m.currentDurability : 10,
    maxDurability: typeof m.maxDurability === "number" ? m.maxDurability : 10,
    healRate: Math.max(0, toNumber(m?.healRate, 1)),
    isSummoned: !!m.isSummoned,
    isProficient,
  };
  if (memoryType === "armor") {
    mem.armorClass = Math.max(1, toNumber(m?.armorClass, 8));
    const armorDexterityBonusRaw = typeof m?.armorDexterityBonus === "string"
      ? m.armorDexterityBonus.toLowerCase()
      : "";
    mem.armorDexterityBonus = ARMOR_DEXTERITY_BONUS_MODES.includes(
      armorDexterityBonusRaw as ArmorDexterityBonusMode,
    )
      ? (armorDexterityBonusRaw as ArmorDexterityBonusMode)
      : "full";
  }
  if (mem.isDamageDealing) {
    const savedHitModifier = typeof m.weaponDamage?.hitModifier === "number" ? m.weaponDamage.hitModifier : 0;
    const isManagedWeapon = memoryType === "weapon" && m.weaponDamage?.statModifierManaged === true;
    // Every legacy weapon was authored while the campaign-wide bonus was +2.
    // Cap the migration there so an unmigrated weapon still improves if its
    // owner crosses a proficiency threshold before the memory is next saved.
    const legacyProficiency = memoryType === "weapon" && !isManagedWeapon && !hasSavedProficiency && isProficient
      ? Math.min(2, Math.max(0, proficiencyBonus))
      : 0;
    mem.weaponDamage = m.weaponDamage ? {
      attackStat: memoryType === "weapon" && STAT_KEYS.includes(m.weaponDamage.attackStat as StatKey)
        ? m.weaponDamage.attackStat as StatKey
        : "dexterity",
      statModifierManaged: memoryType === "weapon" ? true : undefined,
      hitModifier: memoryType === "weapon" && !isManagedWeapon ? 0 : savedHitModifier - legacyProficiency,
      damageDie: DAMAGE_DICE.includes(m.weaponDamage.damageDie) ? m.weaponDamage.damageDie : "D6",
      diceCount: typeof m.weaponDamage.diceCount === "number" ? m.weaponDamage.diceCount : 1,
      damageModifier: memoryType === "weapon" && !isManagedWeapon
        ? 0
        : typeof m.weaponDamage.damageModifier === "number" ? m.weaponDamage.damageModifier : 0,
    } : { attackStat: "dexterity", statModifierManaged: memoryType === "weapon" ? true : undefined, hitModifier: 0, damageDie: "D6", diceCount: 1, damageModifier: 0 };
  }
  return mem;
}

export function getWeaponAttackStat(memory: Memory): StatKey {
  const attackStat = memory.weaponDamage?.attackStat;
  return STAT_KEYS.includes(attackStat as StatKey) ? attackStat as StatKey : "dexterity";
}

export function getWeaponHitModifier(memory: Memory, stats: CharacterStats): number {
  const manualAdjustment = memory.weaponDamage?.hitModifier ?? 0;
  return memory.memoryType === "weapon" ? stats[getWeaponAttackStat(memory)] + manualAdjustment : manualAdjustment;
}

export function getWeaponDamageModifier(memory: Memory, stats: CharacterStats): number {
  const manualAdjustment = memory.weaponDamage?.damageModifier ?? 0;
  return memory.memoryType === "weapon" ? stats[getWeaponAttackStat(memory)] + manualAdjustment : manualAdjustment;
}

export function getEffectiveMemoryArmorClass(memory: Memory): number {
  const armorClass = Math.max(1, memory.armorClass ?? 8);
  return memory.isProficient === false ? Math.floor(armorClass / 2) : armorClass;
}

function normalizeEchoDamageMove(move: any): EchoDamageMove {
  return {
    name: typeof move?.name === "string" ? move.name : "",
    description: typeof move?.description === "string" ? move.description : "",
    hitModifier: toNumber(move?.hitModifier, 0),
    damageDie: DAMAGE_DICE.includes(move?.damageDie) ? move.damageDie : "D6",
    diceCount: Math.max(1, toNumber(move?.diceCount, 1)),
    damageModifier: toNumber(move?.damageModifier, 0),
  };
}

function normalizeEcho(raw: any): Echo {
  const damageMovesRaw = Array.isArray(raw?.damageMoves)
    ? raw.damageMoves
    : raw?.weaponDamage
      ? [{ name: "Attack", ...raw.weaponDamage }]
      : [];
  const coreRaw = typeof raw?.core === "string" ? raw.core.toLowerCase() : "";
  const core: MemoryCore = MEMORY_CORES.includes(coreRaw as MemoryCore) ? (coreRaw as MemoryCore) : "dormant";
  const tierRaw = toNumber(raw?.tier, 1);
  const tier = Math.max(1, Math.min(7, tierRaw));
  const maxHealth = Math.max(1, toNumber(raw?.maxHealth ?? raw?.health, 8));
  const currentHealth = Math.max(0, Math.min(
    maxHealth,
    toNumber(raw?.currentHealth ?? raw?.health, maxHealth),
  ));

  return {
    name: typeof raw?.name === "string" ? raw.name : "",
    armorClass: Math.max(0, toNumber(raw?.armorClass ?? raw?.ac, 8)),
    description: typeof raw?.description === "string" ? raw.description : "",
    damageMoves: damageMovesRaw.map(normalizeEchoDamageMove),
    core,
    tier,
    currentHealth,
    maxHealth,
    healRate: Math.max(0, toNumber(raw?.healRate, 1)),
    summonCost: Math.max(0, toNumber(raw?.summonCost ?? raw?.essenceCost, 0)),
    isSummoned: !!raw?.isSummoned,
  };
}

export function normalizeEchoes(value: unknown): Echo[] {
  if (Array.isArray(value)) {
    return value.map(normalizeEcho);
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeEcho);
      }
      if (parsed && typeof parsed === "object") {
        return [normalizeEcho(parsed)];
      }
    } catch {
      // Legacy plain-text echoes become a single named echo.
      return [{
        name: text,
        armorClass: 8,
        description: "",
        damageMoves: [],
        core: "dormant",
        tier: 1,
        currentHealth: 8,
        maxHealth: 8,
        healRate: 1,
        summonCost: 0,
        isSummoned: false,
      }];
    }
  }

  return [];
}

export function serializeEchoes(value: unknown): string {
  return JSON.stringify(normalizeEchoes(value));
}

export const WS_EVENTS = {
  UPDATE_CHARACTER: "update-character",
  DICE_ROLL: "dice-roll",
  SYSTEM_MESSAGE: "system-message",
  CAMPAIGN_DAY_UPDATE: "campaign-day-update",
  MEMORY_TRADE_STATE: "memory-trade-state",
  MEMORY_TRADE_REQUEST: "memory-trade-request",
  MEMORY_TRADE_REQUEST_SENT: "memory-trade-request-sent",
  MEMORY_TRADE_REQUEST_DECLINED: "memory-trade-request-declined",
  MEMORY_TRADE_ACCEPT: "memory-trade-accept",
  MEMORY_TRADE_DECLINE: "memory-trade-decline",
  MEMORY_TRADE_SESSION_STARTED: "memory-trade-session-started",
  MEMORY_TRADE_SESSION_UPDATE: "memory-trade-session-update",
  MEMORY_TRADE_SESSION_UPDATED: "memory-trade-session-updated",
  MEMORY_TRADE_SESSION_ACCEPT: "memory-trade-session-accept",
  MEMORY_TRADE_SESSION_CANCEL: "memory-trade-session-cancel",
  MEMORY_TRADE_SESSION_CLOSED: "memory-trade-session-closed",
  MEMORY_TRADE_ERROR: "memory-trade-error",
} as const;

export type DiceRollPayload = {
  user: string;
  results: {
    die: string;
    sides: number;
    rolls: number[];
    subtotal: number;
    label?: string;
    modifier?: number;
    character?: string;
  }[];
  total: number;
};

export type SystemMessagePayload = {
  title: string;
  message: string;
};

export type CampaignDayPayload = {
  dayCount: number;
};

export type MemoryBankEntry = {
  bankId: string;
  source: "character" | "bank";
  ownerCharacterId: number | null;
  ownerCharacterName: string | null;
  ownerUsername: string | null;
  memoryIndex: number | null;
  unownedId: number | null;
  memory: Memory;
};

export type MemoryTradeOffer = {
  characterId: number | null;
  memoryIndexes: number[];
};

export type MemoryTradeRequestPayload = {
  requestId: string;
  fromUser: string;
  toUser: string;
  targetCharacterId: number;
  targetCharacterName: string;
  createdAt: number;
};

export type MemoryTradeSessionPayload = {
  sessionId: string;
  requestId: string;
  requester: string;
  recipient: string;
  offers: Record<string, MemoryTradeOffer>;
  acceptedBy: string[];
  createdAt: number;
};

export type MemoryTradeStatePayload = {
  pendingRequests: MemoryTradeRequestPayload[];
  outgoingRequests: MemoryTradeRequestPayload[];
  activeSession: MemoryTradeSessionPayload | null;
};

export type MemoryTradeRequestDeclinedPayload = {
  requestId: string;
  fromUser: string;
  toUser: string;
  message: string;
};

export type MemoryTradeSessionClosedReason =
  | "completed"
  | "declined"
  | "cancelled"
  | "requester-disconnected"
  | "recipient-disconnected"
  | "invalidated";

export type MemoryTradeSessionClosedPayload = {
  sessionId: string;
  reason: MemoryTradeSessionClosedReason;
  message: string;
};

export type MemoryTradeErrorPayload = {
  message: string;
  requestId?: string;
  sessionId?: string;
};

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}
