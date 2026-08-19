import { useEffect, useState } from "react";
import type { Trait } from "@shared/schema";
import { BookOpenCheck, Check, Circle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ExpandedTraitPopupProps {
  trait: Trait;
  children: React.ReactNode;
  onActivate?: (name: string) => void;
  onLearn?: () => void;
  accentColor?: string;
}

function TraitDetails({ trait }: { trait: Trait }) {
  return (
    <div className="space-y-4">
      <h4 className="font-display text-xl text-emerald-200">{trait.name}</h4>
      {trait.effect && (
        <div className="bg-emerald-400/5 border border-emerald-300/20 p-4 rounded-lg">
          <h5 className="text-xs font-bold uppercase tracking-widest text-emerald-300/80 mb-2">Effect</h5>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">{trait.effect}</p>
        </div>
      )}
      {trait.description && (
        <div>
          <h5 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Description</h5>
          <p className="text-muted-foreground italic leading-relaxed whitespace-pre-wrap">{trait.description}</p>
        </div>
      )}
    </div>
  );
}

export function ExpandedTraitPopup({ trait, children, onActivate, onLearn, accentColor = "#b45353" }: ExpandedTraitPopupProps) {
  const choices = trait.subAttributes || [];
  const active = choices.find((choice) => choice.name === trait.activeSubAttribute);
  const [selected, setSelected] = useState<Trait | null>(active || choices[0] || null);

  useEffect(() => {
    setSelected(active || choices[0] || null);
  }, [trait.activeSubAttribute, trait.subAttributes]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="character-custom-scope character-accent-glow glass-panel border-emerald-300/30 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,40rem)] overflow-hidden gap-0 grid-rows-[auto_minmax(0,1fr)]"
        style={{ "--character-accent": accentColor } as React.CSSProperties}
      >
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <DialogTitle className="font-display text-2xl text-emerald-200 text-glow flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> {trait.name}
            </DialogTitle>
            {active && onLearn && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLearn}
                className="shrink-0 border-emerald-300/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20 hover:text-emerald-100"
              >
                <BookOpenCheck className="w-4 h-4 mr-2" /> Learn {active.name}
              </Button>
            )}
          </div>
          {trait.effect && <p className="text-foreground pt-2 whitespace-pre-wrap">{trait.effect}</p>}
          {trait.description && <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{trait.description}</p>}
        </DialogHeader>

        <div className="min-h-0 border-t border-white/10 pt-4 grid grid-cols-1 md:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.2fr)] gap-5">
          <div className="min-h-0 overflow-y-auto space-y-2 pr-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Dormant Attributes</h3>
            {choices.map((choice) => {
              const isActive = choice.name === trait.activeSubAttribute;
              return (
                <div
                  key={choice.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(choice)}
                  onKeyDown={(event) => event.key === "Enter" && setSelected(choice)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                    selected?.name === choice.name ? "border-emerald-300/50 bg-emerald-400/10" : "border-white/5 bg-secondary/30 hover:bg-secondary/50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{choice.name}</p>
                    {isActive && <p className="text-[10px] uppercase tracking-widest text-emerald-300 mt-1">Currently active</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Activate ${choice.name}`}
                    disabled={!onActivate || isActive}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(choice);
                      onActivate?.(choice.name);
                    }}
                    className="h-8 w-8 shrink-0 text-emerald-300"
                  >
                    {isActive ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="min-h-0 overflow-y-auto bg-black/20 border border-white/5 rounded-xl p-5">
            {selected ? <TraitDetails trait={selected} /> : <p className="text-muted-foreground italic">No dormant attributes recorded.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
