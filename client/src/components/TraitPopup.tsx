import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Trait = {
  name: string;
  description: string;
  effect: string;
};

interface TraitPopupProps {
  trait: Trait;
  children: React.ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
}

export function TraitPopup({ trait, children, contentClassName, bodyClassName }: TraitPopupProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "glass-panel border-primary/20 w-[min(92vw,63rem)] max-w-[63rem]",
          contentClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary text-glow">
            {trait.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className={cn("space-y-6 pt-4", bodyClassName)}>
          {trait.effect && (
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
              <h5 className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-2">Effect</h5>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">{trait.effect}</p>
            </div>
          )}
          
          {trait.description && (
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Description</h5>
              <p className="text-muted-foreground italic leading-relaxed whitespace-pre-wrap">
                {trait.description}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
