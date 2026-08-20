import { type ReactNode } from "react";
import { Shield, Sparkles, Swords, Wrench } from "lucide-react";
import {
  ARMOR_DEXTERITY_BONUS_MODES,
  DAMAGE_DICE,
  MEMORY_CORES,
  MEMORY_TIERS,
  MEMORY_TYPES,
  STAT_KEYS,
  getEffectiveMemoryArmorClass,
  getWeaponAttackStat,
  getWeaponDamageModifier,
  getWeaponHitModifier,
  normalizeStats,
  type ArmorDexterityBonusMode,
  type CharacterStats,
  type Memory,
  type MemoryType,
  type WeaponDamage,
} from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  armor: "Armor",
  weapon: "Weapon",
  tool: "Tool",
  charm: "Utility",
};

export const MEMORY_TYPE_ICONS = { armor: Shield, weapon: Swords, tool: Wrench, charm: Sparkles };

const ARMOR_DEX_LABELS: Record<ArmorDexterityBonusMode, string> = {
  full: "Full DEX",
  half: "Half DEX",
  none: "No DEX",
};

const DEFAULT_DAMAGE: WeaponDamage = { attackStat: "dexterity", statModifierManaged: true, hitModifier: 0, damageDie: "D6", diceCount: 1, damageModifier: 0 };

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</label>;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-l border-white/10 px-3 first:border-l-0 first:pl-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg text-foreground">{value}</p>
    </div>
  );
}

function NumberField({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input type="number" min={min} value={value} onChange={(event) => onChange(Math.max(min, Number.parseInt(event.target.value, 10) || 0))} className="h-9 bg-black/50" />
    </div>
  );
}

