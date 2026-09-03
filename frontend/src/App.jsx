import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DeviceGrid } from './components/dashboard/DeviceGrid';
import { DeviceDetail } from './components/device/DeviceDetail';
import { LoginPage } from './components/auth/LoginPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AlertRulesPage } from './components/alerts/AlertRulesPage';
import { ManageDevicesPage } from './components/device/ManageDevicesPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ToastContainer } from './components/alerts/Toast';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<DeviceGrid />} />
                  <Route path="/manage-devices" element={<ManageDevicesPage />} />
                  <Route path="/device/:id" element={<DeviceDetail />} />
                  <Route path="/alerts" element={<AlertRulesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </AppLayout>
              <ToastContainer />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
