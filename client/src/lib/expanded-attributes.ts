import { getProficiencyBonus, normalizeStats, type Character, type StarSeekingLimb, type Trait } from "@shared/schema";

const WILOVAN_LIBRARY_NAMES = new Map([
  ["basic swordsmanship", "Basic Swordsmanship"],
  ["weak flight", "Weak Flight"],
  ["dweller sense", "Dweller Sense"],
  ["champion of duels", "Champion of Duels"],
  ["stalward guardian", "Stalwart Guardian"],
  ["stalwart guardian", "Stalwart Guardian"],
  ["bone mound archery", "Bone Mound Archery"],
  ["enhanced acquatic maneverability.", "Enhanced Aquatic Maneuverability"],
  ["enhanced acquatic maneuverability", "Enhanced Aquatic Maneuverability"],
]);

/**
 * Upgrades legacy character-specific attribute data in memory. It is persisted
 * the next time the sheet is saved, while retaining all existing prose.
 */
export function normalizeExpandedAttributes(character: Character): Trait[] {
  const attributes = (character.attributes || []) as Trait[];
  const characterName = character.name.trim().toLowerCase();

  if (characterName === "steven") {
    return attributes.map((trait) =>
      trait.name.trim().toLowerCase() === "abnormal growth" && !trait.rememberedBy
        ? { ...trait, rememberedBy: [] }
        : trait,
    );
  }

  if (characterName === "gordan reacher" || characterName === "gorrdan reacher") {
    return attributes.map((trait) =>
      trait.name.trim().toLowerCase() === "reforging"
        ? {
            ...trait,
            effect: trait.effect.trim() === "?" ? "" : trait.effect,
            reforging: trait.reforging || {
              goalName: "",
              goalNumber: 0,
              monsters: [],
            },
          }
        : trait,
    );
  }

  if (characterName === "yuri") {
    return attributes.map((trait) => {
      if (trait.name.trim().toLowerCase() !== "star seeking") return trait;
      const loreDescription = trait.description.split(/\n\s*abilitys?/i)[0].trim();
      const attackBase = normalizeStats(character.stats).intelligence
        + getProficiencyBonus(character.totalSoulFragments ?? 0);
      const legacy = trait.starSeeking as unknown as Record<string, any> | undefined;
      const makeArm = (source: Record<string, any> = {}): StarSeekingLimb => ({
        id: String(source.id || "arm"),
        name: String(source.name || "Arm"),
        effect: String(source.effect || trait.effect || ""),
        replacement: String(source.replacement || "Yuri’s absent arm"),
        attackAttribute: (["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const).includes(source.attackAttribute)
          ? source.attackAttribute
          : "intelligence",
        isProficient: true,
        activeFormId: String(source.activeFormId || source.activeForm || "arm"),
        transformEssenceCost: Math.max(0, Number(source.transformEssenceCost ?? 2)),
        hitModifier: source.proficiencyManaged
          ? Number(source.hitModifier ?? 0)
          : Number(source.hitModifier ?? attackBase) - attackBase,
        damageDie: String(source.damageDie || "D6"),
        diceCount: Math.max(1, Number(source.diceCount ?? 2)),
        damageModifier: Number(source.damageModifier ?? 2),
        forms: Array.isArray(source.forms) ? source.forms : [
          {
            id: "arm",
            name: "Arm",
            armorBonus: Number(source.armorBonuses?.arm ?? 0),
            description: "Both hands remain available for ordinary tasks.",
          },
          {
            id: "sword",
            name: "Sword",
            armorBonus: Number(source.armorBonuses?.sword ?? 2),
            description: "A celestial blade that deals fire damage.",
            isWeapon: true,
            damageType: "Fire",
            hasUnknownEffect: true,
          },
          {
            id: "shield",
            name: "Shield",
            armorBonus: Number(source.armorBonuses?.shield ?? 3),
            description: "The heavenly arm broadens into a protective shield.",
          },
        ],
        proficiencyManaged: true,
      });
      const limbs = Array.isArray(legacy?.limbs)
        ? legacy.limbs.map((limb: Record<string, any>) => makeArm(limb))
        : [makeArm(legacy)];
      return {
        ...trait,
        description: loreDescription,
        starSeeking: { limbs },
      };
    });
  }

  if (characterName !== "wilovan") return attributes;

  const librarian = attributes.find(
    (trait) => trait.name.trim().toLowerCase() === "venerable librarian",
  );
  if (!librarian) return attributes;

  if (librarian.subAttributes) return attributes;

  const nested: Trait[] = [];
  const remaining = attributes.filter((trait) => {
    if (trait === librarian) return true;
    const correctedName = WILOVAN_LIBRARY_NAMES.get(trait.name.trim().toLowerCase());
    if (!correctedName) return true;
    nested.push({ ...trait, name: correctedName });
    return false;
  });

  return remaining.map((trait) =>
    trait === librarian
      ? {
          ...trait,
          subAttributes: nested,
          activeSubAttribute: "Bone Mound Archery",
        }
      : trait,
  );
}

export function getStarSeekingArmorBonus(attributes: Trait[]): number {
  const starSeeking = attributes.find((trait) => trait.starSeeking)?.starSeeking;
  if (!starSeeking) return 0;
  return starSeeking.limbs.reduce((total, limb) => {
    const activeForm = limb.forms.find((form) => form.id === limb.activeFormId);
    return total + Math.max(0, activeForm?.armorBonus ?? 0);
  }, 0);
}

export function getPrimaryStarSeekingLimb(trait: Trait): StarSeekingLimb | undefined {
  return trait.starSeeking?.limbs.find((limb) => limb.id === "arm") || trait.starSeeking?.limbs[0];
}
