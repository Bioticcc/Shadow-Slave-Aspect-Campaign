import type { Trait } from "@shared/schema";
import { Eye, Fingerprint, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function HiddenText({ children, hidden }: { children: React.ReactNode; hidden: boolean }) {
  return (
    <span
      aria-label={hidden ? "Undiscovered information" : undefined}
      className={cn(
        "transition-all select-none",
        hidden && "blur-[5px] opacity-60 text-primary/70",
      )}
    >
      {hidden ? "Undiscovered" : children}
    </span>
  );
}

export function RememberedByPopup({ trait, children, accentColor = "#b45353" }: { trait: Trait; children: React.ReactNode; accentColor?: string }) {
  const people = trait.rememberedBy || [];
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="character-custom-scope character-accent-glow glass-panel border-fuchsia-400/30 w-[min(92vw,63rem)] max-w-[63rem] h-[min(85vh,40rem)] overflow-hidden gap-0 grid-rows-[auto_minmax(0,1fr)]"
        style={{ "--character-accent": accentColor } as React.CSSProperties}
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="font-display text-2xl text-fuchsia-300 text-glow flex items-center gap-2">
            <Fingerprint className="w-5 h-5" /> {trait.name}
          </DialogTitle>
          {trait.effect && <p className="text-foreground pt-2 whitespace-pre-wrap">{trait.effect}</p>}
          {trait.description && <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{trait.description}</p>}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto border-t border-white/10 pt-5">
          <div className="relative overflow-hidden rounded-xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 via-black/30 to-primary/5 p-5 mb-5">
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/70">THOSE WHO KNOW</p>
            <p className="font-display text-5xl text-fuchsia-200 mt-2 tabular-nums">{people.length}</p>
          </div>

          <div className="space-y-2">
            {people.map((person, index) => (
              <div key={`${person.name}-${index}`} className="group relative flex items-center gap-4 rounded-lg border border-white/5 bg-secondary/25 px-4 py-3 overflow-hidden">
                <span className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-fuchsia-300/70 to-transparent" />
                <UserRound className="w-4 h-4 text-fuchsia-300/70 shrink-0" />
                <p className="font-display tracking-wide min-w-0 flex-1 truncate">
                  <HiddenText hidden={!person.nameKnown}>{person.name}</HiddenText>
                </p>
                <div className="flex items-center gap-2 min-w-0 max-w-[55%] text-xs text-muted-foreground">
                  <Eye className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span className="truncate"><HiddenText hidden={!person.effectKnown}>{person.effect}</HiddenText></span>
                </div>
              </div>
            ))}
            {people.length === 0 && (
              <div className="py-12 text-center border border-dashed border-fuchsia-300/15 rounded-xl">
                <Eye className="w-7 h-7 mx-auto text-fuchsia-300/30 mb-3" />
                <p className="text-sm text-muted-foreground italic">No remembered names have surfaced.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
