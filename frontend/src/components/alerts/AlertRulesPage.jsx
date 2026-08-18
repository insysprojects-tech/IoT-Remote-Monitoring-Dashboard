import { useEffect, useState } from 'react';
import { useAlertStore } from '../../store/alertStore';
import { useAuthStore } from '../../store/authStore';
import { useDeviceStore } from '../../store/deviceStore';
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  Check,
  CheckCheck,
  X,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.12)' },
  warning: { icon: AlertTriangle, color: '#f39c12', bg: 'rgba(243, 156, 18, 0.12)' },
  info: { icon: Info, color: '#3498db', bg: 'rgba(52, 152, 219, 0.12)' },
};

const METRIC_OPTIONS = [
  { value: 'battery_1_voltage', label: 'Battery 1 Voltage' },
  { value: 'battery_2_voltage', label: 'Battery 2 Voltage' },
];

const OPERATOR_OPTIONS = [
  { value: '<', label: 'Less than (<)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '<=', label: 'Less or equal (≤)' },
  { value: '>=', label: 'Greater or equal (≥)' },
  { value: '==', label: 'Equal to (=)' },
];

// ========================================
// Create Rule Modal
// ========================================
const CreateRuleModal = ({ isOpen, onClose, devices, onSubmit }) => {
  const [formData, setFormData] = useState({
    device_id: '',
    metric: 'battery_1_voltage',
    operator: '<',
    threshold: 11.0,
    severity: 'warning',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({
        device_id: '',
        metric: 'battery_1_voltage',
        operator: '<',
        threshold: 11.0,
        severity: 'warning',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Bell size={20} /> New Alert Rule</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Device</label>
            <select
              value={formData.device_id}
              onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
              required
            >
              <option value="">Select a device...</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.mac_address}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Metric</label>
              <select
                value={formData.metric}
                onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
              >
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Operator</label>
              <select
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
              >
                {OPERATOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Threshold (V)</label>
              <input
                type="number"
                step="0.1"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label>Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Rule Preview */}
          <div className="rule-preview">
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Rule Preview:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
              Alert when{' '}
              <span style={{ color: 'var(--status-amber)' }}>
                {METRIC_OPTIONS.find((m) => m.value === formData.metric)?.label}
              </span>{' '}
              is {formData.operator} <span style={{ color: 'var(--status-red)' }}>{formData.threshold}V</span>
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !formData.device_id}>
              {isSubmitting ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================
// Main Alerts Page
// ========================================
export const AlertRulesPage = () => {
  const { rules, events, fetchRules, fetchEvents, createRule, deleteRule, updateRule, acknowledgeEvent, acknowledgeAll } = useAlertStore();
  const { user } = useAuthStore();
  const { devices, fetchDevices } = useDeviceStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('events');
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    fetchRules();
    fetchEvents({ limit: 100 });
    fetchDevices();
  }, [fetchRules, fetchEvents, fetchDevices]);

  const handleToggleRule = async (rule) => {
    await updateRule(rule.id, { enabled: !rule.enabled });
  };

  const handleDeleteRule = async (ruleId) => {
    if (window.confirm('Delete this alert rule? All associated events will also be deleted.')) {
      await deleteRule(ruleId);
    }
  };

  const filteredEvents = severityFilter === 'all'
    ? events
    : events.filter((e) => e.severity === severityFilter);

  return (
    <div className="alerts-page">
      {/* Page Header */}
      <div className="alerts-page-header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
            <Bell size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Alerts & Notifications
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '14px' }}>
            Configure threshold rules and view triggered alerts
          </p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} /> New Rule
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="alerts-tabs">
        <button
          className={`alerts-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <AlertTriangle size={16} />
          Alert Events
          {events.filter((e) => !e.acknowledged).length > 0 && (
            <span className="tab-badge">{events.filter((e) => !e.acknowledged).length}</span>
          )}
        </button>
        <button
          className={`alerts-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <Bell size={16} />
          Alert Rules
          <span className="tab-badge-subtle">{rules.length}</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'events' && (
        <div className="alerts-events-section">
          {/* Filters */}
          <div className="alerts-filters">
            <div className="filter-group">
              <Filter size={16} />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            {events.some((e) => !e.acknowledged) && (
              <button className="btn-outline" onClick={acknowledgeAll}>
                <CheckCheck size={16} /> Acknowledge All
              </button>
            )}
          </div>

          {/* Events List */}
          {filteredEvents.length === 0 ? (
            <div className="alerts-empty card">
              <Bell size={48} style={{ opacity: 0.2 }} />
              <h3>No alerts</h3>
              <p>When alert rules are triggered, events will appear here.</p>
            </div>
          ) : (
            <div className="alerts-events-list">
              {filteredEvents.map((event) => {
                const config = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.warning;
                const SeverityIcon = config.icon;
                const timeAgo = event.triggered_at
                  ? formatDistanceToNow(new Date(event.triggered_at), { addSuffix: true })
                  : '';

                return (
                  <div
                    key={event.id}
                    className={`alert-event-card card ${event.acknowledged ? 'acknowledged' : ''}`}
                    style={{ borderLeft: `4px solid ${config.color}` }}
                  >
                    <div className="alert-event-icon" style={{ color: config.color, background: config.bg }}>
                      <SeverityIcon size={20} />
                    </div>
                    <div className="alert-event-body">
                      <div className="alert-event-top">
                        <span className="alert-event-severity" style={{ color: config.color }}>
                          {event.severity.toUpperCase()}
                        </span>
                        <span className="alert-event-device">{event.device_name || 'Unknown'}</span>
                        <span className="alert-event-time">{timeAgo}</span>
                      </div>
                      <p className="alert-event-message">
                        {event.message || `${event.metric}: ${event.value}`}
                      </p>
                    </div>
                    {!event.acknowledged && (
                      <button
                        className="btn-ack"
                        onClick={() => acknowledgeEvent(event.id)}
                        title="Acknowledge"
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="alerts-rules-section">
          {rules.length === 0 ? (
            <div className="alerts-empty card">
              <Bell size={48} style={{ opacity: 0.2 }} />
              <h3>No alert rules configured</h3>
              <p>Create a rule to start monitoring your devices.</p>
              {user?.role === 'admin' && (
                <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={18} /> Create First Rule
                </button>
              )}
            </div>
          ) : (
            <div className="alerts-rules-grid">
              {rules.map((rule) => {
                const config = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.warning;
                const SeverityIcon = config.icon;
                return (
                  <div key={rule.id} className={`alert-rule-card card ${!rule.enabled ? 'disabled' : ''}`}>
                    <div className="rule-card-header">
                      <div className="rule-severity-badge" style={{ color: config.color, background: config.bg }}>
                        <SeverityIcon size={16} />
                        {rule.severity.toUpperCase()}
                      </div>
                      {user?.role === 'admin' && (
                        <div className="rule-card-actions">
                          <button
                            className="rule-toggle-btn"
                            onClick={() => handleToggleRule(rule)}
                            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                          >
                            {rule.enabled
                              ? <ToggleRight size={24} style={{ color: 'var(--status-green)' }} />
                              : <ToggleLeft size={24} style={{ color: 'var(--text-muted)' }} />
                            }
                          </button>
                          <button
                            className="rule-delete-btn"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="Delete rule"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="rule-card-body">
                      <p className="rule-condition">
                        <span className="rule-metric">
                          {METRIC_OPTIONS.find((m) => m.value === rule.metric)?.label || rule.metric}
                        </span>
                        <span className="rule-operator">{rule.operator}</span>
                        <span className="rule-threshold">{rule.threshold}V</span>
                      </p>
                      <p className="rule-device">{rule.device_name || 'Unknown Device'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Rule Modal */}
      <CreateRuleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        devices={devices}
        onSubmit={createRule}
      />
    </div>
  );
};
