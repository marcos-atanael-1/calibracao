import { NavLink, useLocation } from 'react-router-dom'
import { getVisibleNavItems } from './navigation'
import { useAuth } from '../../context/AuthContext'

export default function MobileNav() {
  const { user } = useAuth()
  const location = useLocation()
  const items = getVisibleNavItems(user?.role)

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: '10px',
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid #e5e7eb',
        borderRadius: '18px',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
        padding: '8px 6px',
        display: 'none',
        alignItems: 'stretch',
        gap: '4px',
        overflowX: 'auto',
        zIndex: 45,
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))

        return (
          <NavLink
            key={item.to}
            to={item.to}
            style={{
              minWidth: '72px',
              flex: '1 1 0',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              borderRadius: '14px',
              padding: '8px 10px',
              color: isActive ? '#002868' : '#64748b',
              background: isActive ? '#e8eef8' : 'transparent',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 600,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon style={{ width: '17px', height: '17px' }} />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
