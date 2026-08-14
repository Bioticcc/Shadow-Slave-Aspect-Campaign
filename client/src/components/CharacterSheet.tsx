import { useState, useEffect } from "react";
import {
  type ArmorDexterityBonusMode,
  type Character,
  type CharacterStats,
  type Echo,
  type Memory,
  CLASS_TIERS,
  MEMORY_CORES,
  MEMORY_TIERS,
  WS_EVENTS,
  computeClassUp,
  getEffectiveMemoryArmorClass,
  getArmorDexterityBonus,
  getClassTierIndex,
  getEssenceMax,
  getMaxFragmentsForClass,
  getProficiencyBonus,
  normalizeEchoes,
  normalizeMemory,
  normalizeStats,
  serializeEchoes,
  type DiceRollPayload,
} from "@shared/schema";
import { useUpdateCharacter, useDeleteCharacter } from "@/hooks/use-characters";
import { useAuth } from "@/lib/auth";
import { sendWsMessage } from "@/hooks/use-websocket";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Save, Minus, Plus, Gem, Star, Shield, Dna, Upload, Trash2, Droplets, Swords, Sparkles, Wrench, Zap, Crosshair, Flame, Fingerprint, Anvil } from "lucide-react";
import { TraitPopup } from "./TraitPopup";
import { TraitEditor } from "./TraitEditor";
import { ExpandedTraitPopup } from "./ExpandedTraitPopup";
import { RememberedByPopup } from "./RememberedByPopup";
import { ReforgingPopup } from "./ReforgingPopup";
import { StarSeekingPopup } from "./StarSeekingPopup";
import { getPrimaryStarSeekingLimb, getStarSeekingArmorBonus, normalizeExpandedAttributes } from "@/lib/expanded-attributes";
import { MemoryEditor } from "./MemoryEditor";
import { EchoPopup } from "./EchoPopup";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const RANKS = ["Dreamer", "Awakened", "Master", "Saint", "Sovreign", "##??!??!??!_Null_UnKnown"];
const SOUL_CORES = ["Dormant"];
const ASPECT_RANKS = ["Divine"];
const STAT_FIELDS: Array<{ key: keyof CharacterStats; short: string; label: string }> = [
  { key: "strength", short: "STR", label: "Strength" },
  { key: "dexterity", short: "DEX", label: "Dexterity" },
  { key: "constitution", short: "CON", label: "Constitution" },
  { key: "intelligence", short: "INT", label: "Intelligence" },
  { key: "wisdom", short: "WIS", label: "Wisdom" },
  { key: "charisma", short: "CHA", label: "Charisma" },
];

const createDefaultEcho = (name = ""): Echo => ({
  name: name.trim() || "",
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
});

function toStatDrafts(value: unknown): Record<keyof CharacterStats, string> {
  const normalized = normalizeStats(value);
  return {
    strength: String(normalized.strength),
    dexterity: String(normalized.dexterity),
    constitution: String(normalized.constitution),
    intelligence: String(normalized.intelligence),
    wisdom: String(normalized.wisdom),
    charisma: String(normalized.charisma),
  };
}

const MEMORY_TYPE_ICONS: Record<string, typeof Shield> = {
  armor: Shield,
  weapon: Swords,
  tool: Wrench,
  charm: Sparkles,
};

const MEMORY_TYPE_COLORS: Record<string, string> = {
  armor: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  weapon: "text-red-400 border-red-500/30 bg-red-500/10",
  tool: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  charm: "text-purple-400 border-purple-500/30 bg-purple-500/10",
};

const MEMORY_DIALOG_CONTENT_CLASS = "glass-panel border-primary/20 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,36rem)] overflow-hidden gap-0 content-start grid-rows-[auto_minmax(0,1fr)]";
const MEMORY_DIALOG_BODY_CLASS = "h-full border-t border-white/10 pt-3 space-y-3 overflow-y-auto pr-1";
const ECHO_ADD_CONTENT_CLASS = "glass-panel border-primary/20 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,36rem)] overflow-hidden p-0";
const ECHO_ADD_BODY_CLASS = "flex-1 min-h-0 overflow-y-auto p-6 space-y-3";

function getDexterity(character: Character): number {
  return normalizeStats(character.stats).dexterity;
}

