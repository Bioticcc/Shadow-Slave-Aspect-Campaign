import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CharacterStats, Memory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MemoryDetail, MemoryPopup, MEMORY_TYPE_ICONS, MEMORY_TYPE_LABELS } from "./MemoryPopup";

interface MemoryEditorProps {
  memories: Memory[];
  onChange: (memories: Memory[]) => void;
  proficiencyBonus?: number;
  stats?: CharacterStats;
  title?: string;
  onMoveToBank?: (memory: Memory) => void;
  renderAccessory?: (index: number) => React.ReactNode;
  onItemClickCapture?: (event: React.MouseEvent<HTMLDivElement>, index: number) => void;
}

const createMemory = (): Memory => ({
  name: "", description: "", effect: "", memoryType: "tool", core: "dormant", tier: 1,
  essenceCost: 0, isDamageDealing: false, currentDurability: 10, maxDurability: 10,
  healRate: 1, isSummoned: false,
});

export function MemoryEditor({ memories, onChange, proficiencyBonus = 0, stats, title = "Memories", onMoveToBank, renderAccessory, onItemClickCapture }: MemoryEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Memory>(createMemory());
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const updateAt = (index: number, memory: Memory) => onChange(memories.map((item, itemIndex) => itemIndex === index ? memory : item));
  const removeAt = (index: number) => onChange(memories.filter((_, itemIndex) => itemIndex !== index));
  const confirmDelete = () => {
    if (pendingDeleteIndex === null) return;
    removeAt(pendingDeleteIndex);
    setPendingDeleteIndex(null);
  };
  const moveToBank = () => {
    if (pendingDeleteIndex === null || !onMoveToBank) return;
    const memory = memories[pendingDeleteIndex];
    if (!memory) return;
    onMoveToBank({ ...memory, isSummoned: false });
    removeAt(pendingDeleteIndex);
    setPendingDeleteIndex(null);
  };
  const closeAdd = () => { setAdding(false); setDraft(createMemory()); };
  const add = () => {
    if (!draft.name.trim()) return;
    onChange([...memories, { ...draft, name: draft.name.trim() }]);
    closeAdd();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex-1 border-b border-white/10 pb-2 font-display text-lg text-foreground">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="mb-2 h-7 border-primary/30 text-primary hover:bg-primary/10"><Plus className="mr-1 h-3 w-3" /> Add Memory</Button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {memories.map((memory, index) => {
          const Icon = MEMORY_TYPE_ICONS[memory.memoryType];
          return (
            <div key={index} className="relative rounded-lg border border-white/5 bg-secondary/30 transition-all hover:border-white/10 hover:bg-secondary/50" onClickCapture={(event) => onItemClickCapture?.(event, index)}>
              <MemoryPopup memory={memory} editing onChange={(next) => updateAt(index, next)} proficiencyBonus={proficiencyBonus} stats={stats}>
                <button type="button" className="w-full cursor-pointer p-3 pr-11 text-left">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0" /><p className="truncate text-sm font-medium text-foreground">{memory.name || `Memory ${index + 1}`}</p><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{MEMORY_TYPE_LABELS[memory.memoryType]}</span></div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{memory.effect || "No effect."}</p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{memory.core} · Tier {memory.tier} · {memory.currentDurability}/{memory.maxDurability} durability</p>
                </button>
              </MemoryPopup>
              <Button type="button" variant="ghost" size="icon" onClick={() => setPendingDeleteIndex(index)} className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${memory.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
              {renderAccessory?.(index)}
            </div>
          );
        })}
        {memories.length === 0 && <p className="py-2 text-center text-sm italic text-muted-foreground">None</p>}
      </div>

      <Dialog open={adding} onOpenChange={(open) => open ? setAdding(true) : closeAdd()}>
        <DialogContent className="glass-panel grid h-[min(90vh,48rem)] w-[min(95vw,63rem)] max-w-[63rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden gap-0 p-0">
          <DialogHeader className="border-b border-white/10 px-6 pb-4 pt-6"><DialogTitle className="font-display text-2xl text-primary">Add Memory</DialogTitle></DialogHeader>
          <div className="min-h-0 overflow-y-auto p-6"><MemoryDetail memory={draft} editing onChange={setDraft} proficiencyBonus={proficiencyBonus} stats={stats} /></div>
          <DialogFooter className="border-t border-white/10 px-6 py-4"><Button variant="ghost" onClick={closeAdd}>Cancel</Button><Button onClick={add} disabled={!draft.name.trim()}>Add Memory</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDeleteIndex !== null} onOpenChange={(open) => { if (!open) setPendingDeleteIndex(null); }}>
        <AlertDialogContent className="glass-panel border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl text-destructive">Remove memory?</AlertDialogTitle>
            <AlertDialogDescription>Choose whether to permanently delete <span className="font-bold text-foreground">{memories[pendingDeleteIndex ?? -1]?.name || "this memory"}</span> or preserve it in the Memory Bank.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {onMoveToBank && <Button type="button" variant="outline" onClick={moveToBank} className="border-primary/40 text-primary hover:bg-primary/10">Move to Memory Bank</Button>}
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
