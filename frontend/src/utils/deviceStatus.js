/**
 * Utility functions to reliably determine device online status
 * based on last_seen timestamps and real-time timeout thresholds.
 */

// 10 seconds strict threshold: If no message in the last 10s, device is offline
export const OFFLINE_TIMEOUT_SECONDS = 10;

export const getInactivityTimeoutSeconds = () => {
  if (typeof localStorage !== 'undefined') {
    const cfg = localStorage.getItem('cfg-inactivity-sec');
    const parsed = parseInt(cfg, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 10) return parsed;
  }
  return OFFLINE_TIMEOUT_SECONDS; // 10s
};

export const isDeviceOnline = (device) => {
  if (!device) return false;
  if (!device.last_seen) return false;

  const lastSeenMs = new Date(device.last_seen).getTime();
  if (isNaN(lastSeenMs)) return false;

  const timeoutSec = getInactivityTimeoutSeconds();
  const elapsedSec = (Date.now() - lastSeenMs) / 1000;

  // Considered online only if is_online is not explicitly false
  // AND the last telemetry arrived within the 10-second window
  return device.is_online !== false && elapsedSec <= timeoutSec;
};
