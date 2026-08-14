import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { type Echo, DAMAGE_DICE } from "@shared/schema";

interface EchoEditorProps {
  echoes: Echo[];
  onChange: (echoes: Echo[]) => void;
}

const createNewMove = (): Echo["damageMoves"][number] => ({
  name: "",
  description: "",
  hitModifier: 0,
  damageDie: "D6",
  diceCount: 1,
  damageModifier: 0,
});

const createNewEcho = (): Echo => ({
  name: "",
  armorClass: 8,
  description: "",
  damageMoves: [],
  core: "dormant",
  tier: 1,
  currentHealth: 8,
  maxHealth: 8,
  healRate: 1,
  summonCost: 0,
  isSummoned: false,
});

export function EchoEditor({ echoes, onChange }: EchoEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [newEcho, setNewEcho] = useState<Echo>(createNewEcho());
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (!newEcho.name.trim()) return;
    onChange([...echoes, { ...newEcho }]);
    setNewEcho(createNewEcho());
    setIsAdding(false);
  };

  const handleUpdate = (index: number, updates: Partial<Echo>) => {
    const updated = [...echoes];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = [...echoes];
    updated.splice(index, 1);
    onChange(updated);
    if (expandedIdx === index) setExpandedIdx(null);
    if (expandedIdx !== null && expandedIdx > index) setExpandedIdx(expandedIdx - 1);
  };

  const confirmRemove = () => {
    if (pendingDeleteIndex === null) return;
    handleRemove(pendingDeleteIndex);
    setPendingDeleteIndex(null);
  };

  const addMove = (echoIndex: number) => {
    const echo = echoes[echoIndex];
    const moves: Echo["damageMoves"] = [...(echo.damageMoves || [])];
    moves.push(createNewMove());
    handleUpdate(echoIndex, { damageMoves: moves });
  };

  const updateMove = (
    echoIndex: number,
    moveIndex: number,
    updates: Partial<Echo["damageMoves"][number]>,
  ) => {
    const echo = echoes[echoIndex];
    const moves = [...(echo.damageMoves || [])];
    moves[moveIndex] = { ...moves[moveIndex], ...updates };
    handleUpdate(echoIndex, { damageMoves: moves });
  };

  const removeMove = (echoIndex: number, moveIndex: number) => {
    const echo = echoes[echoIndex];
    const moves = [...(echo.damageMoves || [])];
    moves.splice(moveIndex, 1);
    handleUpdate(echoIndex, { damageMoves: moves });
  };

  return (
    <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-display text-primary">Edit Echoes</h4>
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
        {echoes.map((echo, idx) => (
          <div key={idx} className="bg-secondary/50 rounded-lg border border-white/5">
            <div
              className="flex items-start justify-between gap-4 p-3 cursor-pointer"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{echo.name}</p>
                <p className="text-xs text-muted-foreground">AC {echo.armorClass} · {echo.damageMoves.length} moves</p>
              </div>
              <div className="flex items-center gap-1">
                {expandedIdx === idx ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteIndex(idx);
                  }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {expandedIdx === idx && (
              <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Input
                      placeholder="Name"
                      value={echo.name}
                      onChange={e => handleUpdate(idx, { name: e.target.value })}
                      className="bg-black/50"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      min={0}
                      value={echo.armorClass}
                      onChange={e => handleUpdate(idx, { armorClass: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="bg-black/50 text-center"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      min={0}
                      value={echo.healRate}
                      onChange={e => handleUpdate(idx, { healRate: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="bg-black/50 text-center"
                    />
                  </div>
                </div>
                <Textarea
                  placeholder="Description"
                  value={echo.description}
                  onChange={e => handleUpdate(idx, { description: e.target.value })}
                  className="bg-black/50 min-h-[70px]"
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Damage Moves</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => addMove(idx)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Move
                    </Button>
                  </div>
                  {(echo.damageMoves || []).length > 0 ? (
                    <div className="space-y-2">
                      {echo.damageMoves.map((move, moveIdx) => (
                        <div key={moveIdx} className="p-2 rounded-lg border border-white/10 bg-black/30 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Move name"
                              value={move.name}
                              onChange={e => updateMove(idx, moveIdx, { name: e.target.value })}
                              className="bg-black/50"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMove(idx, moveIdx)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Move description"
                            value={move.description}
                            onChange={e => updateMove(idx, moveIdx, { description: e.target.value })}
                            className="bg-black/50 min-h-[64px]"
                          />
                          <div className="grid grid-cols-4 gap-2">
                            <Input
                              type="number"
                              value={move.hitModifier}
                              onChange={e => updateMove(idx, moveIdx, { hitModifier: parseInt(e.target.value) || 0 })}
                              className="bg-black/50 h-8 text-sm text-center"
                              aria-label="Hit Modifier"
                            />
                            <Select
                              value={move.damageDie}
                              onValueChange={v => updateMove(idx, moveIdx, { damageDie: v })}
                            >
                              <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAMAGE_DICE.map(d => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={1}
                              value={move.diceCount}
                              onChange={e => updateMove(idx, moveIdx, { diceCount: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="bg-black/50 h-8 text-sm text-center"
                              aria-label="Dice Count"
                            />
                            <Input
                              type="number"
                              value={move.damageModifier}
                              onChange={e => updateMove(idx, moveIdx, { damageModifier: parseInt(e.target.value) || 0 })}
                              className="bg-black/50 h-8 text-sm text-center"
                              aria-label="Damage Modifier"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">None</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {echoes.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground italic text-center py-2">None</p>
        )}
      </div>

      {isAdding && (
        <div className="space-y-3 p-4 bg-background rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <Input
                placeholder="Echo name"
                value={newEcho.name}
                onChange={e => setNewEcho({ ...newEcho, name: e.target.value })}
                className="bg-black/50"
              />
            </div>
            <Input
              type="number"
              min={0}
              value={newEcho.armorClass}
              onChange={e => setNewEcho({ ...newEcho, armorClass: Math.max(0, parseInt(e.target.value) || 0) })}
              className="bg-black/50 text-center"
            />
            <Input
              type="number"
              min={0}
              value={newEcho.healRate}
              onChange={e => setNewEcho({ ...newEcho, healRate: Math.max(0, parseInt(e.target.value) || 0) })}
              className="bg-black/50 text-center"
            />
          </div>
          <Textarea
            placeholder="Description"
            value={newEcho.description}
            onChange={e => setNewEcho({ ...newEcho, description: e.target.value })}
            className="bg-black/50 min-h-[70px]"
          />
          <Button
            onClick={handleAdd}
            disabled={!newEcho.name.trim()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Confirm Add
          </Button>
        </div>
      )}

      <AlertDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIndex(null);
        }}
      >
        <AlertDialogContent className="glass-panel border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-display text-xl">Delete echo?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will remove <span className="text-foreground font-bold">{echoes[pendingDeleteIndex ?? -1]?.name || "this echo"}</span> from the sheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Echo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
