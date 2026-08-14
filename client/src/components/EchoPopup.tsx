import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendWsMessage } from "@/hooks/use-websocket";
import { useAuth } from "@/lib/auth";
import { type Echo, DAMAGE_DICE, MEMORY_CORES, MEMORY_TIERS, WS_EVENTS, type DiceRollPayload } from "@shared/schema";
import { Crosshair, Flame, Plus, Save, X } from "lucide-react";

interface EchoPopupProps {
  echo: Echo;
  children: React.ReactNode;
  canEdit?: boolean;
  onSave?: (echo: Echo) => void;
  onDelete?: () => void;
  startInEditMode?: boolean;
}

const createEmptyMove = () => ({
  name: "",
  description: "",
  hitModifier: 0,
  damageDie: "D6",
  diceCount: 1,
  damageModifier: 0,
});

export function EchoPopup({ echo, children, canEdit = false, onSave, onDelete, startInEditMode = false }: EchoPopupProps) {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Echo>(echo);
  const [isAddingMove, setIsAddingMove] = useState(false);
  const [newMove, setNewMove] = useState(createEmptyMove());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lastMoveRoll, setLastMoveRoll] = useState<{
    type: "hit" | "damage";
    result: string;
    total: number;
    moveName: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsEditing(canEdit && startInEditMode);
    setIsAddingMove(false);
    setNewMove(createEmptyMove());
    setDraft(echo);
    setIsDeleteDialogOpen(false);
    setLastMoveRoll(null);
  }, [open, echo, canEdit, startInEditMode]);

  const updateMove = (
    moveIndex: number,
    updates: Partial<Echo["damageMoves"][number]>,
  ) => {
    const moves = [...draft.damageMoves];
    moves[moveIndex] = { ...moves[moveIndex], ...updates };
    setDraft({ ...draft, damageMoves: moves });
  };

  const removeMove = (moveIndex: number) => {
    const moves = [...draft.damageMoves];
    moves.splice(moveIndex, 1);
    setDraft({ ...draft, damageMoves: moves });
  };

  const handleAddMove = () => {
    if (!newMove.name.trim()) return;
    setDraft({ ...draft, damageMoves: [...draft.damageMoves, { ...newMove }] });
    setNewMove(createEmptyMove());
    setIsAddingMove(false);
  };

  const handleSave = () => {
    const maxHealth = Math.max(1, draft.maxHealth || 1);
    const nextEcho: Echo = {
      ...draft,
      name: draft.name.trim(),
      tier: Math.max(1, Math.min(7, draft.tier || 1)),
      maxHealth,
      currentHealth: Math.max(0, Math.min(maxHealth, draft.currentHealth)),
      healRate: Math.max(0, draft.healRate || 0),
      summonCost: Math.max(0, draft.summonCost || 0),
    };
    onSave?.(nextEcho);
    setDraft(nextEcho);
    setIsEditing(false);
    setIsAddingMove(false);
  };

  const parseDieSides = (die: string): number => parseInt(die.replace("D", ""), 10) || 6;

  const handleMoveHit = (move: Echo["damageMoves"][number], moveIndex: number) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + move.hitModifier;
    const modStr = move.hitModifier >= 0 ? `+${move.hitModifier}` : `${move.hitModifier}`;
    const resultStr = `D20: ${d20} ${modStr}`;
    const moveName = move.name || `Move ${moveIndex + 1}`;
    setLastMoveRoll({ type: "hit", result: resultStr, total, moveName });

    const rollPayload: DiceRollPayload = {
      user: currentUser || "Unknown",
      results: [{
        die: "D20",
        sides: 20,
        rolls: [d20],
        subtotal: total,
      }],
      total,
    };

    sendWsMessage({
      type: WS_EVENTS.DICE_ROLL,
      payload: { ...rollPayload, user: `${currentUser || "Unknown"} (${draft.name} ${moveName} Hit)` },
    });
  };

  const handleMoveDamage = (move: Echo["damageMoves"][number], moveIndex: number) => {
    const sides = parseDieSides(move.damageDie);
    const rolls = Array.from({ length: Math.max(1, move.diceCount) }, () => Math.floor(Math.random() * sides) + 1);
    const rollSum = rolls.reduce((acc, next) => acc + next, 0);
    const total = rollSum + move.damageModifier;
    const modStr = move.damageModifier >= 0 ? `+${move.damageModifier}` : `${move.damageModifier}`;
    const resultStr = `${move.diceCount}${move.damageDie}: ${rolls.join(" + ")} ${modStr}`;
    const moveName = move.name || `Move ${moveIndex + 1}`;
    setLastMoveRoll({ type: "damage", result: resultStr, total, moveName });

    const rollPayload: DiceRollPayload = {
      user: `${currentUser || "Unknown"} (${draft.name} ${moveName} Dmg)`,
      results: [{
        die: move.damageDie,
        sides,
        rolls,
        subtotal: total,
      }],
      total,
    };

    sendWsMessage({ type: WS_EVENTS.DICE_ROLL, payload: rollPayload });
  };

  const handleDelete = () => {
    if (!onDelete) return;
    onDelete();
    setIsDeleteDialogOpen(false);
    setIsEditing(false);
    setIsAddingMove(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="glass-panel border-primary/20 w-[min(95vw,56rem)] max-w-[56rem] h-[min(90vh,44rem)] overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between gap-4 pr-12">
              <DialogTitle className="font-display text-2xl text-primary text-glow flex items-center gap-3">
                {isEditing ? (
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="h-9 bg-black/50 border-primary/30 w-[280px]"
                    placeholder="Echo Name"
                  />
                ) : (
                  <span>{draft.name}</span>
                )}
              </DialogTitle>

              {canEdit && isEditing && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={!onDelete}
                  >
                    Delete Echo
                  </Button>
                  <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Save className="w-4 h-4 mr-2" /> Save Echo
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            <div className="rounded-lg border border-white/20 bg-white/5 p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Core</p>
              {isEditing ? (
                <Select
                  value={draft.core}
                  onValueChange={(v) => setDraft({ ...draft, core: v as Echo["core"] })}
                >
                  <SelectTrigger className="h-8 bg-black/50 border-white/10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMORY_CORES.map((core) => (
                      <SelectItem key={core} value={core}>{core}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-bold text-foreground">{draft.core}</p>
              )}
            </div>
            <div className="rounded-lg border border-white/20 bg-white/5 p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tier</p>
              {isEditing ? (
                <Select
                  value={String(draft.tier)}
                  onValueChange={(v) => {
                    const tier = Math.max(1, Math.min(7, parseInt(v, 10) || 1));
                    setDraft({ ...draft, tier });
                  }}
                >
                  <SelectTrigger className="h-8 bg-black/50 border-white/10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMORY_TIERS.map((tier) => (
                      <SelectItem key={tier} value={String(tier)}>{tier}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-bold text-foreground">{draft.tier}</p>
              )}
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">AC</p>
              {isEditing ? (
                <Input
                  type="number"
                  min={0}
                  value={draft.armorClass}
                  onChange={(e) => setDraft({ ...draft, armorClass: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="h-8 bg-black/50 border-amber-400/30 text-center"
                />
              ) : (
                <p className="text-sm font-bold text-amber-200">{draft.armorClass}</p>
              )}
            </div>
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Max HP</p>
              {isEditing ? (
                <Input
                  type="number"
                  min={1}
                  value={draft.maxHealth}
                  onChange={(e) => {
                    const maxHealth = Math.max(1, parseInt(e.target.value) || 1);
                    const currentHealth = Math.min(draft.currentHealth, maxHealth);
                    setDraft({ ...draft, maxHealth, currentHealth });
                  }}
                  className="h-8 bg-black/50 border-cyan-400/30 text-center"
                />
              ) : (
                <p className="text-sm font-bold text-cyan-200">{draft.maxHealth}</p>
              )}
            </div>
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Current HP</p>
              {isEditing ? (
                <Input
                  type="number"
                  min={0}
                  max={draft.maxHealth}
                  value={draft.currentHealth}
                  onChange={(e) => {
                    const parsed = Math.max(0, parseInt(e.target.value) || 0);
                    setDraft({ ...draft, currentHealth: Math.min(parsed, draft.maxHealth) });
                  }}
                  className="h-8 bg-black/50 border-cyan-400/30 text-center"
                />
              ) : (
                <p className="text-sm font-bold text-cyan-200">{draft.currentHealth}</p>
              )}
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Heal Rate</p>
              {isEditing ? (
                <Input
                  type="number"
                  min={0}
                  value={draft.healRate}
                  onChange={(e) => setDraft({ ...draft, healRate: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="h-8 bg-black/50 border-emerald-400/30 text-center"
                />
              ) : (
                <p className="text-sm font-bold text-emerald-200">{draft.healRate}</p>
              )}
            </div>
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Summon Cost</p>
              {isEditing ? (
                <Input
                  type="number"
                  min={0}
                  value={draft.summonCost}
                  onChange={(e) => setDraft({ ...draft, summonCost: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="h-8 bg-black/50 border-violet-400/30 text-center"
                />
              ) : (
                <p className="text-sm font-bold text-violet-200">{draft.summonCost}</p>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Status</p>
              <p className={`text-sm font-bold ${draft.isSummoned ? "text-cyan-300" : "text-muted-foreground"}`}>
                {draft.isSummoned ? "Summoned" : "Dismissed"}
              </p>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
            <h5 className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-2">Description</h5>
            {isEditing ? (
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="bg-black/50 min-h-[90px]"
                placeholder="Echo description"
              />
            ) : (
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {draft.description || <span className="text-muted-foreground italic">None</span>}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Damage Moves</h5>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setIsAddingMove((prev) => !prev)}
                >
                  {isAddingMove ? (
                    <>
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" /> Add Move
                    </>
                  )}
                </Button>
              )}
            </div>

            {isEditing && isAddingMove && (
              <div className="rounded-lg border border-primary/20 bg-black/30 p-3 space-y-2">
                <Input
                  placeholder="Move Name"
                  value={newMove.name}
                  onChange={(e) => setNewMove({ ...newMove, name: e.target.value })}
                  className="bg-black/50"
                />
                <Textarea
                  placeholder="Move Description"
                  value={newMove.description}
                  onChange={(e) => setNewMove({ ...newMove, description: e.target.value })}
                  className="bg-black/50 min-h-[70px]"
                />
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Hit Modifier</label>
                    <Input
                      type="number"
                      value={newMove.hitModifier}
                      onChange={(e) => setNewMove({ ...newMove, hitModifier: parseInt(e.target.value) || 0 })}
                      className="bg-black/50 h-8 text-sm text-center"
                      aria-label="Hit Modifier"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Damage Die</label>
                    <Select
                      value={newMove.damageDie}
                      onValueChange={(v) => setNewMove({ ...newMove, damageDie: v })}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAMAGE_DICE.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Dice Count</label>
                    <Input
                      type="number"
                      min={1}
                      value={newMove.diceCount}
                      onChange={(e) => setNewMove({ ...newMove, diceCount: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="bg-black/50 h-8 text-sm text-center"
                      aria-label="Dice Count"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Damage Modifier</label>
                    <Input
                      type="number"
                      value={newMove.damageModifier}
                      onChange={(e) => setNewMove({ ...newMove, damageModifier: parseInt(e.target.value) || 0 })}
                      className="bg-black/50 h-8 text-sm text-center"
                      aria-label="Damage Modifier"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleAddMove}
                  disabled={!newMove.name.trim()}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Confirm Add Move
                </Button>
              </div>
            )}

            {draft.damageMoves.length > 0 ? (
              <div className="space-y-2">
                {draft.damageMoves.map((move, idx) => (
                  <div key={idx} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                    {isEditing ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Move name"
                            value={move.name}
                            onChange={(e) => updateMove(idx, { name: e.target.value })}
                            className="bg-black/50"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMove(idx)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Move description"
                          value={move.description}
                          onChange={(e) => updateMove(idx, { description: e.target.value })}
                          className="bg-black/50 min-h-[70px]"
                        />
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Hit Modifier</label>
                            <Input
                              type="number"
                              value={move.hitModifier}
                              onChange={(e) => updateMove(idx, { hitModifier: parseInt(e.target.value) || 0 })}
                              className="bg-black/50 h-8 text-sm text-center"
                              aria-label="Hit Modifier"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Damage Die</label>
                            <Select
                              value={move.damageDie}
                              onValueChange={(v) => updateMove(idx, { damageDie: v })}
                            >
                              <SelectTrigger className="bg-black/50 border-white/10 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAMAGE_DICE.map((d) => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Dice Count</label>
                            <Input
                              type="number"
                              min={1}
                              value={move.diceCount}
                              onChange={(e) => updateMove(idx, { diceCount: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="bg-black/50 h-8 text-sm text-center"
                              aria-label="Dice Count"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Damage Modifier</label>
                            <Input
                              type="number"
                              value={move.damageModifier}
                              onChange={(e) => updateMove(idx, { damageModifier: parseInt(e.target.value) || 0 })}
                              className="bg-black/50 h-8 text-sm text-center"
                              aria-label="Damage Modifier"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {(() => {
                          const moveName = move.name || `Move ${idx + 1}`;
                          return (
                            <>
                              <p className="text-sm font-bold text-foreground">{moveName}</p>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                {move.description || <span className="italic">No description.</span>}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Hit: D20{move.hitModifier >= 0 ? "+" : ""}{move.hitModifier}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Damage: {move.diceCount}{move.damageDie}{move.damageModifier >= 0 ? "+" : ""}{move.damageModifier}
                              </p>
                              {canEdit && (
                                <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                                      onClick={() => handleMoveHit(move, idx)}
                                    >
                                      <Crosshair className="w-3 h-3 mr-1" />
                                      Hit (D20{move.hitModifier >= 0 ? "+" : ""}{move.hitModifier})
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                      onClick={() => handleMoveDamage(move, idx)}
                                    >
                                      <Flame className="w-3 h-3 mr-1" />
                                      Dmg ({move.diceCount}{move.damageDie}{move.damageModifier >= 0 ? "+" : ""}{move.damageModifier})
                                    </Button>
                                  </div>
                                  {lastMoveRoll && lastMoveRoll.moveName === moveName && (
                                    <div className="text-center p-2 bg-black/40 rounded-lg border border-white/5">
                                      <span className="text-xs text-muted-foreground uppercase tracking-widest">
                                        {lastMoveRoll.type === "hit" ? "Hit Roll" : "Damage Roll"}
                                      </span>
                                      <p className="text-sm text-foreground mt-1">{lastMoveRoll.result}</p>
                                      <p className="text-xl font-display font-bold text-primary mt-1">
                                        = {lastMoveRoll.total}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">None</p>
            )}
            </div>
          </div>
        </div>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="glass-panel border-destructive/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive font-display text-xl">Delete echo?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will remove <span className="text-foreground font-bold">{draft.name || "this echo"}</span> from the sheet.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Echo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
