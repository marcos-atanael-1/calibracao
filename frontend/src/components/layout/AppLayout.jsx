import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const sidebarWidth = collapsed ? 68 : 256

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar collapsed={collapsed} />

      {/* Toggle button — rendered outside sidebar so it's never clipped */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'fixed',
          left: sidebarWidth - 12,
          top: '24px',
          width: '24px', height: '24px', borderRadius: '50%',
          background: '#ffffff', border: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 40,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed
          ? <ChevronRight style={{ width: '14px', height: '14px', color: '#6b7280' }} />
          : <ChevronLeft style={{ width: '14px', height: '14px', color: '#6b7280' }} />
        }
      </button>

      <div style={{
        flex: 1,
        marginLeft: sidebarWidth + 'px',
        transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <Header />
        <main style={{ padding: '32px' }} className="animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
