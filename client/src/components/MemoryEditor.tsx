import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  type ArmorDexterityBonusMode,
  type Memory,
  type MemoryType,
  type WeaponDamage,
  ARMOR_DEXTERITY_BONUS_MODES,
  DAMAGE_DICE,
  MEMORY_CORES,
  MEMORY_TIERS,
  MEMORY_TYPES,
} from "@shared/schema";

interface MemoryEditorProps {
  memories: Memory[];
  onChange: (memories: Memory[]) => void;
  proficiencyBonus?: number;
}

const TYPE_LABELS: Record<MemoryType, string> = {
  armor: "Armor",
  weapon: "Weapon",
  tool: "Tool",
  charm: "Utility",
};

const ARMOR_DEX_BONUS_LABELS: Record<ArmorDexterityBonusMode, string> = {
  full: "Full DEX",
  half: "Half DEX",
  none: "No DEX",
};

const DEFAULT_WEAPON_DAMAGE: WeaponDamage = {
  hitModifier: 0,
  damageDie: "D6",
  diceCount: 1,
  damageModifier: 0,
};

const MEMORY_WINDOW_CONTENT_CLASS = "glass-panel border-primary/20 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,36rem)] overflow-hidden p-0 flex flex-col";
const MEMORY_WINDOW_BODY_CLASS = "flex-1 min-h-0 overflow-y-auto p-6 space-y-3";
const MEMORY_METADATA_GRID_CLASS = "grid grid-cols-1 sm:grid-cols-3 gap-3";

type EditableMemoryTextField = "effect" | "description";

const createNewMemoryDraft = (): Memory => ({
  name: "",
  description: "",
  effect: "",
  memoryType: "tool",
  core: "dormant",
  tier: 1,
  essenceCost: 0,
  isDamageDealing: false,
  currentDurability: 10,
  maxDurability: 10,
  healRate: 1,
  isSummoned: false,
  isProficient: true,
});

