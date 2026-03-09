import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';

type EventStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeEventsOptions {
  /** Event types to listen for (empty = all events) */
  eventTypes?: string[];
  /** Enable/disable the connection */
  enabled?: boolean;
  /** Force SSE fallback instead of MQTT */
  forceSSE?: boolean;
}

/**
 * Hook that connects to the MQTT broker via WebSocket and invokes
 * `handler` whenever a matching event arrives.
 *
 * Falls back to SSE (/api/events/stream) if MQTT connection fails.
 */
export function useRealtimeEvents(
  handler: (eventType: string, data: any) => void,
  options: UseRealtimeEventsOptions = {},
) {
  const { eventTypes, enabled = true, forceSSE = false } = options;
  const [status, setStatus] = useState<EventStatus>('disconnected');
  const [useSSE, setUseSSE] = useState(forceSSE);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const eventTypesKey = eventTypes?.join(',') ?? '';

  // Sync forceSSE prop to state
  useEffect(() => {
    if (forceSSE) setUseSSE(true);
  }, [forceSSE]);

  // ── MQTT connection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || useSSE) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setStatus('error');
      return;
    }

    // Decode user ID from JWT payload (no verification — just for topic subscription)
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub?.toString() ?? null;
    } catch {
      setStatus('error');
      return;
    }

    const mqttUrl = import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:9001';
    let client: MqttClient | null = null;
    let disposed = false;

    try {
      client = mqtt.connect(mqttUrl, {
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      setStatus('connecting');

      client.on('connect', () => {
        if (disposed) return;
        setStatus('connected');
        if (userId) {
          client!.subscribe(`intesa/user/${userId}/events`);
        }
        client!.subscribe('intesa/broadcast/events');
      });

      client.on('message', (_topic: string, payload: Buffer) => {
        try {
          const parsed = JSON.parse(payload.toString());
          const eventType = parsed.event || 'message';
          const data = parsed.data || parsed;

          // Filter by event types if specified
          const types = eventTypesKey ? eventTypesKey.split(',') : [];
          if (types.length === 0 || types.includes(eventType)) {
            handlerRef.current(eventType, data);
          }
        } catch {
          // ignore parse errors
        }
      });

      client.on('error', () => {
        if (!disposed) {
          client?.end(true);
          // Activate SSE fallback
          setUseSSE(true);
        }
      });

      client.on('offline', () => {
        if (!disposed) setStatus('disconnected');
      });

      client.on('reconnect', () => {
        if (!disposed) setStatus('connecting');
      });
    } catch {
      // MQTT not available — fallback to SSE
      setUseSSE(true);
    }

    return () => {
      disposed = true;
      if (client) {
        client.end(true);
      }
      setStatus('disconnected');
    };
  }, [enabled, useSSE, eventTypesKey]);

  // ── SSE fallback ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !useSSE) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      setStatus('error');
      return;
    }

    let es: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const tryConnect = () => {
      if (disposed) return;
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const url = `${baseUrl}/api/events/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      setStatus('connecting');

      es.addEventListener('connected', () => {
        setStatus('connected');
        retryDelay = 1000;
      });

      const types = eventTypesKey ? eventTypesKey.split(',') : [];
      const onMessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlerRef.current(e.type, data);
        } catch { /* ignore */ }
      };

      if (types.length > 0) {
        types.forEach((t) => es!.addEventListener(t, onMessage));
      } else {
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            handlerRef.current('message', data);
          } catch { /* ignore */ }
        };
      }

      es.onerror = () => {
        setStatus('error');
        es?.close();
        if (!disposed) {
          retryTimeout = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30000);
            tryConnect();
          }, retryDelay);
        }
      };
    };

    tryConnect();

    return () => {
      disposed = true;
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      setStatus('disconnected');
    };
  }, [enabled, useSSE, eventTypesKey]);

  return { status };
}
