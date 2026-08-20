import type { CharacterStats, StarSeekingForm, StarSeekingLimb, Trait } from "@shared/schema";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ABILITIES: Array<{ id: keyof CharacterStats; label: string }> = [
  { id: "strength", label: "Strength" },
  { id: "dexterity", label: "Dexterity" },
  { id: "constitution", label: "Constitution" },
  { id: "intelligence", label: "Intelligence" },
  { id: "wisdom", label: "Wisdom" },
  { id: "charisma", label: "Charisma" },
];

const nonNegative = (value: string) => Math.max(0, Number.parseInt(value, 10) || 0);

export function StarSeekingEditor({ trait, onChange, accentColor = "#b45353", accentSecondaryColor = accentColor }: { trait: Trait; onChange: (trait: Trait) => void; accentColor?: string; accentSecondaryColor?: string }) {
  const starSeeking = trait.starSeeking;
  if (!starSeeking) return null;
  const primaryLimb = starSeeking.limbs.find((limb) => limb.id === "arm") || starSeeking.limbs[0];
  const activeForm = primaryLimb?.forms.find((form) => form.id === primaryLimb.activeFormId);

  const updateLimb = (limbId: string, updates: Partial<StarSeekingLimb>) => {
    const limbs = starSeeking.limbs.map((limb) => limb.id === limbId ? { ...limb, ...updates } : limb);
    const nextTrait = { ...trait, starSeeking: { ...starSeeking, limbs } };
    if (limbId === "arm" && typeof updates.effect === "string") nextTrait.effect = updates.effect;
    onChange(nextTrait);
  };

  const updateForm = (limb: StarSeekingLimb, formId: string, updates: Partial<StarSeekingForm>) => {
    updateLimb(limb.id, {
      forms: limb.forms.map((form) => form.id === formId ? { ...form, ...updates } : form),
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-secondary/30 p-3 text-left transition-all hover:border-white/10 hover:bg-secondary/50">
          <Star className="h-4 w-4 shrink-0 fill-amber-300/20 text-amber-300" />
          <span className="min-w-0 flex-1"><span className="block font-medium text-amber-200">{trait.name}</span><span className="block truncate text-xs text-muted-foreground">{activeForm?.name || "Arm"} form · Click to edit</span></span>
        </button>
      </DialogTrigger>
      <DialogContent
        className="character-custom-scope character-accent-glow glass-panel border-amber-300/35 w-[min(92vw,63rem)] max-w-[63rem] h-[min(88vh,46rem)] overflow-y-auto"
        style={{ "--character-accent": accentColor, "--character-accent-secondary": accentSecondaryColor } as React.CSSProperties}
      >
        <DialogHeader><DialogTitle className="font-display text-2xl text-amber-200 text-glow">Edit {trait.name}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-3">
          <Input value={trait.name} onChange={(event) => onChange({ ...trait, name: event.target.value })} placeholder="Name" className="border-amber-300/20 bg-black/50" />
          <Textarea value={trait.description} onChange={(event) => onChange({ ...trait, description: event.target.value })} placeholder="Lore Description" className="min-h-[180px] resize-y border-amber-300/20 bg-black/50" />

          {starSeeking.limbs.map((limb) => (
            <section key={limb.id} className="space-y-4 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/10 via-black/20 to-yellow-700/5 p-5">
              <div>
                <h3 className="font-display text-xl text-amber-100">Heavenly {limb.name}</h3>
                <p className="text-xs text-muted-foreground">All known properties of this manifestation.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-amber-300/70">Effect</span><Textarea value={limb.effect} onChange={(event) => updateLimb(limb.id, { effect: event.target.value })} className="min-h-[140px] resize-y bg-black/50" /></label>
                <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-amber-300/70">Replacement</span><Input value={limb.replacement} onChange={(event) => updateLimb(limb.id, { replacement: event.target.value })} className="bg-black/50" /></label>
                <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-amber-300/70">Attack Attribute</span><Select value={limb.attackAttribute} onValueChange={(attackAttribute: keyof CharacterStats) => updateLimb(limb.id, { attackAttribute })}><SelectTrigger className="bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{ABILITIES.map((ability) => <SelectItem key={ability.id} value={ability.id}>{ability.label}</SelectItem>)}</SelectContent></Select></label>
                <div className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-amber-300/70">Training</span><div className="flex h-10 items-center rounded-md border border-amber-300/15 bg-black/30 px-3 text-sm text-amber-100">Permanently proficient</div></div>
                <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-amber-300/70">Active Form</span><Select value={limb.activeFormId} onValueChange={(activeFormId) => updateLimb(limb.id, { activeFormId })}><SelectTrigger className="bg-black/50"><SelectValue /></SelectTrigger><SelectContent>{limb.forms.map((form) => <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>)}</SelectContent></Select></label>
                <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-amber-300/70">Transformation Cost</span><Input type="number" min={0} value={limb.transformEssenceCost} onChange={(event) => updateLimb(limb.id, { transformEssenceCost: nonNegative(event.target.value) })} className="bg-black/50" /></label>
              </div>

              <div className="space-y-3 border-t border-amber-300/15 pt-4">
                <h4 className="font-display text-lg text-amber-200">Forms</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {limb.forms.map((form) => (
                    <div key={form.id} className="space-y-2 rounded-xl border border-amber-300/15 bg-black/20 p-3">
                      <Input value={form.name} onChange={(event) => updateForm(limb, form.id, { name: event.target.value })} aria-label={`${form.name} form name`} className="bg-black/50 font-display text-amber-100" />
                      <label className="space-y-1"><span className="text-[9px] uppercase tracking-widest text-muted-foreground">AC Bonus</span><Input type="number" min={0} value={form.armorBonus} onChange={(event) => updateForm(limb, form.id, { armorBonus: nonNegative(event.target.value) })} className="bg-black/50" /></label>
                      <Textarea value={form.description} onChange={(event) => updateForm(limb, form.id, { description: event.target.value })} aria-label={`${form.name} description`} className="min-h-[75px] bg-black/50 text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-amber-300/15 pt-4">
                <h4 className="font-display text-lg text-amber-200">Sword Combat Values</h4>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Additional hit modifier</span><Input type="number" value={limb.hitModifier} onChange={(event) => updateLimb(limb.id, { hitModifier: Number.parseInt(event.target.value, 10) || 0 })} className="bg-black/50" /></label>
                  <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Dice count</span><Input type="number" min={1} value={limb.diceCount} onChange={(event) => updateLimb(limb.id, { diceCount: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })} className="bg-black/50" /></label>
                  <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Damage die</span><Input value={limb.damageDie} onChange={(event) => updateLimb(limb.id, { damageDie: event.target.value.toUpperCase() })} placeholder="D6" className="bg-black/50" /></label>
                  <label className="space-y-2"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Damage modifier</span><Input type="number" value={limb.damageModifier} onChange={(event) => updateLimb(limb.id, { damageModifier: Number.parseInt(event.target.value, 10) || 0 })} className="bg-black/50" /></label>
                </div>
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
