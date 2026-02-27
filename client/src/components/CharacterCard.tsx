import { useState } from "react";
import { type Character } from "@shared/schema";
import { useUpdateCharacter } from "@/hooks/use-characters";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Shield } from "lucide-react";
import { CharacterSheet } from "./CharacterSheet";
import { motion } from "framer-motion";

export function CharacterCard({ character }: { character: Character }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const updateChar = useUpdateCharacter();

  const handleHeal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (character.currentHealth < character.maxHealth) {
      updateChar.mutate({ 
        id: character.id, 
        updates: { currentHealth: character.currentHealth + 1 } 
      });
    }
  };

  const handleDamage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (character.currentHealth > 0) {
      updateChar.mutate({ 
        id: character.id, 
        updates: { currentHealth: character.currentHealth - 1 } 
      });
    }
  };

  const healthPercent = (character.currentHealth / character.maxHealth) * 100;
  const isLowHealth = healthPercent <= 25;

  return (
    <>
      <motion.div
        layoutId={`char-${character.id}`}
        onClick={() => setSheetOpen(true)}
        className="group relative cursor-pointer glass-panel rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 border-glow"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-0" />
        
        <div className="relative z-10 p-6 flex flex-col items-center text-center space-y-4">
          <Avatar className="w-24 h-24 border-2 border-primary/50 shadow-lg shadow-primary/20 ring-4 ring-black">
            {character.icon ? (
              <img src={character.icon} alt={character.name} className="w-full h-full object-cover" />
            ) : (
              <AvatarFallback className="bg-secondary font-display text-2xl text-primary">
                {character.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          
          <div className="space-y-1">
            <h3 className="font-display font-bold text-xl text-foreground group-hover:text-primary transition-colors">
              {character.name}
            </h3>
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
              {character.rank}
            </p>
            <p className="text-xs font-bold text-blue-400" data-testid={`text-class-${character.id}`}>
              {character.soulClass || "Beast"}
            </p>
          </div>

          <div className="w-full pt-4 border-t border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" /> HP
              </span>
              <span className={`text-sm font-bold ${isLowHealth ? 'text-destructive' : 'text-primary'}`}>
                {character.currentHealth} / {character.maxHealth}
              </span>
            </div>
            
            <div className="h-2 bg-black rounded-full overflow-hidden mb-4 border border-white/5">
              <div 
                className={`h-full transition-all duration-500 ${isLowHealth ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${healthPercent}%` }}
              />
            </div>
            
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-black/50 border-destructive/30 hover:bg-destructive/20 hover:text-destructive"
                onClick={handleDamage}
                disabled={character.currentHealth <= 0 || updateChar.isPending}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-black/50 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
                onClick={handleHeal}
                disabled={character.currentHealth >= character.maxHealth || updateChar.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <CharacterSheet 
        character={character} 
        open={sheetOpen} 
        onOpenChange={setSheetOpen} 
      />
    </>
  );
}
