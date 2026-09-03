import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  User, 
  Shield, 
  Sliders, 
  Users, 
  Activity, 
  Lock, 
  Key, 
  Check, 
  AlertTriangle, 
  Trash2, 
  UserPlus, 
  Moon, 
  Sun, 
  Volume2, 
  VolumeX, 
  Server, 
  Database, 
  Wifi, 
  RefreshCw, 
  Eye, 
  EyeOff,
  LayoutGrid,
  Layers
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../utils/api';

export const SettingsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Active Tab
  const [activeTab, setActiveTab] = useState('general');

  // Preferences State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  const [defaultView, setDefaultView] = useState(() => {
    return localStorage.getItem('default-dashboard-view') || 'HIERARCHY';
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem('sound-alerts-enabled') !== 'false';
  });

  // Change Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ text: '', isError: false });
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Users Management State (Admin only)
  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [userActionMsg, setUserActionMsg] = useState({ text: '', isError: false });

  // Telemetry Thresholds State (Admin only)
  const [critVoltage, setCritVoltage] = useState(() => localStorage.getItem('cfg-crit-voltage') || '11.2');
  const [warnVoltage, setWarnVoltage] = useState(() => localStorage.getItem('cfg-warn-voltage') || '12.0');
  const [inactivityTimeout, setInactivityTimeout] = useState(() => localStorage.getItem('cfg-inactivity-sec') || '60');
  const [thresholdSaved, setThresholdSaved] = useState(false);

  // Diagnostics State (Admin only)
  const [diagnostics, setDiagnostics] = useState(null);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);

  // Save Preferences
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const handleDefaultViewChange = (mode) => {
    setDefaultView(mode);
    localStorage.setItem('default-dashboard-view', mode);
  };

  const handleSoundAlertsToggle = () => {
    const nextVal = !soundAlerts;
    setSoundAlerts(nextVal);
    localStorage.setItem('sound-alerts-enabled', nextVal ? 'true' : 'false');
  };

  // Fetch Users (Admin)
  const fetchUsers = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
      const res = await api.get('/auth/users');
      setUsersList(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch Diagnostics (Admin)
  const fetchDiagnostics = async () => {
    if (!isAdmin) return;
    setIsLoadingDiag(true);
    try {
      const res = await api.get('/auth/diagnostics');
      setDiagnostics(res.data);
    } catch (err) {
      console.error('Failed to fetch diagnostics:', err);
    } finally {
      setIsLoadingDiag(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'diagnostics') fetchDiagnostics();
  }, [activeTab]);

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ text: '', isError: false });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match', isError: true });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'New password must be at least 6 characters', isError: true });
      return;
    }

    setIsChangingPass(true);
    try {
      await api.put('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      setPasswordMsg({ text: 'Password updated successfully!', isError: false });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to update password';
      setPasswordMsg({ text: detail, isError: true });
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserActionMsg({ text: '', isError: false });

    try {
      await api.post('/auth/register', {
        username: newUsername,
        email: newUserEmail || undefined,
        password: newUserPassword,
        role: newUserRole
      });
      setUserActionMsg({ text: `User "${newUsername}" created successfully!`, isError: false });
      setShowAddUserModal(false);
      setNewUsername('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
      fetchUsers();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to create user';
      setUserActionMsg({ text: detail, isError: true });
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  // Save Threshold Settings
  const handleSaveThresholds = (e) => {
    e.preventDefault();
    localStorage.setItem('cfg-crit-voltage', critVoltage);
    localStorage.setItem('cfg-warn-voltage', warnVoltage);
    localStorage.setItem('cfg-inactivity-sec', inactivityTimeout);
    setThresholdSaved(true);
    setTimeout(() => setThresholdSaved(false), 3000);
  };

  return (
    <div className="settings-page-wrapper">
      {/* Settings Navigation Tabs */}
      <div className="settings-tabs-sidebar">
        <div className="settings-nav-group">
          <span className="settings-nav-heading">System Preferences</span>
          <button 
            className={`settings-nav-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Sliders size={18} />
            <span>General & UI</span>
          </button>
          <button 
            className={`settings-nav-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <Lock size={18} />
            <span>Account Security</span>
          </button>
        </div>

        {isAdmin && (
          <div className="settings-nav-group">
            <span className="settings-nav-heading">Admin Operations</span>
            <button 
              className={`settings-nav-btn ${activeTab === 'thresholds' ? 'active' : ''}`}
              onClick={() => setActiveTab('thresholds')}
            >
              <Activity size={18} />
              <span>Safety Thresholds</span>
            </button>
            <button 
              className={`settings-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={18} />
              <span>User Management</span>
            </button>
            <button 
              className={`settings-nav-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnostics')}
            >
              <Server size={18} />
              <span>Broker & Network</span>
            </button>
          </div>
        )}
      </div>

      {/* Settings Content Body */}
      <div className="settings-content-pane">
        {/* ==========================================
            TAB 1: GENERAL & UI PREFERENCES
           ========================================== */}
        {activeTab === 'general' && (
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Display & Operator Preferences</h3>
              <p>Customize your workspace appearance, notification sounds, and dashboard defaults.</p>
            </div>

            <div className="settings-section-divider" />

            {/* Theme Preference */}
            <div className="settings-row-item">
              <div className="setting-info">
                <span className="setting-title">Interface Color Mode</span>
                <span className="setting-desc">Switch between Obsidian Dark Mode and Crisp Studio Light Mode</span>
              </div>
              <div className="theme-toggle-options">
                <button 
                  className={`theme-opt-btn ${theme === 'dark' ? 'active-theme' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <Moon size={16} /> Dark Mode
                </button>
                <button 
                  className={`theme-opt-btn ${theme === 'light' ? 'active-theme' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <Sun size={16} /> Light Mode
                </button>
              </div>
            </div>

            {/* Default Dashboard View */}
            <div className="settings-row-item">
              <div className="setting-info">
                <span className="setting-title">Default Dashboard View</span>
                <span className="setting-desc">Choose the default arrangement for fleet telemetry cards</span>
              </div>
              <div className="theme-toggle-options">
                <button 
                  className={`theme-opt-btn ${defaultView === 'HIERARCHY' ? 'active-theme' : ''}`}
                  onClick={() => handleDefaultViewChange('HIERARCHY')}
                >
                  <Layers size={16} /> Hierarchy (Train/Coach)
                </button>
                <button 
                  className={`theme-opt-btn ${defaultView === 'FLAT' ? 'active-theme' : ''}`}
                  onClick={() => handleDefaultViewChange('FLAT')}
                >
                  <LayoutGrid size={16} /> Flat Matrix
                </button>
              </div>
            </div>

            {/* Audio Alarm Alerts */}
            <div className="settings-row-item">
              <div className="setting-info">
                <span className="setting-title">Audio Alarms & Sound Alerts</span>
                <span className="setting-desc">Play an audible chime when critical threshold breaches occur</span>
              </div>
              <button 
                className={`toggle-switch-btn ${soundAlerts ? 'switch-enabled' : 'switch-disabled'}`}
                onClick={handleSoundAlertsToggle}
              >
                {soundAlerts ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{soundAlerts ? 'Alarms Enabled' : 'Muted'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: ACCOUNT SECURITY & PASSWORD
           ========================================== */}
        {activeTab === 'account' && (
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Account Security & Credentials</h3>
              <p>Manage your user identity and update your account password.</p>
            </div>

            <div className="settings-section-divider" />

            {/* User Profile Card */}
            <div className="user-profile-badge-box">
              <div className="profile-avatar-icon">
                <User size={24} />
              </div>
              <div className="profile-meta-wrap">
                <h4>{user?.username || 'Operator'}</h4>
                <div className="profile-role-row">
                  <span className={`role-pill ${user?.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                    <Shield size={12} /> {user?.role ? user.role.toUpperCase() : 'USER'}
                  </span>
                  {user?.email && <span className="profile-email-text">{user.email}</span>}
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="settings-form-block">
              <h4 className="form-sub-heading"><Key size={16} /> Change Password</h4>
              
              {passwordMsg.text && (
                <div className={`status-alert-box ${passwordMsg.isError ? 'box-error' : 'box-success'}`}>
                  {passwordMsg.text}
                </div>
              )}

              <div className="form-group-field">
                <label>Current Password</label>
                <input 
                  type="password" 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)} 
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-group-field">
                <label>New Password (min 6 characters)</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div className="form-group-field">
                <label>Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <button type="submit" className="btn-save-primary" disabled={isChangingPass}>
                {isChangingPass ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* ==========================================
            TAB 3: SAFETY THRESHOLDS (Admin Only)
           ========================================== */}
        {activeTab === 'thresholds' && isAdmin && (
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Fleet Safety & Voltage Thresholds</h3>
              <p>Configure global battery voltage alert points and hardware inactivity timers.</p>
            </div>

            <div className="settings-section-divider" />

            <form onSubmit={handleSaveThresholds} className="settings-form-block">
              {thresholdSaved && (
                <div className="status-alert-box box-success">
                  <Check size={16} /> Threshold settings saved successfully!
                </div>
              )}

              <div className="threshold-grid-inputs">
                <div className="form-group-field">
                  <label>Critical Low Battery Threshold (V)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={critVoltage} 
                    onChange={(e) => setCritVoltage(e.target.value)}
                    required
                  />
                  <small>Batteries below this level highlight in Rose Red (&lt; 11.2V).</small>
                </div>

                <div className="form-group-field">
                  <label>Warning Battery Threshold (V)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={warnVoltage} 
                    onChange={(e) => setWarnVoltage(e.target.value)}
                    required
                  />
                  <small>Batteries in this range highlight in Amber (11.2V - 12.0V).</small>
                </div>

                <div className="form-group-field">
                  <label>Node Inactivity / Offline Timeout (seconds)</label>
                  <input 
                    type="number" 
                    step="5" 
                    value={inactivityTimeout} 
                    onChange={(e) => setInactivityTimeout(e.target.value)}
                    required
                  />
                  <small>Nodes without telemetry for this duration are marked OFFLINE.</small>
                </div>
              </div>

              <button type="submit" className="btn-save-primary">
                Save Safety Thresholds
              </button>
            </form>
          </div>
        )}

        {/* ==========================================
            TAB 4: USER MANAGEMENT & RBAC (Admin Only)
           ========================================== */}
        {activeTab === 'users' && isAdmin && (
          <div className="settings-card">
            <div className="settings-card-header flex-between">
              <div>
                <h3>User Accounts & RBAC</h3>
                <p>Manage operator credentials and permission roles across the platform.</p>
              </div>
              <button 
                className="btn-add-action"
                onClick={() => setShowAddUserModal(true)}
              >
                <UserPlus size={16} /> Add User
              </button>
            </div>

            <div className="settings-section-divider" />

            {userActionMsg.text && (
              <div className={`status-alert-box ${userActionMsg.isError ? 'box-error' : 'box-success'}`}>
                {userActionMsg.text}
              </div>
            )}

            {isLoadingUsers ? (
              <div className="table-loading-wrap">Loading user accounts...</div>
            ) : (
              <div className="users-table-responsive">
                <table className="settings-data-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Email</th>
                      <th>Registered</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.username}</strong>
                          {u.id === user?.id && <span className="self-tag">(You)</span>}
                        </td>
                        <td>
                          <span className={`role-pill ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td>{u.email || '—'}</td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          {u.id !== user?.id && (
                            <button 
                              className="btn-delete-row"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              title="Delete User"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 5: SYSTEM & BROKER DIAGNOSTICS (Admin Only)
           ========================================== */}
        {activeTab === 'diagnostics' && isAdmin && (
          <div className="settings-card">
            <div className="settings-card-header flex-between">
              <div>
                <h3>EMQX Broker & System Diagnostics</h3>
                <p>Real-time connectivity and database pipeline diagnostic telemetry.</p>
              </div>
              <button className="btn-refresh-diag" onClick={fetchDiagnostics}>
                <RefreshCw size={15} /> Refresh
              </button>
            </div>

            <div className="settings-section-divider" />

            {isLoadingDiag ? (
              <div className="table-loading-wrap">Running diagnostics...</div>
            ) : diagnostics ? (
              <div className="diagnostics-grid-cards">
                {/* Broker Card */}
                <div className="diag-card">
                  <div className="diag-card-title">
                    <Wifi size={18} className="text-emerald" />
                    <span>EMQX Cloud MQTT Broker</span>
                  </div>
                  <div className="diag-card-body">
                    <div className="diag-stat-row">
                      <span>Status:</span>
                      <strong className="text-emerald">CONNECTED (TLS 8883)</strong>
                    </div>
                    <div className="diag-stat-row">
                      <span>Host:</span>
                      <code>{diagnostics.mqtt_broker.host}</code>
                    </div>
                    <div className="diag-stat-row">
                      <span>Subscription:</span>
                      <code>{diagnostics.mqtt_broker.topic_pattern}</code>
                    </div>
                  </div>
                </div>

                {/* Database Card */}
                <div className="diag-card">
                  <div className="diag-card-title">
                    <Database size={18} className="text-cyan" />
                    <span>Time-Series Storage</span>
                  </div>
                  <div className="diag-card-body">
                    <div className="diag-stat-row">
                      <span>Engine:</span>
                      <strong>{diagnostics.database.engine}</strong>
                    </div>
                    <div className="diag-stat-row">
                      <span>Hypertable:</span>
                      <code>{diagnostics.database.hypertable}</code>
                    </div>
                    <div className="diag-stat-row">
                      <span>Health:</span>
                      <strong className="text-emerald">{diagnostics.database.status}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Provision New User Account</h3>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group-field">
                  <label>Username</label>
                  <input 
                    type="text" 
                    value={newUsername} 
                    onChange={(e) => setNewUsername(e.target.value)} 
                    placeholder="e.g. operator2"
                    required
                  />
                </div>
                <div className="form-group-field">
                  <label>Email (Optional)</label>
                  <input 
                    type="email" 
                    value={newUserEmail} 
                    onChange={(e) => setNewUserEmail(e.target.value)} 
                    placeholder="e.g. operator@railway.in"
                  />
                </div>
                <div className="form-group-field">
                  <label>Password (min 6 characters)</label>
                  <input 
                    type="password" 
                    value={newUserPassword} 
                    onChange={(e) => setNewUserPassword(e.target.value)} 
                    placeholder="Enter secure password"
                    required
                  />
                </div>
                <div className="form-group-field">
                  <label>Role</label>
                  <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                    <option value="user">User (Read-only Telemetry)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
