import { useState } from "react";
import type { RememberedPerson, Trait } from "@shared/schema";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const newPerson = (): RememberedPerson => ({ name: "", effect: "", nameKnown: true, effectKnown: false });

export function RememberedByEditor({ trait, onChange }: { trait: Trait; onChange: (trait: Trait) => void }) {
  const people = trait.rememberedBy || [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<RememberedPerson>(newPerson());
  const updatePerson = (index: number, updates: Partial<RememberedPerson>) => {
    const rememberedBy = people.map((person, personIndex) => personIndex === index ? { ...person, ...updates } : person);
    onChange({ ...trait, rememberedBy });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="w-full flex items-center gap-3 p-3 text-left bg-fuchsia-500/10 border border-fuchsia-400/40 rounded-lg shadow-[0_0_18px_rgba(232,121,249,0.12)] hover:bg-fuchsia-500/15 transition-all">
          <Fingerprint className="w-4 h-4 text-fuchsia-300 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-fuchsia-200">{trait.name}</span>
            <span className="block text-xs text-muted-foreground">{people.length} {people.length === 1 ? "person remembers" : "people remember"} him · Click to edit</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-fuchsia-400/30 w-[min(92vw,63rem)] max-w-[63rem] h-[min(88vh,44rem)] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl text-fuchsia-200 text-glow">Edit {trait.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-3">
          <Input value={trait.name} onChange={(event) => onChange({ ...trait, name: event.target.value })} placeholder="Name" className="bg-black/50" />
          <Input value={trait.effect} onChange={(event) => onChange({ ...trait, effect: event.target.value })} placeholder="Effect" className="bg-black/50" />
          <Textarea value={trait.description} onChange={(event) => onChange({ ...trait, description: event.target.value })} placeholder="Description" className="bg-black/50 min-h-[90px]" />

          <div className="pt-3 space-y-2">
            <div className="flex items-baseline justify-between"><h3 className="font-display text-lg text-fuchsia-200">Remembered By</h3><span className="text-xs uppercase tracking-widest text-muted-foreground">Total: {people.length}</span></div>
            {people.map((person, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-white/5 bg-black/20 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={person.name} onChange={(event) => updatePerson(index, { name: event.target.value })} placeholder="Person's name" className="bg-black/50" />
                  <Input value={person.effect} onChange={(event) => updatePerson(index, { effect: event.target.value })} placeholder="Known effect or connection" className="bg-black/50" />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={person.nameKnown} onCheckedChange={(checked) => updatePerson(index, { nameKnown: checked })} /> Name discovered</label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={person.effectKnown} onCheckedChange={(checked) => updatePerson(index, { effectKnown: checked })} /> Effect discovered</label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...trait, rememberedBy: people.filter((_, personIndex) => personIndex !== index) })} className="ml-auto text-destructive hover:text-destructive"><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>
                </div>
              </div>
            ))}
          </div>

          {adding ? (
            <div className="space-y-3 rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
              <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Person's name (can remain undiscovered)" className="bg-black/50" />
              <Input value={draft.effect} onChange={(event) => setDraft({ ...draft, effect: event.target.value })} placeholder="Effect or connection" className="bg-black/50" />
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={draft.nameKnown} onCheckedChange={(nameKnown) => setDraft({ ...draft, nameKnown })} /> Name discovered</label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={draft.effectKnown} onCheckedChange={(effectKnown) => setDraft({ ...draft, effectKnown })} /> Effect discovered</label>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => { onChange({ ...trait, rememberedBy: [...people, draft] }); setDraft(newPerson()); setAdding(false); }} className="flex-1 bg-fuchsia-300 text-black hover:bg-fuchsia-200">Confirm Add</Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setAdding(true)} className="w-full border-fuchsia-400/30 text-fuchsia-200 hover:bg-fuchsia-500/10"><Plus className="w-4 h-4 mr-2" /> Add Person</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
