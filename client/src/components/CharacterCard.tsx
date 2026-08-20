import { useState } from "react";
import {
  type Character,
  type Echo,
  type Memory,
  getArmorDexterityBonus,
  getEffectiveMemoryArmorClass,
  getEssenceMaxForProgress,
  getProficiencyBonus,
  normalizeEchoes,
  normalizeMemory,
  normalizeStats,
  serializeEchoes,
  CLASS_PROGRESSION_DESCRIPTIONS,
} from "@shared/schema";
import { useUpdateCharacter } from "@/hooks/use-characters";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Droplets, Sparkles } from "lucide-react";
import { CharacterSheet } from "./CharacterSheet";
import { motion } from "framer-motion";
import { getStarSeekingArmorBonus, normalizeExpandedAttributes } from "@/lib/expanded-attributes";

function getMemories(character: Character): Memory[] {
  const proficiencyBonus = getProficiencyBonus(character.soulFragments ?? 0);
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
  const updateChar = useUpdateCharacter();
  const memories = getMemories(character);
  const echoes = getEchoes(character);
  const summonedEchoes = echoes
    .map((echo, index) => ({ echo, index }))
    .filter(({ echo }) => echo.isSummoned);
  const summonedArmor = memories.find(m => m.memoryType === "armor" && m.isSummoned);

  const handleHealthChange = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    const nextHealth = Math.max(0, Math.min(character.maxHealth, character.currentHealth + delta));
    if (nextHealth === character.currentHealth) return;
    updateChar.mutate({ id: character.id, updates: { currentHealth: nextHealth } });
  };

  const handleArmorChange = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    const mems = [...memories];
    const armorIdx = mems.findIndex(m => m.memoryType === "armor" && m.isSummoned);
    if (armorIdx === -1) return;
    const armor = { ...mems[armorIdx] };
    const nextDurability = Math.max(0, Math.min(armor.maxDurability, armor.currentDurability + delta));
    if (nextDurability === armor.currentDurability) return;
    armor.currentDurability = nextDurability;
    mems[armorIdx] = armor;
    updateChar.mutate({ id: character.id, updates: { memories: mems } });
  };

  const handleEssenceChange = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    const current = character.currentEssence ?? 0;
    const max = getEssenceMaxForProgress(character.soulClass || "Beast", character.soulFragments ?? 0);
    const nextEssence = Math.max(0, Math.min(max, current + delta));
    if (nextEssence === current) return;
    updateChar.mutate({ id: character.id, updates: { currentEssence: nextEssence } });
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
  const armorPercent = summonedArmor && summonedArmor.maxDurability > 0
    ? (summonedArmor.currentDurability / summonedArmor.maxDurability) * 100
    : 0;
  const isLowHealth = healthPercent <= 25;
  const essenceCurrent = character.currentEssence ?? 0;
  const essenceMax = getEssenceMaxForProgress(character.soulClass || "Beast", character.soulFragments ?? 0);
  const essencePercent = essenceMax > 0 ? (essenceCurrent / essenceMax) * 100 : 0;
  const armorClass = getEffectiveArmorClass(character, memories);
  const proficiencyBonus = getProficiencyBonus(character.soulFragments ?? 0);
  const canEdit = isDM || currentUser === character.owner;

  return (
    <>
      <motion.div
        layoutId={`char-${character.id}`}
        onClick={() => setSheetOpen(true)}
        className="character-accent-scope group relative cursor-pointer glass-panel rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 border-glow"
        style={{ "--character-accent": "hsl(var(--primary))" } as React.CSSProperties}
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
            <p className="cursor-help text-xs font-bold text-blue-400" data-testid={`text-class-${character.id}`} title={CLASS_PROGRESSION_DESCRIPTIONS[character.soulClass || "Beast"]}>
              {character.soulClass || "Beast"}
            </p>
          </div>

          <div className="w-full border-t border-white/10 pt-3" onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Health
                    <span className="text-[8px] text-cyan-300" title={`Proficiency bonus from ${character.soulFragments ?? 0} fragments`} data-testid={`text-card-proficiency-${character.id}`}>PB +{proficiencyBonus}</span>
                  </span>
                  <span className={`whitespace-nowrap text-xs font-bold ${isLowHealth ? "text-destructive" : "text-primary"}`}>
                    {character.currentHealth}/
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
                        className="ml-0.5 inline-flex h-5 w-10 px-1 text-center text-xs font-bold"
                        data-testid={`input-card-max-health-${character.id}`}
                      />
                    ) : (
                      <button type="button" className="cursor-text rounded px-0.5 hover:bg-white/10" onDoubleClick={(event) => { event.stopPropagation(); if (canEdit) { setMaxHealthDraft(String(character.maxHealth)); setEditingMaxHealth(true); } }} title={canEdit ? "Double-click to edit maximum HP" : undefined}>{character.maxHealth}</button>
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full border border-white/5 bg-black"><div className={`h-full transition-all duration-500 ${isLowHealth ? "bg-destructive" : "bg-primary"}`} style={{ width: `${healthPercent}%` }} /></div>
                <div className="mt-0.5 flex items-center justify-center gap-0.5">
                  {[-1, 1].map((delta) => (
                    <Button key={delta} type="button" variant="ghost" size="sm" className="h-4 min-w-5 rounded-sm px-1 font-display text-[11px] font-bold leading-none text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={(event) => handleHealthChange(event, delta)} disabled={!canEdit || updateChar.isPending || (delta < 0 ? character.currentHealth <= 0 : character.currentHealth >= character.maxHealth)} data-testid={delta === -1 ? `button-card-dmg-${character.id}` : delta === 1 ? `button-card-heal-${character.id}` : undefined}>{delta === -10 ? "--" : delta === -1 ? "-" : delta === 1 ? "+" : "++"}</Button>
                  ))}
                </div>
              </div>

              <div className="min-w-0" data-testid={`text-card-armor-${character.id}`}>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><Shield className="h-3 w-3 text-blue-400" /> Armor</span>
                  <span className="whitespace-nowrap text-xs font-bold text-blue-300">
                    <span className="mr-1 text-[8px] text-amber-300" data-testid={`text-card-ac-${character.id}`}>AC {armorClass}</span>
                    {summonedArmor ? `${summonedArmor.currentDurability}/${summonedArmor.maxDurability}` : "—"}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full border border-white/5 bg-black"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${armorPercent}%` }} /></div>
                <div className="mt-0.5 flex items-center justify-center gap-0.5">
                  {[-1, 1].map((delta) => (
                    <Button key={delta} type="button" variant="ghost" size="sm" className="h-4 min-w-5 rounded-sm px-1 font-display text-[11px] font-bold leading-none text-muted-foreground hover:bg-blue-500/10 hover:text-blue-300" onClick={(event) => handleArmorChange(event, delta)} disabled={!canEdit || !summonedArmor || updateChar.isPending || (delta < 0 ? summonedArmor.currentDurability <= 0 : summonedArmor.currentDurability >= summonedArmor.maxDurability)}>{delta === -10 ? "--" : delta === -1 ? "-" : delta === 1 ? "+" : "++"}</Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><Droplets className="h-3 w-3 text-violet-400" /> Essence</span>
                <span className="text-xs font-bold text-violet-300">{essenceCurrent}/{essenceMax}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full border border-white/5 bg-black"><div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${essencePercent}%` }} /></div>
              <div className="mt-0.5 flex items-center justify-center gap-0.5">
                {[-10, -1, 1, 10].map((delta) => (
                  <Button key={delta} type="button" variant="ghost" size="sm" className="h-4 min-w-5 rounded-sm px-1 font-display text-[11px] font-bold leading-none text-muted-foreground hover:bg-violet-500/10 hover:text-violet-400" onClick={(event) => handleEssenceChange(event, delta)} disabled={!canEdit || updateChar.isPending || (delta < 0 ? essenceCurrent <= 0 : essenceCurrent >= essenceMax)} data-testid={delta === -1 ? `button-card-essence-use-${character.id}` : delta === 1 ? `button-card-essence-restore-${character.id}` : undefined}>{delta === -10 ? "--" : delta === -1 ? "-" : delta === 1 ? "+" : "++"}</Button>
                ))}
              </div>
            </div>

            {summonedEchoes.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                <div className="character-accent-text flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                  <Sparkles className="w-3 h-3" /> Summoned Echoes
                </div>
                <div className="space-y-2">
                  {summonedEchoes.map(({ echo, index }) => {
                    const hpPercent = echo.maxHealth > 0 ? (echo.currentHealth / echo.maxHealth) * 100 : 0;
                    return (
                      <div
                        key={`echo-${index}`}
                        className="rounded-lg border border-white/10 bg-black/20 p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="character-accent-border character-accent-text flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                              {(echo.name || "E").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground">{echo.name || `Echo ${index + 1}`}</p>
                              <p className="text-[10px] text-muted-foreground">HP {echo.currentHealth}/{echo.maxHealth}</p>
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
                              -
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={(event) => handleEchoHealthChange(event, index, 1)}
                              disabled={!canEdit || echo.currentHealth >= echo.maxHealth || updateChar.isPending}
                              data-testid={`button-card-echo-heal-${character.id}-${index}`}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/60">
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
