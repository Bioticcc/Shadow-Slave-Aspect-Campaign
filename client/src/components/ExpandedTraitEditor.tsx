import type { Trait } from "@shared/schema";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TraitEditor } from "./TraitEditor";

export function ExpandedTraitEditor({ trait, onChange }: { trait: Trait; onChange: (trait: Trait) => void }) {
  const choices = trait.subAttributes || [];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="w-full flex items-center gap-3 p-3 text-left bg-emerald-400/10 border border-emerald-300/40 rounded-lg shadow-[0_0_18px_rgba(110,231,183,0.14)] hover:bg-emerald-400/15 transition-all">
          <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-emerald-200">{trait.name}</span>
            <span className="block text-xs text-muted-foreground truncate">Click to edit expanded attribute</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-emerald-300/30 w-[min(92vw,63rem)] max-w-[63rem] h-[min(88vh,44rem)] overflow-y-auto shadow-[0_0_45px_rgba(110,231,183,0.1)]">
        <DialogHeader><DialogTitle className="font-display text-2xl text-emerald-200 text-glow">Edit {trait.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-3">
          <Input value={trait.name} onChange={(e) => onChange({ ...trait, name: e.target.value })} placeholder="Name" className="bg-black/50" />
          <Input value={trait.effect} onChange={(e) => onChange({ ...trait, effect: e.target.value })} placeholder="Effect" className="bg-black/50" />
          <Textarea value={trait.description} onChange={(e) => onChange({ ...trait, description: e.target.value })} placeholder="Description" className="bg-black/50 min-h-[90px]" />
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Currently Active</p>
            <Select value={trait.activeSubAttribute || "none"} onValueChange={(value) => onChange({ ...trait, activeSubAttribute: value === "none" ? undefined : value })}>
              <SelectTrigger className="bg-black/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {choices.map((choice) => <SelectItem key={choice.name} value={choice.name}>{choice.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <TraitEditor title="Venerable Librarian Attributes" traits={choices} addButtonPlacement="bottom" accent="emerald" onChange={(subAttributes) => {
            const activeStillExists = subAttributes.some((choice) => choice.name === trait.activeSubAttribute);
            onChange({ ...trait, subAttributes, activeSubAttribute: activeStillExists ? trait.activeSubAttribute : undefined });
          }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
