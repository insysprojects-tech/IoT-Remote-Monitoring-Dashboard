import { useEffect, useRef } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { useAlertStore } from '../store/alertStore';

/**
 * Resolves the WebSocket URL with multiple intelligent fallbacks:
 * 1. Explicit VITE_WS_BASE_URL (automatically fixes http/https to ws/wss)
 * 2. Auto-derived from VITE_API_BASE_URL (converts https://.../api to wss://.../ws/telemetry)
 * 3. Fallback to current browser window host (for local dev proxy)
 */
export const getResolvedWsUrl = () => {
  let wsUrl = import.meta.env.VITE_WS_BASE_URL;

  // If explicitly set, sanitize protocol if user mistakenly used http/https
  if (wsUrl && typeof wsUrl === 'string' && wsUrl.trim()) {
    wsUrl = wsUrl.trim();
    if (wsUrl.startsWith('https://')) {
      wsUrl = 'wss://' + wsUrl.slice(8);
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = 'ws://' + wsUrl.slice(7);
    }
    return wsUrl;
  }

  // If VITE_WS_BASE_URL is missing, derive it directly from VITE_API_BASE_URL
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase && typeof apiBase === 'string' && (apiBase.startsWith('http://') || apiBase.startsWith('https://'))) {
    const wsProto = apiBase.startsWith('https://') ? 'wss:' : 'ws:';
    const hostAndPath = apiBase
      .replace(/^https?:\/\//, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/+$/, '');
    return `${wsProto}//${hostAndPath}/ws/telemetry`;
  }

  // Fallback for local development or same-host deployment
  if (typeof window !== 'undefined') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.host}/ws/telemetry`;
  }

  return null;
};

export const useWebSocket = (customUrl) => {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const pingTimer = useRef(null);
  const { setWsStatus, updateDeviceTelemetry } = useDeviceStore();
  const { addRealtimeAlert } = useAlertStore();

  const url = customUrl || getResolvedWsUrl();

  useEffect(() => {
    if (!url) {
      console.warn('[WebSocket] Unable to resolve WebSocket URL. Check VITE_WS_BASE_URL or VITE_API_BASE_URL.');
      setWsStatus(false);
      return;
    }

    let isDestroyed = false;

    const connect = () => {
      if (isDestroyed) return;

      console.log(`[WebSocket] Connecting to: ${url}`);
      try {
        ws.current = new WebSocket(url);
      } catch (err) {
        console.error('[WebSocket] Error initiating connection:', err);
        setWsStatus(false);
        scheduleReconnect();
        return;
      }

      ws.current.onopen = () => {
        console.log('[WebSocket] Connection established successfully');
        setWsStatus(true);

        // Send keep-alive ping every 25s so cloud proxies (Render/Cloudflare) don't drop idle connections
        if (pingTimer.current) clearInterval(pingTimer.current);
        pingTimer.current = setInterval(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send('ping');
          }
        }, 25000);
      };

      ws.current.onclose = (event) => {
        console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason || 'none'}). Reconnecting in 3s...`);
        setWsStatus(false);
        if (pingTimer.current) clearInterval(pingTimer.current);
        scheduleReconnect();
      };

      ws.current.onerror = (err) => {
        console.warn('[WebSocket] Network error observed on WebSocket connection');
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            // Heartbeat response from backend
            return;
          }
          if (data.type === 'telemetry') {
            updateDeviceTelemetry(data);
          } else if (data.type === 'alert') {
            addRealtimeAlert(data);
          } else if (data.type === 'device_offline') {
            updateDeviceTelemetry({
              ...data,
              is_online: false,
            });
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };
    };

    const scheduleReconnect = () => {
      if (isDestroyed) return;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    connect();

    return () => {
      isDestroyed = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url, setWsStatus, updateDeviceTelemetry, addRealtimeAlert]);
};
