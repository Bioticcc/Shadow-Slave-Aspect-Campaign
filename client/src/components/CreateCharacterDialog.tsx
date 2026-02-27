import { useState } from "react";
import { useCreateCharacter } from "@/hooks/use-characters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

export function CreateCharacterDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trueName, setTrueName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  
  const createChar = useCreateCharacter();

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("This image is too large (max 5MB). Please choose a smaller file.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !trueName.trim()) return;
    
    createChar.mutate({
      name,
      trueName,
      icon,
      // Sending default required fields, backend schema handles most defaults
      rank: "Dreamer",
      soulCore: "Dormant",
      currentHealth: 8,
      maxHealth: 8,
    }, {
      onSuccess: () => {
        setOpen(false);
        setName("");
        setTrueName("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Manifest Character
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-primary/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary text-glow">
            Manifest New Soul
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Known Name</label>
            <Input 
              placeholder="e.g. Sunnyless" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="bg-black/50 border-white/10 focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">True Name</label>
            <Input 
              placeholder="e.g. Lost from Light" 
              value={trueName} 
              onChange={e => setTrueName(e.target.value)}
              className="bg-black/50 border-white/10 focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Soul Icon</label>
            <div className="flex items-center gap-4">
              {icon && (
                <div className="w-12 h-12 rounded-full overflow-hidden border border-primary/50">
                  <img src={icon} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <Input 
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                className="bg-black/50 border-white/10 focus-visible:ring-primary text-xs"
              />
            </div>
          </div>
          
          <Button 
            className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90" 
            onClick={handleCreate}
            disabled={createChar.isPending || !name.trim() || !trueName.trim()}
          >
            {createChar.isPending ? "Manifesting..." : "Manifest"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
