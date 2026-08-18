import React, { useEffect, useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { AlertBell } from '../alerts/AlertBell';
import { Wifi, WifiOff, Sun, Moon } from 'lucide-react';

export const Header = () => {
  const { wsConnected } = useDeviceStore();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <header className="header">
      <div>
        <h1 className="header-title">FSDS Monitoring Dashboard</h1>
        <p className="header-subtitle">
          Fire & Smoke Detection System 
        </p>
      </div>

      <div className="header-actions-group">
        {/* Dark / Light Mode Toggle */}
        <button 
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun size={18} className="theme-sun-icon" />
          ) : (
            <Moon size={18} className="theme-moon-icon" />
          )}
        </button>

        {/* Alert Bell */}
        <AlertBell />

        {/* WebSocket Live Connection Status Badge */}
        <div className={`connection-status-badge ${wsConnected ? 'status-live' : 'status-disconnected'}`}>
          <span className={`connection-pulse ${wsConnected ? 'pulse-live' : 'pulse-dead'}`} />
          {wsConnected ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{wsConnected ? 'Live Stream' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
};
