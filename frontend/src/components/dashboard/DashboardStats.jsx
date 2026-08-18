import React, { useMemo } from 'react';
import { Train, LayoutGrid, Radio, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { useAlertStore } from '../../store/alertStore';

export const DashboardStats = ({ devices = [] }) => {
  const { unreadCount, criticalCount } = useAlertStore();

  const stats = useMemo(() => {
    const totalDevices = devices.length;
    const onlineDevices = devices.filter(d => d.is_online).length;
    const offlineDevices = totalDevices - onlineDevices;
    
    const trains = new Set();
    const coaches = new Set();
    let lowBatteryCount = 0;

    devices.forEach(d => {
      if (d.train_no) trains.add(d.train_no);
      if (d.coach_no) coaches.add(`${d.train_no || ''}-${d.coach_no}`);
      
      const v1 = d.battery_1_voltage;
      const v2 = d.battery_2_voltage;
      if ((v1 !== null && v1 !== undefined && v1 < 11.5) || (v2 !== null && v2 !== undefined && v2 < 11.5)) {
        lowBatteryCount++;
      }
    });

    return {
      totalTrains: trains.size,
      totalCoaches: coaches.size,
      totalDevices,
      onlineDevices,
      offlineDevices,
      onlinePercent: totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0,
      lowBatteryCount,
    };
  }, [devices]);

  return (
    <div className="stats-kpi-grid">
      {/* 1. Fleet Overview */}
      <div className="stat-kpi-card">
        <div className="kpi-icon-container gradient-blue">
          <Train size={22} color="#ffffff" />
        </div>
        <div className="kpi-info">
          <span className="kpi-label">Active Fleets</span>
          <div className="kpi-value-row">
            <span className="kpi-primary-val">{stats.totalTrains}</span>
            <span className="kpi-sub-tag">{stats.totalCoaches} Coaches</span>
          </div>
        </div>
      </div>

      {/* 2. Online Monitoring Nodes */}
      <div className="stat-kpi-card">
        <div className="kpi-icon-container gradient-green">
          <Radio size={22} color="#ffffff" />
        </div>
        <div className="kpi-info">
          <span className="kpi-label">Active Monitoring Nodes</span>
          <div className="kpi-value-row">
            <span className="kpi-primary-val">{stats.onlineDevices}</span>
            <span className="kpi-sub-total">/ {stats.totalDevices} Online</span>
          </div>
        </div>
        <div className="kpi-progress-wrapper">
          <div 
            className="kpi-progress-bar bg-green" 
            style={{ width: `${stats.onlinePercent}%` }}
            title={`${stats.onlinePercent}% Online`}
          />
        </div>
      </div>

      {/* 3. Power & Battery Status */}
      <div className="stat-kpi-card">
        <div className={`kpi-icon-container ${stats.lowBatteryCount > 0 ? 'gradient-amber' : 'gradient-teal'}`}>
          <Zap size={22} color="#ffffff" />
        </div>
        <div className="kpi-info">
          <span className="kpi-label">Power & Storage</span>
          <div className="kpi-value-row">
            <span className="kpi-primary-val">
              {stats.lowBatteryCount === 0 ? 'Nominal' : `${stats.lowBatteryCount} Low`}
            </span>
            <span className={`kpi-sub-tag ${stats.lowBatteryCount > 0 ? 'tag-warning' : 'tag-success'}`}>
              {stats.lowBatteryCount === 0 ? '100% Normal' : 'Check Voltages'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Active Alerts */}
      <div className="stat-kpi-card">
        <div className={`kpi-icon-container ${criticalCount > 0 ? 'gradient-red' : (unreadCount > 0 ? 'gradient-amber' : 'gradient-emerald')}`}>
          {criticalCount > 0 ? (
            <AlertTriangle size={22} color="#ffffff" />
          ) : (
            <ShieldCheck size={22} color="#ffffff" />
          )}
        </div>
        <div className="kpi-info">
          <span className="kpi-label">Alert Status</span>
          <div className="kpi-value-row">
            <span className="kpi-primary-val">
              {criticalCount > 0 ? `${criticalCount} Critical` : (unreadCount > 0 ? `${unreadCount} Alerts` : 'Healthy')}
            </span>
            <span className={`kpi-sub-tag ${criticalCount > 0 ? 'tag-danger' : (unreadCount > 0 ? 'tag-warning' : 'tag-success')}`}>
              {unreadCount > 0 ? `${unreadCount} Unread` : 'All Clear'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
