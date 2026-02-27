import { useState, useEffect } from "react";
import { type Character } from "@shared/schema";
import { useUpdateCharacter } from "@/hooks/use-characters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Save, Minus, Plus, Gem, Star, Shield, Dna } from "lucide-react";
import { TraitPopup } from "./TraitPopup";
import { TraitEditor } from "./TraitEditor";

const RANKS = ["Dreamer", "Awakened", "Master", "Saint", "Sovreign", "##??!??!??!_Null_UnKnown"];
const SOUL_CORES = ["Dormant"];
const ASPECT_RANKS = ["Divine"];

export function CharacterSheet({ 
  character, 
  open, 
  onOpenChange 
}: { 
  character: Character;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Character>>(character);
  const updateChar = useUpdateCharacter();

  // Reset edit data when opened or character changes
  useEffect(() => {
    if (open) {
      setEditData(character);
      setIsEditing(false);
    }
  }, [open, character]);

  const handleSave = () => {
    updateChar.mutate({ id: character.id, updates: editData }, {
      onSuccess: () => setIsEditing(false)
    });
  };

  const instantUpdate = (updates: Partial<Character>) => {
    updateChar.mutate({ id: character.id, updates });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col border-primary/30">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
        
        <DialogHeader className="p-6 pb-2 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="font-display text-3xl font-bold rank-gradient text-glow">
              {isEditing ? (
                <Input 
                  value={editData.name} 
                  onChange={e => setEditData({...editData, name: e.target.value})}
                  className="text-2xl font-display bg-black/50 border-primary/50 w-[300px]"
                />
              ) : character.name}
            </DialogTitle>
            <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-widest flex items-center gap-2">
              <Star className="w-3 h-3 text-primary" />
              {isEditing ? (
                <Input 
                  value={editData.trueName} 
                  onChange={e => setEditData({...editData, trueName: e.target.value})}
                  className="h-7 text-xs bg-black/50 border-primary/30 inline-block w-[200px]"
                  placeholder="True Name"
                />
              ) : character.trueName}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {isEditing ? (
              <Button onClick={handleSave} disabled={updateChar.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" /> {updateChar.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)} className="border-primary/50 text-primary hover:bg-primary/10">
                <Edit2 className="w-4 h-4 mr-2" /> Edit Sheet
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: Vitals & Core Stats */}
            <div className="space-y-8">
              {/* Health Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px] pointer-events-none" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-destructive" /> Vitality
                </h4>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-display font-bold text-foreground">
                    {character.currentHealth} <span className="text-muted-foreground text-xl">/ {isEditing ? 
                      <Input 
                        type="number" 
                        value={editData.maxHealth} 
                        onChange={e => setEditData({...editData, maxHealth: parseInt(e.target.value) || 0})}
                        className="w-16 inline-block h-8 px-2 text-center"
                      /> : character.maxHealth}</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => instantUpdate({ currentHealth: Math.max(0, character.currentHealth - 1) })}
                    disabled={isEditing || character.currentHealth <= 0}
                  >
                    <Minus className="w-4 h-4 mr-1" /> DMG
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => instantUpdate({ currentHealth: Math.min(character.maxHealth, character.currentHealth + 1) })}
                    disabled={isEditing || character.currentHealth >= character.maxHealth}
                  >
                    <Plus className="w-4 h-4 mr-1" /> HEAL
                  </Button>
                </div>
              </div>

              {/* Soul Fragments Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] pointer-events-none" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Gem className="w-4 h-4 text-blue-400" /> Soul Fragments
                </h4>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-display font-bold text-blue-100">
                    {character.soulFragments} <span className="text-muted-foreground text-sm font-sans font-normal">/ 1000</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-1"
                    onClick={() => instantUpdate({ soulFragments: Math.max(0, character.soulFragments - 1) })}
                    disabled={isEditing || character.soulFragments <= 0}
                  >- 1</Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-1"
                    onClick={() => instantUpdate({ soulFragments: character.soulFragments + 1 })}
                    disabled={isEditing}
                  >+ 1</Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-1"
                    onClick={() => instantUpdate({ soulFragments: character.soulFragments + 10 })}
                    disabled={isEditing}
                  >+ 10</Button>
                </div>
              </div>

              {/* Status Block */}
              <div className="bg-black/30 rounded-xl p-5 border border-white/5 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rank</label>
                  {isEditing ? (
                    <Select value={editData.rank} onValueChange={(v) => setEditData({...editData, rank: v})}>
                      <SelectTrigger className="mt-1 bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-lg font-display text-primary mt-1">{character.rank}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Soul Core</label>
                  {isEditing ? (
                    <Select value={editData.soulCore} onValueChange={(v) => setEditData({...editData, soulCore: v})}>
                      <SelectTrigger className="mt-1 bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOUL_CORES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-lg font-display text-foreground mt-1">{character.soulCore}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Echoes</label>
                  {isEditing ? (
                    <Input 
                      value={editData.echoes} 
                      onChange={e => setEditData({...editData, echoes: e.target.value})}
                      className="mt-1 bg-black/50 border-white/10"
                    />
                  ) : (
                    <p className="text-md text-foreground mt-1">{character.echoes || <span className="text-muted-foreground italic">None</span>}</p>
                  )}
                </div>
              </div>
            </div>

            {/* MIDDLE & RIGHT COLUMNS: Traits, Aspect, Memories */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Aspect Block */}
              <div className="bg-gradient-to-br from-primary/5 to-transparent rounded-xl p-6 border border-primary/20">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80 flex items-center gap-2 mb-1">
                      <Dna className="w-4 h-4" /> Aspect
                    </h3>
                    {isEditing ? (
                      <div className="flex gap-4 mt-2">
                        <Input 
                          value={editData.aspect} 
                          onChange={e => setEditData({...editData, aspect: e.target.value})}
                          className="bg-black/50 border-primary/30 font-display text-xl w-[250px]"
                          placeholder="Aspect Name"
                        />
                        <Select value={editData.aspectRank} onValueChange={(v) => setEditData({...editData, aspectRank: v})}>
                          <SelectTrigger className="bg-black/50 border-primary/30 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASPECT_RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-2xl font-display font-bold text-foreground">{character.aspect || "None"}</h2>
                        {character.aspectRank && <span className="text-xs font-bold uppercase tracking-widest text-primary border border-primary/30 px-2 py-0.5 rounded-full">{character.aspectRank}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  {isEditing ? (
                    <Textarea 
                      value={editData.aspectAbilityDescription} 
                      onChange={e => setEditData({...editData, aspectAbilityDescription: e.target.value})}
                      className="bg-black/50 border-primary/30 min-h-[100px]"
                      placeholder="Aspect Poem / Description"
                    />
                  ) : (
                    character.aspectAbilityDescription && (
                      <p className="text-muted-foreground italic font-serif leading-relaxed border-l-2 border-primary/30 pl-4 py-1">
                        "{character.aspectAbilityDescription}"
                      </p>
                    )
                  )}
                </div>

                {isEditing ? (
                  <TraitEditor 
                    title="Aspect Abilities" 
                    traits={editData.aspectAbilities || []} 
                    onChange={t => setEditData({...editData, aspectAbilities: t})} 
                  />
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Abilities</h4>
                    {character.aspectAbilities.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {character.aspectAbilities.map((ability, i) => (
                          <TraitPopup key={i} trait={ability}>
                            <Button variant="outline" className="bg-black/40 border-primary/20 hover:border-primary/50 text-foreground hover:text-primary transition-all">
                              {ability.name}
                            </Button>
                          </TraitPopup>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground italic">No abilities manifested.</p>}
                  </div>
                )}
              </div>

              {/* Attributes & Memories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Attributes */}
                <div className="space-y-4">
                  <h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Attributes</h3>
                  {isEditing ? (
                    <TraitEditor 
                      title="Edit Attributes" 
                      traits={editData.attributes || []} 
                      onChange={t => setEditData({...editData, attributes: t})} 
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {character.attributes.length > 0 ? character.attributes.map((attr, i) => (
                        <TraitPopup key={i} trait={attr}>
                          <div className="p-3 bg-secondary/30 border border-white/5 rounded-lg cursor-pointer hover:bg-secondary/50 hover:border-white/10 transition-all">
                            <p className="font-medium text-sm text-foreground">{attr.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{attr.effect}</p>
                          </div>
                        </TraitPopup>
                      )) : <p className="text-sm text-muted-foreground italic">None</p>}
                    </div>
                  )}
                </div>

                {/* Memories */}
                <div className="space-y-4">
                  <h3 className="text-lg font-display text-foreground border-b border-white/10 pb-2">Memories</h3>
                  {isEditing ? (
                    <TraitEditor 
                      title="Edit Memories" 
                      traits={editData.memories || []} 
                      onChange={t => setEditData({...editData, memories: t})} 
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {character.memories.length > 0 ? character.memories.map((mem, i) => (
                        <TraitPopup key={i} trait={mem}>
                          <div className="p-3 bg-secondary/30 border border-white/5 rounded-lg cursor-pointer hover:bg-secondary/50 hover:border-white/10 transition-all">
                            <p className="font-medium text-sm text-foreground">{mem.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{mem.effect}</p>
                          </div>
                        </TraitPopup>
                      )) : <p className="text-sm text-muted-foreground italic">None</p>}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
