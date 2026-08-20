import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dices, X, RotateCcw, Triangle, Pentagon, Hexagon, Octagon, Diamond, Circle, Box, Gauge, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useUpdateCharacter } from "@/hooks/use-characters";
import { sendWsMessage, onDiceRoll } from "@/hooks/use-websocket";
import {
  getProficiencyBonus,
  getStatTrainingBonus,
  normalizeEchoes,
  normalizeMemory,
  normalizeStats,
  normalizeStatProgression,
  serializeEchoes,
  WS_EVENTS,
  type Character,
  type CharacterStats,
  type DiceRollPayload,
} from "@shared/schema";

const DICE_ICONS: Record<string, typeof Dices> = {
  D4: Triangle,
  D6: Box,
  D8: Diamond,
  D10: Pentagon,
  D12: Hexagon,
  D20: Octagon,
  D100: Circle,
};

const DICE_TYPES = [
  { name: "D20", sides: 20 },
  { name: "D12", sides: 12 },
  { name: "D100", sides: 100 },
  { name: "D10", sides: 10 },
  { name: "D8", sides: 8 },
  { name: "D6", sides: 6 },
  { name: "D4", sides: 4 },
];

const SAVES: { label: string; short: string; stat: keyof CharacterStats }[] = [
  { label: "Strength", short: "STR", stat: "strength" },
  { label: "Dexterity", short: "DEX", stat: "dexterity" },
  { label: "Constitution", short: "CON", stat: "constitution" },
  { label: "Intelligence", short: "INT", stat: "intelligence" },
  { label: "Wisdom", short: "WIS", stat: "wisdom" },
  { label: "Charisma", short: "CHA", stat: "charisma" },
];

const CHECKS: { label: string; short: string; stat: keyof CharacterStats }[] = [
  { label: "Athletics", short: "STR", stat: "strength" },
  { label: "Deception", short: "CHA", stat: "charisma" },
  { label: "Intimidation", short: "CHA", stat: "charisma" },
  { label: "Investigation", short: "INT", stat: "intelligence" },
  { label: "Perception", short: "INT", stat: "intelligence" },
  { label: "Persuasion", short: "CHA", stat: "charisma" },
  { label: "Slight of Hand", short: "DEX", stat: "dexterity" },
  { label: "Stealth", short: "DEX", stat: "dexterity" },
  { label: "Survival", short: "WIS", stat: "wisdom" },
];

type DiceSelection = Record<string, number>;
type RollResult = DiceRollPayload["results"][number];
type DisplayResult = { user: string; results: RollResult[]; total: number; id: number };

let nextId = 0;

