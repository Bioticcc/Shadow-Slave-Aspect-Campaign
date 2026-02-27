import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { type Memory, type MemoryType, type WeaponDamage, MEMORY_TYPES, DAMAGE_DICE } from "@shared/schema";

interface MemoryEditorProps {
  memories: Memory[];
  onChange: (memories: Memory[]) => void;
}

const TYPE_LABELS: Record<MemoryType, string> = {
  armor: "Armor",
  weapon: "Weapon",
  tool: "Tool",
  charm: "Charm",
};

const DEFAULT_WEAPON_DAMAGE: WeaponDamage = {
  hitModifier: 0,
  damageDie: "D6",
  diceCount: 1,
  damageModifier: 0,
};

function WeaponDamageEditor({ damage, onChange }: { damage: WeaponDamage; onChange: (d: WeaponDamage) => void }) {
  return (
    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2">
      <h5 className="text-xs font-bold uppercase tracking-widest text-red-400">Weapon Damage</h5>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Hit Modifier</label>
          <Input
            type="number"
            value={damage.hitModifier}
            onChange={e => onChange({ ...damage, hitModifier: parseInt(e.target.value) || 0 })}
            className="bg-black/50 h-8 text-sm"
          />
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

export function MemoryEditor({ memories, onChange }: MemoryEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [newMemory, setNewMemory] = useState<Memory>({
    name: "",
    description: "",
    effect: "",
    memoryType: "tool",
    currentDurability: 10,
    maxDurability: 10,
    isSummoned: false,
  });

  const handleAdd = () => {
    if (!newMemory.name.trim()) return;
    const mem = { ...newMemory, currentDurability: newMemory.maxDurability };
    if (mem.memoryType === "weapon" && !mem.weaponDamage) {
      mem.weaponDamage = { ...DEFAULT_WEAPON_DAMAGE };
    }
    onChange([...memories, mem]);
    setNewMemory({
      name: "",
      description: "",
      effect: "",
      memoryType: "tool",
      currentDurability: 10,
      maxDurability: 10,
      isSummoned: false,
    });
    setIsAdding(false);
  };

  const handleUpdate = (index: number, updates: Partial<Memory>) => {
    const updated = [...memories];
    const merged = { ...updated[index], ...updates };
    if (updates.memoryType === "weapon" && !merged.weaponDamage) {
      merged.weaponDamage = { ...DEFAULT_WEAPON_DAMAGE };
    }
    if (updates.memoryType && updates.memoryType !== "weapon") {
      delete merged.weaponDamage;
    }
    updated[index] = merged;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = [...memories];
    updated.splice(index, 1);
    onChange(updated);
    if (expandedIdx === index) setExpandedIdx(null);
  };

  return (
    <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-display text-primary">Edit Memories</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          {isAdding ? "Cancel" : <><Plus className="w-4 h-4 mr-2" /> Add</>}
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
                  onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
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
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Durability:</span>
                    <Input
                      type="number"
                      value={mem.maxDurability}
                      onChange={e => {
                        const max = parseInt(e.target.value) || 0;
                        handleUpdate(idx, { maxDurability: max, currentDurability: Math.min(mem.currentDurability, max) });
                      }}
                      className="w-16 bg-black/50 h-8 px-2 text-center"
                    />
                  </div>
                </div>
                {mem.memoryType === "weapon" && mem.weaponDamage && (
                  <WeaponDamageEditor
                    damage={mem.weaponDamage}
                    onChange={d => handleUpdate(idx, { weaponDamage: d })}
                  />
                )}
                <Input
                  placeholder="Effect"
                  value={mem.effect}
                  onChange={e => handleUpdate(idx, { effect: e.target.value })}
                  className="bg-black/50"
                />
                <Textarea
                  placeholder="Description"
                  value={mem.description}
                  onChange={e => handleUpdate(idx, { description: e.target.value })}
                  className="bg-black/50 min-h-[60px]"
                />
              </div>
            )}
          </div>
        ))}
        {memories.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground italic text-center py-2">None</p>
        )}
      </div>

      {isAdding && (
        <div className="space-y-3 p-4 bg-background rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
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
                if (v === "weapon") updates.weaponDamage = { ...DEFAULT_WEAPON_DAMAGE };
                else updates.weaponDamage = undefined;
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
                value={newMemory.maxDurability}
                onChange={e => setNewMemory({ ...newMemory, maxDurability: parseInt(e.target.value) || 10 })}
                className="w-16 bg-black/50 h-8 px-2 text-center"
              />
            </div>
          </div>
          {newMemory.memoryType === "weapon" && newMemory.weaponDamage && (
            <WeaponDamageEditor
              damage={newMemory.weaponDamage}
              onChange={d => setNewMemory({ ...newMemory, weaponDamage: d })}
            />
          )}
          <Input
            placeholder="Effect"
            value={newMemory.effect}
            onChange={e => setNewMemory({ ...newMemory, effect: e.target.value })}
            className="bg-black/50"
          />
          <Textarea
            placeholder="Description"
            value={newMemory.description}
            onChange={e => setNewMemory({ ...newMemory, description: e.target.value })}
            className="bg-black/50 min-h-[60px]"
          />
          <Button onClick={handleAdd} disabled={!newMemory.name.trim()} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Confirm Add
          </Button>
        </div>
      )}
    </div>
  );
}
