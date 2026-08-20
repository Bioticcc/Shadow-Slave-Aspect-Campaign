import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExpandedTraitEditor } from "./ExpandedTraitEditor";
import { RememberedByEditor } from "./RememberedByEditor";
import { ReforgingEditor } from "./ReforgingEditor";
import { StarSeekingEditor } from "./StarSeekingEditor";
import { cn } from "@/lib/utils";

type Trait = {
  name: string;
  description: string;
  effect: string;
  subAttributes?: Trait[];
  activeSubAttribute?: string;
  rememberedBy?: import("@shared/schema").RememberedPerson[];
  reforging?: import("@shared/schema").ReforgingTracker;
  starSeeking?: import("@shared/schema").StarSeekingAttribute;
};

interface TraitEditorProps {
  title: string;
  traits: Trait[];
  onChange: (traits: Trait[]) => void;
  addButtonPlacement?: "header" | "bottom";
  accent?: "primary" | "emerald";
  accentColor?: string;
  accentSecondaryColor?: string;
  lockRememberedEffects?: boolean;
  bare?: boolean;
  addLabel?: string;
  renderAccessory?: (index: number) => React.ReactNode;
  onItemClickCapture?: (event: React.MouseEvent<HTMLDivElement>, index: number) => void;
}

export function TraitEditor({ title, traits, onChange, addButtonPlacement = "header", accent = "primary", accentColor, accentSecondaryColor, lockRememberedEffects = false, bare = false, addLabel = "Add", renderAccessory, onItemClickCapture }: TraitEditorProps) {
  const [newTrait, setNewTrait] = useState<Trait>({ name: "", description: "", effect: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (!newTrait.name.trim()) return;
    onChange([...traits, newTrait]);
    setNewTrait({ name: "", description: "", effect: "" });
    setIsAdding(false);
  };

  const handleRemove = (index: number) => {
    const updated = [...traits];
    updated.splice(index, 1);
    onChange(updated);
  };

  const confirmRemove = () => {
    if (pendingDeleteIndex === null) return;
    handleRemove(pendingDeleteIndex);
    setPendingDeleteIndex(null);
  };

  const handleUpdate = (index: number, updates: Partial<Trait>) => {
    const updated = [...traits];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  return (
    <div className={cn("space-y-4", !bare && "bg-black/20 p-4 rounded-xl border border-white/5")}>
      <div className="flex items-center justify-between">
        <h4 className={cn("flex-1 border-b border-white/10 pb-2 text-lg font-display", bare ? "text-foreground" : accent === "emerald" ? "text-emerald-200" : "text-primary")}>{title}</h4>
        {addButtonPlacement === "header" && <Button
          variant="outline" 
          size="sm" 
          onClick={() => setIsAdding(!isAdding)}
          className={cn("mb-2 h-7", accent === "emerald" ? "border-emerald-300/30 text-emerald-200 hover:bg-emerald-400/10" : "border-primary/30 text-primary hover:bg-primary/10")}
        >
          {isAdding ? "Cancel" : <><Plus className="mr-1 h-3 w-3" /> {addLabel}</>}
        </Button>}
      </div>

      <div className="space-y-2">
        {traits.map((trait, idx) => (
          <div key={idx} className="space-y-1" onClickCapture={(event) => onItemClickCapture?.(event, idx)}>
          {trait.starSeeking ? (
            <div key={idx} className="relative"><StarSeekingEditor trait={trait} accentColor={accentColor} accentSecondaryColor={accentSecondaryColor} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} /><Button type="button" variant="ghost" size="icon" onClick={() => setPendingDeleteIndex(idx)} className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div>
          ) : trait.reforging ? (
            <div key={idx} className="relative"><ReforgingEditor trait={trait} accentColor={accentColor} accentSecondaryColor={accentSecondaryColor} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} /><Button type="button" variant="ghost" size="icon" onClick={() => setPendingDeleteIndex(idx)} className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div>
          ) : trait.rememberedBy ? (
            <div key={idx} className="relative"><RememberedByEditor trait={trait} accentColor={accentColor} accentSecondaryColor={accentSecondaryColor} effectsLocked={lockRememberedEffects} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} /><Button type="button" variant="ghost" size="icon" onClick={() => setPendingDeleteIndex(idx)} className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div>
          ) : trait.subAttributes ? (
            <div key={idx} className="relative"><ExpandedTraitEditor trait={trait} accentColor={accentColor} accentSecondaryColor={accentSecondaryColor} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} /><Button type="button" variant="ghost" size="icon" onClick={() => setPendingDeleteIndex(idx)} className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div>
          ) : (
          <Dialog key={idx}>
            <div className="relative rounded-lg border border-white/5 bg-secondary/30 transition-all hover:border-white/10 hover:bg-secondary/50">
              <DialogTrigger asChild>
                <button type="button" className="w-full cursor-pointer p-3 pr-11 text-left">
                  <p className="font-medium text-foreground">{trait.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{trait.effect}</p>
                </button>
              </DialogTrigger>
              <Button variant="ghost" size="icon" onClick={() => setPendingDeleteIndex(idx)} className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <DialogContent className="glass-panel grid h-[min(88vh,42rem)] w-[min(92vw,56rem)] max-w-[56rem] grid-rows-[auto_minmax(0,1fr)] overflow-hidden gap-0 p-0">
              <DialogHeader className="border-b border-white/10 px-6 pb-4 pt-6">
                <DialogTitle className="font-display text-2xl text-primary">Edit {trait.name || "Attribute"}</DialogTitle>
                <p className="text-xs text-muted-foreground">Close this window when finished, then use Save Changes.</p>
              </DialogHeader>
              <div className="min-h-0 space-y-4 overflow-y-auto p-6">
                <Input
                  placeholder="Name"
                  value={trait.name}
                  onChange={e => handleUpdate(idx, { name: e.target.value })}
                  className="bg-black/50"
                />
                <Textarea
                  placeholder="Effect"
                  value={trait.effect}
                  onChange={e => handleUpdate(idx, { effect: e.target.value })}
                  className="min-h-[180px] resize-y bg-black/50"
                />
                <Textarea
                  placeholder="Description"
                  value={trait.description}
                  onChange={e => handleUpdate(idx, { description: e.target.value })}
                  className="min-h-[180px] resize-y bg-black/50"
                />
              </div>
            </DialogContent>
          </Dialog>
          )}
          {renderAccessory?.(idx)}
          </div>
        ))}
        {traits.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground italic text-center py-2">None</p>
        )}
      </div>

      {addButtonPlacement === "bottom" && !isAdding && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsAdding(true)}
          className={cn("w-full", accent === "emerald" ? "border-emerald-300/30 text-emerald-200 hover:bg-emerald-400/10" : "border-primary/30 text-primary hover:bg-primary/10")}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Attribute
        </Button>
      )}

      {isAdding && (
        <div className={cn("space-y-3 p-4 bg-background rounded-lg border animate-in fade-in slide-in-from-top-2", accent === "emerald" ? "border-emerald-300/20" : "border-primary/20")}>
          <Input 
            placeholder="Name" 
            value={newTrait.name}
            onChange={e => setNewTrait({...newTrait, name: e.target.value})}
            className="bg-black/50"
          />
          <Input 
            placeholder="Effect" 
            value={newTrait.effect}
            onChange={e => setNewTrait({...newTrait, effect: e.target.value})}
            className="bg-black/50"
          />
          <Textarea 
            placeholder="Description" 
            value={newTrait.description}
            onChange={e => setNewTrait({...newTrait, description: e.target.value})}
            className="bg-black/50 min-h-[80px]"
          />
          <Button onClick={handleAdd} className={cn("w-full", accent === "emerald" ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
            Confirm Add
          </Button>
          {addButtonPlacement === "bottom" && (
            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="w-full">
              Cancel
            </Button>
          )}
        </div>
      )}

      <AlertDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIndex(null);
        }}
      >
        <AlertDialogContent className="glass-panel border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-display text-xl">
              Delete {title.toLowerCase().includes("attribute") ? "attribute" : "entry"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will remove <span className="text-foreground font-bold">{traits[pendingDeleteIndex ?? -1]?.name || "this entry"}</span> from the sheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
