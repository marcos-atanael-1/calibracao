import { useEffect, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import api from '../api/client'

function formatNotificationTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = async ({ nextOffset = offset, nextSearch = searchTerm, silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      })
      if (nextSearch.trim()) {
        params.set('search', nextSearch.trim())
      }

      const { data } = await api.get(`/notifications?${params.toString()}`)
      setItems(data?.data || [])
      setTotal(data?.meta?.total || 0)
      setUnreadCount(data?.meta?.unread_count || 0)
    } catch {
      setItems([])
      setTotal(0)
      setUnreadCount(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadNotifications({ nextOffset: 0, nextSearch: '' })
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOffset(0)
      setSearchTerm(searchInput)
      loadNotifications({ nextOffset: 0, nextSearch: searchInput })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`)
      setItems((prev) => prev.map((item) => (
        item.id === notificationId ? { ...item, is_read: true } : item
      )))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
      setUnreadCount(0)
    } catch {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div
        className="card"
        style={{
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Central de Notificacoes</h3>
          <p style={{ marginTop: '6px', fontSize: '13px', color: '#64748b' }}>
            {unreadCount > 0 ? `${unreadCount} nao lida(s)` : 'Todas as notificacoes estao lidas'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px solid #dbe2ea',
              borderRadius: '12px',
              background: '#ffffff',
              padding: '0 12px',
              minWidth: '320px',
            }}
          >
            <Search style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pesquisar por titulo ou mensagem"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                height: '42px',
                fontSize: '13px',
                background: 'transparent',
                color: '#111827',
              }}
            />
          </div>

          <button
            onClick={() => loadNotifications({ nextOffset: offset, nextSearch: searchTerm, silent: true })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #dbe2ea',
              background: '#ffffff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <RefreshCw style={{ width: '15px', height: '15px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: '#002868',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid #eef2f7', background: '#fafafa' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 180px 1fr 180px 140px',
              gap: '16px',
              padding: '14px 20px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#64748b',
            }}
          >
            <span>Status</span>
            <span>Tipo</span>
            <span>Notificacao</span>
            <span>Data</span>
            <span>Acoes</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Carregando notificacoes...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            Nenhuma notificacao encontrada.
          </div>
        ) : (
          items.map((notification) => (
            <div
              key={notification.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 180px 1fr 180px 140px',
                gap: '16px',
                padding: '18px 20px',
                borderBottom: '1px solid #f1f5f9',
                background: notification.is_read ? '#ffffff' : '#f8fbff',
                alignItems: 'start',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  background: notification.is_read ? '#e5e7eb' : '#dbeafe',
                  color: notification.is_read ? '#475569' : '#1d4ed8',
                }}
              >
                {notification.is_read ? 'Lida' : 'Nao lida'}
              </span>

              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                {notification.notification_type}
              </span>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  {notification.title}
                </div>
                <div style={{ marginTop: '6px', fontSize: '13px', lineHeight: 1.6, color: '#475569' }}>
                  {notification.message}
                </div>
              </div>

              <span style={{ fontSize: '13px', color: '#64748b' }}>
                {formatNotificationTime(notification.created_at)}
              </span>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                {!notification.is_read ? (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Marcar como lida
                  </button>
                ) : (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sem acao</span>
                )}
              </div>
            </div>
          ))
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: '#fafafa',
          }}
        >
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Pagina {currentPage} de {totalPages}
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                const nextOffset = Math.max(0, offset - PAGE_SIZE)
                setOffset(nextOffset)
                loadNotifications({ nextOffset, nextSearch: searchTerm })
              }}
              disabled={offset === 0}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #dbe2ea',
                background: offset === 0 ? '#f8fafc' : '#ffffff',
                color: offset === 0 ? '#94a3b8' : '#334155',
                cursor: offset === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Anterior
            </button>
            <button
              onClick={() => {
                const nextOffset = offset + PAGE_SIZE
                setOffset(nextOffset)
                loadNotifications({ nextOffset, nextSearch: searchTerm })
              }}
              disabled={offset + PAGE_SIZE >= total}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #dbe2ea',
                background: offset + PAGE_SIZE >= total ? '#f8fafc' : '#ffffff',
                color: offset + PAGE_SIZE >= total ? '#94a3b8' : '#334155',
                cursor: offset + PAGE_SIZE >= total ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Proxima
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
