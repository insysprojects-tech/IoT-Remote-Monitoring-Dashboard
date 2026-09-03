import { Activity, LayoutDashboard, Bell, Settings, LogOut, Database } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore';
import { useNavigate, useLocation } from 'react-router-dom';

export const Sidebar = () => {
  const { logout, user } = useAuthStore();
  const { unreadCount } = useAlertStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navLinkStyle = (path) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    background: isActive(path) ? 'var(--status-green-bg)' : 'transparent',
    color: isActive(path) ? 'var(--status-green)' : 'var(--text-secondary)',
    textDecoration: 'none',
    fontWeight: isActive(path) ? '600' : '500',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  });

  return (
    <aside className="sidebar">
      <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          <Activity size={18} />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.3px', margin: 0 }}>FSDS Monitor</h2>
      </div>

      <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={() => navigate('/')} style={navLinkStyle('/')}>
          <LayoutDashboard size={20} />
          Dashboard
        </button>
        {user?.role === 'admin' && (
          <button onClick={() => navigate('/manage-devices')} style={navLinkStyle('/manage-devices')}>
            <Database size={20} />
            Manage Devices
          </button>
        )}
        <button onClick={() => navigate('/alerts')} style={navLinkStyle('/alerts')}>
          <Bell size={20} />
          Alerts
          {unreadCount > 0 && (
            <span style={{
              marginLeft: 'auto',
              background: 'var(--status-red)',
              color: 'white',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '10px',
              minWidth: '20px',
              textAlign: 'center',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button onClick={() => navigate('/settings')} style={navLinkStyle('/settings')}>
          <Settings size={20} />
          Settings
        </button>
      </nav>

      <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '0 8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--status-gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{user?.username}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user?.role}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            color: 'var(--status-red)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
