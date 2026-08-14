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
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
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
}

export function TraitEditor({ title, traits, onChange, addButtonPlacement = "header", accent = "primary" }: TraitEditorProps) {
  const [newTrait, setNewTrait] = useState<Trait>({ name: "", description: "", effect: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
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
    if (expandedIdx === index) setExpandedIdx(null);
    if (expandedIdx !== null && expandedIdx > index) setExpandedIdx(expandedIdx - 1);
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
    <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
      <div className="flex items-center justify-between">
        <h4 className={cn("text-lg font-display", accent === "emerald" ? "text-emerald-200" : "text-primary")}>{title}</h4>
        {addButtonPlacement === "header" && <Button
          variant="outline" 
          size="sm" 
          onClick={() => setIsAdding(!isAdding)}
          className={cn(accent === "emerald" ? "border-emerald-300/30 text-emerald-200 hover:bg-emerald-400/10" : "border-primary/30 text-primary hover:bg-primary/10")}
        >
          {isAdding ? "Cancel" : <><Plus className="w-4 h-4 mr-2" /> Add</>}
        </Button>}
      </div>

      <div className="space-y-2">
        {traits.map((trait, idx) => (
          trait.starSeeking ? (
            <StarSeekingEditor key={idx} trait={trait} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} />
          ) : trait.reforging ? (
            <ReforgingEditor key={idx} trait={trait} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} />
          ) : trait.rememberedBy ? (
            <RememberedByEditor key={idx} trait={trait} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} />
          ) : trait.subAttributes ? (
            <ExpandedTraitEditor key={idx} trait={trait} onChange={(nextTrait) => handleUpdate(idx, nextTrait)} />
          ) : (
          <div key={idx} className="bg-secondary/50 rounded-lg border border-white/5">
            <div
              className="flex items-start justify-between gap-4 p-3 cursor-pointer"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{trait.name}</p>
                <p className="text-sm text-muted-foreground truncate">{trait.effect}</p>
              </div>
              <div className="flex items-center gap-1">
                {expandedIdx === idx ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
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
                  value={trait.name}
                  onChange={e => handleUpdate(idx, { name: e.target.value })}
                  className="bg-black/50"
                />
                <Input
                  placeholder="Effect"
                  value={trait.effect}
                  onChange={e => handleUpdate(idx, { effect: e.target.value })}
                  className="bg-black/50"
                />
                <Textarea
                  placeholder="Description"
                  value={trait.description}
                  onChange={e => handleUpdate(idx, { description: e.target.value })}
                  className="bg-black/50 min-h-[80px]"
                />
              </div>
            )}
          </div>
          )
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
