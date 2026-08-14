import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dices, X, RotateCcw, Triangle, Pentagon, Hexagon, Octagon, Diamond, Circle, Box } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { sendWsMessage, onDiceRoll } from "@/hooks/use-websocket";
import { WS_EVENTS, type DiceRollPayload } from "@shared/schema";

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

type DiceSelection = Record<string, number>;
type RollResult = { die: string; sides: number; rolls: number[]; subtotal: number };
type DisplayResult = { user: string; results: RollResult[]; total: number; id: number };

let nextId = 0;

export function DiceRoller() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<DiceSelection>({});
  const [results, setResults] = useState<RollResult[] | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [incomingRolls, setIncomingRolls] = useState<DisplayResult[]>([]);

  const totalSelected = Object.values(selected).reduce((a, b) => a + b, 0);

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
                {roll.results.map((r, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-muted-foreground font-medium">{r.rolls.length}{r.die}:</span>{" "}
                    <span className="text-foreground">
                      {r.rolls.map((v, j) => (
                        <span key={j}>
                          <span className={
                            v === r.sides ? "text-emerald-400 font-bold" :
                            v === 1 ? "text-destructive font-bold" : ""
                          }>{v}</span>
                          {j < r.rolls.length - 1 ? " + " : ""}
                        </span>
                      ))}
                      {r.rolls.length > 1 && <span className="text-muted-foreground"> = {r.subtotal}</span>}
                    </span>
                  </div>
                ))}
                <div className="pt-1 border-t border-white/10 text-right">
                  <span className="text-xl font-display font-bold text-primary">{roll.total}</span>
                </div>
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
              className="w-72 glass-panel rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-display text-lg text-primary flex items-center gap-2">
                  <Dices className="w-5 h-5" /> Dice Roller
                </h3>
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

              <div className="p-3 space-y-1.5 max-h-[320px] overflow-y-auto">
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
                      {results.map((r, i) => (
                        <div key={i} className="text-sm">
                          <span className="text-muted-foreground font-medium">{r.rolls.length}{r.die}:</span>{" "}
                          <span className="text-foreground">
                            {r.rolls.map((v, j) => (
                              <span key={j}>
                                <span className={
                                  v === r.sides ? "text-emerald-400 font-bold" :
                                  v === 1 ? "text-destructive font-bold" : ""
                                }>{v}</span>
                                {j < r.rolls.length - 1 ? " + " : ""}
                              </span>
                            ))}
                            {r.rolls.length > 1 && <span className="text-muted-foreground"> = {r.subtotal}</span>}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/10 text-center">
                        <span className="text-2xl font-display font-bold text-primary" data-testid="text-dice-total">
                          {grandTotal}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-3 border-t border-white/10">
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display tracking-wider"
                  onClick={handleRoll}
                  disabled={totalSelected === 0 || isRolling}
                  data-testid="button-dice-roll"
                >
                  {isRolling ? "Rolling..." : `Roll ${totalSelected > 0 ? `(${totalSelected} dice)` : ""}`}
                </Button>
              </div>
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
          onClick={() => { setIsOpen(!isOpen); if (isOpen) { setResults(null); } }}
          data-testid="button-dice-toggle"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Dices className="w-6 h-6" />}
        </Button>
      </div>
    </>
  );
}
