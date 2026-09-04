import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeviceStore } from '../../store/deviceStore';
import { ArrowLeft, Battery, Zap, MapPin, Activity, Power } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { VoltageChart } from './VoltageChart';
import { ACStatusChart } from './ACStatusChart';
import { ChargeGauge } from './ChargeGauge';
import { isDeviceOnline } from '../../utils/deviceStatus';

export const DeviceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDevice, deviceTelemetry, isLoading, error, fetchDevice, fetchTelemetry } = useDeviceStore();
  const [timeRange, setTimeRange] = useState('24h'); // '1h', '6h', '24h', '7d'
  const [, setTick] = useState(0);

  // Periodic tick so live status transitions accurately in real time every 1 second
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchDevice(id);
  }, [id, fetchDevice]);

  useEffect(() => {
    if (currentDevice) {
      // Calculate from_time based on timeRange
      const now = new Date();
      let from = new Date();
      if (timeRange === '1h') from.setHours(now.getHours() - 1);
      if (timeRange === '6h') from.setHours(now.getHours() - 6);
      if (timeRange === '24h') from.setHours(now.getHours() - 24);
      if (timeRange === '7d') from.setDate(now.getDate() - 7);
      
      fetchTelemetry(id, { from: from.toISOString() });
    }
  }, [id, currentDevice?.id, timeRange, fetchTelemetry]);

  if (isLoading && !currentDevice) {
    return <div style={{ padding: '40px', color: 'var(--text-secondary)' }}>Loading device details...</div>;
  }

  if (error || !currentDevice) {
    return <div style={{ padding: '40px', color: 'var(--status-red)' }}>Error loading device details.</div>;
  }

  const isOnline = isDeviceOnline(currentDevice);
  const statusColor = isOnline ? 'var(--status-green)' : 'var(--status-gray)';
  
  let lastSeenText = 'Never';
  if (currentDevice.last_seen) {
    try {
      lastSeenText = formatDistanceToNow(new Date(currentDevice.last_seen), { addSuffix: true });
    } catch (e) {
      // ignore
    }
  }

  // Calculate approximate battery percentages based on 12V scale (10.5V = 0%, 13.8V = 100%)
  const getBatteryPercent = (voltage) => {
    if (voltage === undefined || voltage === null || voltage <= 0) return 0;
    const minV = 10.5;
    const maxV = 13.8;
    const clamped = Math.min(Math.max(voltage, minV), maxV);
    return Math.round(((clamped - minV) / (maxV - minV)) * 100);
  };
  const bat1Percent = isOnline ? getBatteryPercent(currentDevice.battery_1_voltage) : 0;
  const bat2Percent = isOnline ? getBatteryPercent(currentDevice.battery_2_voltage) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header / Back navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ 
              background: 'var(--bg-card)', border: 'none', borderRadius: '8px', padding: '8px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-primary)'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontSize: '24px', margin: 0 }}>{currentDevice.name || 'Unnamed Device'}</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {currentDevice.mac_address}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span style={{ fontWeight: '600', color: statusColor }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Sidebar Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Device Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Location</span>
                <span>{currentDevice.location || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Type</span>
                <span>{currentDevice.device_type || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Firmware</span>
                <span>{currentDevice.firmware_ver || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Last Seen</span>
                <span>{lastSeenText}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Current State</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'center' }}>
              <div>
                <ChargeGauge value={isOnline ? bat1Percent : 0} label="Bat 1" />
                <div style={{ fontSize: '13px', fontWeight: '600', color: isOnline ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '-6px' }}>
                  {isOnline && currentDevice.battery_1_voltage !== undefined && currentDevice.battery_1_voltage !== null
                    ? `${Number(currentDevice.battery_1_voltage).toFixed(2)} V`
                    : '--'}
                </div>
              </div>
              <div>
                <ChargeGauge value={isOnline ? bat2Percent : 0} label="Bat 2" />
                <div style={{ fontSize: '13px', fontWeight: '600', color: isOnline ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '-6px' }}>
                  {isOnline && currentDevice.battery_2_voltage !== undefined && currentDevice.battery_2_voltage !== null
                    ? `${Number(currentDevice.battery_2_voltage).toFixed(2)} V`
                    : '--'}
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Power size={16} /> Main MCB
                </div>
                {(() => {
                  const mcb1 = currentDevice.ac_1_status ?? currentDevice.main_mcb_status;
                  return (
                    <span style={{ fontWeight: '600', color: isOnline ? (mcb1 === 'ON' ? 'var(--status-green)' : (mcb1 === 'OFF' ? 'var(--status-red)' : 'var(--text-primary)')) : 'var(--text-muted)' }}>
                      {isOnline ? (mcb1 || '--') : '--'}
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Power size={16} /> FSDS MCB
                </div>
                {(() => {
                  const mcb2 = currentDevice.ac_2_status ?? currentDevice.fsds_mcb_status;
                  return (
                    <span style={{ fontWeight: '600', color: isOnline ? (mcb2 === 'ON' ? 'var(--status-green)' : (mcb2 === 'OFF' ? 'var(--status-red)' : 'var(--text-primary)')) : 'var(--text-muted)' }}>
                      {isOnline ? (mcb2 || '--') : '--'}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Charts Area */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Time range selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} /> Telemetry History
            </h3>
            <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px' }}>
              {['1h', '6h', '24h', '7d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  style={{
                    background: timeRange === range ? 'var(--bg-card)' : 'transparent',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: timeRange === range ? '600' : '400',
                    color: timeRange === range ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: timeRange === range ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: '350px' }}>
            <VoltageChart data={deviceTelemetry} />
          </div>
          
          <div style={{ height: '200px' }}>
            <ACStatusChart data={deviceTelemetry} />
          </div>

        </div>
      </div>
    </div>
  );
};
