import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type Memory, type MemoryBankEntry, normalizeMemory } from "@shared/schema";

const MEMORY_BANK_QUERY_KEY = ["/api/memory-bank"] as const;

function normalizeEntry(entry: MemoryBankEntry): MemoryBankEntry {
  return {
    ...entry,
    memory: normalizeMemory(entry.memory),
  };
}

export function useMemoryBankEntries(enabled = true) {
  return useQuery({
    queryKey: MEMORY_BANK_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/memory-bank", { credentials: "include" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch memory bank");
      }
      const data = await res.json() as MemoryBankEntry[];
      return data.map(normalizeEntry);
    },
  });
}

function invalidateMemoryBankAndCharacters(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: MEMORY_BANK_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: [api.characters.list.path] });
}

export function useCreateMemoryBankMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memory: Memory) => {
      const res = await fetch("/api/memory-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memory),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create memory bank memory");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMemoryBankAndCharacters(queryClient);
    },
  });
}

export function useUpdateCharacterMemoryFromBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ characterId, memoryIndex, memory }: { characterId: number; memoryIndex: number; memory: Memory }) => {
      const res = await fetch(`/api/memory-bank/character/${characterId}/${memoryIndex}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memory),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update character memory");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMemoryBankAndCharacters(queryClient);
    },
  });
}

export function useDeassignCharacterMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ characterId, memoryIndex }: { characterId: number; memoryIndex: number }) => {
      const res = await fetch(`/api/memory-bank/character/${characterId}/${memoryIndex}/deassign`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to deassign memory");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMemoryBankAndCharacters(queryClient);
    },
  });
}

export function useUpdateBankMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bankId, memory }: { bankId: number; memory: Memory }) => {
      const res = await fetch(`/api/memory-bank/bank/${bankId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memory),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update bank memory");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMemoryBankAndCharacters(queryClient);
    },
  });
}

export function useAssignBankMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bankId, characterId }: { bankId: number; characterId: number }) => {
      const res = await fetch(`/api/memory-bank/bank/${bankId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to assign bank memory");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMemoryBankAndCharacters(queryClient);
    },
  });
}
