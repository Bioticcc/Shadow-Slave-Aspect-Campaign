import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, WS_EVENTS } from "@shared/routes";
import { type CharacterListResponse } from "@shared/routes";
import { type DiceRollPayload } from "@shared/schema";

type DiceRollListener = (payload: DiceRollPayload) => void;

const diceRollListeners = new Set<DiceRollListener>();

export function onDiceRoll(listener: DiceRollListener) {
  diceRollListeners.add(listener);
  return () => { diceRollListeners.delete(listener); };
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
