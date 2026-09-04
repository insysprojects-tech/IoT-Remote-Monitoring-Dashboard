import React, { useEffect, useState, useMemo } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { DeviceCard } from './DeviceCard';
import { DashboardStats } from './DashboardStats';
import { isDeviceOnline } from '../../utils/deviceStatus';
import { 
  Filter, 
  Search, 
  Train, 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  SlidersHorizontal, 
  LayoutGrid, 
  Radio, 
  Wifi, 
  WifiOff, 
  X,
  Layers,
  Grid3X3,
  Check
} from 'lucide-react';

export const DeviceGrid = () => {
  const { devices, isLoading, error, fetchDevices } = useDeviceStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrain, setSelectedTrain] = useState('ALL');
  const [selectedCoach, setSelectedCoach] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ONLINE' | 'OFFLINE'
  const [viewMode, setViewMode] = useState('HIERARCHY'); // 'HIERARCHY' | 'FLAT'
  const [collapsedTrains, setCollapsedTrains] = useState({});

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Unique Trains list for filter dropdown and quick-select pills
  const uniqueTrains = useMemo(() => {
    const trains = new Set();
    devices.forEach(d => { if (d.train_no) trains.add(d.train_no); });
    return Array.from(trains).sort();
  }, [devices]);

  // Unique Coaches for selected train
  const uniqueCoaches = useMemo(() => {
    if (selectedTrain === 'ALL') {
      const coaches = new Set();
      devices.forEach(d => { if (d.coach_no) coaches.add(d.coach_no); });
      return Array.from(coaches).sort();
    }
    const coaches = new Set();
    devices.forEach(d => {
      if (d.train_no === selectedTrain && d.coach_no) coaches.add(d.coach_no);
    });
    return Array.from(coaches).sort();
  }, [devices, selectedTrain]);

  // Reset coach selection when train changes
  useEffect(() => {
    setSelectedCoach('ALL');
  }, [selectedTrain]);

  // Filter devices based on Search Term, Selected Train, Coach, and Status
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      // 1. Train filter
      if (selectedTrain !== 'ALL' && d.train_no !== selectedTrain) {
        return false;
      }
      // 2. Coach filter
      if (selectedCoach !== 'ALL' && d.coach_no !== selectedCoach) {
        return false;
      }
      // 3. Online/Offline filter
      const isOnline = isDeviceOnline(d);
      if (statusFilter === 'ONLINE' && !isOnline) return false;
      if (statusFilter === 'OFFLINE' && isOnline) return false;

      // 4. Smart Multi-Field Search (Train No, Coach No, Name, MAC, Location)
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase().replace(/:/g, '');
        const macClean = (d.mac_address || '').toLowerCase().replace(/:/g, '');
        const trainMatch = (d.train_no || '').toLowerCase().includes(query);
        const coachMatch = (d.coach_no || '').toLowerCase().includes(query);
        const nameMatch = (d.name || '').toLowerCase().includes(query);
        const macMatch = macClean.includes(query) || (d.mac_address || '').toLowerCase().includes(query);
        const locMatch = (d.location || '').toLowerCase().includes(query);
        const typeMatch = (d.device_type || '').toLowerCase().includes(query);
        
        if (!trainMatch && !coachMatch && !nameMatch && !macMatch && !locMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [devices, selectedTrain, selectedCoach, statusFilter, searchTerm]);

  // Group filtered devices by Train -> Coach
  const groupedDevices = useMemo(() => {
    const map = {};
    filteredDevices.forEach(d => {
      const train = d.train_no || 'Unassigned Fleet';
      const coach = d.coach_no || 'General Coach';
      if (!map[train]) map[train] = {};
      if (!map[train][coach]) map[train][coach] = [];
      map[train][coach].push(d);
    });
    return map;
  }, [filteredDevices]);

  const toggleTrainCollapse = (trainName) => {
    setCollapsedTrains(prev => ({
      ...prev,
      [trainName]: !prev[trainName]
    }));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedTrain('ALL');
    setSelectedCoach('ALL');
    setStatusFilter('ALL');
  };

  const isFiltered = searchTerm !== '' || selectedTrain !== 'ALL' || selectedCoach !== 'ALL' || statusFilter !== 'ALL';

  if (isLoading && devices.length === 0) {
    return (
      <div className="dashboard-loading-state">
        <div className="pulse-spinner" />
        <h3>Connecting to Live Telemetry Stream...</h3>
        <p>Fetching active FSDS monitoring nodes and fleet registry.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error-banner">
        <h3>Communication Failure</h3>
        <p>{error}</p>
        <button onClick={() => fetchDevices()} className="btn-retry">
          <RefreshCw size={14} /> Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* 1. Fleet KPI Stats Ribbon */}
      <DashboardStats devices={devices} />

      {/* 2. Instant Search & Smart Multi-Filter Bar */}
      <div className="dashboard-filter-ribbon">
        {/* Main Toolbar Controls */}
        <div className="filter-ribbon-top">
          {/* Instant Search Bar */}
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text"
              className="search-input"
              placeholder="Instant Search: Train #, Coach #, MAC address, or Node name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchTerm(''); }}
            />
            {searchTerm && (
              <button 
                className="clear-search-btn" 
                onClick={() => setSearchTerm('')}
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dropdowns & Action Controls */}
          <div className="filter-controls-group">
            {/* Train Dropdown */}
            <div className="filter-select-wrapper">
              <Train size={14} className="filter-select-icon" />
              <select 
                value={selectedTrain} 
                onChange={(e) => setSelectedTrain(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Trains ({uniqueTrains.length})</option>
                {uniqueTrains.map(t => (
                  <option key={t} value={t}>Train {t}</option>
                ))}
              </select>
            </div>

            {/* Coach Dropdown */}
            <div className="filter-select-wrapper">
              <LayoutGrid size={14} className="filter-select-icon" />
              <select 
                value={selectedCoach} 
                onChange={(e) => setSelectedCoach(e.target.value)}
                className="filter-select"
                disabled={uniqueCoaches.length === 0}
              >
                <option value="ALL">All Coaches ({uniqueCoaches.length})</option>
                {uniqueCoaches.map(c => (
                  <option key={c} value={c}>Coach {c}</option>
                ))}
              </select>
            </div>

            {/* Live Status Filter Chips */}
            <div className="status-toggle-chips">
              <button 
                className={`status-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                All
              </button>
              <button 
                className={`status-chip chip-online ${statusFilter === 'ONLINE' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ONLINE')}
              >
                <span className="chip-dot dot-green" /> Live
              </button>
              <button 
                className={`status-chip chip-offline ${statusFilter === 'OFFLINE' ? 'active' : ''}`}
                onClick={() => setStatusFilter('OFFLINE')}
              >
                <span className="chip-dot dot-gray" /> Offline
              </button>
            </div>

            {/* View Mode Toggle: Hierarchy vs Flat */}
            <div className="view-mode-toggles">
              <button 
                className={`view-mode-btn ${viewMode === 'HIERARCHY' ? 'active' : ''}`}
                onClick={() => setViewMode('HIERARCHY')}
                title="Fleet Hierarchy View (Train -> Coach -> Device)"
              >
                <Layers size={15} />
              </button>
              <button 
                className={`view-mode-btn ${viewMode === 'FLAT' ? 'active' : ''}`}
                onClick={() => setViewMode('FLAT')}
                title="Compact Grid View"
              >
                <Grid3X3 size={15} />
              </button>
            </div>

            {/* Reset Filters */}
            {isFiltered && (
              <button className="btn-reset-filters" onClick={clearAllFilters} title="Reset all filters">
                <X size={14} /> Reset
              </button>
            )}

            {/* Refresh Button */}
            <button className="btn-refresh-data" onClick={() => fetchDevices()} title="Refresh live fleet data">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Quick-Select Train Pills Ribbon */}
        {uniqueTrains.length > 0 && (
          <div className="quick-train-pills-bar">
            <span className="quick-filter-label">Quick Fleets:</span>
            <button 
              className={`train-filter-pill ${selectedTrain === 'ALL' ? 'active-pill' : ''}`}
              onClick={() => setSelectedTrain('ALL')}
            >
              All Fleets ({devices.length})
            </button>
            {uniqueTrains.map(trainNum => {
              const trainCount = devices.filter(d => d.train_no === trainNum).length;
              return (
                <button
                  key={trainNum}
                  className={`train-filter-pill ${selectedTrain === trainNum ? 'active-pill' : ''}`}
                  onClick={() => setSelectedTrain(selectedTrain === trainNum ? 'ALL' : trainNum)}
                >
                  <Train size={12} className="pill-icon" />
                  <span>Train {trainNum}</span>
                  <span className="pill-badge">{trainCount}</span>
                </button>
              );
            })}

            {/* Results Counter */}
            <span className="filtered-results-counter">
              Showing <strong>{filteredDevices.length}</strong> of {devices.length} Nodes
            </span>
          </div>
        )}
      </div>

      {/* 3. Telemetry Stream Output (Default: Shows all active trains immediately) */}
      {filteredDevices.length === 0 ? (
        <div className="empty-dashboard-card">
          <div className="empty-icon-circle">
            <Radio size={32} />
          </div>
          <h3>No Telemetry Nodes Match Filter</h3>
          <p>No active monitoring nodes match your current search query or filter selection.</p>
          {isFiltered && (
            <button className="btn-primary-action" onClick={clearAllFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'FLAT' ? (
        /* Flat Grid View */
        <div className="flat-telemetry-grid">
          {filteredDevices.map(device => (
            <DeviceCard 
              key={device.id || device.mac_address}
              device={device}
              hideActions={true}
            />
          ))}
        </div>
      ) : (
        /* Hierarchy View: Grouped by Train -> Coach -> Device */
        <div className="fleet-hierarchy-stream">
          {Object.entries(groupedDevices).sort((a,b) => a[0].localeCompare(b[0])).map(([trainName, coaches]) => {
            const isCollapsed = collapsedTrains[trainName];
            const trainDevicesList = Object.values(coaches).flat();
            const onlineCount = trainDevicesList.filter(d => isDeviceOnline(d)).length;
            const coachCount = Object.keys(coaches).length;

            return (
              <div key={trainName} className="train-fleet-card">
                {/* Train Header Banner */}
                <div 
                  className="train-fleet-header"
                  onClick={() => toggleTrainCollapse(trainName)}
                >
                  <div className="train-header-left">
                    <div className="train-avatar-badge">
                      <Train size={18} />
                    </div>
                    <div className="train-title-wrap">
                      <h3 className="train-name-heading">
                        {trainName === 'Unassigned Fleet' ? trainName : `Train: ${trainName}`}
                      </h3>
                      <span className="train-metrics-badge">
                        {coachCount} {coachCount === 1 ? 'Coach' : 'Coaches'} • {trainDevicesList.length} Nodes
                      </span>
                    </div>
                  </div>

                  <div className="train-header-right">
                    <div className="train-live-pill">
                      <span className={`pill-pulse-dot ${onlineCount > 0 ? 'pulse-green' : 'pulse-gray'}`} />
                      <span>{onlineCount} / {trainDevicesList.length} Live</span>
                    </div>
                    <button className="train-collapse-btn">
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Train Coaches & Telemetry Grid (Collapsible) */}
                {!isCollapsed && (
                  <div className="train-fleet-body">
                    {Object.entries(coaches).sort((a,b) => a[0].localeCompare(b[0])).map(([coachName, coachDevices]) => (
                      <div key={coachName} className="coach-section-block">
                        <div className="coach-section-header">
                          <div className="coach-stripe-indicator" />
                          <h4 className="coach-section-title">
                            {coachName === 'General Coach' ? coachName : `Coach: ${coachName}`}
                          </h4>
                          <span className="coach-node-count">({coachDevices.length} Nodes)</span>
                        </div>

                        <div className="device-telemetry-grid">
                          {coachDevices.map(device => (
                            <DeviceCard 
                              key={device.id || device.mac_address}
                              device={device}
                              hideActions={true}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
