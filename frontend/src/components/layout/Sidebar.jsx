import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Settings,
  Bot,
  Users,
  SlidersHorizontal,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/certificates', label: 'Certificados', icon: FileText },
  { to: '/templates', label: 'Templates', icon: Settings },
  { to: '/queue', label: 'Agente', icon: Bot },
  { to: '/settings', label: 'Configuracoes', icon: SlidersHorizontal, adminOnly: true },
  { to: '/users', label: 'Usuários', icon: Users, adminOnly: true },
]

export default function Sidebar({ collapsed }) {
  const { user } = useAuth()
  const location = useLocation()

  const width = collapsed ? '68px' : '256px'

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width,
      background: '#ffffff', borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', zIndex: 30,
      transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      overflow: 'hidden',
    }}>
      <div style={{
        height: '64px', display: 'flex', alignItems: 'center',
        gap: collapsed ? '0' : '12px',
        padding: collapsed ? '0 16px' : '0 24px',
        borderBottom: '1px solid #f3f4f6',
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'padding 0.25s ease',
      }}>
        <img
          src="/logo-sidebar.jpg"
          alt="Elus"
          style={{
            width: '36px', height: '36px', borderRadius: '8px',
            objectFit: 'contain', flexShrink: 0,
            imageRendering: 'auto',
          }}
        />
        {!collapsed && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <h1 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>Calibracao</h1>
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>Sistema de Certificados</p>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        {navItems
          .filter(item => !item.adminOnly || user?.role === 'admin' || user?.role === 'super_admin')
          .map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to))

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? '0' : '12px',
                  padding: collapsed ? '10px' : '10px 12px',
                  borderRadius: '8px',
                  fontSize: '14px', fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  color: isActive ? '#002868' : '#6b7280',
                  background: isActive ? '#e8eef8' : 'transparent',
                  borderLeft: isActive ? '3px solid #002868' : '3px solid transparent',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                {!collapsed && item.label}
              </NavLink>
            )
          })}
      </nav>
    </aside>
  )
}
