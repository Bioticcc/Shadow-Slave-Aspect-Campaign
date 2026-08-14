import { useCallback, useEffect, useState } from "react";
import { WS_EVENTS } from "@shared/routes";
import { type MemoryTradeRequestPayload, type MemoryTradeSessionPayload } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { onMemoryTradeEvent, sendWsMessage } from "./use-websocket";

function upsertRequest(
  list: MemoryTradeRequestPayload[],
  request: MemoryTradeRequestPayload,
): MemoryTradeRequestPayload[] {
  const without = list.filter((item) => item.requestId !== request.requestId);
  return [...without, request].sort((a, b) => a.createdAt - b.createdAt);
}

function uniqueSortedIndexes(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value >= 0))).sort((a, b) => a - b);
}

export function useMemoryTrade() {
  const { currentUser } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<MemoryTradeRequestPayload[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<MemoryTradeRequestPayload[]>([]);
  const [activeSession, setActiveSession] = useState<MemoryTradeSessionPayload | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setPendingRequests([]);
      setOutgoingRequests([]);
      setActiveSession(null);
      setStatusMessage(null);
      return;
    }

    return onMemoryTradeEvent((event) => {
      if (event.type === WS_EVENTS.MEMORY_TRADE_STATE) {
        setPendingRequests(event.payload.pendingRequests || []);
        setOutgoingRequests(event.payload.outgoingRequests || []);
        setActiveSession(event.payload.activeSession || null);
        return;
      }

      if (event.type === WS_EVENTS.MEMORY_TRADE_REQUEST) {
        setPendingRequests((prev) => upsertRequest(prev, event.payload));
        return;
      }

      if (event.type === WS_EVENTS.MEMORY_TRADE_REQUEST_SENT) {
        setOutgoingRequests((prev) => upsertRequest(prev, event.payload));
        setStatusMessage(`Trade request sent to ${event.payload.toUser}.`);
        return;
      }

      if (event.type === WS_EVENTS.MEMORY_TRADE_REQUEST_DECLINED) {
        setOutgoingRequests((prev) => prev.filter((item) => item.requestId !== event.payload.requestId));
        setPendingRequests((prev) => prev.filter((item) => item.requestId !== event.payload.requestId));
        if (event.payload.message) {
          setStatusMessage(event.payload.message);
        }
        return;
      }

      if (event.type === WS_EVENTS.MEMORY_TRADE_SESSION_STARTED) {
        setActiveSession(event.payload);
        setPendingRequests((prev) => prev.filter((item) => item.requestId !== event.payload.requestId));
        setOutgoingRequests((prev) => prev.filter((item) => item.requestId !== event.payload.requestId));
        setStatusMessage("Trade session started.");
        return;
      }

      if (event.type === WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED) {
        setActiveSession((prev) => {
          if (!prev || prev.sessionId !== event.payload.sessionId) {
            return event.payload;
          }
          return event.payload;
        });
        return;
      }

      if (event.type === WS_EVENTS.MEMORY_TRADE_SESSION_CLOSED) {
        setActiveSession((prev) => {
          if (!prev || prev.sessionId !== event.payload.sessionId) {
            return prev;
          }
          return null;
        });
        if (event.payload.message) {
          setStatusMessage(event.payload.message);
        }
        return;
      }

      if (event.type === WS_EVENTS.MEMORY_TRADE_ERROR) {
        setStatusMessage(event.payload.message || "Memory trade action failed.");
      }
    });
  }, [currentUser]);

  const requestTrade = useCallback((targetUser: string, targetCharacterId: number) => {
    sendWsMessage({
      type: WS_EVENTS.MEMORY_TRADE_REQUEST,
      payload: { targetUser, targetCharacterId },
    });
  }, []);

  const acceptTradeRequest = useCallback((requestId: string) => {
    sendWsMessage({
      type: WS_EVENTS.MEMORY_TRADE_ACCEPT,
      payload: { requestId },
    });
  }, []);

  const declineTradeRequest = useCallback((requestId: string) => {
    sendWsMessage({
      type: WS_EVENTS.MEMORY_TRADE_DECLINE,
      payload: { requestId },
    });
    setPendingRequests((prev) => prev.filter((item) => item.requestId !== requestId));
  }, []);

  const updateTradeOffer = useCallback((sessionId: string, characterId: number, memoryIndexes: number[]) => {
    sendWsMessage({
      type: WS_EVENTS.MEMORY_TRADE_SESSION_UPDATE,
      payload: {
        sessionId,
        characterId,
        memoryIndexes: uniqueSortedIndexes(memoryIndexes),
      },
    });
  }, []);

  const setTradeAccepted = useCallback((sessionId: string, accepted: boolean) => {
    sendWsMessage({
      type: WS_EVENTS.MEMORY_TRADE_SESSION_ACCEPT,
      payload: { sessionId, accepted },
    });
  }, []);

  const cancelTradeSession = useCallback((sessionId: string) => {
    sendWsMessage({
      type: WS_EVENTS.MEMORY_TRADE_SESSION_CANCEL,
      payload: { sessionId },
    });
  }, []);

  const clearStatusMessage = useCallback(() => {
    setStatusMessage(null);
  }, []);

  return {
    pendingRequests,
    pendingRequestCount: pendingRequests.length,
    outgoingRequests,
    activeSession,
    statusMessage,
    clearStatusMessage,
    requestTrade,
    acceptTradeRequest,
    declineTradeRequest,
    updateTradeOffer,
    setTradeAccepted,
    cancelTradeSession,
  };
}
