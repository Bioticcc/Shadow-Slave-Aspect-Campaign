import { type ReactNode, useEffect, useMemo, useState } from "react";
import { onDiceRoll, onSystemMessage } from "@/hooks/use-websocket";
import { type DiceRollPayload, type SystemMessagePayload } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Clock3, ScrollText, X } from "lucide-react";

type RoundLogDiceEntry = {
  kind: "dice";
  payload: DiceRollPayload;
  id: number;
  createdAt: number;
};

type RoundLogSystemEntry = {
  kind: "system";
  payload: SystemMessagePayload;
  id: number;
  createdAt: number;
};

type RoundLogEntry = RoundLogDiceEntry | RoundLogSystemEntry;

let nextRoundLogId = 0;

function getRollCategory(payload: DiceRollPayload): "Dice" | "Check" | "Save" {
  if (payload.results?.some((result) => result.label?.endsWith(" Save"))) return "Save";
  if (payload.results?.some((result) => result.label)) return "Check";
  return "Dice";
}

function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function formatRollName(payload: DiceRollPayload): string {
  if (!payload.results?.length) return "None";
  return payload.results.map((result) => {
    if (result.label) {
      const modifier = result.modifier === undefined ? "" : ` ${formatModifier(result.modifier)}`;
      return `${result.label} (${result.die}${modifier})`;
    }
    return `${result.rolls.length}${result.die}`;
  }).join(" + ");
}

function formatResultBreakdown(payload: DiceRollPayload): string {
  if (!payload.results?.length) return String(payload.total ?? 0);
  return payload.results
    .map((result) => {
      const modifier = result.modifier === undefined ? "" : ` ${formatModifier(result.modifier)}`;
      const showSubtotal = result.rolls.length > 1 || result.modifier !== undefined;
      return `${result.rolls.join(" + ")}${modifier}${showSubtotal ? ` = ${result.subtotal}` : ""}`;
    })
    .join(" | ");
}

interface RoundLogPanelProps {
  leftControls?: ReactNode;
  diceRollerOpen?: boolean;
}

export function RoundLogPanel({ leftControls, diceRollerOpen = false }: RoundLogPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<RoundLogEntry[]>([]);

  useEffect(() => {
    const unlistenDiceRoll = onDiceRoll((payload) => {
      const nextEntry: RoundLogDiceEntry = {
        kind: "dice",
        payload,
        id: nextRoundLogId++,
        createdAt: Date.now(),
      };
      setEntries((prev) => [nextEntry, ...prev].slice(0, 20));
    });

    const unlistenSystemMessage = onSystemMessage((payload) => {
      const nextEntry: RoundLogSystemEntry = {
        kind: "system",
        payload,
        id: nextRoundLogId++,
        createdAt: Date.now(),
      };
      setEntries((prev) => [nextEntry, ...prev].slice(0, 20));
      setIsOpen(true);
    });

    return () => {
      unlistenDiceRoll();
      unlistenSystemMessage();
    };
  }, []);

  const headerText = useMemo(() => `Round Log (${entries.length}/20)`, [entries.length]);

  return (
    <>
      <div
        className="fixed top-24 bottom-24 z-40 pointer-events-none flex items-stretch transition-[right] duration-300"
        style={{
          right: diceRollerOpen
            ? "calc(min(52rem, calc(100vw - 3rem)) + 2.25rem)"
            : "1.5rem",
        }}
      >
        <div
          className={`pointer-events-auto w-[360px] max-w-[85vw] glass-panel rounded-xl border border-white/10 overflow-hidden transition-all duration-300 ${
            isOpen ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"
          }`}
          data-testid="panel-round-log"
        >
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-display text-lg text-primary flex items-center gap-2">
              <ScrollText className="w-5 h-5" /> {headerText}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
              data-testid="button-round-log-close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="h-full overflow-y-auto p-3 space-y-2">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No rolls logged yet.</p>
            ) : (
              entries.map((entry) => (
                entry.kind === "dice" ? (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-1"
                    data-testid={`round-log-entry-${entry.id}`}
                  >
                    <p className="text-sm font-bold text-primary">{entry.payload.user}</p>
                    <p className="text-xs text-muted-foreground">
                      Type: <span className="font-bold text-foreground">{getRollCategory(entry.payload)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Roll: <span className="text-foreground">{formatRollName(entry.payload)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Result: <span className="text-foreground">{formatResultBreakdown(entry.payload)}</span>
                    </p>
                    <p className="text-sm font-display text-primary pt-1 border-t border-white/10">
                      Total: {entry.payload.total}
                    </p>
                  </div>
                ) : (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-primary/30 bg-primary/10 p-3 space-y-2"
                    data-testid={`round-log-entry-${entry.id}`}
                  >
                    <p className="text-[10px] text-primary/80 uppercase tracking-widest flex items-center gap-1">
                      <Clock3 className="w-3 h-3" /> World Event
                    </p>
                    <p className="font-display text-lg text-primary leading-tight">
                      {entry.payload.title}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {entry.payload.message}
                    </p>
                  </div>
                )
              ))
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 right-24 z-50 flex items-center gap-2">
        {leftControls}
        <Button
          onClick={() => setIsOpen((prev) => !prev)}
          data-testid="button-round-log-toggle"
        >
          <ScrollText className="w-4 h-4 mr-2" />
          Round Log
        </Button>
      </div>
    </>
  );
}
