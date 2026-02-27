import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dices, X, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DICE_TYPES = [
  { name: "D20", sides: 20, color: "from-amber-500 to-amber-700" },
  { name: "D12", sides: 12, color: "from-purple-500 to-purple-700" },
  { name: "D100", sides: 100, color: "from-rose-500 to-rose-700" },
  { name: "D10", sides: 10, color: "from-blue-500 to-blue-700" },
  { name: "D8", sides: 8, color: "from-emerald-500 to-emerald-700" },
  { name: "D6", sides: 6, color: "from-cyan-500 to-cyan-700" },
  { name: "D4", sides: 4, color: "from-pink-500 to-pink-700" },
];

type DiceSelection = Record<string, number>;
type RollResult = { die: string; sides: number; rolls: number[]; subtotal: number };

export function DiceRoller() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<DiceSelection>({});
  const [results, setResults] = useState<RollResult[] | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const totalSelected = Object.values(selected).reduce((a, b) => a + b, 0);

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
      setIsRolling(false);
    }, 400);
  };

  const grandTotal = results ? results.reduce((a, r) => a + r.subtotal, 0) : 0;

  const handleReset = () => {
    setSelected({});
    setResults(null);
  };

  return (
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
                    <div className="flex items-center gap-2">
                      <span className={`w-10 h-10 rounded-lg bg-gradient-to-br ${dice.color} flex items-center justify-center text-white font-bold text-xs shadow-lg`}>
                        {dice.name}
                      </span>
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
  );
}
