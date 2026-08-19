import type { Trait } from "@shared/schema";
import { Anvil, Flame, Minus, Plus, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ReforgingPopup({
  trait,
  children,
  onChangeCount,
  accentColor = "#b45353",
}: {
  trait: Trait;
  children: React.ReactNode;
  onChangeCount?: (monsterIndex: number, delta: number) => void;
  accentColor?: string;
}) {
  const tracker = trait.reforging;
  if (!tracker) return <>{children}</>;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="character-custom-scope character-accent-glow glass-panel border-red-500/35 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,40rem)] overflow-hidden gap-0 grid-rows-[auto_minmax(0,1fr)]"
        style={{ "--character-accent": accentColor } as React.CSSProperties}
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="font-display text-2xl text-red-300 text-glow flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" /> {trait.name}
          </DialogTitle>
          {trait.effect && trait.effect.trim() !== "?" && <p className="text-foreground pt-2 whitespace-pre-wrap">{trait.effect}</p>}
          {trait.description && <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{trait.description}</p>}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto border-t border-red-500/15 pt-5">
          <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-600/20 via-orange-500/5 to-black/30 p-5 mb-5">
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-red-500/15 blur-3xl" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-orange-300/70">Goal</p>
            <div className="relative mt-2 flex items-end justify-between gap-5">
              <p className="font-display text-2xl text-red-100 break-words">{tracker.goalName || "Undiscovered"}</p>
              <div className="shrink-0 text-right">
                <p className="font-display text-4xl text-orange-300 tabular-nums">{tracker.goalNumber || "???"}</p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Reforgings required</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-300/70">
              <Skull className="h-4 w-4" /> Slain Monsters
            </h3>
            {tracker.monsters.map((monster, index) => (
              <div key={`${monster.name}-${index}`} className="relative overflow-hidden rounded-lg border border-red-500/15 bg-gradient-to-r from-red-950/40 to-secondary/20 px-4 py-3">
                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 via-red-500 to-red-950" />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="font-display tracking-wide text-red-50">“{monster.name || "Unknown Monster"}”</p>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {onChangeCount && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Decrease ${monster.name} reforges`} disabled={monster.reforgedCount <= 0} onClick={() => onChangeCount(index, -1)} className="h-7 w-7 text-red-300 hover:bg-red-500/15 hover:text-red-200"><Minus className="h-3.5 w-3.5" /></Button>
                    )}
                    <p className="min-w-[4.5rem] text-center font-display text-xl text-orange-200 tabular-nums">
                      {monster.reforgedCount}<span className="text-red-300/50">/</span>{monster.totalRequired ?? "???"}
                    </p>
                    {onChangeCount && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Increase ${monster.name} reforges`} disabled={monster.totalRequired !== null && monster.reforgedCount >= monster.totalRequired} onClick={() => onChangeCount(index, 1)} className="h-7 w-7 text-orange-300 hover:bg-orange-500/15 hover:text-orange-200"><Plus className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tracker.monsters.length === 0 && (
              <div className="rounded-xl border border-dashed border-red-500/20 py-12 text-center">
                <Anvil className="mx-auto mb-3 h-7 w-7 text-red-400/30" />
                <p className="text-sm italic text-muted-foreground">No slain monsters have been recorded.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
