import React from 'react';
import { 
  Battery, 
  Zap, 
  Clock, 
  MapPin, 
  Edit, 
  Trash2, 
  Train, 
  Power, 
  Timer, 
  Activity,
  ShieldAlert,
  ChevronRight,
  Wifi,
  WifiOff,
  Gauge,
  Cpu
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { isDeviceOnline } from '../../utils/deviceStatus';

export const DeviceCard = ({ device, onEdit, onDelete, hideActions }) => {
  const navigate = useNavigate();
  const isOnline = isDeviceOnline(device);

  // Format relative timestamp
  let lastSeenText = 'Offline';
  if (device.last_seen) {
    try {
      lastSeenText = formatDistanceToNow(new Date(device.last_seen), { addSuffix: true });
    } catch (e) {
      lastSeenText = 'Unknown';
    }
  }

  // Calculate 12V Battery Percentage based on 10.5V (0%) - 13.8V (100%)
  const getBatteryPercent = (voltage) => {
    if (voltage === null || voltage === undefined || isNaN(voltage)) return null;
    const minV = 10.5;
    const maxV = 13.8;
    const clamped = Math.min(Math.max(voltage, minV), maxV);
    return Math.round(((clamped - minV) / (maxV - minV)) * 100);
  };

  // Voltage Thresholds: Emerald >= 12.0V, Amber 11.2V - 12.0V, Rose < 11.2V
  const getVoltageStatusClass = (voltage) => {
    if (voltage === null || voltage === undefined || isNaN(voltage)) return 'voltage-neutral';
    if (voltage >= 12.0) return 'voltage-emerald';
    if (voltage >= 11.2) return 'voltage-amber';
    return 'voltage-rose';
  };

  const getVoltageLabel = (voltage) => {
    if (voltage === null || voltage === undefined || isNaN(voltage)) return 'No Signal';
    if (voltage >= 12.0) return 'Optimal';
    if (voltage >= 11.2) return 'Warning';
    return 'Critical';
  };

  const bat1Pct = getBatteryPercent(device.battery_1_voltage);
  const bat2Pct = getBatteryPercent(device.battery_2_voltage);

  // Map AC 1 / AC 2 to Main MCB and FSDS MCB with backwards fallback
  const mainMcb = device.ac_1_status ?? device.main_mcb_status ?? null;
  const fsdsMcb = device.ac_2_status ?? device.fsds_mcb_status ?? null;

  return (
    <div 
      className={`telemetry-card ${isOnline ? 'card-online' : 'card-offline'}`}
      onClick={() => navigate(`/device/${device.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/device/${device.id}`); }}
    >
      {/* 1. Top Status & Fleet Location Header */}
      <div className="card-top-header">
        <div className="fleet-badge-group">
          <div className="fleet-badge train-badge">
            <Train size={12} className="fleet-badge-icon" />
            <span>{device.train_no ? `Train ${device.train_no}` : 'Unassigned'}</span>
          </div>
          {device.coach_no && (
            <div className="fleet-badge coach-badge">
              <span>{`Coach ${device.coach_no}`}</span>
            </div>
          )}
        </div>

        <div className="card-status-pill">
          <span className={`live-pulse-dot ${isOnline ? 'pulse-green' : 'pulse-gray'}`} />
          <span className="live-status-label">{isOnline ? 'LIVE' : 'OFFLINE'}</span>
          {!hideActions && (
            <div className="card-action-btns" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <button 
                  className="icon-action-btn btn-edit"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  title="Edit Device"
                >
                  <Edit size={13} />
                </button>
              )}
              {onDelete && (
                <button 
                  className="icon-action-btn btn-delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  title="Delete Device"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Device Identity & Hardware Details */}
      <div className="device-identity-row">
        <div className="device-meta-left">
          <h4 className="device-display-name" title={device.name || 'Monitoring Node'}>
            {device.name || 'Monitoring Node'}
          </h4>
          <div className="device-sub-tags">
            {device.location && (
              <span className="device-location-tag">
                <MapPin size={10} /> {device.location}
              </span>
            )}
            {device.device_type && (
              <span className="device-type-tag">
                <Cpu size={10} /> {device.device_type}
              </span>
            )}
          </div>
        </div>
        <span className="device-mac-chip" title={`MAC: ${device.mac_address}`}>
          {device.mac_address}
        </span>
      </div>

      {/* 3. Dual Battery Telemetry Gauges */}
      <div className="battery-telemetry-section">
        {/* Battery 1 */}
        <div className={`battery-gauge-card border-${getVoltageStatusClass(device.battery_1_voltage)}`}>
          <div className="gauge-header">
            <div className="gauge-title">
              <Battery size={13} className="gauge-icon" />
              <span>Battery 1</span>
            </div>
            <span className={`gauge-voltage ${getVoltageStatusClass(device.battery_1_voltage)}`}>
              {device.battery_1_voltage !== null && device.battery_1_voltage !== undefined
                ? `${device.battery_1_voltage.toFixed(2)}V`
                : '--'}
            </span>
          </div>
          <div className="gauge-track">
            <div 
              className={`gauge-fill ${getVoltageStatusClass(device.battery_1_voltage)}`}
              style={{ width: `${bat1Pct !== null ? bat1Pct : 0}%` }}
            />
          </div>
          <div className="gauge-footer">
            <span className="gauge-status-label">{getVoltageLabel(device.battery_1_voltage)}</span>
            <span className="gauge-pct-text">{bat1Pct !== null ? `${bat1Pct}%` : 'Offline'}</span>
          </div>
        </div>

        {/* Battery 2 */}
        <div className={`battery-gauge-card border-${getVoltageStatusClass(device.battery_2_voltage)}`}>
          <div className="gauge-header">
            <div className="gauge-title">
              <Battery size={13} className="gauge-icon" />
              <span>Battery 2</span>
            </div>
            <span className={`gauge-voltage ${getVoltageStatusClass(device.battery_2_voltage)}`}>
              {device.battery_2_voltage !== null && device.battery_2_voltage !== undefined
                ? `${device.battery_2_voltage.toFixed(2)}V`
                : '--'}
            </span>
          </div>
          <div className="gauge-track">
            <div 
              className={`gauge-fill ${getVoltageStatusClass(device.battery_2_voltage)}`}
              style={{ width: `${bat2Pct !== null ? bat2Pct : 0}%` }}
            />
          </div>
          <div className="gauge-footer">
            <span className="gauge-status-label">{getVoltageLabel(device.battery_2_voltage)}</span>
            <span className="gauge-pct-text">{bat2Pct !== null ? `${bat2Pct}%` : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* 4. Tactile MCB Switches Grid (Main MCB & FSDS MCB) */}
      <div className="telemetry-switches-grid">
        {/* Main MCB */}
        <div className={`switch-status-pill switch-${mainMcb === 'ON' ? 'on' : (mainMcb === 'OFF' ? 'off' : 'null')}`}>
          <div className="switch-meta">
            <Power size={12} />
            <span>Main MCB</span>
          </div>
          <div className="switch-state-indicator">
            <span className={`switch-led led-${mainMcb === 'ON' ? 'on' : (mainMcb === 'OFF' ? 'off' : 'null')}`} />
            <span className="switch-val-text">{mainMcb || 'N/A'}</span>
          </div>
        </div>

        {/* FSDS MCB */}
        <div className={`switch-status-pill switch-${fsdsMcb === 'ON' ? 'on' : (fsdsMcb === 'OFF' ? 'off' : 'null')}`}>
          <div className="switch-meta">
            <Power size={12} />
            <span>FSDS MCB</span>
          </div>
          <div className="switch-state-indicator">
            <span className={`switch-led led-${fsdsMcb === 'ON' ? 'on' : (fsdsMcb === 'OFF' ? 'off' : 'null')}`} />
            <span className="switch-val-text">{fsdsMcb || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* 5. Live Heartbeat, Countdown Timer & Navigation */}
      <div className="telemetry-card-footer">
        <div className="footer-meta-item" title="Telemetry Heartbeat">
          <Clock size={12} className="footer-icon" />
          <span>{lastSeenText}</span>
        </div>

        {device.countdown_timer !== undefined && device.countdown_timer !== null && (
          <div className="footer-meta-item timer-pill" title="Hardware Refresh Countdown Timer">
            <Timer size={12} className="footer-icon" />
            <span>{`${device.countdown_timer}s`}</span>
          </div>
        )}

        <div className="footer-view-more">
          <span>View Telemetry</span>
          <ChevronRight size={13} className="chevron-slide" />
        </div>
      </div>
    </div>
  );
};
