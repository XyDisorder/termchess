import { useState, useEffect, useRef, useCallback } from 'react';
import { type ClientMessage, type ServerMessage, parseServerMessage } from '@termchess/protocol';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (message: ClientMessage) => void;
  lastMessage: ServerMessage | null;
  error: string | null;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setError(null);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const raw: unknown = JSON.parse(event.data as string);
        const msg = parseServerMessage(raw);
        setLastMessage(msg);
      } catch (err) {
        // Log but don't crash on parse errors
        console.error('Failed to parse server message:', err);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setError('WebSocket connection error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
    };
  }, [url]);

  const send = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  return { status, send, lastMessage, error };
}
