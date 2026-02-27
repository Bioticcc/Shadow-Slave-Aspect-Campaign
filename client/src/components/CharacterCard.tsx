import { useState } from "react";
import { type Character, type Memory, normalizeMemory } from "@shared/schema";
import { useUpdateCharacter } from "@/hooks/use-characters";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Shield, Droplets } from "lucide-react";
import { CharacterSheet } from "./CharacterSheet";
import { motion } from "framer-motion";

function getMemories(character: Character): Memory[] {
  return (character.memories || []).map(normalizeMemory);
}

export function CharacterCard({ character }: { character: Character }) {
  const { currentUser, isDM } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const updateChar = useUpdateCharacter();
  const memories = getMemories(character);
  const summonedArmor = memories.find(m => m.memoryType === "armor" && m.isSummoned);

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
    const mems = [...memories];
    const armorIdx = mems.findIndex(m => m.memoryType === "armor" && m.isSummoned);
    if (armorIdx !== -1) {
      const armor = { ...mems[armorIdx] };
      if (armor.currentDurability > 0) {
        armor.currentDurability -= 1;
        mems[armorIdx] = armor;
        updateChar.mutate({ id: character.id, updates: { memories: mems } });
        return;
      }
    }
    if (character.currentHealth > 0) {
      updateChar.mutate({ 
        id: character.id, 
        updates: { currentHealth: character.currentHealth - 1 } 
      });
    }
  };

  const handleEssenceUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = character.currentEssence ?? 0;
    if (current > 0) {
      updateChar.mutate({ 
        id: character.id, 
        updates: { currentEssence: current - 1 } 
      });
    }
  };

  const handleEssenceRestore = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = character.currentEssence ?? 0;
    const max = character.maxEssence ?? 10;
    if (current < max) {
      updateChar.mutate({ 
        id: character.id, 
        updates: { currentEssence: current + 1 } 
      });
    }
  };

  const healthPercent = (character.currentHealth / character.maxHealth) * 100;
  const isLowHealth = healthPercent <= 25;
  const essenceCurrent = character.currentEssence ?? 0;
  const essenceMax = character.maxEssence ?? 10;
  const essencePercent = essenceMax > 0 ? (essenceCurrent / essenceMax) * 100 : 0;
  const canEdit = isDM || currentUser === character.owner;

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
              <div className="flex items-center gap-2">
                {summonedArmor && (
                  <span className="text-[10px] font-bold text-sky-400 flex items-center gap-0.5" data-testid={`text-card-armor-${character.id}`}>
                    <Shield className="w-3 h-3" /> {summonedArmor.currentDurability}/{summonedArmor.maxDurability}
                  </span>
                )}
                <span className={`text-sm font-bold ${isLowHealth ? 'text-destructive' : 'text-primary'}`}>
                  {character.currentHealth} / {character.maxHealth}
                </span>
              </div>
            </div>
            
            <div className="relative h-2 bg-black rounded-full overflow-hidden mb-3 border border-white/5">
              <div 
                className={`absolute inset-y-0 left-0 transition-all duration-500 ${isLowHealth ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${healthPercent}%` }}
              />
              {summonedArmor && summonedArmor.currentDurability > 0 && (
                <div
                  className="absolute inset-y-0 transition-all duration-300 bg-sky-400/40"
                  style={{
                    left: `${healthPercent}%`,
                    width: `${Math.min((summonedArmor.currentDurability / character.maxHealth) * 100, 100 - healthPercent)}%`,
                  }}
                />
              )}
            </div>
            
            <div className="flex gap-2 w-full mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-black/50 border-destructive/30 hover:bg-destructive/20 hover:text-destructive"
                onClick={handleDamage}
                disabled={!canEdit || (character.currentHealth <= 0 && (!summonedArmor || summonedArmor.currentDurability <= 0)) || updateChar.isPending}
                data-testid={`button-card-dmg-${character.id}`}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-black/50 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
                onClick={handleHeal}
                disabled={!canEdit || character.currentHealth >= character.maxHealth || updateChar.isPending}
                data-testid={`button-card-heal-${character.id}`}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Droplets className="w-3 h-3 text-violet-400" /> ES
              </span>
              <span className="text-sm font-bold text-violet-300">
                {essenceCurrent} / {essenceMax}
              </span>
            </div>

            <div className="h-2 bg-black rounded-full overflow-hidden mb-3 border border-white/5">
              <div 
                className="h-full transition-all duration-500 bg-violet-500"
                style={{ width: `${essencePercent}%` }}
              />
            </div>

            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-black/50 border-violet-500/30 hover:bg-violet-500/20 hover:text-violet-400"
                onClick={handleEssenceUse}
                disabled={!canEdit || essenceCurrent <= 0 || updateChar.isPending}
                data-testid={`button-card-essence-use-${character.id}`}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-black/50 border-violet-500/30 hover:bg-violet-500/20 hover:text-violet-400"
                onClick={handleEssenceRestore}
                disabled={!canEdit || essenceCurrent >= essenceMax || updateChar.isPending}
                data-testid={`button-card-essence-restore-${character.id}`}
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
        canEdit={canEdit}
      />
    </>
  );
}
