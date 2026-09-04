import { create } from 'zustand';
import api from '../utils/api';
import { isDeviceOnline } from '../utils/deviceStatus';

export const useDeviceStore = create((set, get) => ({
  devices: [],
  isLoading: false,
  error: null,
  wsConnected: false,
  currentDevice: null,
  deviceTelemetry: [],

  setWsStatus: (status) => set({ wsConnected: status }),

  fetchDevices: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/devices');
      const normalized = (res.data || []).map(d => ({
        ...d,
        is_online: isDeviceOnline(d)
      }));
      set({ devices: normalized, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchDevice: async (id) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/devices/${id}`);
      const normalized = res.data ? {
        ...res.data,
        is_online: isDeviceOnline(res.data)
      } : null;
      set({ currentDevice: normalized, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchTelemetry: async (id, params = {}) => {
    try {
      const res = await api.get(`/devices/${id}/telemetry`, { params });
      // Reverse array so chronological order
      set({ deviceTelemetry: res.data.reverse() });
    } catch (err) {
      console.error(err);
    }
  },

  updateDeviceTelemetry: (telemetry) => {
    set((state) => {
      const isOnline = telemetry.is_online !== undefined ? Boolean(telemetry.is_online) : true;
      const lastSeen = telemetry.last_seen || (isOnline ? new Date().toISOString() : null);

      const matchesDevice = (d) => {
        if (!d) return false;
        if (telemetry.mac_address && d.mac_address === telemetry.mac_address) return true;
        if (telemetry.device_id && String(d.id) === String(telemetry.device_id)) return true;
        return false;
      };

      return {
        devices: state.devices.map((device) => {
          if (matchesDevice(device)) {
            return {
              ...device,
              ...telemetry,
              is_online: isOnline,
              last_seen: lastSeen || device.last_seen
            };
          }
          return device;
        }),
        currentDevice: matchesDevice(state.currentDevice)
          ? {
              ...state.currentDevice,
              ...telemetry,
              is_online: isOnline,
              last_seen: lastSeen || state.currentDevice.last_seen
            }
          : state.currentDevice,
        deviceTelemetry: matchesDevice(state.currentDevice) && isOnline
          ? [...state.deviceTelemetry, { time: new Date().toISOString(), ...telemetry }].slice(-1000)
          : state.deviceTelemetry
      };
    });
  },

  checkStaleDevices: () => {
    set((state) => {
      let changed = false;
      const updatedDevices = state.devices.map((d) => {
        const computed = isDeviceOnline(d);
        if (d.is_online !== computed) {
          changed = true;
          return { ...d, is_online: computed };
        }
        return d;
      });

      let updatedCurrent = state.currentDevice;
      if (state.currentDevice) {
        const computed = isDeviceOnline(state.currentDevice);
        if (state.currentDevice.is_online !== computed) {
          changed = true;
          updatedCurrent = { ...state.currentDevice, is_online: computed };
        }
      }

      return changed ? { devices: updatedDevices, currentDevice: updatedCurrent } : {};
    });
  }
}));
