import { useEffect, useState, useMemo } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useAuthStore } from '../../store/authStore';
import { DeviceModal } from '../dashboard/DeviceModal';
import { Plus, Train, MapPin, Edit, Trash2, Server } from 'lucide-react';
import api from '../../utils/api';

export const ManageDevicesPage = () => {
  const { devices, isLoading, fetchDevices } = useDeviceStore();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState(null);
  const [initialData, setInitialData] = useState(null);
  
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this device? This will also delete all its telemetry history.')) {
      try {
        await api.delete(`/devices/${id}`);
        fetchDevices();
      } catch (err) {
        console.error("Failed to delete device", err);
        const msg = err.response?.data?.detail || err.message || "Failed to delete device";
        alert(`Failed to delete device: ${msg}`);
      }
    }
  };

  const handleEdit = (device) => {
    setDeviceToEdit(device);
    setIsModalOpen(true);
  };

  // Group devices by Train -> Coach
  const grouped = useMemo(() => {
    const map = {}; // train -> coach -> devices[]
    devices.forEach(d => {
      const train = d.train_no || 'Unassigned Train';
      const coach = d.coach_no || 'Unassigned Coach';
      if (!map[train]) map[train] = {};
      if (!map[train][coach]) map[train][coach] = [];
      map[train][coach].push(d);
    });
    return map;
  }, [devices]);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Manage Devices</h2>
        {user?.role === 'admin' && (
          <button 
            onClick={() => { setDeviceToEdit(null); setInitialData(null); setIsModalOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: 'var(--status-green)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            <Plus size={18} /> Add Device
          </button>
        )}
      </div>
      
      {isLoading && devices.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading devices...</p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No devices found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Add a new device to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0])).map(([trainName, coaches]) => (
            <div key={trainName} className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Train size={20} color="var(--text-secondary)" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Train: {trainName}</h3>
                {user?.role === 'admin' && trainName !== 'Unassigned Train' && (
                  <button 
                    onClick={() => { setDeviceToEdit(null); setInitialData({ train_no: trainName }); setIsModalOpen(true); }}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(46, 204, 113, 0.1)', color: 'var(--status-green)', border: '1px solid rgba(46, 204, 113, 0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  >
                    <Plus size={14} /> Add to Train
                  </button>
                )}
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {Object.entries(coaches).sort((a,b) => a[0].localeCompare(b[0])).map(([coachName, coachDevices]) => (
                  <div key={coachName}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                      Coach: {coachName}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                      {coachDevices.map(device => (
                        <div key={device.id} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{device.name || 'Unnamed Device'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Server size={12} /> MAC: {device.mac_address}
                            </div>
                            {device.location && (
                               <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                 <MapPin size={12} /> {device.location}
                               </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {user?.role === 'admin' && (
                              <>
                                <button onClick={() => handleEdit(device)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Edit size={16} /></button>
                                <button onClick={() => handleDelete(device.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--status-red)' }}><Trash2 size={16} /></button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <DeviceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} device={deviceToEdit} initialData={initialData} />
    </div>
  );
};
