import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  type ArmorDexterityBonusMode,
  type Character,
  type CharacterStats,
  type Echo,
  type Memory,
  type SheetCounter,
  type SheetCounterTarget,
  CLASS_TIERS,
  MEMORY_CORES,
  MEMORY_TIERS,
  WS_EVENTS,
  computeClassUp,
  getEffectiveMemoryArmorClass,
  getArmorDexterityBonus,
  getClassTierIndex,
  getMaxFragmentsForClass,
  getNextStatAllocation,
  getPendingStatAllocationCount,
  getProficiencyBonus,
  getWeaponDamageModifier,
  getWeaponHitModifier,
  normalizeStatProgression,
  rollbackStatAllocations,
  STAT_KEYS,
  CLASS_PROGRESSION_DESCRIPTIONS,
  normalizeEchoes,
  normalizeMemory,
  normalizeSheetCounters,
  normalizeStats,
  serializeEchoes,
  type DiceRollPayload,
  type StatKey,
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
import { Edit2, Save, Minus, Plus, Star, Shield, Dna, Upload, Trash2, Swords, Sparkles, Wrench, Zap, Crosshair, Flame, Fingerprint, Anvil, Hash, X } from "lucide-react";
import { TraitPopup } from "./TraitPopup";
import { TraitEditor } from "./TraitEditor";
import { ExpandedTraitPopup } from "./ExpandedTraitPopup";
import { RememberedByPopup } from "./RememberedByPopup";
import { ReforgingPopup } from "./ReforgingPopup";
import { StarSeekingPopup } from "./StarSeekingPopup";
import { getPrimaryStarSeekingLimb, getStarSeekingArmorBonus, normalizeExpandedAttributes } from "@/lib/expanded-attributes";
import { MemoryEditor } from "./MemoryEditor";
import { MemoryPopup } from "./MemoryPopup";
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
const DEFAULT_ECHO_ACCENT_COLOR = "hsl(var(--primary))";
const CUSTOM_ATTRIBUTE_PALETTES: Array<{ names: string[]; primary: string; secondary: string }> = [
  { names: ["steven"], primary: "#ef4444", secondary: "#050505" },
  { names: ["gordon", "gordan"], primary: "#f97316", secondary: "#e2e8f0" },
  { names: ["yuri"], primary: "#fbbf24", secondary: "#9333ea" },
  { names: ["wilovan", "wilvoan"], primary: "#7dd3fc", secondary: "#86efac" },
];

function getCustomAttributePalette(name: string) {
  const normalizedName = name.trim().toLowerCase();
  return CUSTOM_ATTRIBUTE_PALETTES.find((palette) => palette.names.some((candidate) => normalizedName.includes(candidate)));
}
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
  armor: "text-primary border-blue-700/50 bg-blue-950/35",
  weapon: "text-primary border-red-400/60 bg-red-500/10",
  tool: "text-primary border-white/15 bg-primary/10",
  charm: "text-primary border-white/15 bg-primary/10",
};

function CounterControls({ counter, editing, disabled, onChange, onRemove }: {
  counter: SheetCounter;
  editing: boolean;
  disabled?: boolean;
  onChange: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-end gap-1 rounded-md border border-primary/20 bg-black/35 px-2 py-1" onClick={(event) => event.stopPropagation()}>
      <Hash className="h-3 w-3 text-primary/70" />
      <span className="mr-auto text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Counter</span>
      {editing ? (
        <>
          <span className="min-w-7 text-center font-display text-sm font-bold text-primary">{counter.value}</span>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRemove} aria-label="Remove counter"><X className="h-3 w-3" /></Button>
        </>
      ) : (
        <>
          <Button type="button" variant="ghost" size="sm" className="h-5 min-w-7 rounded-sm px-1.5 font-display text-sm font-bold leading-none text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => onChange(-1)} disabled={disabled}>-</Button>
          <span className="min-w-7 text-center font-display text-sm font-bold text-primary">{counter.value}</span>
          <Button type="button" variant="ghost" size="sm" className="h-5 min-w-7 rounded-sm px-1.5 font-display text-sm font-bold leading-none text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => onChange(1)} disabled={disabled}>+</Button>
        </>
      )}
    </div>
  );
}

const MEMORY_DIALOG_CONTENT_CLASS = "glass-panel border-primary/20 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,36rem)] overflow-hidden gap-0 content-start grid-rows-[auto_minmax(0,1fr)]";
const MEMORY_DIALOG_BODY_CLASS = "h-full border-t border-white/10 pt-3 space-y-3 overflow-y-auto pr-1";
const ECHO_ADD_CONTENT_CLASS = "glass-panel border-primary/20 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,36rem)] overflow-hidden p-0";
const ECHO_ADD_BODY_CLASS = "flex-1 min-h-0 overflow-y-auto p-6 space-y-3";