function formatModifier(modifier: number) {
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function RollResultLines({
  results,
  total,
  totalTestId,
}: {
  results: RollResult[];
  total: number;
  totalTestId?: string;
}) {
  return (
    <>
      {results.map((result, i) => (
        <div key={i} className="text-sm">
          <span className="text-muted-foreground font-medium">
            {result.label || `${result.rolls.length}${result.die}`}:
          </span>{" "}
          <span className="text-foreground">
            {result.rolls.map((value, j) => (
              <span key={j}>
                <span className={
                  value === result.sides ? "text-emerald-400 font-bold" :
                  value === 1 ? "text-destructive font-bold" : ""
                }>{value}</span>
                {j < result.rolls.length - 1 ? " + " : ""}
              </span>
            ))}
            {result.modifier !== undefined && (
              <span className="text-muted-foreground"> {formatModifier(result.modifier)}</span>
            )}
            {(result.rolls.length > 1 || result.modifier !== undefined) && (
              <span className="text-muted-foreground"> = {result.subtotal}</span>
            )}
          </span>
          {result.character && (
            <span className="block text-[10px] text-muted-foreground/70">{result.character}</span>
          )}
        </div>
      ))}
      <div className="pt-1 border-t border-white/10 text-right">
        <span className="text-xl font-display font-bold text-primary" data-testid={totalTestId}>{total}</span>
      </div>
    </>
  );
}

export function DiceRoller({
  activeCharacter,
  onOpenChange,
}: {
  activeCharacter?: Character;
  onOpenChange?: (open: boolean) => void;
}) {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<DiceSelection>({});
  const [results, setResults] = useState<RollResult[] | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [incomingRolls, setIncomingRolls] = useState<DisplayResult[]>([]);
  const updateCharacter = useUpdateCharacter();

  const totalSelected = Object.values(selected).reduce((a, b) => a + b, 0);
  const characterStats = normalizeStats(activeCharacter?.stats);
  const activeProficiencyBonus = getProficiencyBonus(activeCharacter?.soulFragments ?? 0);
  const activeStatProgression = normalizeStatProgression(activeCharacter?.statProgression, activeCharacter?.soulFragments ?? 0, activeCharacter?.soulClass || "Beast");
  const getRollModifier = (stat: keyof CharacterStats, manuallyProficient = false) => {
    const trainingBonus = getStatTrainingBonus(activeStatProgression, stat, activeProficiencyBonus);
    return characterStats[stat] + (trainingBonus || (manuallyProficient ? activeProficiencyBonus : 0));
  };

  const isCheckProficient = (label: string) => activeStatProgression.checkProficiencies?.[label] === true;
  const isSaveProficient = (stat: keyof CharacterStats) => activeStatProgression.saveProficiencies?.[stat] === true;

  const handleProficiencyToggle = (kind: "check" | "save", key: string, checked: boolean) => {
    if (!activeCharacter || updateCharacter.isPending) return;
    const field = kind === "check" ? "checkProficiencies" : "saveProficiencies";
    const existing = { ...(activeStatProgression[field] || {}) } as Record<string, boolean>;
    if (checked) existing[key] = true;
    else delete existing[key];
    updateCharacter.mutate({
      id: activeCharacter.id,
      updates: { statProgression: { ...activeStatProgression, [field]: existing } },
    });
  };

  useEffect(() => {
    return onDiceRoll((payload: DiceRollPayload) => {
      if (payload.user === currentUser) return;
      const entry: DisplayResult = { ...payload, id: nextId++ };
      setIncomingRolls(prev => [entry, ...prev].slice(0, 5));
      setTimeout(() => {
        setIncomingRolls(prev => prev.filter(r => r.id !== entry.id));
      }, 12000);
    });
  }, [currentUser]);

  const adjustDie = (name: string, delta: number) => {
    setSelected(prev => {
      const newVal = Math.max(0, Math.min(20, (prev[name] || 0) + delta));
      const next = { ...prev };
      if (newVal === 0) {
        delete next[name];
      } else {
        next[name] = newVal;
      }
      return next;
    });
  };

  const handleRoll = () => {
    setIsRolling(true);
    setTimeout(() => {
      const rollResults: RollResult[] = [];
      for (const dice of DICE_TYPES) {
        const count = selected[dice.name] || 0;
        if (count > 0) {
          const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * dice.sides) + 1);
          rollResults.push({
            die: dice.name,
            sides: dice.sides,
            rolls,
            subtotal: rolls.reduce((a, b) => a + b, 0),
          });
        }
      }
      setResults(rollResults);
      setSelected({});
      setIsRolling(false);

      const total = rollResults.reduce((a, r) => a + r.subtotal, 0);
      sendWsMessage({
        type: WS_EVENTS.DICE_ROLL,
        payload: {
          user: currentUser || "Unknown",
          results: rollResults,
          total,
        },
      });
    }, 400);
  };

  const handleModifierRoll = (label: string, stat: keyof CharacterStats) => {
    if (!activeCharacter || isRolling) return;

    setIsRolling(true);
    setTimeout(() => {
      const actualStat = label === "Perception" && activeCharacter.name.trim().toLowerCase() === "wilovan"
        ? "dexterity"
        : stat;
      const manualProficiency = label.endsWith(" Save")
        ? isSaveProficient(actualStat)
        : isCheckProficient(label);
      const modifier = getRollModifier(actualStat, manualProficiency);
      const naturalRoll = Math.floor(Math.random() * 20) + 1;
      const rollResults: RollResult[] = [{
        die: "D20",
        sides: 20,
        rolls: [naturalRoll],
        modifier,
        subtotal: naturalRoll + modifier,
        label,
        character: activeCharacter.name,
      }];

      setResults(rollResults);
      setIsRolling(false);
      sendWsMessage({
        type: WS_EVENTS.DICE_ROLL,
        payload: {
          user: currentUser || "Unknown",
          results: rollResults,
          total: rollResults[0].subtotal,
        },
      });
    }, 400);
  };

  const handleLongRest = async () => {
    if (!activeCharacter || updateCharacter.isPending) return;

    const proficiencyBonus = getProficiencyBonus(activeCharacter.soulFragments ?? 0);
    const memories = (activeCharacter.memories || []).map((rawMemory) => {
      const memory = normalizeMemory(rawMemory, proficiencyBonus);
      if (memory.isSummoned) return memory;
      return {
        ...memory,
        currentDurability: Math.min(
          memory.maxDurability,
          memory.currentDurability + (Math.max(0, memory.healRate) * 8),
        ),
      };
    });
    const echoes = normalizeEchoes(activeCharacter.echoes).map((echo) => {
      if (echo.isSummoned) return echo;
      return {
        ...echo,
        currentHealth: Math.min(
          echo.maxHealth,
          echo.currentHealth + (Math.max(0, echo.healRate) * 8),
        ),
      };
    });

    try {
      await updateCharacter.mutateAsync({
        id: activeCharacter.id,
        updates: {
          currentEssence: activeCharacter.maxEssence ?? 10,
          memories,
          echoes: serializeEchoes(echoes),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete long rest";
      alert(message);
    }
  };

  const grandTotal = results ? results.reduce((a, r) => a + r.subtotal, 0) : 0;

  const handleReset = () => {
    setSelected({});
    setResults(null);
  };

  return (
    <>
      {/* Incoming roll notifications */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none w-80">
        <AnimatePresence>
          {incomingRolls.map((roll) => (
            <motion.div
              key={roll.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="pointer-events-auto glass-panel rounded-xl border border-primary/30 shadow-2xl shadow-black/50 overflow-hidden"
              data-testid={`notification-dice-roll-${roll.id}`}
            >
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                <Dices className="w-4 h-4 text-primary" />
                <span className="font-display text-sm text-primary">{roll.user}</span>
                <span className="text-xs text-muted-foreground">rolled dice</span>
              </div>
              <div className="px-4 py-3 space-y-1">
                <RollResultLines results={roll.results} total={roll.total} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dice roller FAB */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="w-[min(52rem,calc(100vw-3rem))] glass-panel rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mr-2 font-display text-lg text-primary flex items-center gap-2">
                      <Dices className="w-5 h-5" /> Dice Roller
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={handleLongRest}
                      disabled={!activeCharacter || updateCharacter.isPending}
                      data-testid="button-long-rest"
                    >
                      <Moon className="mr-1.5 h-3.5 w-3.5" />
                      {updateCharacter.isPending ? "Resting..." : "Longrest"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => handleModifierRoll("Initiative", "intelligence")}
                      disabled={!activeCharacter || isRolling}
                      data-testid="button-initiative"
                    >
                      <Gauge className="mr-1.5 h-3.5 w-3.5" /> Initiative
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {activeCharacter ? `Active character: ${activeCharacter.name}` : "No active character assigned"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleReset}
                  data-testid="button-dice-reset"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              <div>
                <div className="grid grid-cols-2">
                  <section className="relative min-h-0 min-w-0">
                    <div className="absolute inset-0 space-y-1.5 overflow-y-auto p-3 pr-2">
                      <h4 className="px-1 pb-1 text-xs font-bold uppercase tracking-widest text-primary">Saves</h4>
                      {SAVES.map((save) => {
                        const statTraining = activeStatProgression.training[save.stat];
                        const manuallyProficient = isSaveProficient(save.stat);
                        const trained = !!statTraining;
                        return (
                          <div key={save.stat} className="flex h-10 items-center gap-2 rounded-md border border-white/5 bg-black/30 px-2 hover:bg-white/10">
                            <Checkbox
                              checked={trained || manuallyProficient}
                              disabled={!activeCharacter || trained || updateCharacter.isPending}
                              onCheckedChange={(checked) => handleProficiencyToggle("save", save.stat, checked === true)}
                              className="h-3.5 w-3.5"
                              aria-label={`${trained || manuallyProficient ? "Remove" : "Add"} ${save.label} save proficiency`}
                              title={trained ? `Granted by ${statTraining}` : "Proficient"}
                            />
                            <button type="button" className="flex min-w-0 flex-1 items-center justify-between self-stretch" disabled={!activeCharacter || isRolling} onClick={() => handleModifierRoll(`${save.label} Save`, save.stat)} data-testid={`button-save-${save.stat}`}>
                              <span className="text-sm">{save.label}</span>
                              <span className="text-xs text-muted-foreground">{save.short} {formatModifier(getRollModifier(save.stat, manuallyProficient))}</span>
                            </button>
                          </div>
                        );
                      })}
                      <h4 className="px-1 pb-1 pt-4 text-xs font-bold uppercase tracking-widest text-primary">Checks</h4>
                      {CHECKS.map((check) => {
                        const stat = check.label === "Perception" && activeCharacter?.name.trim().toLowerCase() === "wilovan"
                          ? "dexterity"
                          : check.stat;
                        const short = stat === "dexterity" && check.label === "Perception" ? "DEX" : check.short;
                        const statTraining = activeStatProgression.training[stat];
                        const manuallyProficient = isCheckProficient(check.label);
                        const trained = !!statTraining;
                        return (
                          <div key={check.label} className="flex h-10 items-center gap-2 rounded-md border border-white/5 bg-black/30 px-2 hover:bg-white/10">
                            <Checkbox
                              checked={trained || manuallyProficient}
                              disabled={!activeCharacter || trained || updateCharacter.isPending}
                              onCheckedChange={(checked) => handleProficiencyToggle("check", check.label, checked === true)}
                              className="h-3.5 w-3.5"
                              aria-label={`${trained || manuallyProficient ? "Remove" : "Add"} ${check.label} proficiency`}
                              title={trained ? `Granted by ${statTraining}` : "Proficient"}
                            />
                            <button type="button" className="flex min-w-0 flex-1 items-center justify-between self-stretch" disabled={!activeCharacter || isRolling} onClick={() => handleModifierRoll(check.label, check.stat)} data-testid={`button-check-${check.label.toLowerCase().replaceAll(" ", "-")}`}>
                              <span className="text-sm">{check.label}</span>
                              <span className="text-xs text-muted-foreground">{short} {formatModifier(getRollModifier(stat, manuallyProficient))}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="min-w-0 space-y-1.5 border-l border-white/10 p-3">
                    <h4 className="px-1 pb-1 text-xs font-bold uppercase tracking-widest text-primary">Dice</h4>
                    {DICE_TYPES.map((dice) => {
                      const count = selected[dice.name] || 0;
                      return (
                        <div
                          key={dice.name}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            {(() => { const Icon = DICE_ICONS[dice.name] || Dices; return <Icon className="w-5 h-5 text-muted-foreground" />; })()}
                            <span className="text-sm font-bold text-foreground">{dice.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => adjustDie(dice.name, -1)}
                              disabled={count === 0}
                              data-testid={`button-dice-minus-${dice.name}`}
                            >
                              <span className="text-lg font-bold">−</span>
                            </Button>
                            <span className="w-6 text-center font-bold text-foreground text-sm" data-testid={`text-dice-count-${dice.name}`}>
                              {count}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => adjustDie(dice.name, 1)}
                              disabled={count >= 20}
                              data-testid={`button-dice-plus-${dice.name}`}
                            >
                              <span className="text-lg font-bold">+</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display tracking-wider"
                      onClick={handleRoll}
                      disabled={totalSelected === 0 || isRolling}
                      data-testid="button-dice-roll"
                    >
                      {isRolling ? "Rolling..." : `Roll ${totalSelected > 0 ? `(${totalSelected} dice)` : ""}`}
                    </Button>
                  </section>
                </div>
              </div>

              <AnimatePresence>
                {results && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 overflow-hidden"
                  >
                    <div className="p-3 space-y-2">
                      <RollResultLines results={results} total={grandTotal} totalTestId="text-dice-total" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          size="icon"
          className={`w-14 h-14 rounded-full shadow-xl transition-all duration-300 ${
            isOpen
              ? "bg-muted text-muted-foreground hover:bg-muted/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/30"
          }`}
          onClick={() => {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            onOpenChange?.(nextOpen);
            if (isOpen) setResults(null);
          }}
          data-testid="button-dice-toggle"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Dices className="w-6 h-6" />}
        </Button>
      </div>
    </>
  );
}
