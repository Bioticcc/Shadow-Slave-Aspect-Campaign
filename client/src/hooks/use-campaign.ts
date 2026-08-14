import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CampaignStateResponse } from "@shared/routes";

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  const contentType = (res.headers.get("content-type") || "").toLowerCase();

  if (!contentType.includes("application/json")) {
    if (text.trim().startsWith("<!DOCTYPE")) {
      throw new Error("Campaign API returned HTML. Restart the dev server and try again.");
    }
    throw new Error(text || `Unexpected response format (${res.status})`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Received invalid JSON from campaign API.");
  }
}

export function useCampaignState() {
  return useQuery({
    queryKey: [api.campaign.state.path],
    queryFn: async () => {
      const res = await fetch(api.campaign.state.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaign state");
      return api.campaign.state.responses[200].parse(await readJsonOrThrow(res));
    },
  });
}

export function useUpdateCampaignDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (delta: -1 | 1) => {
      const res = await fetch(api.campaign.updateDay.path, {
        method: api.campaign.updateDay.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await readJsonOrThrow<{ message?: string }>(res);
        throw new Error(error.message || "Failed to update day");
      }
      return api.campaign.updateDay.responses[200].parse(await readJsonOrThrow(res));
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CampaignStateResponse>([api.campaign.state.path], data);
      queryClient.invalidateQueries({ queryKey: [api.campaign.state.path] });
    },
  });
}

export function useSetCampaignDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dayCount: number) => {
      const res = await fetch(api.campaign.setDay.path, {
        method: api.campaign.setDay.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayCount }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await readJsonOrThrow<{ message?: string }>(res);
        throw new Error(error.message || "Failed to set day");
      }
      return api.campaign.setDay.responses[200].parse(await readJsonOrThrow(res));
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CampaignStateResponse>([api.campaign.state.path], data);
      queryClient.invalidateQueries({ queryKey: [api.campaign.state.path] });
    },
  });
}

export function usePassHour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.campaign.passHour.path, {
        method: api.campaign.passHour.method,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await readJsonOrThrow<{ message?: string }>(res);
        throw new Error(error.message || "Failed to pass an hour");
      }
      return api.campaign.passHour.responses[200].parse(await readJsonOrThrow(res));
    },
    onSuccess: () => {
      // Fallback sync if websocket is delayed/disconnected.
      queryClient.invalidateQueries({ queryKey: [api.characters.list.path] });
    },
  });
}

export function useUndoCampaignAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.campaign.undo.path, {
        method: api.campaign.undo.method,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await readJsonOrThrow<{ message?: string }>(res);
        throw new Error(error.message || "Failed to undo campaign action");
      }
      return api.campaign.undo.responses[200].parse(await readJsonOrThrow(res));
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CampaignStateResponse>([api.campaign.state.path], { dayCount: data.dayCount });
      queryClient.invalidateQueries({ queryKey: [api.characters.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.campaign.state.path] });
    },
  });
}
