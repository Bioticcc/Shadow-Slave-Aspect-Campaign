import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, WS_EVENTS } from "@shared/routes";
import { type CampaignStateResponse, type CharacterListResponse } from "@shared/routes";
import {
  type DiceRollPayload,
  type MemoryTradeErrorPayload,
  type MemoryTradeRequestDeclinedPayload,
  type MemoryTradeRequestPayload,
  type MemoryTradeSessionClosedPayload,
  type MemoryTradeSessionPayload,
  type MemoryTradeStatePayload,
  type SystemMessagePayload,
} from "@shared/schema";

type DiceRollListener = (payload: DiceRollPayload) => void;
type SystemMessageListener = (payload: SystemMessagePayload) => void;
type MemoryTradeEvent =
  | { type: typeof WS_EVENTS.MEMORY_TRADE_STATE; payload: MemoryTradeStatePayload }
  | { type: typeof WS_EVENTS.MEMORY_TRADE_REQUEST; payload: MemoryTradeRequestPayload }
  | { type: typeof WS_EVENTS.MEMORY_TRADE_REQUEST_SENT; payload: MemoryTradeRequestPayload }
  | { type: typeof WS_EVENTS.MEMORY_TRADE_REQUEST_DECLINED; payload: MemoryTradeRequestDeclinedPayload }
  | { type: typeof WS_EVENTS.MEMORY_TRADE_SESSION_STARTED; payload: MemoryTradeSessionPayload }
  | { type: typeof WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED; payload: MemoryTradeSessionPayload }
  | { type: typeof WS_EVENTS.MEMORY_TRADE_SESSION_CLOSED; payload: MemoryTradeSessionClosedPayload }
  | { type: typeof WS_EVENTS.MEMORY_TRADE_ERROR; payload: MemoryTradeErrorPayload };
type MemoryTradeListener = (event: MemoryTradeEvent) => void;

const diceRollListeners = new Set<DiceRollListener>();
const systemMessageListeners = new Set<SystemMessageListener>();
const memoryTradeListeners = new Set<MemoryTradeListener>();

export function onDiceRoll(listener: DiceRollListener) {
  diceRollListeners.add(listener);
  return () => { diceRollListeners.delete(listener); };
}

export function onSystemMessage(listener: SystemMessageListener) {
  systemMessageListeners.add(listener);
  return () => { systemMessageListeners.delete(listener); };
}

export function onMemoryTradeEvent(listener: MemoryTradeListener) {
  memoryTradeListeners.add(listener);
  return () => { memoryTradeListeners.delete(listener); };
}

let sharedWs: WebSocket | null = null;

export function sendWsMessage(msg: unknown) {
  if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
    sharedWs.send(JSON.stringify(msg));
  }
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;
    
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        wsRef.current = new WebSocket(url);
        sharedWs = wsRef.current;
        
        wsRef.current.onopen = () => {
          console.log('[WS] Connected');
          setConnected(true);
        };
        
        wsRef.current.onclose = () => {
          console.log('[WS] Disconnected, reconnecting...');
          setConnected(false);
          sharedWs = null;
          reconnectTimeout = setTimeout(connect, 3000);
        };
        
        wsRef.current.onerror = (err) => {
          console.error('[WS] Error:', err);
        };
        
        wsRef.current.onmessage = (e) => {
          try {
            const { type, payload } = JSON.parse(e.data);
            
            if (type === WS_EVENTS.UPDATE_CHARACTER) {
              queryClient.setQueryData<CharacterListResponse>(
                [api.characters.list.path],
                (old) => {
                  if (!old) return old;
                  return old.map(char => char.id === payload.id ? payload : char);
                }
              );
              
              queryClient.setQueryData(
                [api.characters.get.path, payload.id],
                payload
              );
            }

            if (type === WS_EVENTS.DICE_ROLL) {
              diceRollListeners.forEach(fn => fn(payload as DiceRollPayload));
            }

            if (type === WS_EVENTS.SYSTEM_MESSAGE) {
              systemMessageListeners.forEach((fn) => fn(payload as SystemMessagePayload));
            }

            if (type === WS_EVENTS.CAMPAIGN_DAY_UPDATE) {
              queryClient.setQueryData<CampaignStateResponse>(
                [api.campaign.state.path],
                payload as CampaignStateResponse,
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_STATE) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeStatePayload,
                }),
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_REQUEST) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeRequestPayload,
                }),
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_REQUEST_SENT) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeRequestPayload,
                }),
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_REQUEST_DECLINED) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeRequestDeclinedPayload,
                }),
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_SESSION_STARTED) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeSessionPayload,
                }),
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_SESSION_UPDATED) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeSessionPayload,
                }),
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_SESSION_CLOSED) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeSessionClosedPayload,
                }),
              );
            }

            if (type === WS_EVENTS.MEMORY_TRADE_ERROR) {
              memoryTradeListeners.forEach((fn) =>
                fn({
                  type,
                  payload: payload as MemoryTradeErrorPayload,
                }),
              );
            }
          } catch (err) {
            console.error('[WS] Failed to parse message', err);
          }
        };
      } catch (err) {
        console.error('[WS] Connection failed', err);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      sharedWs = null;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return { connected };
}
