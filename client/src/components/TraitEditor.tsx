import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";

type Trait = {
  name: string;
  description: string;
  effect: string;
};

interface TraitEditorProps {
  title: string;
  traits: Trait[];
  onChange: (traits: Trait[]) => void;
}

export function TraitEditor({ title, traits, onChange }: TraitEditorProps) {
  const [newTrait, setNewTrait] = useState<Trait>({ name: "", description: "", effect: "" });
  const [isAdding, setIsAdding] = useState(false);

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

  return (
    <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-display text-primary">{title}</h4>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsAdding(!isAdding)}
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          {isAdding ? "Cancel" : <><Plus className="w-4 h-4 mr-2" /> Add</>}
        </Button>
      </div>

      <div className="space-y-2">
        {traits.map((trait, idx) => (
          <div key={idx} className="flex items-start justify-between gap-4 p-3 bg-secondary/50 rounded-lg border border-white/5 group">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{trait.name}</p>
              <p className="text-sm text-muted-foreground truncate">{trait.effect}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(idx)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {traits.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground italic text-center py-2">None</p>
        )}
      </div>

      {isAdding && (
        <div className="space-y-3 p-4 bg-background rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
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
          <Button onClick={handleAdd} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Confirm Add
          </Button>
        </div>
      )}
    </div>
  );
}