export function MemoryDetail({ memory, editing, onChange, proficiencyBonus = 0, stats }: { memory: Memory; editing: boolean; onChange?: (memory: Memory) => void; proficiencyBonus?: number; stats?: CharacterStats }) {
  const update = (updates: Partial<Memory>) => onChange?.({ ...memory, ...updates });
  const damage = memory.weaponDamage || DEFAULT_DAMAGE;
  const updateDamage = (updates: Partial<WeaponDamage>) => update({ weaponDamage: { ...damage, ...updates } });
  const characterStats = normalizeStats(stats);
  const attackStat = getWeaponAttackStat(memory);
  const statBase = memory.memoryType === "weapon" ? characterStats[attackStat] : 0;
  const hitModifier = getWeaponHitModifier(memory, characterStats);
  const damageModifier = getWeaponDamageModifier(memory, characterStats);

  if (!editing) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.07] to-transparent p-4">
          <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Type" value={MEMORY_TYPE_LABELS[memory.memoryType]} />
            <Stat label="Rank" value={memory.core} />
            <Stat label="Tier" value={memory.tier} />
            <Stat label="Durability" value={`${memory.currentDurability}/${memory.maxDurability}`} />
            <Stat label="Heal Rate" value={memory.healRate} />
            <Stat label="Cost" value={memory.essenceCost} />
            <Stat label="Status" value={memory.isSummoned ? "Summoned" : "Stored"} />
          </div>
        </div>

        {memory.memoryType === "armor" && (
          <div className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Armor</p>
            <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
              <p className="font-display text-xl text-primary">AC {getEffectiveMemoryArmorClass(memory)}</p>
              <p className="text-sm text-muted-foreground">{ARMOR_DEX_LABELS[memory.armorDexterityBonus || "full"]}</p>
              <p className="text-sm text-muted-foreground">{memory.isProficient ? "Proficient" : "Not proficient"}</p>
            </div>
          </div>
        )}

        {memory.isDamageDealing && memory.weaponDamage && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Damage</p>
            <p className="mt-2 text-sm text-foreground">Hit D20{hitModifier + (memory.memoryType === "weapon" && memory.isProficient ? proficiencyBonus : 0) >= 0 ? "+" : ""}{hitModifier + (memory.memoryType === "weapon" && memory.isProficient ? proficiencyBonus : 0)} · {memory.weaponDamage.diceCount}{memory.weaponDamage.damageDie}{damageModifier >= 0 ? "+" : ""}{damageModifier}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h5 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary/80">Effect</h5>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">{memory.effect || <span className="italic text-muted-foreground">None</span>}</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h5 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</h5>
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{memory.description || <span className="italic">None</span>}</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Name</FieldLabel>
        <Input value={memory.name} onChange={(event) => update({ name: event.target.value })} className="bg-black/50" placeholder="Memory name" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <FieldLabel>Type</FieldLabel>
          <Select value={memory.memoryType} onValueChange={(value) => {
            const memoryType = value as MemoryType;
            update({
              memoryType,
              isDamageDealing: memoryType === "weapon" ? true : memory.isDamageDealing,
              weaponDamage: memoryType === "weapon"
                ? { ...(memory.weaponDamage || DEFAULT_DAMAGE), attackStat: memory.weaponDamage?.attackStat || "dexterity", statModifierManaged: true }
                : memory.weaponDamage,
              armorClass: memoryType === "armor" ? (memory.armorClass || 8) : undefined,
              armorDexterityBonus: memoryType === "armor" ? (memory.armorDexterityBonus || "full") : undefined,
              isProficient: memoryType === "weapon" || memoryType === "armor" ? (memory.isProficient ?? true) : undefined,
            });
          }}><SelectTrigger className="h-9 bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{MEMORY_TYPES.map((type) => <SelectItem key={type} value={type}>{MEMORY_TYPE_LABELS[type]}</SelectItem>)}</SelectContent></Select>
        </div>
        <div><FieldLabel>Rank</FieldLabel><Select value={memory.core} onValueChange={(core) => update({ core: core as Memory["core"] })}><SelectTrigger className="h-9 bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{MEMORY_CORES.map((core) => <SelectItem key={core} value={core}>{core}</SelectItem>)}</SelectContent></Select></div>
        <div><FieldLabel>Tier</FieldLabel><Select value={String(memory.tier)} onValueChange={(tier) => update({ tier: Number(tier) })}><SelectTrigger className="h-9 bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{MEMORY_TIERS.map((tier) => <SelectItem key={tier} value={String(tier)}>{tier}</SelectItem>)}</SelectContent></Select></div>
        <NumberField label="Essence Cost" value={memory.essenceCost} onChange={(essenceCost) => update({ essenceCost })} />
        <NumberField label="Current Durability" value={memory.currentDurability} onChange={(currentDurability) => update({ currentDurability: Math.min(currentDurability, memory.maxDurability) })} />
        <NumberField label="Max Durability" value={memory.maxDurability} onChange={(maxDurability) => update({ maxDurability, currentDurability: Math.min(memory.currentDurability, maxDurability) })} />
        <NumberField label="Heal Rate" value={memory.healRate} onChange={(healRate) => update({ healRate })} />
        {memory.memoryType === "armor" && <NumberField label="Armor Class" value={memory.armorClass || 8} min={1} onChange={(armorClass) => update({ armorClass })} />}
      </div>

      {(memory.memoryType === "weapon" || memory.memoryType === "armor") && <label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked={!!memory.isProficient} onCheckedChange={(checked) => update({ isProficient: checked === true })} /> Proficient</label>}
      {memory.memoryType === "weapon" && <div><FieldLabel>Weapon Stat</FieldLabel><Select value={attackStat} onValueChange={(attackStat) => updateDamage({ attackStat: attackStat as keyof CharacterStats, statModifierManaged: true })}><SelectTrigger className="max-w-xs bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{STAT_KEYS.map((stat) => <SelectItem key={stat} value={stat}>{stat.charAt(0).toUpperCase() + stat.slice(1)}</SelectItem>)}</SelectContent></Select></div>}
      {memory.memoryType === "armor" && <div><FieldLabel>Armor Dexterity Bonus</FieldLabel><Select value={memory.armorDexterityBonus || "full"} onValueChange={(value) => update({ armorDexterityBonus: value as ArmorDexterityBonusMode })}><SelectTrigger className="max-w-xs bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{ARMOR_DEXTERITY_BONUS_MODES.map((mode) => <SelectItem key={mode} value={mode}>{ARMOR_DEX_LABELS[mode]}</SelectItem>)}</SelectContent></Select></div>}

      {memory.memoryType !== "weapon" && <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground"><span>Damage dealing</span><Switch checked={memory.isDamageDealing} onCheckedChange={(isDamageDealing) => update({ isDamageDealing, weaponDamage: isDamageDealing ? (memory.weaponDamage || DEFAULT_DAMAGE) : undefined })} /></label>}
      {memory.isDamageDealing && <div className="grid grid-cols-2 gap-3 rounded-xl border border-red-400/20 bg-red-500/5 p-4 md:grid-cols-4">
        <NumberField label="Hit Modifier" value={hitModifier} min={-99} onChange={(value) => updateDamage({ hitModifier: value - statBase, statModifierManaged: memory.memoryType === "weapon" ? true : damage.statModifierManaged })} />
        <div><FieldLabel>Damage Die</FieldLabel><Select value={damage.damageDie} onValueChange={(damageDie) => updateDamage({ damageDie })}><SelectTrigger className="h-9 bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{DAMAGE_DICE.map((die) => <SelectItem key={die} value={die}>{die}</SelectItem>)}</SelectContent></Select></div>
        <NumberField label="Dice Count" value={damage.diceCount} min={1} onChange={(diceCount) => updateDamage({ diceCount })} />
        <NumberField label="Damage Modifier" value={damageModifier} min={-99} onChange={(value) => updateDamage({ damageModifier: value - statBase, statModifierManaged: memory.memoryType === "weapon" ? true : damage.statModifierManaged })} />
      </div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div><FieldLabel>Effect</FieldLabel><Textarea value={memory.effect} onChange={(event) => update({ effect: event.target.value })} className="min-h-[220px] resize-y bg-black/50" placeholder="Memory effects" /></div>
        <div><FieldLabel>Description</FieldLabel><Textarea value={memory.description} onChange={(event) => update({ description: event.target.value })} className="min-h-[220px] resize-y bg-black/50" placeholder="Memory description" /></div>
      </div>
    </div>
  );
}

export function MemoryPopup({ memory, children, editing = false, onChange, proficiencyBonus = 0, stats }: { memory: Memory; children: ReactNode; editing?: boolean; onChange?: (memory: Memory) => void; proficiencyBonus?: number; stats?: CharacterStats }) {
  const Icon = MEMORY_TYPE_ICONS[memory.memoryType];
  const isWeapon = memory.memoryType === "weapon";
  const isArmor = memory.memoryType === "armor";
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={`${isWeapon ? "!border-red-500/50" : isArmor ? "!border-blue-700/45" : "!border-white/15"} glass-panel grid h-[min(90vh,48rem)] w-[min(95vw,63rem)] max-w-[63rem] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0`}
      >
        <DialogHeader className="border-b border-white/10 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-3 font-display text-2xl text-primary text-glow"><Icon className="h-5 w-5" />{editing ? `Edit ${memory.name || "Memory"}` : memory.name}</DialogTitle>
          {editing && <p className="text-xs text-muted-foreground">Changes stay in the sheet draft. Close this window, then use Save Changes.</p>}
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto p-6"><MemoryDetail memory={memory} editing={editing} onChange={onChange} proficiencyBonus={proficiencyBonus} stats={stats} /></div>
      </DialogContent>
    </Dialog>
  );
}
