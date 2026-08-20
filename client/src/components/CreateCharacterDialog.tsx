import { useState } from "react";
import { useCreateCharacter } from "@/hooks/use-characters";
import { useAuth } from "@/lib/auth";
import {
  type CharacterStats,
  type Echo,
  type Memory,
  type Trait,
  getEssenceMaxForProgress,
  getProficiencyBonus,
  normalizeMemory,
  normalizeStatProgression,
  serializeEchoes,
} from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EchoPopup } from "@/components/EchoPopup";
import { MemoryEditor } from "@/components/MemoryEditor";
import { TraitEditor } from "@/components/TraitEditor";
import { Dna, Plus, Sparkles, Trash2, Upload } from "lucide-react";

const DEFAULT_CHARACTER_ACCENT_COLOR = "#b45353";
const SOUL_CORES = ["Dormant", "Awakened", "Ascended", "Transcendent", "Supreme", "Sacred", "Divine"];
const RANK_BY_SOUL_CORE: Record<string, string> = {
  Dormant: "Dreamer", Awakened: "Awakened", Ascended: "Master", Transcendent: "Saint",
  Supreme: "Sovereign", Sacred: "Sacred", Divine: "Divine",
};
const STAT_FIELDS: Array<{ key: keyof CharacterStats; short: string; label: string }> = [
  { key: "strength", short: "STR", label: "Strength" },
  { key: "dexterity", short: "DEX", label: "Dexterity" },
  { key: "constitution", short: "CON", label: "Constitution" },
  { key: "intelligence", short: "INT", label: "Intelligence" },
  { key: "wisdom", short: "WIS", label: "Wisdom" },
  { key: "charisma", short: "CHA", label: "Charisma" },
];

type CharacterDraft = {
  name: string;
  trueName: string;
  icon: string | null;
  accentColor: string;
  currentHealth: number;
  maxHealth: number;
  armorClass: number;
  soulCore: string;
  soulFragments: number;
  stats: CharacterStats;
  aspect: string;
  aspectAbilityDescription: string;
  aspectAbilities: Trait[];
  flaw: Trait;
  attributes: Trait[];
  memories: Memory[];
  echoes: Echo[];
  inventoryNotes: string;
};

const templateAttribute = (): Trait => ({
  name: "What Is an Attribute?",
  description: "Attributes are the innate qualities, powers, and unusual traits that belong to this character.",
  effect: "Replace this example with the attribute's mechanical effect, limitation, or passive benefit.",
});

const templateMemory = (): Memory => ({
  name: "What Is a Memory?",
  description: "Memories are manifested equipment, relics, weapons, armor, tools, or charms carried by the character.",
  effect: "Choose its type, core, tier, essence cost, durability, and the rules it provides.",
  memoryType: "tool",
  core: "dormant",
  tier: 1,
  essenceCost: 0,
  isDamageDealing: false,
  currentDurability: 10,
  maxDurability: 10,
  healRate: 1,
  isSummoned: false,
});

const templateEcho = (name = "What Is an Echo?"): Echo => ({
  name,
  armorClass: 8,
  description: "Echoes are summonable companions. Give one health, armor, a summon cost, and any damage moves it can use.",
  damageMoves: [],
  core: "dormant",
  tier: 1,
  currentHealth: 8,
  maxHealth: 8,
  healRate: 1,
  summonCost: 0,
  isSummoned: false,
});

