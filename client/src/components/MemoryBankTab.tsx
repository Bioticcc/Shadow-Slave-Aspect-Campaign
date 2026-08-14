import { useEffect, useMemo, useState } from "react";
import { type Character, type Memory, normalizeMemory } from "@shared/schema";
import {
  useAssignBankMemory,
  useCreateMemoryBankMemory,
  useDeassignCharacterMemory,
  useMemoryBankEntries,
  useUpdateBankMemory,
  useUpdateCharacterMemoryFromBank,
} from "@/hooks/use-memory-bank";
import { MemoryEditor } from "@/components/MemoryEditor";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function createDefaultMemory(): Memory {
  return {
    name: "",
    description: "",
    effect: "",
    memoryType: "tool",
    core: "dormant",
    tier: 1,
    essenceCost: 0,
    isDamageDealing: false,
    currentDurability: 10,
    maxDurability: 10,
    healRate: 1,
    isSummoned: false,
  };
}

export function MemoryBankTab({ characters }: { characters: Character[] }) {
  const { data: entries, isLoading, error } = useMemoryBankEntries(true);
  const createMemory = useCreateMemoryBankMemory();
  const updateCharacterMemory = useUpdateCharacterMemoryFromBank();
  const updateBankMemory = useUpdateBankMemory();
  const deassignMemory = useDeassignCharacterMemory();
  const assignMemory = useAssignBankMemory();

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [assignTargetId, setAssignTargetId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const orderedEntries = useMemo(() => {
    const list = entries || [];
    return [...list].sort((a, b) => {
      const ownerA = a.ownerUsername || "ZZZ";
      const ownerB = b.ownerUsername || "ZZZ";
      if (ownerA !== ownerB) return ownerA.localeCompare(ownerB);
      return a.memory.name.localeCompare(b.memory.name);
    });
  }, [entries]);

  const selectedEntry = useMemo(
    () => orderedEntries.find((entry) => entry.bankId === selectedBankId) || null,
    [orderedEntries, selectedBankId],
  );

  useEffect(() => {
    if (selectedEntry) {
      setEditingMemory(normalizeMemory(selectedEntry.memory));
      setIsCreating(false);
    }
  }, [selectedEntry]);

  const saveDisabled = !editingMemory || !editingMemory.name.trim();
  const busy = createMemory.isPending || updateCharacterMemory.isPending || updateBankMemory.isPending || deassignMemory.isPending || assignMemory.isPending;

  const handleSave = async () => {
    if (!editingMemory || !selectedEntry) return;
    const normalized = normalizeMemory(editingMemory);
    if (selectedEntry.source === "character" && selectedEntry.ownerCharacterId !== null && selectedEntry.memoryIndex !== null) {
      await updateCharacterMemory.mutateAsync({
        characterId: selectedEntry.ownerCharacterId,
        memoryIndex: selectedEntry.memoryIndex,
        memory: normalized,
      });
      return;
    }
    if (selectedEntry.source === "bank" && selectedEntry.unownedId !== null) {
      await updateBankMemory.mutateAsync({
        bankId: selectedEntry.unownedId,
        memory: normalized,
      });
    }
  };

  const handleCreate = async () => {
    if (!editingMemory || !editingMemory.name.trim()) return;
    const normalized = normalizeMemory(editingMemory);
    normalized.isSummoned = false;
    await createMemory.mutateAsync(normalized);
    setIsCreating(false);
    setEditingMemory(null);
  };

  const handleDeassign = async () => {
    if (!selectedEntry || selectedEntry.source !== "character" || selectedEntry.ownerCharacterId === null || selectedEntry.memoryIndex === null) return;
    await deassignMemory.mutateAsync({
      characterId: selectedEntry.ownerCharacterId,
      memoryIndex: selectedEntry.memoryIndex,
    });
    setSelectedBankId(null);
    setEditingMemory(null);
  };

  const handleAssign = async () => {
    if (!selectedEntry || selectedEntry.source !== "bank" || selectedEntry.unownedId === null) return;
    const characterId = Number(assignTargetId);
    if (!Number.isFinite(characterId)) return;
    await assignMemory.mutateAsync({ bankId: selectedEntry.unownedId, characterId });
    setAssignTargetId("");
    setSelectedBankId(null);
    setEditingMemory(null);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading memory bank...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl text-primary">Memory Bank</h3>
          <p className="text-sm text-muted-foreground">DM-only memory catalog for owned and unowned memories.</p>
        </div>
        <Button
          onClick={() => {
            setIsCreating(true);
            setSelectedBankId(null);
            setEditingMemory(createDefaultMemory());
          }}
          data-testid="button-memory-bank-create"
        >
          Create Unowned Memory
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-4">
        <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
          {orderedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No memories found.</p>
          ) : (
            orderedEntries.map((entry) => (
              <button
                key={entry.bankId}
                type="button"
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedBankId === entry.bankId ? "border-primary bg-primary/10" : "border-white/10 bg-black/30 hover:bg-black/45"
                }`}
                onClick={() => setSelectedBankId(entry.bankId)}
                data-testid={`memory-bank-entry-${entry.bankId}`}
              >
                <p className="font-medium text-foreground">{entry.memory.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Owner: {entry.ownerCharacterName ? `${entry.ownerCharacterName} (${entry.ownerUsername})` : "Unowned (Memory Bank)"}
                </p>
                <p className="text-xs text-muted-foreground">Type: {entry.memory.memoryType} • Core: {entry.memory.core}</p>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
          {isCreating ? (
            <>
              <h4 className="text-lg font-display text-primary">Create Unowned Memory</h4>
              {editingMemory && (
                <MemoryEditor
                  memories={[editingMemory]}
                  onChange={(next) => setEditingMemory(next[0] ? normalizeMemory(next[0]) : null)}
                />
              )}
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={saveDisabled || busy}>Save to Memory Bank</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingMemory(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : selectedEntry && editingMemory ? (
            <>
              <div className="space-y-1">
                <h4 className="text-lg font-display text-primary">Edit Memory</h4>
                <p className="text-xs text-muted-foreground">
                  Owner: {selectedEntry.ownerCharacterName ? `${selectedEntry.ownerCharacterName} (${selectedEntry.ownerUsername})` : "Unowned (Memory Bank)"}
                </p>
              </div>

              <MemoryEditor
                memories={[editingMemory]}
                onChange={(next) => setEditingMemory(next[0] ? normalizeMemory(next[0]) : null)}
              />

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saveDisabled || busy}>Save Memory</Button>
                {selectedEntry.source === "character" && (
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={handleDeassign}
                    disabled={busy}
                  >
                    Deassign to Memory Bank
                  </Button>
                )}
              </div>

              {selectedEntry.source === "bank" && selectedEntry.unownedId !== null && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Assign to Character</p>
                  <div className="flex gap-2">
                    <Select value={assignTargetId} onValueChange={setAssignTargetId}>
                      <SelectTrigger className="bg-black/50 border-white/10">
                        <SelectValue placeholder="Choose character" />
                      </SelectTrigger>
                      <SelectContent>
                        {characters.map((character) => (
                          <SelectItem key={character.id} value={String(character.id)}>
                            {character.name} ({character.owner})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAssign} disabled={!assignTargetId || busy}>Assign</Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a memory from the bank list to edit it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
