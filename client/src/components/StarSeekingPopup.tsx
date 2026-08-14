import { useState } from "react";
import { WS_EVENTS, type CharacterStats, type DiceRollPayload, type StarSeekingForm, type StarSeekingLimb, type Trait } from "@shared/schema";
import { Crosshair, Flame, Hand, HelpCircle, Shield, Sparkles, Star, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { sendWsMessage } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";

type RollResult = { limbId: string; label: string; expression: string; total: number };

const ABILITY_LABELS: Record<keyof CharacterStats, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
};

function FormIcon({ form }: { form: StarSeekingForm }) {
  const Icon = form.id === "arm" ? Hand : form.id === "sword" ? Swords : form.id === "shield" ? Shield : Sparkles;
  return <Icon className="h-4 w-4 text-amber-300" />;
}

export function StarSeekingPopup({
  trait,
  children,
  onChangeForm,
  canRoll = false,
  stats,
  proficiencyBonus,
}: {
  trait: Trait;
  children: React.ReactNode;
  onChangeForm?: (limbId: string, formId: string) => void;
  canRoll?: boolean;
  stats: CharacterStats;
  proficiencyBonus: number;
}) {
  const { currentUser } = useAuth();
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const limbs = trait.starSeeking?.limbs || [];

  const getHitModifier = (limb: StarSeekingLimb) => (
    (stats[limb.attackAttribute] ?? 0)
    + (limb.isProficient ? proficiencyBonus : 0)
    + limb.hitModifier
  );

  const rollHit = (limb: StarSeekingLimb) => {
    const hitModifier = getHitModifier(limb);
    const die = Math.floor(Math.random() * 20) + 1;
    const total = die + hitModifier;
    const sign = hitModifier >= 0 ? "+" : "";
    setLastRoll({ limbId: limb.id, label: "Hit Connection", expression: `D20: ${die} ${sign}${hitModifier}`, total });
    const payload: DiceRollPayload = {
      user: `${currentUser || "Unknown"} (Star Seeking Hit)`,
      results: [{ die: "D20", sides: 20, rolls: [die], subtotal: total }],
      total,
    };
    sendWsMessage({ type: WS_EVENTS.DICE_ROLL, payload });
  };

  const rollDamage = (limb: StarSeekingLimb, damageType: string) => {
    const sides = Number.parseInt(limb.damageDie.replace(/D/i, ""), 10) || 6;
    const rolls = Array.from({ length: limb.diceCount }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + limb.damageModifier;
    const sign = limb.damageModifier >= 0 ? "+" : "";
    setLastRoll({ limbId: limb.id, label: `${damageType} Damage`, expression: `${limb.diceCount}${limb.damageDie}: ${rolls.join(" + ")} ${sign}${limb.damageModifier}`, total });
    const payload: DiceRollPayload = {
      user: `${currentUser || "Unknown"} (Star Seeking ${damageType} Damage)`,
      results: [{ die: limb.damageDie, sides, rolls, subtotal: total }],
      total,
    };
    sendWsMessage({ type: WS_EVENTS.DICE_ROLL, payload });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass-panel border-amber-300/35 w-[min(92vw,63rem)] max-w-[63rem] h-[min(88vh,43rem)] overflow-hidden gap-0 grid-rows-[auto_minmax(0,1fr)] shadow-[0_0_50px_rgba(251,191,36,0.12)]">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 font-display text-2xl text-amber-200 text-glow">
            <Star className="h-5 w-5 fill-amber-300/30 text-amber-300" /> {trait.name}
          </DialogTitle>
          {trait.description && <p className="pt-2 text-sm italic text-muted-foreground whitespace-pre-wrap">{trait.description}</p>}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto border-t border-amber-300/15 pt-5 space-y-5">
          {limbs.map((limb) => {
            const activeForm = limb.forms.find((form) => form.id === limb.activeFormId) || limb.forms[0];
            const hitModifier = getHitModifier(limb);
            return (
              <section key={limb.id} className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/10 via-black/25 to-yellow-700/5 p-5 shadow-[inset_0_1px_0_rgba(253,230,138,0.06)]">
                <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-xl text-amber-100">Heavenly {limb.name}</p>
                      {limb.effect && <p className="mt-1 text-sm text-muted-foreground">{limb.effect}</p>}
                    </div>
                    <Sparkles className="h-5 w-5 shrink-0 text-amber-300/70" />
                  </div>

                  <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-amber-300/15 bg-black/20 p-3"><p className="text-[9px] uppercase tracking-widest text-amber-300/60">Replacement</p><p className="mt-1 text-sm text-amber-50">{limb.replacement}</p></div>
                    <div className="rounded-lg border border-amber-300/15 bg-black/20 p-3"><p className="text-[9px] uppercase tracking-widest text-amber-300/60">Attack Attribute</p><p className="mt-1 text-sm text-amber-50">{ABILITY_LABELS[limb.attackAttribute]}</p></div>
                    <div className="rounded-lg border border-amber-300/15 bg-black/20 p-3"><p className="text-[9px] uppercase tracking-widest text-amber-300/60">Training</p><p className="mt-1 text-sm text-amber-50">Proficient</p></div>
                  </div>

                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-amber-300/70">Manifested Form</h3>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Transform · {limb.transformEssenceCost} Essence</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {limb.forms.map((form) => {
                      const active = activeForm?.id === form.id;
                      return (
                        <button
                          key={form.id}
                          type="button"
                          disabled={!onChangeForm || active}
                          onClick={() => onChangeForm?.(limb.id, form.id)}
                          className={cn(
                            "rounded-xl border p-4 text-left transition-all disabled:cursor-default",
                            active ? "border-amber-300/60 bg-gradient-to-br from-amber-400/20 to-yellow-600/5 shadow-[0_0_24px_rgba(251,191,36,0.12)]" : "border-white/5 bg-secondary/20 hover:border-amber-300/25 hover:bg-amber-400/5",
                          )}
                        >
                          <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-display text-lg text-amber-100"><FormIcon form={form} /> {form.name}</span><span className="text-xs font-bold text-amber-300">+{form.armorBonus} AC</span></div>
                          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{form.description}</p>
                          {form.hasUnknownEffect && (
                            <div className="mt-3 flex items-center gap-2 border-t border-amber-300/10 pt-3 text-xs text-amber-200/70"><HelpCircle className="h-3.5 w-3.5" /><span className="select-none blur-[3px]">????????????</span></div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {activeForm?.isWeapon && (
                    <div className="mt-4 rounded-xl border border-amber-300/20 bg-black/20 p-4">
                      <div className="mb-3"><p className="font-display text-lg text-amber-100">Celestial {activeForm.name}</p><p className="text-xs text-muted-foreground">{ABILITY_LABELS[limb.attackAttribute]} attack · Proficient · {activeForm.damageType || "Fire"} damage</p></div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="outline" disabled={!canRoll} onClick={() => rollHit(limb)} className="flex-1 border-amber-300/35 text-amber-200 hover:bg-amber-400/10"><Crosshair className="mr-2 h-4 w-4" /> Hit (D20{hitModifier >= 0 ? "+" : ""}{hitModifier})</Button>
                        <Button type="button" variant="outline" disabled={!canRoll} onClick={() => rollDamage(limb, activeForm.damageType || "Fire")} className="flex-1 border-red-400/35 text-red-300 hover:bg-red-500/10"><Flame className="mr-2 h-4 w-4" /> {activeForm.damageType || "Fire"} ({limb.diceCount}{limb.damageDie}{limb.damageModifier >= 0 ? "+" : ""}{limb.damageModifier})</Button>
                      </div>
                      {lastRoll?.limbId === limb.id && (
                        <div className="mt-3 rounded-lg border border-amber-300/15 bg-black/35 p-3 text-center"><p className="text-[9px] uppercase tracking-widest text-amber-300/60">{lastRoll.label}</p><p className="mt-1 text-sm text-foreground">{lastRoll.expression}</p><p className="mt-1 font-display text-2xl text-amber-200">= {lastRoll.total}</p></div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
