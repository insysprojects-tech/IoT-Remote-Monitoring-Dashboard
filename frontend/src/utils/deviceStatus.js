/**
 * Utility functions to reliably determine device online status
 * based on last_seen timestamps and configurable timeout thresholds.
 */

export const getInactivityTimeoutSeconds = () => {
  if (typeof localStorage !== 'undefined') {
    const cfg = localStorage.getItem('cfg-inactivity-sec');
    const parsed = parseInt(cfg, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 60; // 60s default (firmware sends telemetry every 3s)
};

export const isDeviceOnline = (device) => {
  if (!device) return false;
  if (!device.last_seen) return false;

  const lastSeenMs = new Date(device.last_seen).getTime();
  if (isNaN(lastSeenMs)) return false;

  const timeoutSec = getInactivityTimeoutSeconds();
  const elapsedSec = (Date.now() - lastSeenMs) / 1000;

  // Considered online only if is_online is not explicitly false
  // AND the last telemetry arrived within the inactivity timeout threshold
  return device.is_online !== false && elapsedSec <= timeoutSec;
};
