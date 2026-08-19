import { useState, useEffect, useLayoutEffect, useRef } from "react";
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
import { Edit2, Save, Minus, Plus, Gem, Star, Shield, Dna, Upload, Trash2, Swords, Sparkles, Wrench, Zap, Crosshair, Flame, Fingerprint, Anvil } from "lucide-react";
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

const SOUL_CORES = ["Dormant", "Awakened", "Ascended", "Transcendent", "Supreme", "Sacred", "Divine"];
const DEFAULT_CHARACTER_ACCENT_COLOR = "#b45353";
const RANK_BY_SOUL_CORE: Record<string, string> = {
  Dormant: "Dreamer",
  Awakened: "Awakened",
  Ascended: "Master",
  Transcendent: "Saint",
  Supreme: "Sovereign",
  Sacred: "Sacred",
  Divine: "Divine",
};
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

function getRankForSoulCore(soulCore: unknown): string {
  const normalized = typeof soulCore === "string" && soulCore.trim() ? soulCore.trim() : "Dormant";
  return RANK_BY_SOUL_CORE[normalized] || normalized;
}

function normalizeAccentColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : DEFAULT_CHARACTER_ACCENT_COLOR;
}

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
  armor: "text-primary border-primary/30 bg-primary/10",
  weapon: "character-accent-text character-accent-border character-accent-soft character-accent-glow",
  tool: "text-primary border-primary/30 bg-primary/10",
  charm: "text-primary border-primary/30 bg-primary/10",
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
  const [statDrafts, setStatDrafts] = useState<Record<keyof CharacterStats, string>>(toStatDrafts(character.stats));
  const [isAddingEcho, setIsAddingEcho] = useState(false);
  const [newEchoDraft, setNewEchoDraft] = useState<Echo>(createDefaultEcho());
  const inventoryNotesRef = useRef<HTMLTextAreaElement>(null);
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
      setStatDrafts(toStatDrafts(character.stats));
      setIsAddingEcho(false);
      setNewEchoDraft(createDefaultEcho());
    }
  }, [open, character]);

  useEffect(() => {
    if (isEditing) return;
    setIsAddingEcho(false);
  }, [isEditing]);

  useLayoutEffect(() => {
    if (!isEditing || !inventoryNotesRef.current) return;
    const textarea = inventoryNotesRef.current;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`;
  }, [isEditing, editData.inventoryNotes]);

  const handleSave = () => {
    const data = { ...editData };
    data.soulCore = data.soulCore || character.soulCore || "Dormant";
    data.rank = getRankForSoulCore(data.soulCore);
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
  const starSeekingArmorBonus = getStarSeekingArmorBonus(displayAttributes);
  const effectiveArmorClass = getEffectiveArmorClass(character) + starSeekingArmorBonus;
  const baseArmorClass = getBaseArmorClass(character);
  const armorDexterityMode = getArmorDexterityMode(character);
  const dexterityBonus = getArmorDexterityBonus(characterStats.dexterity, armorDexterityMode);

  const instantUpdate = (updates: Partial<Character>) => {
    updateChar.mutate({ id: character.id, updates });
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
  const displayedSoulCore = (isEditing ? editData.soulCore : character.soulCore) || "Dormant";
  const displayedRank = getRankForSoulCore(displayedSoulCore);
  const accentColor = normalizeAccentColor(isEditing ? editData.accentColor : character.accentColor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="character-accent-scope glass-panel max-w-7xl h-[90vh] p-0 overflow-hidden flex flex-col border-primary/30"
        style={{ "--character-accent": accentColor } as React.CSSProperties}
      >
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
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-2xl">{displayedRank}</span>
                    <Input
                      value={editData.name}
                      onChange={e => setEditData({...editData, name: e.target.value})}
                      className="text-2xl font-display bg-black/50 border-primary/50 w-[300px]"
                    />
                  </div>
                ) : `${displayedRank} ${character.name}`}
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-widest flex items-center gap-2">
                <Star className="w-3 h-3 text-primary" />
                {isEditing ? (
                  <>
                    <Input
                      value={editData.trueName}
                      onChange={e => setEditData({...editData, trueName: e.target.value})}
                      className="h-7 text-xs bg-black/50 border-primary/30 inline-block w-[200px]"
                      placeholder="True Name"
                    />
                    <label className="flex items-center gap-1.5 normal-case tracking-normal" title="Character accent color">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(event) => setEditData({ ...editData, accentColor: event.target.value })}
                        className="h-7 w-8 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
                        aria-label="Character accent color"
                      />
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Accent</span>
                    </label>
                  </>
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
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[19rem_repeat(2,minmax(0,1fr))]">
            
            {/* Progression, echoes, and stats */}
            <div className="contents">
              {/* Soul Fragments Block */}
              <div className="character-accent-panel character-accent-glow order-3 relative overflow-hidden rounded-xl border px-5 py-4 lg:col-span-3">
                <div className="character-accent-soft pointer-events-none absolute inset-x-1/4 top-0 h-20 blur-[45px]" />
                <div className="relative flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex min-w-0 flex-wrap items-end justify-center gap-x-3 gap-y-2 sm:justify-start">
                    <Gem className="character-accent-text mb-1 h-5 w-5 shrink-0" />
                    <div>
                      <p className="character-accent-muted text-[9px] font-bold uppercase tracking-[0.2em]">Nightmare Rank</p>
                      {isEditing ? (
                        <Select
                          value={displayedSoulCore}
                          onValueChange={(value) => setEditData({
                            ...editData,
                            soulCore: value,
                            rank: getRankForSoulCore(value),
                          })}
                        >
                          <SelectTrigger className="character-accent-border character-accent-text mt-1 h-8 w-[150px] bg-black/50 font-display">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SOUL_CORES.map((soulCore) => (
                              <SelectItem key={soulCore} value={soulCore}>{soulCore}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="character-accent-text font-display text-xl font-bold">{displayedSoulCore}</p>
                      )}
                    </div>
                    <div className="character-accent-muted mb-0.5 text-xl font-display">·</div>
                    <div>
                      <p className="character-accent-muted text-[9px] font-bold uppercase tracking-[0.2em]">Class</p>
                      <p className="character-accent-text font-display text-xl font-bold" data-testid="text-soul-class">{currentClass}</p>
                    </div>
                    <div className="character-accent-muted mb-0.5 text-xl font-display">—</div>
                    <div>
                      <p className="character-accent-muted text-[9px] font-bold uppercase tracking-[0.2em]">Fragments</p>
                      <p className="character-accent-text font-display text-xl font-bold">
                        {character.soulFragments} / {maxFragments}
                        {isMaxClass && character.soulFragments >= maxFragments && (
                          <span className="ml-2 text-[10px] font-sans font-normal uppercase tracking-widest text-muted-foreground">Max class</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid w-full grid-cols-4 gap-2 sm:w-auto">
                    {[-10, -1, 1, 10].map((delta) => {
                      const increasing = delta > 0;
                      const disabled = !canEdit
                        || isEditing
                        || (!increasing && character.soulFragments <= 0)
                        || (increasing && isMaxClass && character.soulFragments >= maxFragments);
                      return (
                        <Button
                          key={delta}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="character-accent-button min-w-14"
                          onClick={() => handleFragmentChange(delta)}
                          disabled={disabled}
                          data-testid={`button-fragments-${delta > 0 ? "plus" : "minus"}${Math.abs(delta)}`}
                        >
                          {delta > 0 ? "+" : "−"}{Math.abs(delta)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Echoes Column */}
              <div className="character-custom-scope order-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex-1 border-b border-white/10 pb-2 font-display text-lg text-foreground">Echoes</h3>
                    {canEdit && isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingEcho(true)}
                        className="character-accent-button mb-2 h-7"
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
                              ? "character-accent-text character-accent-border character-accent-soft character-accent-glow"
                              : "bg-secondary/30 border-white/5 hover:bg-secondary/50 hover:border-white/10"
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              {isEditing ? (
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="w-4 h-4 shrink-0" />
                                    <p className="font-medium text-sm text-foreground truncate">{echo.name || `Echo ${i + 1}`}</p>
                                    <span className="character-accent-border character-accent-soft character-accent-text text-[10px] font-bold uppercase tracking-widest border px-1.5 py-0.5 rounded shrink-0">
                                      AC {echo.armorClass}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <EchoPopup
                                  echo={echo}
                                  accentColor={accentColor}
                                  canEdit={canEdit}
                                  onSave={(nextEcho: Echo) => handleSaveEchoAtIndex(i, nextEcho)}
                                  onDelete={() => handleDeleteEchoAtIndex(i)}
                                >
                                  <div className="flex-1 cursor-pointer min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Sparkles className="w-4 h-4 shrink-0" />
                                      <p className="font-medium text-sm text-foreground truncate">{echo.name || `Echo ${i + 1}`}</p>
                                      <span className="character-accent-border character-accent-soft character-accent-text text-[10px] font-bold uppercase tracking-widest border px-1.5 py-0.5 rounded shrink-0">
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
                                      ? "character-accent-button"
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
                                <span className="character-accent-text text-xs font-bold">
                                  {echo.currentHealth} / {echo.maxHealth}
                                </span>
                              </div>
                              <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                                <div
                                  className="h-full transition-all duration-300"
                                  style={{ width: `${hpPercent}%`, backgroundColor: "var(--character-accent)" }}
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
                                          className="character-accent-button flex-1 h-7 px-2 text-[11px]"
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
                                          className="character-accent-button flex-1 h-7 px-2 text-[11px]"
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
                                          <p className="character-accent-text text-lg font-display font-bold mt-1">
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
                              accentColor={accentColor}
                              canEdit={canEdit}
                              onSave={(nextEcho: Echo) => handleSaveEchoAtIndex(i, nextEcho)}
                              onDelete={() => handleDeleteEchoAtIndex(i)}
                              startInEditMode
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="character-accent-button w-full h-7"
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
              <div className="order-1 h-full space-y-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary/80">Stats</h4>
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

                <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                  <div className="px-1 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Armor Class</p>
                    {isEditing ? (
                      <div className="mt-1 space-y-1">
                        <Input
                          type="number"
                          min={1}
                          value={editData.armorClass ?? 8}
                          onChange={(event) => setEditData({
                            ...editData,
                            armorClass: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                          })}
                          className="h-8 border-primary/20 bg-black/40 px-2 font-display text-primary"
                          data-testid="input-armor-class"
                        />
                        <p className="text-[9px] leading-snug text-muted-foreground">
                          Base + DEX ({editData.armorClass ?? 8} + {editStats.dexterity})
                        </p>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <p className="font-display text-xl text-primary" data-testid="text-armor-class">{effectiveArmorClass}</p>
                        <p className="text-[9px] leading-snug text-muted-foreground">
                          Base {baseArmorClass} + {armorDexterityMode === "full" ? "DEX" : armorDexterityMode === "half" ? "Half DEX" : "No DEX"} {dexterityBonus}{starSeekingArmorBonus > 0 ? ` + Star Seeking ${starSeekingArmorBonus}` : ""}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-l border-white/10 px-4 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Proficiency</p>
                    <p className="mt-1 font-display text-xl text-primary">+{proficiencyBonus}</p>
                    <p className="text-[9px] leading-snug text-muted-foreground">{character.totalSoulFragments ?? 0} total shards</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Aspect, attributes, memories, and notes */}
            <div className="contents">
              
              {/* Aspect Block */}
              <div className="order-2 h-full rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 lg:col-span-2">
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
              <div className="order-5 grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-2">
                {/* Attributes */}
                <div className="space-y-4">
                  <h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Attributes</h3>
                  {isEditing ? (
                    <TraitEditor
                      title="Edit Attributes"
                      traits={editData.attributes || []}
                      onChange={t => setEditData({ ...editData, attributes: t })}
                      accentColor={accentColor}
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
                            accentColor={accentColor}
                            onChangeForm={canEdit ? (limbId, formId) => handleStarSeekingFormChange(i, limbId, formId) : undefined}
                          >
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow cursor-pointer rounded-lg border p-3 transition-all">
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
                          <ReforgingPopup key={i} trait={attr} accentColor={accentColor} onChangeCount={canEdit ? (monsterIndex, delta) => handleReforgeCountChange(i, monsterIndex, delta) : undefined}>
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow rounded-lg border p-3 transition-all cursor-pointer">
                              <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400" /><p className="text-sm font-medium text-red-200">{attr.name}</p></div>
                              {attr.effect && attr.effect.trim() !== "?" && <p className="mt-1 truncate text-xs text-muted-foreground">{attr.effect}</p>}
                              <div className="ml-6 mt-2 flex items-center justify-between rounded-md border border-red-500/20 bg-black/30 px-2.5 py-1.5">
                                <div className="min-w-0"><p className="text-[9px] uppercase tracking-widest text-orange-300/70">Goal</p><p className="truncate text-xs font-medium text-foreground">{attr.reforging.goalName || "Undiscovered"}</p></div>
                                <div className="ml-3 flex shrink-0 items-center gap-1.5 text-red-200"><Anvil className="h-3.5 w-3.5" /><span className="font-display text-lg">{attr.reforging.goalNumber || "???"}</span></div>
                              </div>
                            </div>
                          </ReforgingPopup>
                        ) : attr.rememberedBy ? (
                          <RememberedByPopup key={i} trait={attr} accentColor={accentColor}>
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow p-3 border rounded-lg cursor-pointer transition-all">
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
                            accentColor={accentColor}
                            onActivate={canEdit ? (name) => handleActivateSubAttribute(i, name) : undefined}
                            onLearn={canEdit && attr.activeSubAttribute ? () => handleLearnSubAttribute(i) : undefined}
                          >
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow p-3 border rounded-lg cursor-pointer transition-all">
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
                                accentColor={mem.memoryType === "weapon" ? accentColor : undefined}
                                contentClassName={MEMORY_DIALOG_CONTENT_CLASS}
                                bodyClassName={MEMORY_DIALOG_BODY_CLASS}
                              >
                                <div className="flex-1 cursor-pointer min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <TypeIcon className="w-4 h-4 shrink-0" />
                                    <p className="font-medium text-sm text-foreground truncate">{mem.name}</p>
                                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">{memoryTypeLabel}</span>
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
                                      ? mem.memoryType === "weapon"
                                        ? "character-accent-button"
                                        : "border-primary/50 text-primary hover:bg-primary/10"
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
                                    className={`flex-1 text-xs ${mem.memoryType === "weapon" ? "character-accent-button" : "border-primary/30 text-primary hover:bg-primary/10"}`}
                                    onClick={() => handleWeaponHit(mem, i)}
                                    data-testid={`button-weapon-hit-${i}`}
                                  >
                                    <Crosshair className="w-3 h-3 mr-1" /> Hit (D20{(mem.weaponDamage.hitModifier + (mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0)) >= 0 ? "+" : ""}{mem.weaponDamage.hitModifier + (mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0)})
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`flex-1 text-xs ${mem.memoryType === "weapon" ? "character-accent-button" : "border-primary/30 text-primary hover:bg-primary/10"}`}
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
              <div className="order-6 space-y-4 lg:col-span-3">
                <h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Inventory/Notes</h3>
                {isEditing ? (
                  <Textarea
                    ref={inventoryNotesRef}
                    value={editData.inventoryNotes ?? ""}
                    onChange={e => setEditData({ ...editData, inventoryNotes: e.target.value })}
                    className="min-h-[180px] resize-y overflow-hidden bg-black/50 border-white/10"
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
          <DialogContent
            className={`character-custom-scope character-accent-border character-accent-glow ${ECHO_ADD_CONTENT_CLASS}`}
            style={{ "--character-accent": accentColor } as React.CSSProperties}
          >
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