const createInitialDraft = (): CharacterDraft => ({
  name: "",
  trueName: "",
  icon: null,
  accentColor: DEFAULT_CHARACTER_ACCENT_COLOR,
  currentHealth: 8,
  maxHealth: 8,
  armorClass: 8,
  soulCore: "Dormant",
  soulFragments: 0,
  stats: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
  aspect: "",
  aspectAbilityDescription: "",
  aspectAbilities: [],
  flaw: { name: "", description: "", effect: "" },
  attributes: [templateAttribute()],
  memories: [templateMemory()],
  echoes: [templateEcho()],
  inventoryNotes: "",
});

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-black/20 p-4 ${className}`}>
      <h3 className="mb-4 border-b border-white/10 pb-2 font-display text-lg text-primary">{title}</h3>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</label>;
}

export function CreateCharacterDialog() {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CharacterDraft>(createInitialDraft);
  const createChar = useCreateCharacter();
  const proficiencyBonus = getProficiencyBonus(draft.soulFragments);

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("This image is too large (max 5MB). Please choose a smaller file.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setDraft((current) => ({ ...current, icon: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const updateStat = (key: keyof CharacterStats, value: string) => {
    setDraft((current) => ({ ...current, stats: { ...current.stats, [key]: Number.parseInt(value, 10) || 0 } }));
  };

  const updateEcho = (index: number, echo: Echo) => {
    setDraft((current) => ({ ...current, echoes: current.echoes.map((item, itemIndex) => itemIndex === index ? echo : item) }));
  };

  const removeEcho = (index: number) => {
    setDraft((current) => ({ ...current, echoes: current.echoes.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const handleCreate = () => {
    const name = draft.name.trim();
    const trueName = draft.trueName.trim();
    if (!name || !trueName) return;

    const soulClass = "Beast";
    const soulFragments = Math.max(0, Math.min(999, draft.soulFragments));
    const maxEssence = getEssenceMaxForProgress(soulClass, soulFragments);
    createChar.mutate({
      name,
      trueName,
      icon: draft.icon,
      accentColor: draft.accentColor,
      rank: RANK_BY_SOUL_CORE[draft.soulCore] || draft.soulCore,
      soulCore: draft.soulCore,
      soulClass,
      soulFragments,
      totalSoulFragments: soulFragments,
      currentHealth: Math.max(0, Math.min(draft.currentHealth, Math.max(1, draft.maxHealth))),
      maxHealth: Math.max(1, draft.maxHealth),
      armorClass: Math.max(0, draft.armorClass),
      currentEssence: maxEssence,
      maxEssence,
      stats: draft.stats,
      statProgression: normalizeStatProgression({}, soulFragments, soulClass),
      aspect: draft.aspect,
      aspectRank: "Divine",
      aspectAbilityDescription: draft.aspectAbilityDescription,
      aspectAbilities: draft.aspectAbilities,
      flaw: draft.flaw,
      attributes: draft.attributes,
      memories: draft.memories.map((memory) => normalizeMemory(memory, proficiencyBonus)),
      echoes: serializeEchoes(draft.echoes),
      inventoryNotes: draft.inventoryNotes,
      owner: currentUser || "DM",
    }, {
      onSuccess: () => {
        setOpen(false);
        setDraft(createInitialDraft());
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Manifest Character
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel flex h-[92vh] w-[min(96vw,80rem)] max-w-[80rem] flex-col overflow-hidden border-primary/20 p-0 sm:max-w-[80rem]">
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 pb-4 pt-6">
          <DialogTitle className="font-display text-2xl text-primary text-glow">Manifest New Soul</DialogTitle>
          <p className="text-sm text-muted-foreground">Build the complete first version of the character sheet. Every section can still be changed later.</p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Identity">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><FieldLabel>Known Name</FieldLabel><Input placeholder="e.g. Sunnyless" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="bg-black/50 border-white/10" /></div>
                <div className="space-y-2"><FieldLabel>True Name</FieldLabel><Input placeholder="e.g. Lost from Light" value={draft.trueName} onChange={(event) => setDraft({ ...draft, trueName: event.target.value })} className="bg-black/50 border-white/10" /></div>
                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel>Soul Icon</FieldLabel>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/40 bg-black/40">{draft.icon ? <img src={draft.icon} alt="Preview" className="h-full w-full object-cover" /> : <Upload className="h-5 w-5 text-muted-foreground" />}</div>
                    <Input type="file" accept="image/*" onChange={handleIconUpload} className="bg-black/50 border-white/10 text-xs" />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel>Custom Attribute Color</FieldLabel>
                  <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
                    <input type="color" value={draft.accentColor} onChange={(event) => setDraft({ ...draft, accentColor: event.target.value })} className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent p-0.5" aria-label="Custom attribute color" />
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">Used only by this character's designated custom attribute.</p>
                    <span className="font-mono text-xs uppercase text-muted-foreground">{draft.accentColor}</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Vitals & Progression">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="space-y-2"><FieldLabel>Current HP</FieldLabel><Input type="number" min={0} value={draft.currentHealth} onChange={(event) => setDraft({ ...draft, currentHealth: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} className="bg-black/50" /></div>
                <div className="space-y-2"><FieldLabel>Max HP</FieldLabel><Input type="number" min={1} value={draft.maxHealth} onChange={(event) => setDraft({ ...draft, maxHealth: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })} className="bg-black/50" /></div>
                <div className="space-y-2"><FieldLabel>Armor Class</FieldLabel><Input type="number" min={0} value={draft.armorClass} onChange={(event) => setDraft({ ...draft, armorClass: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} className="bg-black/50" /></div>
                <div className="space-y-2"><FieldLabel>Soul Core</FieldLabel><Select value={draft.soulCore} onValueChange={(soulCore) => setDraft({ ...draft, soulCore })}><SelectTrigger className="bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{SOUL_CORES.map((core) => <SelectItem key={core} value={core}>{core}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><FieldLabel>Fragments</FieldLabel><Input type="number" min={0} max={999} value={draft.soulFragments} onChange={(event) => setDraft({ ...draft, soulFragments: Math.max(0, Math.min(999, Number.parseInt(event.target.value, 10) || 0)) })} className="bg-black/50" /></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">New souls begin as Beasts. Essence is filled automatically from their starting fragment count.</p>
            </Section>

            <Section title="Stats" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {STAT_FIELDS.map(({ key, short, label }) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
                    <FieldLabel>{label}</FieldLabel>
                    <Input type="number" value={draft.stats[key]} onChange={(event) => updateStat(key, event.target.value)} className="mt-2 bg-black/50 text-center font-display text-lg" aria-label={label} />
                    <span className="mt-1 block text-[9px] font-bold tracking-widest text-muted-foreground">{short}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Aspect & Flaw" className="lg:col-span-2">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2"><FieldLabel>Aspect Name</FieldLabel><Input value={draft.aspect} onChange={(event) => setDraft({ ...draft, aspect: event.target.value })} placeholder="Aspect Name" className="bg-black/50" /></div>
                  <div className="space-y-2"><FieldLabel>Aspect Description</FieldLabel><Textarea value={draft.aspectAbilityDescription} onChange={(event) => setDraft({ ...draft, aspectAbilityDescription: event.target.value })} placeholder="Aspect poem or description" className="min-h-24 bg-black/50" /></div>
                  <TraitEditor title="Aspect Abilities" traits={draft.aspectAbilities} onChange={(aspectAbilities) => setDraft({ ...draft, aspectAbilities })} />
                </div>
                <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <h4 className="flex items-center gap-2 font-display text-lg text-destructive"><Dna className="h-4 w-4" /> Flaw</h4>
                  <Input value={draft.flaw.name} onChange={(event) => setDraft({ ...draft, flaw: { ...draft.flaw, name: event.target.value } })} placeholder="Flaw Name" className="bg-black/50 border-destructive/30" />
                  <Textarea value={draft.flaw.description} onChange={(event) => setDraft({ ...draft, flaw: { ...draft.flaw, description: event.target.value } })} placeholder="Flaw Description" className="min-h-24 bg-black/50 border-destructive/30" />
                  <Input value={draft.flaw.effect} onChange={(event) => setDraft({ ...draft, flaw: { ...draft.flaw, effect: event.target.value } })} placeholder="Mechanical Effect" className="bg-black/50 border-destructive/30" />
                </div>
              </div>
            </Section>

            <Section title="Attributes">
              <p className="mb-3 text-xs text-muted-foreground">The included example can be edited, expanded, or removed.</p>
              <TraitEditor title="Character Attributes" traits={draft.attributes} onChange={(attributes) => setDraft({ ...draft, attributes })} bare />
            </Section>

            <Section title="Memories">
              <p className="mb-3 text-xs text-muted-foreground">The included example opens the same detailed memory editor used on a character sheet.</p>
              <MemoryEditor memories={draft.memories} onChange={(memories) => setDraft({ ...draft, memories })} proficiencyBonus={proficiencyBonus} stats={draft.stats} title="Character Memories" />
            </Section>

            <Section title="Echoes" className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Click an echo to edit its health, armor, summoning cost, description, and damage moves.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, echoes: [...draft.echoes, templateEcho(`New Echo ${draft.echoes.length + 1}`)] })} className="shrink-0 border-primary/30 text-primary hover:bg-primary/10"><Plus className="mr-1 h-3 w-3" /> Add Echo</Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {draft.echoes.map((echo, index) => (
                  <div key={index} className="relative rounded-lg border border-white/10 bg-secondary/30 transition-colors hover:bg-secondary/50">
                    <EchoPopup echo={echo} canEdit startInEditMode onSave={(nextEcho) => updateEcho(index, nextEcho)}>
                      <button type="button" className="w-full p-3 pr-12 text-left">
                        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="font-medium">{echo.name || `Echo ${index + 1}`}</span><span className="text-[10px] uppercase tracking-widest text-muted-foreground">AC {echo.armorClass}</span></div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{echo.description || "No description."}</p>
                      </button>
                    </EchoPopup>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEcho(index)} className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10" aria-label={`Delete ${echo.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
                {draft.echoes.length === 0 && <p className="py-3 text-sm italic text-muted-foreground">No echoes added.</p>}
              </div>
            </Section>

            <Section title="Inventory & Notes" className="lg:col-span-2">
              <Textarea value={draft.inventoryNotes} onChange={(event) => setDraft({ ...draft, inventoryNotes: event.target.value })} placeholder="Inventory, notes, goals, and other character details..." className="min-h-40 bg-black/50" />
            </Section>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-black/30 px-6 py-4">
          <p className="text-xs text-muted-foreground">Known Name and True Name are required.</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleCreate} disabled={createChar.isPending || !draft.name.trim() || !draft.trueName.trim()}>
              {createChar.isPending ? "Manifesting..." : "Manifest Character"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