function WeaponDamageEditor({
  damage,
  onChange,
  title = "Damage Settings",
  proficiencyBonus = 0,
}: {
  damage: WeaponDamage;
  onChange: (d: WeaponDamage) => void;
  title?: string;
  proficiencyBonus?: number;
}) {
  return (
    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2">
      <h5 className="text-xs font-bold uppercase tracking-widest text-red-400">{title}</h5>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Base Hit Modifier</label>
          <Input
            type="number"
            value={damage.hitModifier}
            onChange={e => onChange({ ...damage, hitModifier: parseInt(e.target.value) || 0 })}
            className="bg-black/50 h-8 text-sm"
          />
          {proficiencyBonus > 0 && (
            <p className="mt-1 text-[10px] text-emerald-300">Final hit: {damage.hitModifier + proficiencyBonus >= 0 ? "+" : ""}{damage.hitModifier + proficiencyBonus} (+{proficiencyBonus} proficiency)</p>
          )}
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Damage Die</label>
          <Select value={damage.damageDie} onValueChange={v => onChange({ ...damage, damageDie: v })}>
            <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAMAGE_DICE.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Dice Count</label>
          <Input
            type="number"
            value={damage.diceCount}
            onChange={e => onChange({ ...damage, diceCount: Math.max(1, parseInt(e.target.value) || 1) })}
            className="bg-black/50 h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Damage Modifier</label>
          <Input
            type="number"
            value={damage.damageModifier}
            onChange={e => onChange({ ...damage, damageModifier: parseInt(e.target.value) || 0 })}
            className="bg-black/50 h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export function MemoryEditor({ memories, onChange, proficiencyBonus = 2 }: MemoryEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editingTextField, setEditingTextField] = useState<{ index: number; field: EditableMemoryTextField } | null>(null);
  const [newMemory, setNewMemory] = useState<Memory>(createNewMemoryDraft());
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  const closeAddDialog = () => {
    setIsAdding(false);
    setNewMemory(createNewMemoryDraft());
  };

  const handleAdd = () => {
    if (!newMemory.name.trim()) return;
    const mem: Memory = {
      ...newMemory,
      currentDurability: newMemory.maxDurability,
      healRate: Math.max(0, newMemory.healRate ?? 1),
      isDamageDealing: newMemory.memoryType === "weapon" ? true : !!newMemory.isDamageDealing,
    };
    if (mem.isDamageDealing && !mem.weaponDamage) {
      mem.weaponDamage = { ...DEFAULT_WEAPON_DAMAGE };
    }
    if (!mem.isDamageDealing) {
      delete mem.weaponDamage;
    }
    if (mem.memoryType === "armor") {
      mem.armorClass = Math.max(1, mem.armorClass ?? 8);
      mem.armorDexterityBonus = mem.armorDexterityBonus ?? "full";
    } else {
      delete mem.armorClass;
      delete mem.armorDexterityBonus;
    }
    onChange([...memories, mem]);
    closeAddDialog();
  };

  const handleUpdate = (index: number, updates: Partial<Memory>) => {
    const updated = [...memories];
    const previousType = updated[index].memoryType;
    const merged = { ...updated[index], ...updates };

    if (updates.memoryType === "weapon") {
      merged.isDamageDealing = true;
    } else if (updates.memoryType && typeof updates.isDamageDealing === "undefined") {
      merged.isDamageDealing = false;
    }

    if (merged.memoryType === "weapon") {
      merged.isDamageDealing = true;
    }
    if (updates.memoryType && updates.memoryType !== previousType) {
      merged.isProficient = updates.memoryType === "weapon" || updates.memoryType === "armor"
        ? true
        : undefined;
    }
    merged.healRate = Math.max(0, merged.healRate ?? 1);
    if (merged.memoryType === "armor") {
      merged.armorClass = Math.max(1, merged.armorClass ?? 8);
      merged.armorDexterityBonus = merged.armorDexterityBonus ?? "full";
    } else {
      delete merged.armorClass;
      delete merged.armorDexterityBonus;
    }

    if (merged.isDamageDealing) {
      if (!merged.weaponDamage) {
        merged.weaponDamage = { ...DEFAULT_WEAPON_DAMAGE };
      }
    } else {
      delete merged.weaponDamage;
    }

    updated[index] = merged;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = [...memories];
    updated.splice(index, 1);
    onChange(updated);

    if (expandedIdx === index) {
      setExpandedIdx(null);
    } else if (expandedIdx !== null && expandedIdx > index) {
      setExpandedIdx(expandedIdx - 1);
    }

    if (!editingTextField) return;
    if (editingTextField.index === index) {
      setEditingTextField(null);
      return;
    }
    if (editingTextField.index > index) {
      setEditingTextField({ ...editingTextField, index: editingTextField.index - 1 });
    }
  };

  const confirmRemove = () => {
    if (pendingDeleteIndex === null) return;
    handleRemove(pendingDeleteIndex);
    setPendingDeleteIndex(null);
  };

  const textEditorMemory = editingTextField ? memories[editingTextField.index] : null;
  const textEditorTitle = editingTextField?.field === "effect" ? "Edit Effects" : "Edit Description";
  const textEditorValue = editingTextField && textEditorMemory
    ? textEditorMemory[editingTextField.field]
    : "";

  return (
    <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-display text-primary">Edit Memories</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          <Plus className="w-4 h-4 mr-2" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {memories.map((mem, idx) => (
          <div key={idx} className="bg-secondary/50 rounded-lg border border-white/5">
            <div
              className="flex items-center justify-between gap-4 p-3 cursor-pointer"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
                  {TYPE_LABELS[mem.memoryType] || "Tool"}
                </span>
                <p className="font-medium text-foreground truncate">{mem.name}</p>
                <span className="text-xs text-muted-foreground">{mem.currentDurability}/{mem.maxDurability}</span>
              </div>
              <div className="flex items-center gap-1">
                {expandedIdx === idx ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteIndex(idx);
                  }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {expandedIdx === idx && (
              <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
                <Input
                  placeholder="Name"
                  value={mem.name}
                  onChange={e => handleUpdate(idx, { name: e.target.value })}
                  className="bg-black/50"
                />
                <div className="flex gap-2">
                  <Select
                    value={mem.memoryType}
                    onValueChange={(v) => handleUpdate(idx, { memoryType: v as MemoryType })}
                  >
                    <SelectTrigger className="bg-black/50 border-white/10 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-end gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Max Durability</span>
                      <Input
                        type="number"
                        min={0}
                        value={mem.maxDurability}
                        onChange={e => {
                          const max = Math.max(0, parseInt(e.target.value) || 0);
                          handleUpdate(idx, { maxDurability: max, currentDurability: Math.min(mem.currentDurability, max) });
                        }}
                        className="w-20 bg-black/50 h-8 px-2 text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Current</span>
                      <Input
                        type="number"
                        min={0}
                        max={mem.maxDurability}
                        value={mem.currentDurability}
                        onChange={e => {
                          const current = Math.max(0, parseInt(e.target.value) || 0);
                          handleUpdate(idx, { currentDurability: Math.min(current, mem.maxDurability) });
                        }}
                        className="w-20 bg-black/50 h-8 px-2 text-center"
                        disabled={mem.isSummoned}
                        title={mem.isSummoned ? "Dismiss this memory to edit current durability." : undefined}
                      />
                    </div>
                  </div>
                </div>
                <div className={MEMORY_METADATA_GRID_CLASS}>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Core</label>
                    <Select
                      value={mem.core || "dormant"}
                      onValueChange={(v) => handleUpdate(idx, { core: v as Memory["core"] })}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
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
                      value={String(mem.tier || 1)}
                      onValueChange={(v) => {
                        const tier = Math.max(1, Math.min(7, parseInt(v, 10) || 1));
                        handleUpdate(idx, { tier });
                      }}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
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
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Cost</label>
                    <Input
                      type="number"
                      min={0}
                      value={mem.essenceCost ?? 0}
                      onChange={(e) => handleUpdate(idx, { essenceCost: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="bg-black/50 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Heal Rate</label>
                    <Input
                      type="number"
                      min={0}
                      value={mem.healRate ?? 1}
                      onChange={(e) => handleUpdate(idx, { healRate: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="bg-black/50 h-8 text-sm"
                    />
                  </div>
                  {mem.memoryType === "armor" ? (
                    <>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-widest">AC</label>
                        <Input
                          type="number"
                          min={1}
                          value={mem.armorClass ?? 8}
                          onChange={(e) => handleUpdate(idx, { armorClass: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="bg-black/50 h-8 text-sm"
                        />
                        {!mem.isProficient && (
                          <p className="mt-1 text-[10px] text-red-300">Effective AC: {Math.floor((mem.armorClass ?? 8) / 2)}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-widest">DEX Bonus</label>
                        <Select
                          value={mem.armorDexterityBonus ?? "full"}
                          onValueChange={(v) => handleUpdate(idx, { armorDexterityBonus: v as ArmorDexterityBonusMode })}
                        >
                          <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ARMOR_DEXTERITY_BONUS_MODES.map((mode) => (
                              <SelectItem key={mode} value={mode}>
                                {ARMOR_DEX_BONUS_LABELS[mode]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : null}
                </div>

                {(mem.memoryType === "weapon" || mem.memoryType === "armor") && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Proficient</p>
                      <p className="text-[11px] text-muted-foreground">
                        {mem.memoryType === "weapon"
                          ? `Adds +${proficiencyBonus} to hit connection.`
                          : "Without proficiency, this armor's AC is halved."}
                      </p>
                    </div>
                    <Switch checked={!!mem.isProficient} onCheckedChange={(checked) => handleUpdate(idx, { isProficient: checked })} />
                  </div>
                )}

                {mem.memoryType !== "weapon" ? (
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Damage Dealing</p>
                      <p className="text-[11px] text-muted-foreground">Enable hit and damage rolls for this memory.</p>
                    </div>
                    <Switch
                      checked={!!mem.isDamageDealing}
                      onCheckedChange={(checked) => handleUpdate(idx, { isDamageDealing: checked })}
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Damage Dealing</p>
                    <p className="text-[11px] text-muted-foreground">Weapons always use damage settings.</p>
                  </div>
                )}

                {mem.isDamageDealing && mem.weaponDamage && (
                  <WeaponDamageEditor
                    damage={mem.weaponDamage}
                    onChange={d => handleUpdate(idx, { weaponDamage: d })}
                    title={mem.memoryType === "weapon" ? "Weapon Damage" : "Damage Settings"}
                    proficiencyBonus={mem.memoryType === "weapon" && mem.isProficient ? proficiencyBonus : 0}
                  />
                )}

                <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Text Editing</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => setEditingTextField({ index: idx, field: "effect" })}
                    >
                      Edit Effects
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => setEditingTextField({ index: idx, field: "description" })}
                    >
                      Edit Description
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-md border border-white/10 bg-black/40 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Effects Preview</p>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                        {mem.effect.trim() ? mem.effect : <span className="text-muted-foreground italic">No effects yet.</span>}
                      </p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-black/40 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Description Preview</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                        {mem.description.trim() ? mem.description : <span className="text-muted-foreground italic">No description yet.</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {memories.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-2">None</p>
        )}
      </div>

      <Dialog
        open={!!editingTextField}
        onOpenChange={(open) => {
          if (!open) setEditingTextField(null);
        }}
      >
        <DialogContent className={MEMORY_WINDOW_CONTENT_CLASS}>
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-white/10">
              <DialogTitle className="font-display text-xl text-primary">
                {textEditorTitle} {textEditorMemory?.name ? `· ${textEditorMemory.name}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className={MEMORY_WINDOW_BODY_CLASS}>
              <Textarea
                value={textEditorValue}
                onChange={(e) => {
                  if (!editingTextField) return;
                  handleUpdate(editingTextField.index, { [editingTextField.field]: e.target.value } as Partial<Memory>);
                }}
                className="bg-black/50 border-white/10 min-h-[220px] h-full whitespace-pre-wrap resize-none"
              />
            </div>
            <DialogFooter className="px-6 py-4 border-t border-white/10">
              <Button
                type="button"
                onClick={() => setEditingTextField(null)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAdding}
        onOpenChange={(open) => {
          if (!open) {
            closeAddDialog();
            return;
          }
          setIsAdding(true);
        }}
      >
        <DialogContent className={MEMORY_WINDOW_CONTENT_CLASS}>
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-white/10">
              <DialogTitle className="font-display text-xl text-primary">Add Memory</DialogTitle>
            </DialogHeader>
            <div className={MEMORY_WINDOW_BODY_CLASS}>
              <Input
                placeholder="Memory Name"
                value={newMemory.name}
                onChange={e => setNewMemory({ ...newMemory, name: e.target.value })}
                className="bg-black/50"
              />
              <div className="flex gap-2">
                <Select
                  value={newMemory.memoryType}
                  onValueChange={(v) => {
                    const updates: Partial<Memory> = { memoryType: v as MemoryType };
                    if (v === "weapon") {
                      updates.isDamageDealing = true;
                      updates.isProficient = true;
                      updates.weaponDamage = newMemory.weaponDamage || { ...DEFAULT_WEAPON_DAMAGE };
                      updates.armorClass = undefined;
                      updates.armorDexterityBonus = undefined;
                    } else if (v === "armor") {
                      updates.isDamageDealing = false;
                      updates.isProficient = true;
                      updates.weaponDamage = undefined;
                      updates.armorClass = 8;
                      updates.armorDexterityBonus = "full";
                    } else {
                      updates.isDamageDealing = false;
                      updates.isProficient = undefined;
                      updates.weaponDamage = undefined;
                      updates.armorClass = undefined;
                      updates.armorDexterityBonus = undefined;
                    }
                    setNewMemory({ ...newMemory, ...updates });
                  }}
                >
                  <SelectTrigger className="bg-black/50 border-white/10 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMORY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Durability:</span>
                  <Input
                    type="number"
                    min={0}
                    value={newMemory.maxDurability}
                    onChange={e => setNewMemory({ ...newMemory, maxDurability: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-16 bg-black/50 h-8 px-2 text-center"
                  />
                </div>
              </div>
              <div className={MEMORY_METADATA_GRID_CLASS}>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Core</label>
                  <Select
                    value={newMemory.core || "dormant"}
                    onValueChange={(v) => setNewMemory({ ...newMemory, core: v as Memory["core"] })}
                  >
                    <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
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
                    value={String(newMemory.tier || 1)}
                    onValueChange={(v) => {
                      const tier = Math.max(1, Math.min(7, parseInt(v, 10) || 1));
                      setNewMemory({ ...newMemory, tier });
                    }}
                  >
                    <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
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
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Cost</label>
                  <Input
                    type="number"
                    min={0}
                    value={newMemory.essenceCost ?? 0}
                    onChange={(e) => setNewMemory({ ...newMemory, essenceCost: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="bg-black/50 h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Heal Rate</label>
                  <Input
                    type="number"
                    min={0}
                    value={newMemory.healRate ?? 1}
                    onChange={(e) => setNewMemory({ ...newMemory, healRate: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="bg-black/50 h-8 text-sm"
                  />
                </div>
                {newMemory.memoryType === "armor" ? (
                  <>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-widest">AC</label>
                      <Input
                        type="number"
                        min={1}
                        value={newMemory.armorClass ?? 8}
                        onChange={(e) => setNewMemory({ ...newMemory, armorClass: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="bg-black/50 h-8 text-sm"
                      />
                      {!newMemory.isProficient && (
                        <p className="mt-1 text-[10px] text-red-300">Effective AC: {Math.floor((newMemory.armorClass ?? 8) / 2)}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-widest">DEX Bonus</label>
                      <Select
                        value={newMemory.armorDexterityBonus ?? "full"}
                        onValueChange={(v) => setNewMemory({ ...newMemory, armorDexterityBonus: v as ArmorDexterityBonusMode })}
                      >
                        <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ARMOR_DEXTERITY_BONUS_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {ARMOR_DEX_BONUS_LABELS[mode]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
              </div>

              {(newMemory.memoryType === "weapon" || newMemory.memoryType === "armor") && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Proficient</p>
                    <p className="text-[11px] text-muted-foreground">
                      {newMemory.memoryType === "weapon"
                        ? `Adds +${proficiencyBonus} to hit connection.`
                        : "Without proficiency, this armor's AC is halved."}
                    </p>
                  </div>
                  <Switch checked={!!newMemory.isProficient} onCheckedChange={(checked) => setNewMemory({ ...newMemory, isProficient: checked })} />
                </div>
              )}

              {newMemory.memoryType !== "weapon" ? (
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Damage Dealing</p>
                    <p className="text-[11px] text-muted-foreground">Enable hit and damage rolls for this memory.</p>
                  </div>
                  <Switch
                    checked={!!newMemory.isDamageDealing}
                    onCheckedChange={(checked) =>
                      setNewMemory({
                        ...newMemory,
                        isDamageDealing: checked,
                        weaponDamage: checked ? (newMemory.weaponDamage || { ...DEFAULT_WEAPON_DAMAGE }) : undefined,
                      })
                    }
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Damage Dealing</p>
                  <p className="text-[11px] text-muted-foreground">Weapons always use damage settings.</p>
                </div>
              )}

              {newMemory.isDamageDealing && newMemory.weaponDamage && (
                <WeaponDamageEditor
                  damage={newMemory.weaponDamage}
                  onChange={d => setNewMemory({ ...newMemory, weaponDamage: d })}
                  title={newMemory.memoryType === "weapon" ? "Weapon Damage" : "Damage Settings"}
                  proficiencyBonus={newMemory.memoryType === "weapon" && newMemory.isProficient ? proficiencyBonus : 0}
                />
              )}
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Effects</label>
                <Textarea
                  placeholder="Effects"
                  value={newMemory.effect}
                  onChange={e => setNewMemory({ ...newMemory, effect: e.target.value })}
                  className="bg-black/50 min-h-[110px] whitespace-pre-wrap"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Description</label>
                <Textarea
                  placeholder="Description"
                  value={newMemory.description}
                  onChange={e => setNewMemory({ ...newMemory, description: e.target.value })}
                  className="bg-black/50 min-h-[140px] whitespace-pre-wrap"
                />
              </div>
            </div>
            <DialogFooter className="px-6 py-4 border-t border-white/10">
              <Button variant="outline" onClick={closeAddDialog} className="border-white/10 hover:bg-white/5">
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!newMemory.name.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Confirm Add
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIndex(null);
        }}
      >
        <AlertDialogContent className="glass-panel border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-display text-xl">Delete memory?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will remove <span className="text-foreground font-bold">{memories[pendingDeleteIndex ?? -1]?.name || "this memory"}</span> from the sheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Memory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