function getMemories(character: Character): Memory[] {
  const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
  return (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
}

function getSummonedArmorMemory(character: Character): Memory | null {
  const mems = getMemories(character);
  return mems.find(m => m.memoryType === "armor" && m.isSummoned) || null;
}

function getSummonedArmorDurability(character: Character): { current: number; max: number } | null {
  const armor = getSummonedArmorMemory(character);
  if (!armor) return null;
  return { current: armor.currentDurability, max: armor.maxDurability };
}

function getBaseArmorClass(character: Character): number {
  const armor = getSummonedArmorMemory(character);
  if (armor && typeof armor.armorClass === "number") {
    return getEffectiveMemoryArmorClass(armor);
  }
  return Math.max(1, character.armorClass ?? 8);
}

function getArmorDexterityMode(character: Character): ArmorDexterityBonusMode {
  const armor = getSummonedArmorMemory(character);
  return armor?.armorDexterityBonus ?? "full";
}

function getEffectiveArmorClass(character: Character): number {
  const dexterity = getDexterity(character);
  const dexterityBonus = getArmorDexterityBonus(dexterity, getArmorDexterityMode(character));
  return getBaseArmorClass(character) + dexterityBonus;
}

export function CharacterSheet({ 
  character, 
  open, 
  onOpenChange,
  canEdit = true
}: { 
  character: Character;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canEdit?: boolean;
}) {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Character>>(character);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [lastWeaponRoll, setLastWeaponRoll] = useState<{ type: "hit" | "damage"; result: string; total: number; memoryIndex: number } | null>(null);
  const [lastEchoMoveRoll, setLastEchoMoveRoll] = useState<{ type: "hit" | "damage"; result: string; total: number; echoIndex: number; moveIndex: number } | null>(null);
  const [manualCurrentHealth, setManualCurrentHealth] = useState<string>(String(character.currentHealth));
  const [statDrafts, setStatDrafts] = useState<Record<keyof CharacterStats, string>>(toStatDrafts(character.stats));
  const [isAddingEcho, setIsAddingEcho] = useState(false);
  const [newEchoDraft, setNewEchoDraft] = useState<Echo>(createDefaultEcho());
  const displayAttributes = normalizeExpandedAttributes(character);
  const updateChar = useUpdateCharacter();
  const deleteChar = useUpdateCharacter();
  const { mutate: performDelete } = useDeleteCharacter(); 

  useEffect(() => {
    if (open) {
      setEditData({ ...character, attributes: normalizeExpandedAttributes(character) });
      setIsEditing(false);
      setDeleteConfirm("");
      setLastWeaponRoll(null);
      setLastEchoMoveRoll(null);
      setManualCurrentHealth(String(character.currentHealth));
      setStatDrafts(toStatDrafts(character.stats));
      setIsAddingEcho(false);
      setNewEchoDraft(createDefaultEcho());
    }
  }, [open, character]);

  useEffect(() => {
    if (isEditing) return;
    setIsAddingEcho(false);
  }, [isEditing]);

  const handleSave = () => {
    const data = { ...editData };
    const currentClass = data.soulClass || "Beast";
    const fragments = data.soulFragments ?? 0;
    const oldFragments = character.soulFragments ?? 0;
    const addedFragments = Math.max(0, fragments - oldFragments);
    const newTotal = (character.totalSoulFragments ?? 0) + addedFragments;
    data.totalSoulFragments = newTotal;

    const oldMaxEssence = character.maxEssence ?? 10;
    const result = computeClassUp(currentClass, fragments, newTotal);
    data.soulFragments = result.newFragments;
    data.soulClass = result.newClass;
    data.totalSoulFragments = result.newTotalFragments;
    data.maxEssence = result.newMaxEssence;

    const essenceGain = result.newMaxEssence - oldMaxEssence;
    if (essenceGain > 0) {
      data.currentEssence = (character.currentEssence ?? 0) + essenceGain;
    }

    if (data.memories) {
      const proficiencyBonus = getProficiencyBonus(data.totalSoulFragments ?? 0);
      data.memories = (data.memories as any[]).map((memory) => normalizeMemory(memory, proficiencyBonus));
    }
    data.echoes = serializeEchoes(data.echoes);
    const nextStats = normalizeStats(data.stats);
    for (const { key } of STAT_FIELDS) {
      const raw = (statDrafts[key] ?? "").trim();
      if (raw === "" || raw === "-") {
        nextStats[key] = 0;
        continue;
      }
      const parsed = Number.parseInt(raw, 10);
      nextStats[key] = Number.isNaN(parsed) ? 0 : parsed;
    }
    data.stats = nextStats;
    data.armorClass = Math.max(1, data.armorClass ?? character.armorClass ?? 8);

    updateChar.mutate({ id: character.id, updates: data }, {
      onSuccess: () => setIsEditing(false)
    });
  };

  const handleActivateSubAttribute = (attributeIndex: number, activeSubAttribute: string) => {
    const attributes = displayAttributes.map((attribute, index) =>
      index === attributeIndex ? { ...attribute, activeSubAttribute } : attribute,
    );
    updateChar.mutate({ id: character.id, updates: { attributes } });
  };

  const handleLearnSubAttribute = (attributeIndex: number) => {
    const librarian = displayAttributes[attributeIndex];
    if (!librarian?.subAttributes || !librarian.activeSubAttribute) return;
    const learnedAttribute = librarian.subAttributes.find(
      (attribute) => attribute.name === librarian.activeSubAttribute,
    );
    if (!learnedAttribute) return;

    const attributes = displayAttributes.map((attribute, index) =>
      index === attributeIndex
        ? {
            ...attribute,
            subAttributes: attribute.subAttributes?.filter(
              (choice) => choice.name !== learnedAttribute.name,
            ),
            activeSubAttribute: undefined,
          }
        : attribute,
    );
    attributes.push({ ...learnedAttribute, subAttributes: undefined, activeSubAttribute: undefined });
    updateChar.mutate({ id: character.id, updates: { attributes } });
  };

  const handleStarSeekingFormChange = (attributeIndex: number, limbId: string, activeFormId: string) => {
    const attribute = displayAttributes[attributeIndex];
    const limb = attribute?.starSeeking?.limbs.find((candidate) => candidate.id === limbId);
    if (!attribute?.starSeeking || !limb || limb.activeFormId === activeFormId) return;
    const cost = Math.max(0, limb.transformEssenceCost);
    const currentEssence = character.currentEssence ?? 0;
    if (currentEssence < cost) {
      alert(`Not enough Essence to transform Star Seeking. Required: ${cost}, Available: ${currentEssence}.`);
      return;
    }
    const attributes = displayAttributes.map((candidate, index) =>
      index === attributeIndex && candidate.starSeeking
        ? {
            ...candidate,
            starSeeking: {
              ...candidate.starSeeking,
              limbs: candidate.starSeeking.limbs.map((candidateLimb) =>
                candidateLimb.id === limbId ? { ...candidateLimb, activeFormId } : candidateLimb,
              ),
            },
          }
        : candidate,
    );
    updateChar.mutate({
      id: character.id,
      updates: {
        attributes,
        currentEssence: Math.max(0, currentEssence - cost),
      },
    });
  };

  const handleReforgeCountChange = (attributeIndex: number, monsterIndex: number, delta: number) => {
    const attribute = displayAttributes[attributeIndex];
    if (!attribute?.reforging) return;
    const monsters = attribute.reforging.monsters.map((monster, index) => {
      if (index !== monsterIndex) return monster;
      const maximum = monster.totalRequired ?? Number.POSITIVE_INFINITY;
      return { ...monster, reforgedCount: Math.max(0, Math.min(maximum, monster.reforgedCount + delta)) };
    });
    const attributes = displayAttributes.map((candidate, index) =>
      index === attributeIndex && candidate.reforging
        ? { ...candidate, reforging: { ...candidate.reforging, monsters } }
        : candidate,
    );
    updateChar.mutate({ id: character.id, updates: { attributes } });
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("This image is too large (max 5MB). Please choose a smaller file.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData({ ...editData, icon: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const memories = getMemories(character);
  const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
  const characterEchoes = normalizeEchoes(character.echoes);
  const editEchoes = normalizeEchoes(editData.echoes);
  const visibleEchoes = isEditing ? editEchoes : characterEchoes;
  const characterStats = normalizeStats(character.stats);
  const editStats = normalizeStats(editData.stats);
  const armorShield = getSummonedArmorDurability(character);
  const starSeekingArmorBonus = getStarSeekingArmorBonus(displayAttributes);
  const effectiveArmorClass = getEffectiveArmorClass(character) + starSeekingArmorBonus;
  const baseArmorClass = getBaseArmorClass(character);
  const armorDexterityMode = getArmorDexterityMode(character);
  const dexterityBonus = getArmorDexterityBonus(characterStats.dexterity, armorDexterityMode);

  const instantUpdate = (updates: Partial<Character>) => {
    updateChar.mutate({ id: character.id, updates });
  };

  const commitManualCurrentHealth = () => {
    if (!canEdit || isEditing) return;
    const parsed = Number.parseInt(manualCurrentHealth, 10);
    const next = Number.isNaN(parsed) ? character.currentHealth : parsed;
    const clamped = Math.max(0, Math.min(character.maxHealth, next));
    setManualCurrentHealth(String(clamped));
    if (clamped !== character.currentHealth) {
      instantUpdate({ currentHealth: clamped });
    }
  };

  const setEditStatDraft = (key: keyof CharacterStats, value: string) => {
    if (!/^-?\d*$/.test(value)) return;
    setStatDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const commitEditStat = (key: keyof CharacterStats) => {
    const raw = (statDrafts[key] ?? "").trim();
    const parsed = raw === "" || raw === "-" ? 0 : Number.parseInt(raw, 10);
    const value = Number.isNaN(parsed) ? 0 : parsed;

    setEditData((prev) => {
      const next = normalizeStats(prev.stats);
      next[key] = value;
      return { ...prev, stats: next };
    });
    setStatDrafts((prev) => ({ ...prev, [key]: String(value) }));
  };

  const handleAddEcho = () => {
    if (!isEditing) return;
    const name = newEchoDraft.name.trim();
    if (!name) return;

    const maxHealth = Math.max(1, newEchoDraft.maxHealth || 1);
    const currentHealth = Math.max(0, Math.min(maxHealth, newEchoDraft.currentHealth));
    const nextEcho: Echo = {
      ...newEchoDraft,
      name,
      maxHealth,
      currentHealth,
      healRate: Math.max(0, newEchoDraft.healRate || 0),
      summonCost: Math.max(0, newEchoDraft.summonCost || 0),
      isSummoned: false,
    };

    setEditData((prev) => {
      const current = normalizeEchoes(prev.echoes);
      const nextEchoes = [...current, nextEcho];
      return { ...prev, echoes: serializeEchoes(nextEchoes) };
    });
    setIsAddingEcho(false);
    setNewEchoDraft(createDefaultEcho());
  };

  const handleSaveEchoAtIndex = (index: number, nextEcho: Echo) => {
    if (isEditing) {
      setEditData((prev) => {
        const nextEchoes = normalizeEchoes(prev.echoes);
        nextEchoes[index] = nextEcho;
        return { ...prev, echoes: serializeEchoes(nextEchoes) };
      });
      return;
    }

    const nextEchoes = [...characterEchoes];
    nextEchoes[index] = nextEcho;
    instantUpdate({ echoes: serializeEchoes(nextEchoes) });
  };

  const handleDeleteEchoAtIndex = (index: number) => {
    if (isEditing) {
      setEditData((prev) => {
        const nextEchoes = normalizeEchoes(prev.echoes);
        nextEchoes.splice(index, 1);
        return { ...prev, echoes: serializeEchoes(nextEchoes) };
      });
      return;
    }

    const nextEchoes = [...characterEchoes];
    nextEchoes.splice(index, 1);
    instantUpdate({ echoes: serializeEchoes(nextEchoes) });
  };

  const handleEchoSummonToggle = (echoIndex: number) => {
    if (isEditing) return;
    const echoes = [...characterEchoes];
    const target = echoes[echoIndex];
    if (!target) return;

    const currentEssence = character.currentEssence ?? 0;
    const summonCost = Math.max(0, target.summonCost ?? 0);

    if (target.isSummoned) {
      echoes[echoIndex] = { ...target, isSummoned: false };
      instantUpdate({ echoes: serializeEchoes(echoes) });
      return;
    }

    if (summonCost > currentEssence) {
      alert(`Not enough Essence to summon ${target.name}. Required: ${summonCost}, Available: ${currentEssence}.`);
      return;
    }

    echoes[echoIndex] = { ...target, isSummoned: true };
    const updates: Partial<Character> = { echoes: serializeEchoes(echoes) };
    if (summonCost > 0) {
      updates.currentEssence = Math.max(0, currentEssence - summonCost);
    }
    instantUpdate(updates);
  };

  const handleEchoHealthChange = (echoIndex: number, delta: number) => {
    if (isEditing) return;
    const echoes = [...characterEchoes];
    const target = echoes[echoIndex];
    if (!target || !target.isSummoned) return;

    const nextValue = Math.max(0, Math.min(target.maxHealth, target.currentHealth + delta));
    if (nextValue === target.currentHealth) return;

    echoes[echoIndex] = { ...target, currentHealth: nextValue };
    instantUpdate({ echoes: serializeEchoes(echoes) });
  };

  const handleDamage = (amount: number) => {
    const mems = [...memories];
    const armorIdx = mems.findIndex(m => m.memoryType === "armor" && m.isSummoned);
    if (armorIdx !== -1) {
      const armor = { ...mems[armorIdx] };
      if (armor.currentDurability > 0) {
        const absorbed = Math.min(amount, armor.currentDurability);
        armor.currentDurability -= absorbed;
        const remaining = amount - absorbed;
        mems[armorIdx] = armor;
        const updates: Partial<Character> = { memories: mems };
        if (remaining > 0) {
          updates.currentHealth = Math.max(0, character.currentHealth - remaining);
        }
        instantUpdate(updates);
        return;
      }
    }
    instantUpdate({ currentHealth: Math.max(0, character.currentHealth - amount) });
  };

  const handleSummonToggle = (memIndex: number) => {
    const mems = [...memories];
    const mem = mems[memIndex];
    const currentEssence = character.currentEssence ?? 0;
    const summonCost = Math.max(0, mem.essenceCost ?? 0);

    if (mem.isSummoned) {
      mems[memIndex] = { ...mem, isSummoned: false };
      instantUpdate({ memories: mems });
    } else {
      if (summonCost > currentEssence) {
        alert(`Not enough Essence to summon ${mem.name}. Required: ${summonCost}, Available: ${currentEssence}.`);
        return;
      }

      // Weapons and tools can be summoned in any quantity.
      if (mem.memoryType !== "tool" && mem.memoryType !== "weapon") {
        mems.forEach((m, i) => {
          if (m.memoryType === mem.memoryType && m.isSummoned) {
            mems[i] = { ...m, isSummoned: false };
          }
        });
      }
      mems[memIndex] = { ...mem, isSummoned: true };
      const updates: Partial<Character> = { memories: mems };
      if (summonCost > 0) {
        updates.currentEssence = Math.max(0, currentEssence - summonCost);
      }
      instantUpdate(updates);
    }
  };

  const parseDieSides = (die: string): number => {
    return parseInt(die.replace("D", "")) || 6;
  };

  const handleWeaponHit = (mem: Memory, memoryIndex: number) => {
    if (!mem.weaponDamage) return;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const proficiencyModifier = mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0;
    const mod = mem.weaponDamage.hitModifier + proficiencyModifier;
    const total = d20 + mod;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const resultStr = `D20: ${d20} ${modStr}`;

    setLastWeaponRoll({ type: "hit", result: resultStr, total, memoryIndex });

    const rollPayload: DiceRollPayload = {
      user: currentUser || "Unknown",
      results: [{
        die: "D20",
        sides: 20,
        rolls: [d20],
        subtotal: total,
      }],
      total,
    };
    sendWsMessage({
      type: WS_EVENTS.DICE_ROLL,
      payload: { ...rollPayload, user: `${currentUser} (${mem.name} Hit)` },
    });
  };

  const handleWeaponDamage = (mem: Memory, memoryIndex: number) => {
    if (!mem.weaponDamage) return;
    const { damageDie, diceCount, damageModifier } = mem.weaponDamage;
    const sides = parseDieSides(damageDie);
    const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * sides) + 1);
    const rollSum = rolls.reduce((a, b) => a + b, 0);
    const total = rollSum + damageModifier;
    const mod = damageModifier;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const resultStr = `${diceCount}${damageDie}: ${rolls.join(" + ")} ${modStr}`;

    setLastWeaponRoll({ type: "damage", result: resultStr, total, memoryIndex });

    const rollPayload: DiceRollPayload = {
      user: `${currentUser} (${mem.name} Dmg)`,
      results: [{
        die: damageDie,
        sides,
        rolls,
        subtotal: total,
      }],
      total,
    };
    sendWsMessage({ type: WS_EVENTS.DICE_ROLL, payload: rollPayload });
  };

  const handleEchoMoveHit = (
    echo: Echo,
    echoIndex: number,
    move: Echo["damageMoves"][number],
    moveIndex: number,
  ) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + move.hitModifier;
    const modStr = move.hitModifier >= 0 ? `+${move.hitModifier}` : `${move.hitModifier}`;
    const resultStr = `D20: ${d20} ${modStr}`;
    const moveName = move.name || `Move ${moveIndex + 1}`;

    setLastEchoMoveRoll({ type: "hit", result: resultStr, total, echoIndex, moveIndex });

    const rollPayload: DiceRollPayload = {
      user: currentUser || "Unknown",
      results: [{
        die: "D20",
        sides: 20,
        rolls: [d20],
        subtotal: total,
      }],
      total,
    };

    sendWsMessage({
      type: WS_EVENTS.DICE_ROLL,
      payload: { ...rollPayload, user: `${currentUser || "Unknown"} (${echo.name} ${moveName} Hit)` },
    });
  };

  const handleEchoMoveDamage = (
    echo: Echo,
    echoIndex: number,
    move: Echo["damageMoves"][number],
    moveIndex: number,
  ) => {
    const sides = parseDieSides(move.damageDie);
    const rolls = Array.from({ length: Math.max(1, move.diceCount) }, () => Math.floor(Math.random() * sides) + 1);
    const rollSum = rolls.reduce((acc, next) => acc + next, 0);
    const total = rollSum + move.damageModifier;
    const modStr = move.damageModifier >= 0 ? `+${move.damageModifier}` : `${move.damageModifier}`;
    const resultStr = `${move.diceCount}${move.damageDie}: ${rolls.join(" + ")} ${modStr}`;
    const moveName = move.name || `Move ${moveIndex + 1}`;

    setLastEchoMoveRoll({ type: "damage", result: resultStr, total, echoIndex, moveIndex });

    const rollPayload: DiceRollPayload = {
      user: `${currentUser || "Unknown"} (${echo.name} ${moveName} Dmg)`,
      results: [{
        die: move.damageDie,
        sides,
        rolls,
        subtotal: total,
      }],
      total,
    };

    sendWsMessage({ type: WS_EVENTS.DICE_ROLL, payload: rollPayload });
  };

  const handleFragmentChange = (delta: number) => {
    const currentClass = character.soulClass || "Beast";
    const maxFrag = getMaxFragmentsForClass(currentClass);
    const newFragments = Math.max(0, Math.min(character.soulFragments + delta, maxFrag));
    const addedFragments = newFragments - character.soulFragments;
    const newTotal = (character.totalSoulFragments || 0) + Math.max(0, addedFragments);

    const result = computeClassUp(currentClass, newFragments, newTotal);

    const oldMaxEssence = character.maxEssence ?? 10;
    const updates: Partial<Character> = {
      soulFragments: result.newFragments,
      soulClass: result.newClass,
      totalSoulFragments: result.newTotalFragments,
      maxEssence: result.newMaxEssence,
    };

    const essenceGain = result.newMaxEssence - oldMaxEssence;
    if (essenceGain > 0) {
      updates.currentEssence = (character.currentEssence ?? 0) + essenceGain;
    }

    instantUpdate(updates);
  };

  const handleDelete = () => {
    if (deleteConfirm === character.name) {
      performDelete(character.id, {
        onSuccess: () => {
          onOpenChange(false);
        }
      });
    }
  };

  const currentClass = character.soulClass || "Beast";
  const maxFragments = getMaxFragmentsForClass(currentClass);
  const currentTierIdx = getClassTierIndex(currentClass);
  const isMaxClass = currentTierIdx >= CLASS_TIERS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col border-primary/30">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
        
        <DialogHeader className="p-6 pb-2 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30 bg-black/50">
                {isEditing ? (
                  editData.icon ? (
                    <img src={editData.icon} alt="Icon" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary/30">
                      <Upload className="w-6 h-6" />
                    </div>
                  )
                ) : (
                  character.icon ? (
                    <img src={character.icon} alt="Icon" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-display text-2xl text-primary/50">
                      {character.name[0]}
                    </div>
                  )
                )}
              </div>
              {isEditing && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                  <Upload className="w-5 h-5 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                </label>
              )}
            </div>
            <div>
              <DialogTitle className="font-display text-3xl font-bold rank-gradient text-glow">
                {isEditing ? (
                  <Input 
                    value={editData.name} 
                    onChange={e => setEditData({...editData, name: e.target.value})}
                    className="text-2xl font-display bg-black/50 border-primary/50 w-[300px]"
                  />
                ) : character.name}
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-widest flex items-center gap-2">
                <Star className="w-3 h-3 text-primary" />
                {isEditing ? (
                  <Input 
                    value={editData.trueName} 
                    onChange={e => setEditData({...editData, trueName: e.target.value})}
                    className="h-7 text-xs bg-black/50 border-primary/30 inline-block w-[200px]"
                    placeholder="True Name"
                  />
                ) : character.trueName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {canEdit && (
              isEditing ? (
                <Button onClick={handleSave} disabled={updateChar.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Save className="w-4 h-4 mr-2" /> {updateChar.isPending ? "Saving..." : "Save Changes"}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)} className="border-primary/50 text-primary hover:bg-primary/10">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit Sheet
                </Button>
              )
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: Vitals & Core Stats */}
            <div className="space-y-8">
              {/* Health Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px] pointer-events-none" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-destructive" /> Vitality
                </h4>
                
                <div className="flex items-center justify-between mb-2">
                  {isEditing ? (
                    <span className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
                      <Input
                        type="number"
                        value={editData.currentHealth ?? character.currentHealth}
                        onChange={e => {
                          const nextCurrent = Math.max(0, parseInt(e.target.value) || 0);
                          const maxHealth = Math.max(0, editData.maxHealth ?? character.maxHealth);
                          setEditData({ ...editData, currentHealth: Math.min(nextCurrent, maxHealth) });
                        }}
                        className="w-20 inline-block h-8 px-2 text-center"
                        data-testid="input-current-health-edit"
                      />
                      <span className="text-muted-foreground text-xl">/</span>
                      <Input
                        type="number"
                        value={editData.maxHealth ?? character.maxHealth}
                        onChange={e => {
                          const nextMax = Math.max(0, parseInt(e.target.value) || 0);
                          const currentHealth = Math.min(editData.currentHealth ?? character.currentHealth, nextMax);
                          setEditData({ ...editData, maxHealth: nextMax, currentHealth });
                        }}
                        className="w-20 inline-block h-8 px-2 text-center"
                        data-testid="input-max-health-edit"
                      />
                    </span>
                  ) : (
                    <span className="text-3xl font-display font-bold text-foreground">
                      {character.currentHealth} <span className="text-muted-foreground text-xl">/ {character.maxHealth}</span>
                    </span>
                  )}
                  {armorShield && (
                    <span className="text-sm font-bold text-sky-400 flex items-center gap-1" data-testid="text-armor-durability">
                      <Shield className="w-4 h-4" /> {armorShield.current}/{armorShield.max}
                    </span>
                  )}
                </div>

                {/* Health bar with armor overlay */}
                <div className="relative h-3 bg-black/50 rounded-full mb-3 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-red-500/80 rounded-full transition-all duration-300"
                    style={{ width: `${character.maxHealth > 0 ? (character.currentHealth / character.maxHealth) * 100 : 0}%` }}
                  />
                  {armorShield && armorShield.current > 0 && (
                    <div
                      className="absolute inset-y-0 rounded-full transition-all duration-300 bg-sky-400/40 border-r border-sky-400/60"
                      style={{
                        left: `${character.maxHealth > 0 ? (character.currentHealth / character.maxHealth) * 100 : 0}%`,
                        width: `${character.maxHealth > 0 ? Math.min((armorShield.current / character.maxHealth) * 100, 100 - (character.currentHealth / character.maxHealth) * 100) : 0}%`,
                      }}
                    />
                  )}
                </div>

                {!isEditing && canEdit && (
                  <div className="mb-3">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Current HP</label>
                    <Input
                      type="number"
                      min={0}
                      max={character.maxHealth}
                      value={manualCurrentHealth}
                      onChange={e => setManualCurrentHealth(e.target.value)}
                      onBlur={commitManualCurrentHealth}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitManualCurrentHealth();
                        }
                      }}
                      className="mt-1 bg-black/50 border-white/10 h-8 w-24 text-center"
                      data-testid="input-current-health-manual"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDamage(1)}
                    disabled={!canEdit || isEditing || (character.currentHealth <= 0 && (!armorShield || armorShield.current <= 0))}
                    data-testid="button-health-minus"
                  >
                    <Minus className="w-4 h-4 mr-1" /> DMG
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => instantUpdate({ currentHealth: Math.min(character.maxHealth, character.currentHealth + 1) })}
                    disabled={!canEdit || isEditing || character.currentHealth >= character.maxHealth}
                    data-testid="button-health-plus"
                  >
                    <Plus className="w-4 h-4 mr-1" /> HEAL
                  </Button>
                </div>
              </div>

              {/* Essence Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-[50px] pointer-events-none" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-violet-400" /> Essence
                </h4>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-display font-bold text-violet-200">
                    {character.currentEssence ?? 10} <span className="text-muted-foreground text-xl">/ {character.maxEssence ?? 10}</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                    onClick={() => instantUpdate({ currentEssence: Math.max(0, (character.currentEssence ?? 0) - 1) })}
                    disabled={!canEdit || isEditing || (character.currentEssence ?? 0) <= 0}
                    data-testid="button-essence-minus"
                  >
                    <Minus className="w-4 h-4 mr-1" /> USE
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                    onClick={() => instantUpdate({ currentEssence: Math.min((character.maxEssence ?? 10), (character.currentEssence ?? 0) + 1) })}
                    disabled={!canEdit || isEditing || (character.currentEssence ?? 0) >= (character.maxEssence ?? 10)}
                    data-testid="button-essence-plus"
                  >
                    <Plus className="w-4 h-4 mr-1" /> RESTORE
                  </Button>
                </div>
              </div>

              {/* Soul Fragments Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] pointer-events-none" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Gem className="w-4 h-4 text-blue-400" /> {character.corePrefix || "Soul"} Fragments
                </h4>
                
                <div className="flex items-center justify-between mb-2">
                  {isEditing ? (
                    <span className="text-3xl font-display font-bold text-blue-100 flex items-center gap-2">
                      <Input 
                        type="number" 
                        value={editData.soulFragments} 
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          const max = getMaxFragmentsForClass(editData.soulClass || "Beast");
                          setEditData({...editData, soulFragments: Math.max(0, Math.min(val, max))});
                        }}
                        className="w-24 inline-block h-10 px-2 text-center text-2xl"
                        data-testid="input-soul-fragments"
                      />
                      <span className="text-muted-foreground text-sm font-sans font-normal">/ {maxFragments}</span>
                    </span>
                  ) : (
                    <span className="text-3xl font-display font-bold text-blue-100">
                      {character.soulFragments} <span className="text-muted-foreground text-sm font-sans font-normal">/ {maxFragments}</span>
                    </span>
                  )}
                </div>

                <p className="text-lg font-display font-bold text-blue-400 mb-4" data-testid="text-soul-class">
                  {currentClass}
                  {isMaxClass && character.soulFragments >= maxFragments && (
                    <span className="text-xs text-muted-foreground font-sans font-normal ml-2">(Max Class)</span>
                  )}
                </p>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-1"
                    onClick={() => handleFragmentChange(-1)}
                    disabled={!canEdit || isEditing || character.soulFragments <= 0}
                    data-testid="button-fragments-minus1"
                  >- 1</Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-1"
                    onClick={() => handleFragmentChange(1)}
                    disabled={!canEdit || isEditing || (isMaxClass && character.soulFragments >= maxFragments)}
                    data-testid="button-fragments-plus1"
                  >+ 1</Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-1"
                    onClick={() => handleFragmentChange(10)}
                    disabled={!canEdit || isEditing || (isMaxClass && character.soulFragments >= maxFragments)}
                    data-testid="button-fragments-plus10"
                  >+ 10</Button>
                </div>
              </div>

              {/* Status Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rank</label>
                  {isEditing ? (
                    <Select value={editData.rank} onValueChange={(v) => setEditData({...editData, rank: v})}>
                      <SelectTrigger className="mt-1 bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-lg font-display text-primary mt-1">{character.rank}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Armor Class</label>
                  {isEditing ? (
                    <div className="space-y-1">
                      <Input
                        type="number"
                        min={1}
                        value={editData.armorClass ?? 8}
                        onChange={e => setEditData({ ...editData, armorClass: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="mt-1 bg-black/50 border-white/10 w-24"
                        data-testid="input-armor-class"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Final AC = Base + DEX ({editData.armorClass ?? 8} + {editStats.dexterity} = {(editData.armorClass ?? 8) + editStats.dexterity})
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <p className="text-lg font-display text-amber-300" data-testid="text-armor-class">
                        {effectiveArmorClass}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Base {baseArmorClass} + {armorDexterityMode === "full" ? "DEX" : armorDexterityMode === "half" ? "Half DEX" : "No DEX"} {dexterityBonus}{starSeekingArmorBonus > 0 ? ` + Star Seeking ${starSeekingArmorBonus}` : ""}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Proficiency Bonus</label>
                  <p className="mt-1 font-display text-lg text-cyan-300">+{proficiencyBonus}</p>
                  <p className="text-[10px] text-muted-foreground">Based on {character.totalSoulFragments ?? 0} total shards</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{character.corePrefix || "Soul"} Core</label>
                  {isEditing ? (
                    <div className="space-y-2 mt-1">
                      <Input 
                        value={editData.corePrefix} 
                        onChange={e => setEditData({...editData, corePrefix: e.target.value})}
                        className="bg-black/50 border-white/10 h-8 text-xs"
                        placeholder="Prefix (e.g. Soul, Steel, Corrupted)"
                        data-testid="input-core-prefix"
                      />
                      <Select value={editData.soulCore} onValueChange={(v) => setEditData({...editData, soulCore: v})}>
                        <SelectTrigger className="bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOUL_CORES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-lg font-display text-foreground mt-1">{character.soulCore}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Echoes</label>
                    {canEdit && isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingEcho(true)}
                        className="h-7 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Echo
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {visibleEchoes.length > 0 ? visibleEchoes.map((echo, i) => {
                      const hpPercent = echo.maxHealth > 0 ? (echo.currentHealth / echo.maxHealth) * 100 : 0;
                      return (
                        <div key={i} className="space-y-2">
                          <div className={`relative p-3 rounded-lg border transition-all ${
                            echo.isSummoned
                              ? "text-cyan-300 border-cyan-500/30 bg-cyan-500/10 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30"
                              : "bg-secondary/30 border-white/5 hover:bg-secondary/50 hover:border-white/10"
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              {isEditing ? (
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="w-4 h-4 shrink-0" />
                                    <p className="font-medium text-sm text-foreground truncate">{echo.name || `Echo ${i + 1}`}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-widest border border-amber-400/30 bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded shrink-0">
                                      AC {echo.armorClass}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <EchoPopup
                                  echo={echo}
                                  canEdit={canEdit}
                                  onSave={(nextEcho: Echo) => handleSaveEchoAtIndex(i, nextEcho)}
                                  onDelete={() => handleDeleteEchoAtIndex(i)}
                                >
                                  <div className="flex-1 cursor-pointer min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Sparkles className="w-4 h-4 shrink-0" />
                                      <p className="font-medium text-sm text-foreground truncate">{echo.name || `Echo ${i + 1}`}</p>
                                      <span className="text-[10px] font-bold uppercase tracking-widest border border-amber-400/30 bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded shrink-0">
                                        AC {echo.armorClass}
                                      </span>
                                    </div>
                                  </div>
                                </EchoPopup>
                              )}
                              {canEdit && !isEditing && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEchoSummonToggle(i)}
                                  className={`shrink-0 text-[10px] h-6 px-1.5 ${
                                    echo.isSummoned
                                      ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                      : "border-white/10 text-muted-foreground hover:bg-white/5"
                                  }`}
                                >
                                  <Zap className="w-3 h-3 mr-1" />
                                  {echo.isSummoned ? "Dismiss" : "Summon"}
                                </Button>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground truncate">
                              {echo.description || "No description."}
                            </p>

                            <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-1.5">
                              <div className="min-w-0">
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Core</span>
                                <p className="text-xs font-bold truncate">{echo.core}</p>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Tier</span>
                                <p className="text-xs font-bold truncate">{echo.tier}</p>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Cost</span>
                                <p className="text-xs font-bold truncate">{echo.summonCost}</p>
                              </div>
                            </div>

                            <div className="mt-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Health</span>
                                <span className="text-xs font-bold text-cyan-200">
                                  {echo.currentHealth} / {echo.maxHealth}
                                </span>
                              </div>
                              <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                                <div
                                  className="h-full bg-cyan-400 transition-all duration-300"
                                  style={{ width: `${hpPercent}%` }}
                                />
                              </div>
                              {canEdit && !isEditing && echo.isSummoned && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 h-7"
                                    onClick={() => handleEchoHealthChange(i, -1)}
                                    disabled={echo.currentHealth <= 0}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-7"
                                    onClick={() => handleEchoHealthChange(i, 1)}
                                    disabled={echo.currentHealth >= echo.maxHealth}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                              {canEdit && !isEditing && echo.isSummoned && echo.damageMoves.length > 0 && (
                                <div className="pt-2 border-t border-white/10 space-y-2">
                                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Damaging Moves</span>
                                  {echo.damageMoves.map((move, moveIndex) => (
                                    <div key={moveIndex} className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2">
                                      <p className="text-xs font-medium leading-snug whitespace-normal break-words">
                                        {move.name || `Move ${moveIndex + 1}`}
                                      </p>
                                      <div className="flex gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 h-7 px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[11px]"
                                          onClick={() => handleEchoMoveHit(echo, i, move, moveIndex)}
                                          data-testid={`button-echo-hit-${i}-${moveIndex}`}
                                        >
                                          <Crosshair className="w-3 h-3 mr-1" />
                                          Hit DC
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 h-7 px-2 border-red-500/30 text-red-400 hover:bg-red-500/10 text-[11px]"
                                          onClick={() => handleEchoMoveDamage(echo, i, move, moveIndex)}
                                          data-testid={`button-echo-dmg-${i}-${moveIndex}`}
                                        >
                                          <Flame className="w-3 h-3 mr-1" />
                                          Damage
                                        </Button>
                                      </div>
                                      {lastEchoMoveRoll && lastEchoMoveRoll.echoIndex === i && lastEchoMoveRoll.moveIndex === moveIndex && (
                                        <div className="text-center p-2 bg-black/40 rounded-lg border border-white/5">
                                          <span className="text-xs text-muted-foreground uppercase tracking-widest">
                                            {lastEchoMoveRoll.type === "hit" ? "Hit Roll" : "Damage Roll"}
                                          </span>
                                          <p className="text-sm text-foreground mt-1">{lastEchoMoveRoll.result}</p>
                                          <p className="text-lg font-display font-bold text-primary mt-1">
                                            = {lastEchoMoveRoll.total}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {isEditing && (
                            <EchoPopup
                              echo={echo}
                              canEdit={canEdit}
                              onSave={(nextEcho: Echo) => handleSaveEchoAtIndex(i, nextEcho)}
                              onDelete={() => handleDeleteEchoAtIndex(i)}
                              startInEditMode
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-7 border-primary/30 text-primary hover:bg-primary/10"
                              >
                                <Edit2 className="w-3 h-3 mr-1" /> Edit Echo
                              </Button>
                            </EchoPopup>
                          )}
                        </div>
                      );
                    }) : <p className="text-sm text-muted-foreground italic">None</p>}
                  </div>
                </div>
              </div>

              {/* Stats Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Stats</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[STAT_FIELDS.slice(0, 3), STAT_FIELDS.slice(3)].map((column, columnIndex) => (
                    <div key={columnIndex} className="space-y-2">
                      {column.map((stat) => (
                        <div key={stat.key} className="rounded-md border border-primary/20 bg-black/30 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-widest text-primary/70">{stat.short}</p>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={statDrafts[stat.key]}
                              onChange={(e) => setEditStatDraft(stat.key, e.target.value)}
                              onBlur={() => commitEditStat(stat.key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitEditStat(stat.key);
                                }
                              }}
                              className="h-8 mt-1 px-2 bg-black/40 border-primary/20 text-sm font-display text-primary"
                              aria-label={stat.label}
                              data-testid={`input-stat-${stat.key}`}
                            />
                          ) : (
                            <p className="text-base font-display text-primary mt-1">{characterStats[stat.key]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MIDDLE & RIGHT COLUMNS: Traits, Aspect, Memories */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Aspect Block */}
              <div className="bg-gradient-to-br from-primary/5 to-transparent rounded-xl p-6 border border-primary/20">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80 flex items-center gap-2 mb-1">
                      <Dna className="w-4 h-4" /> Aspect
                    </h3>
                    {isEditing ? (
                      <div className="flex gap-4 mt-2">
                        <Input 
                          value={editData.aspect} 
                          onChange={e => setEditData({...editData, aspect: e.target.value})}
                          className="bg-black/50 border-primary/30 font-display text-xl w-[250px]"
                          placeholder="Aspect Name"
                        />
                        <Select value={editData.aspectRank} onValueChange={(v) => setEditData({...editData, aspectRank: v})}>
                          <SelectTrigger className="bg-black/50 border-primary/30 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASPECT_RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-2xl font-display font-bold text-foreground">{character.aspect || "None"}</h2>
                        {character.aspectRank && <span className="text-xs font-bold uppercase tracking-widest text-primary border border-primary/30 px-2 py-0.5 rounded-full">{character.aspectRank}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  {isEditing ? (
                    <Textarea 
                      value={editData.aspectAbilityDescription} 
                      onChange={e => setEditData({...editData, aspectAbilityDescription: e.target.value})}
                      className="bg-black/50 border-primary/30 min-h-[100px]"
                      placeholder="Aspect Poem / Description"
                    />
                  ) : (
                    character.aspectAbilityDescription && (
                      <p className="text-muted-foreground italic font-serif leading-relaxed border-l-2 border-primary/30 pl-4 py-1">
                        "{character.aspectAbilityDescription}"
                      </p>
                    )
                  )}
                </div>

                {isEditing ? (
                  <TraitEditor 
                    title="Aspect Abilities" 
                    traits={editData.aspectAbilities || []} 
                    onChange={t => setEditData({...editData, aspectAbilities: t})} 
                  />
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Abilities</h4>
                    {character.aspectAbilities.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {character.aspectAbilities.map((ability, i) => (
                          <TraitPopup key={i} trait={ability}>
                            <Button variant="outline" className="bg-black/40 border-primary/20 hover:border-primary/50 text-foreground hover:text-primary transition-all">
                              {ability.name}
                            </Button>
                          </TraitPopup>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground italic">No abilities manifested.</p>}
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-destructive/20">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-destructive/80 flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4" /> Flaw
                  </h4>
                  {isEditing ? (
                    <div className="space-y-3 bg-destructive/5 p-4 rounded-lg border border-destructive/20">
                      <Input 
                        value={editData.flaw?.name} 
                        onChange={e => setEditData({...editData, flaw: {...(editData.flaw || {name: "", description: "", effect: ""}), name: e.target.value}})}
                        className="bg-black/50 border-destructive/30"
                        placeholder="Flaw Name"
                      />
                      <Textarea 
                        value={editData.flaw?.description} 
                        onChange={e => setEditData({...editData, flaw: {...(editData.flaw || {name: "", description: "", effect: ""}), description: e.target.value}})}
                        className="bg-black/50 border-destructive/30 min-h-[80px]"
                        placeholder="Flaw Description"
                      />
                      <Input 
                        value={editData.flaw?.effect} 
                        onChange={e => setEditData({...editData, flaw: {...(editData.flaw || {name: "", description: "", effect: ""}), effect: e.target.value}})}
                        className="bg-black/50 border-destructive/30"
                        placeholder="Flaw Effect"
                      />
                    </div>
                  ) : (
                    character.flaw?.name ? (
                      <TraitPopup trait={character.flaw}>
                        <Button variant="outline" className="bg-destructive/10 border-destructive/30 hover:border-destructive/50 text-destructive hover:bg-destructive/20 transition-all">
                          {character.flaw.name}
                        </Button>
                      </TraitPopup>
                    ) : <p className="text-sm text-muted-foreground italic">No flaw identified.</p>
                  )}
                </div>
              </div>

              {/* Attributes & Memories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Attributes */}
                <div className="space-y-4">
                  <h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Attributes</h3>
                  {isEditing ? (
                    <TraitEditor
                      title="Edit Attributes"
                      traits={editData.attributes || []}
                      onChange={t => setEditData({ ...editData, attributes: t })}
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {displayAttributes.length > 0 ? displayAttributes.map((attr, i) => (
                        attr.starSeeking ? (
                          <StarSeekingPopup
                            key={i}
                            trait={attr}
                            canRoll={canEdit}
                            stats={characterStats}
                            proficiencyBonus={proficiencyBonus}
                            onChangeForm={canEdit ? (limbId, formId) => handleStarSeekingFormChange(i, limbId, formId) : undefined}
                          >
                            <div className="cursor-pointer rounded-lg border border-amber-300/40 bg-amber-400/10 p-3 shadow-[0_0_18px_rgba(251,191,36,0.14)] transition-all hover:border-amber-200/60 hover:bg-amber-400/15">
                              <div className="flex items-center gap-2"><Star className="h-4 w-4 fill-amber-300/20 text-amber-300" /><p className="text-sm font-medium text-amber-200">{attr.name}</p></div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">{attr.effect}</p>
                              {(() => {
                                const limb = getPrimaryStarSeekingLimb(attr);
                                const activeForm = limb?.forms.find((form) => form.id === limb.activeFormId);
                                return limb && activeForm ? (
                                  <div className="ml-6 mt-2 flex items-center justify-between rounded-md border border-amber-300/20 bg-black/30 px-2.5 py-1.5">
                                    <div><p className="text-[9px] uppercase tracking-widest text-amber-300/70">Manifested form</p><p className="text-xs font-medium text-foreground">{activeForm.name}</p></div>
                                    <p className="font-display text-lg text-amber-200">+{activeForm.armorBonus} AC</p>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </StarSeekingPopup>
                        ) : attr.reforging ? (
                          <ReforgingPopup key={i} trait={attr} onChangeCount={canEdit ? (monsterIndex, delta) => handleReforgeCountChange(i, monsterIndex, delta) : undefined}>
                            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 shadow-[0_0_18px_rgba(239,68,68,0.14)] transition-all cursor-pointer hover:border-red-400/60 hover:bg-red-500/15">
                              <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400" /><p className="text-sm font-medium text-red-200">{attr.name}</p></div>
                              {attr.effect && attr.effect.trim() !== "?" && <p className="mt-1 truncate text-xs text-muted-foreground">{attr.effect}</p>}
                              <div className="ml-6 mt-2 flex items-center justify-between rounded-md border border-red-500/20 bg-black/30 px-2.5 py-1.5">
                                <div className="min-w-0"><p className="text-[9px] uppercase tracking-widest text-orange-300/70">Goal</p><p className="truncate text-xs font-medium text-foreground">{attr.reforging.goalName || "Undiscovered"}</p></div>
                                <div className="ml-3 flex shrink-0 items-center gap-1.5 text-red-200"><Anvil className="h-3.5 w-3.5" /><span className="font-display text-lg">{attr.reforging.goalNumber || "???"}</span></div>
                              </div>
                            </div>
                          </ReforgingPopup>
                        ) : attr.rememberedBy ? (
                          <RememberedByPopup key={i} trait={attr}>
                            <div className="p-3 bg-fuchsia-500/10 border border-fuchsia-400/40 rounded-lg cursor-pointer hover:bg-fuchsia-500/15 hover:border-fuchsia-300/60 transition-all shadow-[0_0_18px_rgba(232,121,249,0.12)]">
                              <div className="flex items-center gap-2"><Fingerprint className="w-4 h-4 text-fuchsia-300" /><p className="font-medium text-sm text-fuchsia-200">{attr.name}</p></div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{attr.effect}</p>
                              <div className="mt-2 ml-6 px-2.5 py-1.5 rounded-md bg-black/30 border border-fuchsia-400/20 flex items-center justify-between">
                                <p className="text-[9px] uppercase tracking-widest text-fuchsia-300/70">THOSE WHO KNOW</p>
                                <p className="font-display text-lg text-fuchsia-200">{attr.rememberedBy.length}</p>
                              </div>
                            </div>
                          </RememberedByPopup>
                        ) : attr.subAttributes ? (
                          <ExpandedTraitPopup
                            key={i}
                            trait={attr}
                            onActivate={canEdit ? (name) => handleActivateSubAttribute(i, name) : undefined}
                            onLearn={canEdit && attr.activeSubAttribute ? () => handleLearnSubAttribute(i) : undefined}
                          >
                            <div className="p-3 bg-emerald-400/10 border border-emerald-300/40 rounded-lg cursor-pointer hover:bg-emerald-400/15 hover:border-emerald-200/60 transition-all shadow-[0_0_18px_rgba(110,231,183,0.14)]">
                              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-300" /><p className="font-medium text-sm text-emerald-200">{attr.name}</p></div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{attr.effect}</p>
                              {attr.activeSubAttribute && (
                                <div className="mt-2 ml-6 px-2.5 py-1.5 rounded-md bg-black/30 border border-emerald-300/20">
                                  <p className="text-[9px] uppercase tracking-widest text-emerald-300/70">Active attribute</p>
                                  <p className="text-xs font-medium text-foreground mt-0.5">{attr.activeSubAttribute}</p>
                                </div>
                              )}
                            </div>
                          </ExpandedTraitPopup>
                        ) : (
                          <TraitPopup key={i} trait={attr}>
                            <div className="p-3 bg-secondary/30 border border-white/5 rounded-lg cursor-pointer hover:bg-secondary/50 hover:border-white/10 transition-all">
                              <p className="font-medium text-sm text-foreground">{attr.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{attr.effect}</p>
                            </div>
                          </TraitPopup>
                        )
                      )) : <p className="text-sm text-muted-foreground italic">None</p>}
                    </div>
                  )}
                </div>

                {/* Memories */}
                <div className="space-y-4">
                  <h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Memories</h3>
                  {isEditing ? (
                    <MemoryEditor
                      memories={(editData.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus))}
                      proficiencyBonus={proficiencyBonus}
                      onChange={m => setEditData({...editData, memories: m})}
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {memories.length > 0 ? memories.map((mem, i) => {
                        const TypeIcon = MEMORY_TYPE_ICONS[mem.memoryType] || Wrench;
                        const colorClass = MEMORY_TYPE_COLORS[mem.memoryType] || MEMORY_TYPE_COLORS.tool;
                        const memoryTypeLabel = mem.memoryType === "charm" ? "utility" : mem.memoryType;
                        return (
                          <div key={i} className={`relative p-3 rounded-lg border transition-all ${
                            mem.isSummoned
                              ? `${colorClass} shadow-lg shadow-current/20 ring-1 ring-current/30`
                              : "bg-secondary/30 border-white/5 hover:bg-secondary/50 hover:border-white/10"
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              <TraitPopup
                                trait={mem}
                                contentClassName={MEMORY_DIALOG_CONTENT_CLASS}
                                bodyClassName={MEMORY_DIALOG_BODY_CLASS}
                              >
                                <div className="flex-1 cursor-pointer min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <TypeIcon className="w-4 h-4 shrink-0" />
                                    <p className="font-medium text-sm text-foreground truncate">{mem.name}</p>
                                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">{memoryTypeLabel}</span>
                                    {(mem.memoryType === "weapon" || mem.memoryType === "armor") && (
                                      <span className={`text-[9px] uppercase tracking-widest font-bold ${mem.isProficient ? "text-emerald-300" : "text-red-300"}`}>
                                        {mem.isProficient ? `Proficient +${proficiencyBonus}` : "Not proficient"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{mem.effect}</p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Durability</span>
                                    <span className="text-xs font-bold">{mem.currentDurability}/{mem.maxDurability}</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Core</span>
                                    <span className="text-xs font-bold">{mem.core}</span>
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Tier</span>
                                    <span className="text-xs font-bold">{mem.tier}</span>
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Cost</span>
                                    <span className="text-xs font-bold">{mem.essenceCost ?? 0}</span>
                                    {mem.memoryType === "armor" && (
                                      <>
                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">AC</span>
                                        <span className="text-xs font-bold">{getEffectiveMemoryArmorClass(mem)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </TraitPopup>
                              {canEdit && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSummonToggle(i)}
                                  className={`shrink-0 text-xs h-7 ${
                                    mem.isSummoned
                                      ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                      : "border-white/10 text-muted-foreground hover:bg-white/5"
                                  }`}
                                  data-testid={`button-summon-${i}`}
                                >
                                  <Zap className="w-3 h-3 mr-1" />
                                  {mem.isSummoned ? "Dismiss" : "Summon"}
                                </Button>
                              )}
                            </div>
                            {mem.isSummoned && mem.isDamageDealing && mem.weaponDamage && canEdit && (
                              <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                                    onClick={() => handleWeaponHit(mem, i)}
                                    data-testid={`button-weapon-hit-${i}`}
                                  >
                                    <Crosshair className="w-3 h-3 mr-1" /> Hit (D20{(mem.weaponDamage.hitModifier + (mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0)) >= 0 ? "+" : ""}{mem.weaponDamage.hitModifier + (mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0)})
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                    onClick={() => handleWeaponDamage(mem, i)}
                                    data-testid={`button-weapon-dmg-${i}`}
                                  >
                                    <Flame className="w-3 h-3 mr-1" /> Dmg ({mem.weaponDamage.diceCount}{mem.weaponDamage.damageDie}{mem.weaponDamage.damageModifier >= 0 ? "+" : ""}{mem.weaponDamage.damageModifier})
                                  </Button>
                                </div>
                                {lastWeaponRoll && lastWeaponRoll.memoryIndex === i && (
                                  <div className="text-center p-2 bg-black/40 rounded-lg border border-white/5">
                                    <span className="text-xs text-muted-foreground uppercase tracking-widest">
                                      {lastWeaponRoll.type === "hit" ? "Hit Roll" : "Damage Roll"}
                                    </span>
                                    <p className="text-sm text-foreground mt-1">{lastWeaponRoll.result}</p>
                                    <p className="text-xl font-display font-bold text-primary mt-1" data-testid="text-weapon-roll-total">
                                      = {lastWeaponRoll.total}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }) : <p className="text-sm text-muted-foreground italic">None</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Inventory / Notes */}
              <div className="space-y-4">
                <h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Inventory/Notes</h3>
                {isEditing ? (
                  <Textarea
                    value={editData.inventoryNotes ?? ""}
                    onChange={e => setEditData({ ...editData, inventoryNotes: e.target.value })}
                    className="bg-black/50 border-white/10 min-h-[180px]"
                    placeholder="Track inventory, supplies, reminders, and session notes."
                    data-testid="textarea-inventory-notes"
                  />
                ) : (
                  <div
                    className="min-h-[180px] p-4 bg-secondary/30 border border-white/5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap"
                    data-testid="text-inventory-notes"
                  >
                    {(character.inventoryNotes || "").trim() || (
                      <span className="text-muted-foreground italic">None</span>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
          
          {canEdit && <div className="mt-12 pt-8 border-t border-white/5 flex justify-center pb-8">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2">
                  <Trash2 className="w-4 h-4" /> Erase Soul
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-panel border-destructive/20">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive font-display text-xl">Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This will permanently delete <span className="text-foreground font-bold">{character.name}</span>. This action cannot be undone.
                    <div className="mt-4 space-y-2 text-foreground">
                      <p className="text-sm font-medium">To confirm, please type the character's name:</p>
                      <Input 
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={character.name}
                        className="bg-black/50 border-destructive/30"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    disabled={deleteConfirm !== character.name}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Character
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>}
        </div>

        <Dialog
          open={isAddingEcho}
          onOpenChange={(openState) => {
            if (openState) {
              setIsAddingEcho(true);
              return;
            }
            setIsAddingEcho(false);
            setNewEchoDraft(createDefaultEcho());
          }}
        >
          <DialogContent className={ECHO_ADD_CONTENT_CLASS}>
            <div className="flex h-full min-h-0 flex-col">
              <DialogHeader className="px-6 pt-6 pb-3 border-b border-white/10">
                <DialogTitle className="font-display text-xl text-primary">Add Echo</DialogTitle>
              </DialogHeader>
              <div className={ECHO_ADD_BODY_CLASS}>
                <Input
                  placeholder="Echo Name"
                  value={newEchoDraft.name}
                  onChange={e => setNewEchoDraft({ ...newEchoDraft, name: e.target.value })}
                  className="bg-black/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Core</label>
                    <Select
                      value={newEchoDraft.core}
                      onValueChange={(v) => setNewEchoDraft({ ...newEchoDraft, core: v as Echo["core"] })}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMORY_CORES.map((core) => (
                          <SelectItem key={core} value={core}>{core}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Tier</label>
                    <Select
                      value={String(newEchoDraft.tier)}
                      onValueChange={(v) => {
                        const tier = Math.max(1, Math.min(7, parseInt(v, 10) || 1));
                        setNewEchoDraft({ ...newEchoDraft, tier });
                      }}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMORY_TIERS.map((tier) => (
                          <SelectItem key={tier} value={String(tier)}>{tier}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Armor Class</label>
                    <Input
                      type="number"
                      min={0}
                      value={newEchoDraft.armorClass}
                      onChange={e => setNewEchoDraft({ ...newEchoDraft, armorClass: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="bg-black/50 h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Summon Cost</label>
                    <Input
                      type="number"
                      min={0}
                      value={newEchoDraft.summonCost}
                      onChange={e => setNewEchoDraft({ ...newEchoDraft, summonCost: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="bg-black/50 h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Heal Rate</label>
                    <Input
                      type="number"
                      min={0}
                      value={newEchoDraft.healRate}
                      onChange={e => setNewEchoDraft({ ...newEchoDraft, healRate: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="bg-black/50 h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Max Health</label>
                    <Input
                      type="number"
                      min={1}
                      value={newEchoDraft.maxHealth}
                      onChange={e => {
                        const maxHealth = Math.max(1, parseInt(e.target.value) || 1);
                        const currentHealth = Math.min(newEchoDraft.currentHealth, maxHealth);
                        setNewEchoDraft({ ...newEchoDraft, maxHealth, currentHealth });
                      }}
                      className="bg-black/50 h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Current Health</label>
                    <Input
                      type="number"
                      min={0}
                      max={newEchoDraft.maxHealth}
                      value={newEchoDraft.currentHealth}
                      onChange={e => {
                        const parsed = Math.max(0, parseInt(e.target.value) || 0);
                        setNewEchoDraft({ ...newEchoDraft, currentHealth: Math.min(parsed, newEchoDraft.maxHealth) });
                      }}
                      className="bg-black/50 h-8 text-sm mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Description</label>
                  <Textarea
                    placeholder="Echo Description"
                    value={newEchoDraft.description}
                    onChange={e => setNewEchoDraft({ ...newEchoDraft, description: e.target.value })}
                    className="bg-black/50 min-h-[180px] mt-1 whitespace-pre-wrap"
                  />
                </div>
              </div>
              <DialogFooter className="px-6 py-4 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingEcho(false);
                    setNewEchoDraft(createDefaultEcho());
                  }}
                  className="border-white/10 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEcho}
                  disabled={!newEchoDraft.name.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Confirm Add
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
