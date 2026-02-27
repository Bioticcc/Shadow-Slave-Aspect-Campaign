import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CharacterInput, type CharacterUpdateInput } from "@shared/routes";

export function useCharacters() {
  return useQuery({
    queryKey: [api.characters.list.path],
    queryFn: async () => {
      const res = await fetch(api.characters.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch characters");
      return api.characters.list.responses[200].parse(await res.json());
    },
  });
}

export function useCharacter(id: number) {
  return useQuery({
    queryKey: [api.characters.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.characters.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch character");
      return api.characters.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CharacterInput) => {
      const res = await fetch(api.characters.create.path, {
        method: api.characters.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create character");
      }
      return api.characters.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.characters.list.path] });
    },
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: CharacterUpdateInput }) => {
      const url = buildUrl(api.characters.update.path, { id });
      const res = await fetch(url, {
        method: api.characters.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update character");
      }
      return api.characters.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Optimistic update handled by WS usually, but update cache locally just in case
      queryClient.setQueryData(
        [api.characters.list.path],
        (old: any) => old?.map((c: any) => c.id === data.id ? data : c)
      );
      queryClient.setQueryData([api.characters.get.path, data.id], data);
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.characters.delete.path, { id });
      const res = await fetch(url, {
        method: api.characters.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete character");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.characters.list.path] });
    },
  });
}
