import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Trait = {
  name: string;
  description: string;
  effect: string;
};

interface TraitPopupProps {
  trait: Trait;
  children: React.ReactNode;
}

export function TraitPopup({ trait, children }: TraitPopupProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="glass-panel border-primary/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary text-glow">
            {trait.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {trait.effect && (
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
              <h5 className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-2">Effect</h5>
              <p className="text-foreground leading-relaxed">{trait.effect}</p>
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
