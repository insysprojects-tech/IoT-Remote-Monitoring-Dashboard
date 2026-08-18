import { useEffect, useRef } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { useAlertStore } from '../store/alertStore';

const defaultWsUrl = import.meta.env.VITE_WS_BASE_URL || (typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/telemetry` 
  : null);

export const useWebSocket = (url = defaultWsUrl) => {
  const ws = useRef(null);
  const { setWsStatus, updateDeviceTelemetry } = useDeviceStore();
  const { addRealtimeAlert } = useAlertStore();

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setWsStatus(true);
      };

      ws.current.onclose = () => {
        console.log('WebSocket Disconnected, retrying...');
        setWsStatus(false);
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.current.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.current.close();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            updateDeviceTelemetry(data);
          } else if (data.type === 'alert') {
            // Real-time alert from the backend
            addRealtimeAlert(data);
          } else if (data.type === 'device_offline') {
            // Device went offline — update the device store
            updateDeviceTelemetry({
              ...data,
              is_online: false,
            });
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url, setWsStatus, updateDeviceTelemetry, addRealtimeAlert]);
};
