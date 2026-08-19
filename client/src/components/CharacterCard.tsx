import { useState } from "react";
import {
  type Character,
  type Echo,
  type Memory,
  getArmorDexterityBonus,
  getEffectiveMemoryArmorClass,
  getProficiencyBonus,
  normalizeEchoes,
  normalizeMemory,
  normalizeStats,
  serializeEchoes,
} from "@shared/schema";
import { useUpdateCharacter } from "@/hooks/use-characters";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Shield, Droplets, Sparkles } from "lucide-react";
import { CharacterSheet } from "./CharacterSheet";
import { motion } from "framer-motion";
import { getStarSeekingArmorBonus, normalizeExpandedAttributes } from "@/lib/expanded-attributes";

function getMemories(character: Character): Memory[] {
  const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
  return (character.memories || []).map((memory) => normalizeMemory(memory, proficiencyBonus));
}

function getEchoes(character: Character): Echo[] {
  return normalizeEchoes(character.echoes);
}

function getEffectiveArmorClass(character: Character, memories: Memory[]): number {
  const dexterity = normalizeStats(character.stats).dexterity;
  const summonedArmor = memories.find((m) => m.memoryType === "armor" && m.isSummoned);
  const baseAc = summonedArmor ? getEffectiveMemoryArmorClass(summonedArmor) : (character.armorClass ?? 8);
  const dexterityBonus = getArmorDexterityBonus(dexterity, summonedArmor?.armorDexterityBonus ?? "full");
  const attributeBonus = getStarSeekingArmorBonus(normalizeExpandedAttributes(character));
  return Math.max(1, baseAc) + dexterityBonus + attributeBonus;
}

