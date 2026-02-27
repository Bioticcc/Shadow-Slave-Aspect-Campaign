import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, WS_EVENTS } from "@shared/routes";
import { type CharacterListResponse } from "@shared/routes";

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
        
        wsRef.current.onopen = () => {
          console.log('[WS] Connected');
          setConnected(true);
        };
        
        wsRef.current.onclose = () => {
          console.log('[WS] Disconnected, reconnecting...');
          setConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };
        
        wsRef.current.onerror = (err) => {
          console.error('[WS] Error:', err);
        };
        
        wsRef.current.onmessage = (e) => {
          try {
            const { type, payload } = JSON.parse(e.data);
            
            if (type === WS_EVENTS.UPDATE_CHARACTER) {
              // Optimistically update the character in the list cache
              queryClient.setQueryData<CharacterListResponse>(
                [api.characters.list.path],
                (old) => {
                  if (!old) return old;
                  return old.map(char => char.id === payload.id ? payload : char);
                }
              );
              
              // Also update individual character cache if it exists
              queryClient.setQueryData(
                [api.characters.get.path, payload.id],
                payload
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
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return { connected };
}