function getDexterity(character: Character): number {
  return normalizeStats(character.stats).dexterity;
}

function getMemories(character: Character): Memory[] {
  const proficiencyBonus = getProficiencyBonus(character.soulFragments ?? 0);
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
  const [pendingEchoDeleteIndex, setPendingEchoDeleteIndex] = useState<number | null>(null);
  const [memoriesForBank, setMemoriesForBank] = useState<Memory[]>([]);
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [isAddingCounter, setIsAddingCounter] = useState(false);
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
      setPendingEchoDeleteIndex(null);
      setMemoriesForBank([]);
      setIsAddingCounter(false);
    }
  }, [open, character]);

  useEffect(() => {
    if (isEditing) return;
    setIsAddingEcho(false);
  }, [isEditing]);

  useLayoutEffect(() => {
    if (!isEditing || !inventoryNotesRef.current) return;
    const textarea = inventoryNotesRef.current;
    const nextHeight = Math.max(180, textarea.scrollHeight);
    if (nextHeight > textarea.offsetHeight) textarea.style.height = `${nextHeight}px`;
  }, [isEditing, editData.inventoryNotes]);

  const handleSave = async () => {
    const data = { ...editData };
    data.soulCore = data.soulCore || character.soulCore || "Dormant";
    data.rank = getRankForSoulCore(data.soulCore);
    const currentClass = data.soulClass || "Beast";
    const fragments = data.soulFragments ?? 0;
    const oldFragments = character.soulFragments ?? 0;
    const progression = normalizeStatProgression(data.statProgression, character.soulFragments ?? 0, currentClass);
    data.statProgression = progression;

    const oldMaxEssence = character.maxEssence ?? 10;
    const result = computeClassUp(currentClass, fragments);
    const shouldApplyTitan = result.newClass === "Titan" && result.newFragments >= 7000 && !progression.titanApplied;
    if (shouldApplyTitan) progression.titanApplied = true;
    if (result.newClass !== currentClass) {
      progression.allocationClass = result.newClass;
      progression.processedMilestones = 0;
      progression.allocationHistory = [];
    }
    data.soulFragments = result.newFragments;
    data.soulClass = result.newClass;
    data.totalSoulFragments = result.newTotalFragments;
    data.maxEssence = result.newMaxEssence;

    const essenceChange = result.newMaxEssence - oldMaxEssence;
    data.currentEssence = essenceChange > 0
      ? Math.min(result.newMaxEssence, (character.currentEssence ?? 0) + essenceChange)
      : Math.min(character.currentEssence ?? 0, result.newMaxEssence);

    if (data.memories) {
      const proficiencyBonus = getProficiencyBonus(data.soulFragments ?? 0);
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
    if (result.newClass === currentClass && result.newFragments < oldFragments) {
      const rollback = rollbackStatAllocations(progression, result.newFragments, currentClass, nextStats);
      data.statProgression = rollback.progression;
      Object.assign(nextStats, rollback.stats);
    }
    if (shouldApplyTitan) {
      for (const key of STAT_KEYS) nextStats[key] += 5;
    }
    data.stats = nextStats;
    data.armorClass = Math.max(1, data.armorClass ?? character.armorClass ?? 8);

    if (memoriesForBank.length > 0) {
      setIsSavingToBank(true);
      try {
        for (const memory of memoriesForBank) {
          const response = await fetch(`/api/memory-bank/deposit/${character.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ ...memory, isSummoned: false }),
          });
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Failed to move ${memory.name} to the Memory Bank`);
          }
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to move memories to the Memory Bank");
        setIsSavingToBank(false);
        return;
      }
    }

    updateChar.mutate({ id: character.id, updates: data }, {
      onSuccess: () => {
        setMemoriesForBank([]);
        setIsSavingToBank(false);
        setIsEditing(false);
      },
      onError: () => setIsSavingToBank(false),
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
  const proficiencyBonus = getProficiencyBonus(character.soulFragments ?? 0);
  const characterEchoes = normalizeEchoes(character.echoes);
  const editEchoes = normalizeEchoes(editData.echoes);
  const visibleEchoes = isEditing ? editEchoes : characterEchoes;
  const displayCounters = normalizeSheetCounters(isEditing ? editData.sheetCounters : character.sheetCounters);
  const characterStats = normalizeStats(character.stats);
  const editStats = normalizeStats(editData.stats);
  const progressionClass = character.soulClass || "Beast";
  const statProgression = normalizeStatProgression(character.statProgression, character.soulFragments ?? 0, progressionClass);
  const editStatProgression = normalizeStatProgression(editData.statProgression, editData.soulFragments ?? 0, editData.soulClass || progressionClass);
  const nextStatAllocation = getNextStatAllocation(statProgression, character.soulFragments ?? 0, progressionClass, characterStats);
  const pendingStatAllocations = getPendingStatAllocationCount(statProgression, character.soulFragments ?? 0, progressionClass);
  const starSeekingArmorBonus = getStarSeekingArmorBonus(displayAttributes);
  const effectiveArmorClass = getEffectiveArmorClass(character) + starSeekingArmorBonus;
  const baseArmorClass = getBaseArmorClass(character);
  const armorDexterityMode = getArmorDexterityMode(character);
  const dexterityBonus = getArmorDexterityBonus(characterStats.dexterity, armorDexterityMode);

  const instantUpdate = (updates: Partial<Character>) => {
    updateChar.mutate({ id: character.id, updates });
  };

  const handleCounterChange = (counterId: string, delta: number) => {
    if (!canEdit || isEditing || updateChar.isPending) return;
    const counters = normalizeSheetCounters(character.sheetCounters).map((counter) =>
      counter.id === counterId ? { ...counter, value: counter.value + delta } : counter,
    );
    instantUpdate({ sheetCounters: counters });
  };

  const handleRemoveCounter = (counterId: string) => {
    if (!isEditing) return;
    setEditData((current) => ({
      ...current,
      sheetCounters: normalizeSheetCounters(current.sheetCounters).filter((counter) => counter.id !== counterId),
    }));
  };

  const handleCounterTargetClick = (
    event: React.MouseEvent,
    targetType: SheetCounterTarget,
    targetIndex: number,
  ) => {
    if (!isAddingCounter) return;
    event.preventDefault();
    event.stopPropagation();
    const nextCounter: SheetCounter = {
      id: `counter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      targetType,
      targetIndex,
      value: 0,
    };
    if (isEditing) {
      setEditData((current) => ({
        ...current,
        sheetCounters: [...normalizeSheetCounters(current.sheetCounters), nextCounter],
      }));
    } else {
      instantUpdate({ sheetCounters: [...normalizeSheetCounters(character.sheetCounters), nextCounter] });
    }
    setIsAddingCounter(false);
  };

  const countersFor = (targetType: SheetCounterTarget, targetIndex: number) =>
    displayCounters.filter((counter) => counter.targetType === targetType && counter.targetIndex === targetIndex);

  const renderCounters = (targetType: SheetCounterTarget, targetIndex: number) =>
    countersFor(targetType, targetIndex).map((counter) => (
      <CounterControls
        key={counter.id}
        counter={counter}
        editing={isEditing}
        disabled={!canEdit || updateChar.isPending}
        onChange={(delta) => handleCounterChange(counter.id, delta)}
        onRemove={() => handleRemoveCounter(counter.id)}
      />
    ));

  const handleAllocateStat = (key: StatKey) => {
    if (!canEdit || !nextStatAllocation || updateChar.isPending) return;
    const amount = nextStatAllocation.options[key];
    if (!amount) return;
    instantUpdate({
      stats: { ...characterStats, [key]: characterStats[key] + amount },
      statProgression: {
        ...statProgression,
        processedMilestones: nextStatAllocation.milestone,
        allocationHistory: [
          ...(statProgression.allocationHistory || []),
          { milestone: nextStatAllocation.milestone, stat: key, amount, className: progressionClass },
        ],
      },
    });
  };

  const handleTrainingChoice = (key: StatKey, kind: "physical" | "mental") => {
    if (!canEdit || updateChar.isPending) return;
    const current = statProgression.training[key];
    const training = { ...statProgression.training, [key]: current === "proficient" ? "expertise" as const : "proficient" as const };
    instantUpdate({
      statProgression: {
        ...statProgression,
        training,
        ...(kind === "physical" ? { physicalChoice: key } : { mentalChoice: key }),
      },
    });
  };

  const cycleTraining = (key: StatKey) => {
    const normalizedEditProgression = normalizeStatProgression(editData.statProgression, editData.soulFragments ?? 0, editData.soulClass || progressionClass);
    const training = { ...normalizedEditProgression.training };
    if (!training[key]) training[key] = "proficient";
    else if (training[key] === "proficient") training[key] = "expertise";
    else delete training[key];
    setEditData({
      ...editData,
      statProgression: { ...normalizedEditProgression, training },
    });
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
    const mod = getWeaponHitModifier(mem, characterStats) + proficiencyModifier;
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
    const { damageDie, diceCount } = mem.weaponDamage;
    const damageModifier = getWeaponDamageModifier(mem, characterStats);
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
    const result = computeClassUp(currentClass, newFragments);

    const oldMaxEssence = character.maxEssence ?? 10;
    const updates: Partial<Character> = {
      soulFragments: result.newFragments,
      soulClass: result.newClass,
      totalSoulFragments: result.newTotalFragments,
      maxEssence: result.newMaxEssence,
    };
    const progression = normalizeStatProgression(character.statProgression, character.soulFragments ?? 0, currentClass);
    if (result.newClass === "Titan" && result.newFragments >= 7000 && !progression.titanApplied) {
      const titanStats = normalizeStats(character.stats);
      for (const key of STAT_KEYS) titanStats[key] += 5;
      updates.stats = titanStats;
      progression.titanApplied = true;
    }
    if (result.newClass !== currentClass) {
      progression.allocationClass = result.newClass;
      progression.processedMilestones = 0;
      progression.allocationHistory = [];
    } else if (result.newFragments < character.soulFragments) {
      const rollback = rollbackStatAllocations(progression, result.newFragments, currentClass, normalizeStats(updates.stats || character.stats));
      updates.stats = rollback.stats;
      Object.assign(progression, rollback.progression);
    }
    updates.statProgression = progression;

    const essenceChange = result.newMaxEssence - oldMaxEssence;
    updates.currentEssence = essenceChange > 0
      ? Math.min(result.newMaxEssence, (character.currentEssence ?? 0) + essenceChange)
      : Math.min(character.currentEssence ?? 0, result.newMaxEssence);

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
  const customAttributePalette = getCustomAttributePalette(character.name);
  const accentColor = customAttributePalette?.primary || normalizeAccentColor(isEditing ? editData.accentColor : character.accentColor);
  const accentSecondaryColor = customAttributePalette?.secondary || accentColor;
  const characterAccentStyle = {
    "--character-accent": accentColor,
    "--character-accent-secondary": accentSecondaryColor,
  } as React.CSSProperties;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="character-accent-scope glass-panel max-w-7xl h-[90vh] p-0 overflow-hidden flex flex-col border-primary/30"
        style={characterAccentStyle}
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
                    {customAttributePalette ? (
                      <span className="flex items-center gap-1.5 normal-case tracking-normal" title="Designated custom attribute palette">
                        <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: accentColor }} />
                        <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: accentSecondaryColor }} />
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Attributes</span>
                      </span>
                    ) : <label className="flex items-center gap-1.5 normal-case tracking-normal" title="Custom attribute color">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(event) => setEditData({ ...editData, accentColor: event.target.value })}
                        className="h-7 w-8 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
                        aria-label="Custom attribute color"
                      />
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Attributes</span>
                    </label>}
                  </>
                ) : character.trueName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {canEdit && (
              <Button type="button" variant="outline" onClick={() => setIsAddingCounter((current) => !current)} className={isAddingCounter ? "border-destructive/50 text-destructive hover:bg-destructive/10" : "border-primary/35 text-primary hover:bg-primary/10"}>
                {isAddingCounter ? <><X className="mr-2 h-4 w-4" /> Cancel Counter</> : <><Hash className="mr-2 h-4 w-4" /> Add a Counter</>}
              </Button>
            )}
            {canEdit && (
              isEditing ? (
                <Button onClick={handleSave} disabled={updateChar.isPending || isSavingToBank} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Save className="w-4 h-4 mr-2" /> {updateChar.isPending || isSavingToBank ? "Saving..." : "Save Changes"}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)} className="border-primary/50 text-primary hover:bg-primary/10">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit Sheet
                </Button>
              )
            )}
          </div>
        </DialogHeader>

        <div className={`flex-1 overflow-y-auto p-6 scroll-smooth ${isAddingCounter ? "cursor-crosshair" : ""}`}>
          {isAddingCounter && (
            <div className="sticky top-0 z-20 mb-4 rounded-lg border border-primary/35 bg-background/95 px-4 py-2 text-center text-sm font-medium text-primary shadow-lg backdrop-blur">
              Click the attribute, memory, or echo that should receive the counter.
            </div>
          )}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[19rem_repeat(2,minmax(0,1fr))]">
            
            {/* Progression, echoes, and stats */}
            <div className="contents">
              {/* Echoes sit directly beneath attributes in the left rail. */}
              <div
                className="character-custom-scope order-4 space-y-4 lg:col-start-1 lg:row-start-3"
                style={{ "--character-accent": DEFAULT_ECHO_ACCENT_COLOR } as React.CSSProperties}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex-1 border-b border-white/10 pb-2 font-display text-lg text-foreground">Echoes</h3>
                    {canEdit && isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingEcho(true)}
                        className="mb-2 h-7 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Echo
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {visibleEchoes.length > 0 ? visibleEchoes.map((echo, i) => {
                      const hpPercent = echo.maxHealth > 0 ? (echo.currentHealth / echo.maxHealth) * 100 : 0;
                      return (
                        <div key={i} className={`space-y-2 ${isAddingCounter ? "rounded-lg ring-1 ring-primary/40 hover:ring-2" : ""}`} onClickCapture={(event) => handleCounterTargetClick(event, "echo", i)}>
                          <div className={`relative p-3 rounded-lg border transition-all ${
                            echo.isSummoned && !isEditing
                              ? "character-accent-border character-accent-soft"
                              : "bg-secondary/30 border-white/5 hover:bg-secondary/50 hover:border-white/10"
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              <EchoPopup
                                echo={echo}
                                canEdit={canEdit}
                                onSave={(nextEcho: Echo) => handleSaveEchoAtIndex(i, nextEcho)}
                                startInEditMode={isEditing}
                              >
                                  <div className="flex-1 cursor-pointer min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Sparkles className="w-4 h-4 shrink-0" />
                                      <p className="font-medium text-sm text-foreground truncate">{echo.name || `Echo ${i + 1}`}</p>
                                      <span className="character-accent-text shrink-0 text-[10px] font-bold uppercase tracking-widest">
                                        AC {echo.armorClass}
                                      </span>
                                    </div>
                                  </div>
                              </EchoPopup>
                              {isEditing && <Button type="button" variant="ghost" size="icon" onClick={() => setPendingEchoDeleteIndex(i)} className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${echo.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>}
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
                                          className="character-accent-button h-7 flex-1 px-2 text-[11px]"
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
                                          className="character-accent-button h-7 flex-1 px-2 text-[11px]"
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
                                          <p className="character-accent-text mt-1 font-display text-lg font-bold">
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
                          {renderCounters("echo", i)}
                        </div>
                      );
                    }) : <p className="text-sm text-muted-foreground italic">None</p>}
                  </div>
                </div>
              </div>

              {/* Stats Block */}
              <div className={`order-1 h-full space-y-3 ${pendingStatAllocations > 0 ? "rounded-xl border border-primary/35 bg-primary/[0.03] p-3 shadow-[0_0_24px_rgba(251,191,36,0.14)]" : "p-1"}`}>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary/80">Stats</h4>
                  {pendingStatAllocations > 0 && !isEditing && (
                    <span className="max-w-[14rem] rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-right text-[8px] font-bold uppercase leading-tight tracking-wider text-primary">
                      {pendingStatAllocations > 1 ? `${pendingStatAllocations} choices · ` : ""}{nextStatAllocation?.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[STAT_FIELDS.slice(0, 3), STAT_FIELDS.slice(3)].map((column, columnIndex) => (
                    <div key={columnIndex} className="space-y-1">
                      {column.map((stat) => {
                        const trainingLevel = (isEditing ? editStatProgression : statProgression).training[stat.key];
                        const allocationAmount = nextStatAllocation?.options[stat.key];
                        return <div key={stat.key} className={`border-b px-1 py-1.5 last:border-b-0 ${!isEditing && allocationAmount ? "rounded-md border-primary/25 bg-primary/5" : "border-white/5"}`}>
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.short}</p>
                            {isEditing ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => cycleTraining(stat.key)} className="h-5 px-1 text-[8px] uppercase text-muted-foreground" title="Cycle check/save training">
                                {trainingLevel === "expertise" ? "EXP" : trainingLevel === "proficient" ? "PROF" : "—"}
                              </Button>
                            ) : trainingLevel ? (
                              <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${trainingLevel === "expertise" ? "bg-amber-400/15 text-amber-200" : "bg-primary/10 text-primary"}`} title={`${trainingLevel} in checks and saves`}>
                                {trainingLevel === "expertise" ? "EXP" : "PROF"}
                              </span>
                            ) : null}
                          </div>
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
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <p className="font-display text-base text-foreground">{characterStats[stat.key]}</p>
                              {!!allocationAmount && canEdit && (
                                <Button type="button" size="sm" onClick={() => handleAllocateStat(stat.key)} disabled={updateChar.isPending} className="h-6 min-w-8 bg-primary/15 px-1.5 text-[10px] font-bold text-primary hover:bg-primary/25" aria-label={`Increase ${stat.label} by ${allocationAmount}`}>
                                  +{allocationAmount}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>;
                      })}
                    </div>
                  ))}
                </div>

                {!isEditing && canEdit && getClassTierIndex(progressionClass) >= 1 && !statProgression.physicalChoice && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                    <p className="mb-1.5 text-[9px] uppercase tracking-widest text-primary/80">Choose Monster physical training</p>
                    <div className="grid grid-cols-3 gap-1">
                      {(["strength", "dexterity", "constitution"] as StatKey[]).map((key) => <Button key={key} type="button" variant="outline" size="sm" onClick={() => handleTrainingChoice(key, "physical")} disabled={updateChar.isPending} className="h-7 border-primary/20 px-1 text-[9px] uppercase text-primary hover:bg-primary/10">{key.slice(0, 3)}</Button>)}
                    </div>
                  </div>
                )}
                {!isEditing && canEdit && getClassTierIndex(progressionClass) >= 2 && !statProgression.mentalChoice && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                    <p className="mb-1.5 text-[9px] uppercase tracking-widest text-primary/80">Choose Demon mental training</p>
                    <div className="grid grid-cols-3 gap-1">
                      {(["intelligence", "wisdom", "charisma"] as StatKey[]).map((key) => <Button key={key} type="button" variant="outline" size="sm" onClick={() => handleTrainingChoice(key, "mental")} disabled={updateChar.isPending} className="h-7 border-primary/20 px-1 text-[9px] uppercase text-primary hover:bg-primary/10">{key.slice(0, 3)}</Button>)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                  <div className="px-1 py-1">
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

                  <div className="border-l border-white/10 px-3 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Proficiency</p>
                    <p className="mt-1 font-display text-xl text-primary">+{proficiencyBonus}</p>
                    <p className="text-[9px] leading-snug text-muted-foreground">{character.soulFragments ?? 0} fragments</p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-display text-base font-bold sm:text-lg">
                    {isEditing ? (
                      <Select
                        value={displayedSoulCore}
                        onValueChange={(value) => setEditData({
                          ...editData,
                          soulCore: value,
                          rank: getRankForSoulCore(value),
                        })}
                      >
                        <SelectTrigger className="h-7 w-[112px] border-primary/25 bg-black/30 px-2 font-display text-xs text-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOUL_CORES.map((soulCore) => (
                            <SelectItem key={soulCore} value={soulCore}>{soulCore}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-primary">{displayedSoulCore}</span>
                    )}
                    <span className="text-muted-foreground/50">·</span>
                    <span className="cursor-help text-foreground" data-testid="text-soul-class" title={CLASS_PROGRESSION_DESCRIPTIONS[currentClass]}>{currentClass}</span>
                    <span className="text-muted-foreground/50">—</span>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={editData.soulFragments ?? 0}
                          onChange={(event) => setEditData({
                            ...editData,
                            soulFragments: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                          })}
                          className="h-7 w-16 border-primary/25 bg-black/30 px-2 text-center font-display text-xs text-primary"
                          aria-label="Current fragments"
                          data-testid="input-current-fragments"
                        />
                        <span className="text-xs text-muted-foreground">/ {maxFragments}</span>
                      </div>
                    ) : (
                      <span className="text-primary">
                        {character.soulFragments} / {maxFragments}
                        {isMaxClass && character.soulFragments >= maxFragments && (
                          <span className="ml-1 font-sans text-[8px] font-normal uppercase tracking-widest text-muted-foreground">Max</span>
                        )}
                      </span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="mt-1.5 flex items-center justify-center gap-1">
                      {[-10, -1, 1, 10].map((delta) => {
                        const increasing = delta > 0;
                        const disabled = !canEdit
                          || (!increasing && character.soulFragments <= 0)
                          || (increasing && isMaxClass && character.soulFragments >= maxFragments);
                        return (
                          <Button
                            key={delta}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 min-w-7 rounded-sm px-1.5 font-display text-sm font-bold leading-none text-muted-foreground hover:bg-primary/5 hover:text-primary"
                            onClick={() => handleFragmentChange(delta)}
                            disabled={disabled}
                            data-testid={`button-fragments-${delta > 0 ? "plus" : "minus"}${Math.abs(delta)}`}
                          >
                            {delta === -10 ? "--" : delta === -1 ? "-" : delta === 1 ? "+" : "++"}
                          </Button>
                        );
                      })}
                    </div>
                  )}
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

              {/* Attributes and memories */}
              <div className="contents">
                {/* Attributes */}
                <div className="order-3 space-y-4 lg:col-start-1 lg:row-start-2">
                  {isEditing ? (
                    <TraitEditor
                      title="Attributes"
                      traits={editData.attributes || []}
                      onChange={t => setEditData({ ...editData, attributes: t })}
                      accentColor={accentColor}
                      accentSecondaryColor={accentSecondaryColor}
                      lockRememberedEffects={character.name.trim().toLowerCase().includes("steven")}
                      bare
                      addLabel="Add Attribute"
                      renderAccessory={(index) => renderCounters("attribute", index)}
                      onItemClickCapture={(event, index) => handleCounterTargetClick(event, "attribute", index)}
                    />
                  ) : (
                    <><h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Attributes</h3><div className="flex flex-col gap-2">
                      {displayAttributes.length > 0 ? displayAttributes.map((attr, i) => (
                        <div key={i} className={`space-y-1 ${isAddingCounter ? "rounded-lg ring-1 ring-primary/40 hover:ring-2" : ""}`} onClickCapture={(event) => handleCounterTargetClick(event, "attribute", i)}>
                        {attr.starSeeking ? (
                          <StarSeekingPopup
                            key={i}
                            trait={attr}
                            canRoll={canEdit}
                            stats={characterStats}
                            proficiencyBonus={proficiencyBonus}
                            accentColor={accentColor}
                            accentSecondaryColor={accentSecondaryColor}
                            onChangeForm={canEdit ? (limbId, formId) => handleStarSeekingFormChange(i, limbId, formId) : undefined}
                          >
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow cursor-pointer rounded-lg border p-3 transition-all">
                              <div className="flex items-center gap-2"><Star className="character-accent-text h-4 w-4 fill-amber-300/20" /><p className="text-sm font-medium text-amber-200">{attr.name}</p></div>
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
                          <ReforgingPopup key={i} trait={attr} accentColor={accentColor} accentSecondaryColor={accentSecondaryColor} onChangeCount={canEdit ? (monsterIndex, delta) => handleReforgeCountChange(i, monsterIndex, delta) : undefined}>
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow rounded-lg border p-3 transition-all cursor-pointer">
                              <div className="flex items-center gap-2"><Flame className="character-accent-text h-4 w-4" /><p className="text-sm font-medium text-red-200">{attr.name}</p></div>
                              {attr.effect && attr.effect.trim() !== "?" && <p className="mt-1 truncate text-xs text-muted-foreground">{attr.effect}</p>}
                              <div className="ml-6 mt-2 flex items-center justify-between rounded-md border border-red-500/20 bg-black/30 px-2.5 py-1.5">
                                <div className="min-w-0"><p className="text-[9px] uppercase tracking-widest text-orange-300/70">Goal</p><p className="truncate text-xs font-medium text-foreground">{attr.reforging.goalName || "Undiscovered"}</p></div>
                                <div className="ml-3 flex shrink-0 items-center gap-1.5 text-red-200"><Anvil className="h-3.5 w-3.5" /><span className="font-display text-lg">{attr.reforging.goalNumber || "???"}</span></div>
                              </div>
                            </div>
                          </ReforgingPopup>
                        ) : attr.rememberedBy ? (
                          <RememberedByPopup key={i} trait={attr} accentColor={accentColor} accentSecondaryColor={accentSecondaryColor}>
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow p-3 border rounded-lg cursor-pointer transition-all">
                              <div className="flex items-center gap-2"><Fingerprint className="character-accent-text h-4 w-4" /><p className="font-medium text-sm text-fuchsia-200">{attr.name}</p></div>
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
                            accentSecondaryColor={accentSecondaryColor}
                            onActivate={canEdit ? (name) => handleActivateSubAttribute(i, name) : undefined}
                            onLearn={canEdit && attr.activeSubAttribute ? () => handleLearnSubAttribute(i) : undefined}
                          >
                            <div className="character-custom-scope character-accent-border character-accent-soft character-accent-glow p-3 border rounded-lg cursor-pointer transition-all">
                              <div className="flex items-center gap-2"><Sparkles className="character-accent-text h-4 w-4" /><p className="font-medium text-sm text-emerald-200">{attr.name}</p></div>
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
                            <div className="cursor-pointer rounded-lg border border-white/5 bg-secondary/30 p-3 transition-all hover:border-white/10 hover:bg-secondary/50">
                              <p className="text-sm font-medium text-foreground">{attr.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{attr.effect}</p>
                            </div>
                          </TraitPopup>
                        )}
                        {renderCounters("attribute", i)}
                        </div>
                      )) : <p className="text-sm text-muted-foreground italic">None</p>}
                    </div></>
                  )}
                </div>

                {/* Memories */}
                <div className="order-5 space-y-4 lg:col-span-2 lg:col-start-2 lg:row-span-2 lg:row-start-2">
                  {isEditing ? (
                    <MemoryEditor
                      memories={(editData.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus))}
                      proficiencyBonus={proficiencyBonus}
                      stats={editStats}
                      onMoveToBank={(memory) => setMemoriesForBank((current) => [...current, memory])}
                      onChange={m => setEditData({...editData, memories: m})}
                      renderAccessory={(index) => renderCounters("memory", index)}
                      onItemClickCapture={(event, index) => handleCounterTargetClick(event, "memory", index)}
                    />
                  ) : (
                    <><h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Memories</h3><div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {memories.length > 0 ? memories.map((mem, i) => {
                        const TypeIcon = MEMORY_TYPE_ICONS[mem.memoryType] || Wrench;
                        const colorClass = MEMORY_TYPE_COLORS[mem.memoryType] || MEMORY_TYPE_COLORS.tool;
                        const isWeaponMemory = mem.memoryType === "weapon";
                        const memoryTypeLabel = mem.memoryType === "charm" ? "utility" : mem.memoryType;
                        return (
                          <div key={i} onClickCapture={(event) => handleCounterTargetClick(event, "memory", i)} className={`relative p-3 rounded-lg border transition-all ${isAddingCounter ? "ring-1 ring-primary/40 hover:ring-2 " : ""}${
                            mem.isSummoned
                              ? `${colorClass} shadow-lg shadow-current/15`
                              : "border-white/5 bg-secondary/30 text-foreground hover:border-white/10 hover:bg-secondary/50"
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              <MemoryPopup
                                memory={mem}
                                proficiencyBonus={proficiencyBonus}
                                stats={characterStats}
                              >
                                <div className="flex-1 cursor-pointer min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <TypeIcon className="w-4 h-4 shrink-0" />
                                    <p className={`truncate text-sm font-medium ${mem.isSummoned && isWeaponMemory ? "text-primary" : "text-foreground"}`}>{mem.name}</p>
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
                              </MemoryPopup>
                              {canEdit && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSummonToggle(i)}
                                  className={`shrink-0 text-xs h-7 ${
                                    mem.isSummoned
                                      ? "border-primary/50 text-primary hover:bg-primary/10"
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
                                    className="flex-1 border-primary/30 text-xs text-primary hover:bg-primary/10"
                                    onClick={() => handleWeaponHit(mem, i)}
                                    data-testid={`button-weapon-hit-${i}`}
                                  >
                                    <Crosshair className="w-3 h-3 mr-1" /> Hit (D20{(getWeaponHitModifier(mem, characterStats) + (mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0)) >= 0 ? "+" : ""}{getWeaponHitModifier(mem, characterStats) + (mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0)})
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-primary/30 text-xs text-primary hover:bg-primary/10"
                                    onClick={() => handleWeaponDamage(mem, i)}
                                    data-testid={`button-weapon-dmg-${i}`}
                                  >
                                    <Flame className="w-3 h-3 mr-1" /> Dmg ({mem.weaponDamage.diceCount}{mem.weaponDamage.damageDie}{getWeaponDamageModifier(mem, characterStats) >= 0 ? "+" : ""}{getWeaponDamageModifier(mem, characterStats)})
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
                            {renderCounters("memory", i)}
                          </div>
                        );
                      }) : <p className="text-sm text-muted-foreground italic">None</p>}
                    </div></>
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
            className={`character-custom-scope ${ECHO_ADD_CONTENT_CLASS}`}
            style={{ "--character-accent": DEFAULT_ECHO_ACCENT_COLOR } as React.CSSProperties}
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

        <AlertDialog open={pendingEchoDeleteIndex !== null} onOpenChange={(openState) => { if (!openState) setPendingEchoDeleteIndex(null); }}>
          <AlertDialogContent className="glass-panel border-destructive/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-xl text-destructive">Delete echo?</AlertDialogTitle>
              <AlertDialogDescription>This will remove <span className="font-bold text-foreground">{visibleEchoes[pendingEchoDeleteIndex ?? -1]?.name || "this echo"}</span> from the sheet when you save your changes.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (pendingEchoDeleteIndex !== null) handleDeleteEchoAtIndex(pendingEchoDeleteIndex); setPendingEchoDeleteIndex(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Echo</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