export function CharacterCard({ character }: { character: Character }) {
  const { currentUser, isDM } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMaxHealth, setEditingMaxHealth] = useState(false);
  const [maxHealthDraft, setMaxHealthDraft] = useState(String(character.maxHealth));
  const [editingMaxEssence, setEditingMaxEssence] = useState(false);
  const [maxEssenceDraft, setMaxEssenceDraft] = useState(String(character.maxEssence ?? 10));
  const updateChar = useUpdateCharacter();
  const memories = getMemories(character);
  const echoes = getEchoes(character);
  const summonedEchoes = echoes
    .map((echo, index) => ({ echo, index }))
    .filter(({ echo }) => echo.isSummoned);
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

  const commitMaxHealth = () => {
    const parsed = Number.parseInt(maxHealthDraft, 10);
    const maxHealth = Number.isFinite(parsed) ? Math.max(1, parsed) : character.maxHealth;
    setMaxHealthDraft(String(maxHealth));
    setEditingMaxHealth(false);
    if (maxHealth !== character.maxHealth) {
      updateChar.mutate({
        id: character.id,
        updates: {
          maxHealth,
          currentHealth: Math.min(character.currentHealth, maxHealth),
        },
      });
    }
  };

  const commitMaxEssence = () => {
    const currentMax = character.maxEssence ?? 10;
    const parsed = Number.parseInt(maxEssenceDraft, 10);
    const maxEssence = Number.isFinite(parsed) ? Math.max(0, parsed) : currentMax;
    setMaxEssenceDraft(String(maxEssence));
    setEditingMaxEssence(false);
    if (maxEssence !== currentMax) {
      updateChar.mutate({
        id: character.id,
        updates: {
          maxEssence,
          currentEssence: Math.min(character.currentEssence ?? 0, maxEssence),
        },
      });
    }
  };

  const handleEchoHealthChange = (e: React.MouseEvent, echoIndex: number, delta: number) => {
    e.stopPropagation();
    if (!canEdit) return;

    const nextEchoes = [...echoes];
    const target = nextEchoes[echoIndex];
    if (!target || !target.isSummoned) return;

    const nextHealth = Math.max(0, Math.min(target.maxHealth, target.currentHealth + delta));
    if (nextHealth === target.currentHealth) return;

    nextEchoes[echoIndex] = { ...target, currentHealth: nextHealth };
    updateChar.mutate({
      id: character.id,
      updates: { echoes: serializeEchoes(nextEchoes) },
    });
  };

  const healthPercent = (character.currentHealth / character.maxHealth) * 100;
  const isLowHealth = healthPercent <= 25;
  const essenceCurrent = character.currentEssence ?? 0;
  const essenceMax = character.maxEssence ?? 10;
  const essencePercent = essenceMax > 0 ? (essenceCurrent / essenceMax) * 100 : 0;
  const armorClass = getEffectiveArmorClass(character, memories);
  const proficiencyBonus = getProficiencyBonus(character.totalSoulFragments ?? 0);
  const canEdit = isDM || currentUser === character.owner;
  const accentColor = typeof character.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(character.accentColor)
    ? character.accentColor
    : "#b45353";

  return (
    <>
      <motion.div
        layoutId={`char-${character.id}`}
        onClick={() => setSheetOpen(true)}
        className="character-accent-scope group relative cursor-pointer glass-panel rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 border-glow"
        style={{ "--character-accent": accentColor } as React.CSSProperties}
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
                <span
                  className="text-[10px] font-bold text-amber-300 border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 rounded"
                  data-testid={`text-card-ac-${character.id}`}
                >
                  AC {armorClass}
                </span>
                <span
                  className="text-[10px] font-bold text-cyan-300 border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 rounded"
                  title={`Proficiency bonus from ${character.totalSoulFragments ?? 0} total shards`}
                  data-testid={`text-card-proficiency-${character.id}`}
                >
                  PB +{proficiencyBonus}
                </span>
                {summonedArmor && (
                  <span className="text-[10px] font-bold text-primary flex items-center gap-0.5" data-testid={`text-card-armor-${character.id}`}>
                    <Shield className="w-3 h-3" /> {summonedArmor.currentDurability}/{summonedArmor.maxDurability}
                  </span>
                )}
                <span className={`text-sm font-bold ${isLowHealth ? 'text-destructive' : 'text-primary'}`}>
                  {character.currentHealth} /
                  {editingMaxHealth ? (
                    <Input
                      type="number"
                      min={1}
                      autoFocus
                      value={maxHealthDraft}
                      onChange={(event) => setMaxHealthDraft(event.target.value)}
                      onBlur={commitMaxHealth}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setMaxHealthDraft(String(character.maxHealth));
                          setEditingMaxHealth(false);
                        }
                      }}
                      className="ml-1 inline-flex h-6 w-16 px-1.5 text-center text-sm font-bold"
                      data-testid={`input-card-max-health-${character.id}`}
                    />
                  ) : (
                    <button
                      type="button"
                      className="ml-1 cursor-text rounded px-0.5 hover:bg-white/10"
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (!canEdit) return;
                        setMaxHealthDraft(String(character.maxHealth));
                        setEditingMaxHealth(true);
                      }}
                      title={canEdit ? "Double-click to edit maximum HP" : undefined}
                    >
                      {character.maxHealth}
                    </button>
                  )}
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
                  className="absolute inset-y-0 transition-all duration-300 bg-primary/40"
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
                {essenceCurrent} /
                {editingMaxEssence ? (
                  <Input
                    type="number"
                    min={0}
                    autoFocus
                    value={maxEssenceDraft}
                    onChange={(event) => setMaxEssenceDraft(event.target.value)}
                    onBlur={commitMaxEssence}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setMaxEssenceDraft(String(essenceMax));
                          setEditingMaxEssence(false);
                      }
                    }}
                    className="ml-1 inline-flex h-6 w-16 px-1.5 text-center text-sm font-bold"
                    data-testid={`input-card-max-essence-${character.id}`}
                  />
                ) : (
                  <button
                    type="button"
                    className="ml-1 cursor-text rounded px-0.5 hover:bg-white/10"
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      if (!canEdit) return;
                      setMaxEssenceDraft(String(essenceMax));
                      setEditingMaxEssence(true);
                    }}
                    title={canEdit ? "Double-click to edit maximum Essence" : undefined}
                  >
                    {essenceMax}
                  </button>
                )}
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

            {summonedEchoes.length > 0 && (
              <div className="character-accent-border mt-4 pt-3 border-t space-y-2">
                <div className="character-accent-text flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                  <Sparkles className="w-3 h-3" /> Summoned Echoes
                </div>
                <div className="space-y-2">
                  {summonedEchoes.map(({ echo, index }) => {
                    const hpPercent = echo.maxHealth > 0 ? (echo.currentHealth / echo.maxHealth) * 100 : 0;
                    return (
                      <div
                        key={`echo-${index}`}
                        className="character-accent-border character-accent-soft rounded-lg border p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="character-accent-border character-accent-soft character-accent-text w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0">
                              {(echo.name || "E").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="character-accent-text text-xs font-bold truncate">{echo.name || `Echo ${index + 1}`}</p>
                              <p className="character-accent-muted text-[10px]">HP {echo.currentHealth}/{echo.maxHealth}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={(event) => handleEchoHealthChange(event, index, -1)}
                              disabled={!canEdit || echo.currentHealth <= 0 || updateChar.isPending}
                              data-testid={`button-card-echo-dmg-${character.id}-${index}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={(event) => handleEchoHealthChange(event, index, 1)}
                              disabled={!canEdit || echo.currentHealth >= echo.maxHealth || updateChar.isPending}
                              data-testid={`button-card-echo-heal-${character.id}-${index}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="character-accent-border mt-2 h-1.5 bg-black/60 rounded-full overflow-hidden border">
                          <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${hpPercent}%`, backgroundColor: "var(--character-accent)" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
