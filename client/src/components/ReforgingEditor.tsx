import { useState } from "react";
import type { ReforgingMonster, Trait } from "@shared/schema";
import { Flame, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const blankMonster = (): ReforgingMonster => ({ name: "", reforgedCount: 0, totalRequired: null });

function optionalPositiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : Math.max(0, parsed);
}

export function ReforgingEditor({ trait, onChange, accentColor = "#b45353" }: { trait: Trait; onChange: (trait: Trait) => void; accentColor?: string }) {
  const tracker = trait.reforging;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ReforgingMonster>(blankMonster());
  if (!tracker) return null;

  const updateMonster = (index: number, updates: Partial<ReforgingMonster>) => {
    const monsters = tracker.monsters.map((monster, monsterIndex) =>
      monsterIndex === index ? { ...monster, ...updates } : monster,
    );
    onChange({ ...trait, reforging: { ...tracker, monsters } });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="w-full flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-left shadow-[0_0_18px_rgba(239,68,68,0.14)] transition-all hover:bg-red-500/15">
          <Flame className="h-4 w-4 shrink-0 text-orange-400" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-red-200">{trait.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{tracker.monsters.length} slain {tracker.monsters.length === 1 ? "monster" : "monsters"} · Click to edit</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        className="character-custom-scope character-accent-glow glass-panel border-red-500/35 w-[min(92vw,63rem)] max-w-[63rem] h-[min(88vh,44rem)] overflow-y-auto"
        style={{ "--character-accent": accentColor } as React.CSSProperties}
      >
        <DialogHeader><DialogTitle className="font-display text-2xl text-red-300 text-glow">Edit {trait.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-3">
          <Input value={trait.name} onChange={(event) => onChange({ ...trait, name: event.target.value })} placeholder="Name" className="bg-black/50 border-red-500/20" />
          <Input value={trait.effect} onChange={(event) => onChange({ ...trait, effect: event.target.value })} placeholder="Effect" className="bg-black/50 border-red-500/20" />
          <Textarea value={trait.description} onChange={(event) => onChange({ ...trait, description: event.target.value })} placeholder="Description" className="min-h-[90px] bg-black/50 border-red-500/20" />

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 md:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-300/70">Goal Attribute</p>
              <Input value={tracker.goalName} onChange={(event) => onChange({ ...trait, reforging: { ...tracker, goalName: event.target.value } })} placeholder="Attribute being forged" className="bg-black/50 border-red-500/20" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-300/70">Goal Number</p>
              <Input type="number" min={0} value={tracker.goalNumber} onChange={(event) => onChange({ ...trait, reforging: { ...tracker, goalNumber: Math.max(0, Number.parseInt(event.target.value, 10) || 0) } })} className="bg-black/50 border-red-500/20" />
            </div>
          </div>

          <div className="space-y-2 pt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg text-red-200">Slain Monsters</h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Total: {tracker.monsters.length}</span>
            </div>
            {tracker.monsters.length > 0 && (
              <div className="hidden grid-cols-[minmax(0,1fr)_9rem_9rem] gap-3 px-1 text-[9px] font-bold uppercase tracking-widest text-red-300/60 md:grid">
                <span>Monster</span><span>Times reforged</span><span>Total required</span>
              </div>
            )}
            {tracker.monsters.map((monster, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-red-500/15 bg-black/20 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                  <Input value={monster.name} onChange={(event) => updateMonster(index, { name: event.target.value })} placeholder="Monster name" className="bg-black/50" />
                  <Input type="number" min={0} value={monster.reforgedCount} onChange={(event) => updateMonster(index, { reforgedCount: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} aria-label="Times reforged" className="bg-black/50" />
                  <Input type="number" min={0} value={monster.totalRequired ?? ""} onChange={(event) => updateMonster(index, { totalRequired: optionalPositiveNumber(event.target.value) })} placeholder="??? total" aria-label="Total required" className="bg-black/50" />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...trait, reforging: { ...tracker, monsters: tracker.monsters.filter((_, monsterIndex) => monsterIndex !== index) } })} className="ml-auto flex text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            ))}
          </div>

          {adding ? (
            <div className="space-y-3 rounded-lg border border-red-500/25 bg-red-500/5 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Monster name" className="bg-black/50" />
                <Input type="number" min={0} value={draft.reforgedCount} onChange={(event) => setDraft({ ...draft, reforgedCount: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} aria-label="Times reforged" className="bg-black/50" />
                <Input type="number" min={0} value={draft.totalRequired ?? ""} onChange={(event) => setDraft({ ...draft, totalRequired: optionalPositiveNumber(event.target.value) })} placeholder="??? total" aria-label="Total required" className="bg-black/50" />
              </div>
              <div className="flex gap-2">
                <Button type="button" disabled={!draft.name.trim()} onClick={() => { onChange({ ...trait, reforging: { ...tracker, monsters: [...tracker.monsters, { ...draft, name: draft.name.trim() }] } }); setDraft(blankMonster()); setAdding(false); }} className="flex-1 bg-red-600 text-white hover:bg-red-500">Confirm Add</Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setAdding(true)} className="w-full border-red-500/35 text-red-200 hover:bg-red-500/10"><Plus className="mr-2 h-4 w-4" /> Add Monster</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
