import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import Certificates from './pages/Certificates'
import CertificateForm from './pages/CertificateForm'
import Templates from './pages/Templates'
import Queue from './pages/Queue'
import NotificationsPage from './pages/Notifications'
import UsersPage from './pages/Users'
import SettingsPage from './pages/Settings'
import AISetupPage from './pages/AISetup'
import { canAccessModule } from './utils/access'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  // Force password change on first login
  if (user.must_change_password) return <ChangePassword />
  return children
}

function ModuleRoute({ moduleKey, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.must_change_password) return <ChangePassword />
  if (!canAccessModule(user.role, moduleKey)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<ModuleRoute moduleKey="dashboard"><Dashboard /></ModuleRoute>} />
        <Route path="certificates" element={<ModuleRoute moduleKey="certificates"><Certificates /></ModuleRoute>} />
        <Route path="certificates/new" element={<ModuleRoute moduleKey="certificates"><CertificateForm /></ModuleRoute>} />
        <Route path="certificates/:id/edit" element={<ModuleRoute moduleKey="certificates"><CertificateForm /></ModuleRoute>} />
        <Route path="templates" element={<ModuleRoute moduleKey="templates"><Templates /></ModuleRoute>} />
        <Route path="queue" element={<ModuleRoute moduleKey="queue"><Queue /></ModuleRoute>} />
        <Route path="notifications" element={<ModuleRoute moduleKey="notifications"><NotificationsPage /></ModuleRoute>} />
        <Route path="users" element={<ModuleRoute moduleKey="users"><UsersPage /></ModuleRoute>} />
        <Route path="settings" element={<ModuleRoute moduleKey="settings"><SettingsPage /></ModuleRoute>} />
        <Route path="ai-setup" element={<ModuleRoute moduleKey="ai_setup"><AISetupPage /></ModuleRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
