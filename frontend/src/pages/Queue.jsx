import { useEffect, useState } from 'react'
import { RefreshCw, Bot } from 'lucide-react'
import api from '../api/client'

const statusLabels = {
  pending: { label: 'Aguardando Agente', bg: '#fef3c7', color: '#b45309' },
  processing: { label: 'Processando', bg: '#dbeafe', color: '#1d4ed8' },
  done: { label: 'Concluido', bg: '#d1fae5', color: '#047857' },
  error: { label: 'Erro', bg: '#fee2e2', color: '#dc2626' },
}

export default function Queue() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data } = await api.get('/queue')
      setItems(data.data || [])
    } catch (e) {
    } finally {
      setLoading(false)
    }
  }

  const retry = async (id) => {
    try {
      await api.post(`/queue/${id}/retry`)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '14px', color: '#111827', fontWeight: 600 }}>Agente de processamento</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{items.length} item(s) aguardando ou processados pelo agente</p>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
            borderRadius: '8px', fontSize: '13px', color: '#4b5563', background: '#ffffff',
            border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
        >
          <RefreshCw style={{ width: '16px', height: '16px' }} /> Atualizar
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['CERTIFICADO', 'STATUS', 'TENTATIVAS', 'ERRO', 'CRIADO EM', 'ACOES'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'ACOES' ? 'right' : 'left',
                  padding: '12px 24px', fontSize: '11px', fontWeight: 600,
                  color: '#6b7280', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>Carregando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center' }}>
                <Bot style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>Nenhum item para o agente</p>
              </td></tr>
            ) : items.map(item => {
              const s = statusLabels[item.status] || statusLabels.pending
              return (
                <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '14px 24px', fontSize: '13px', fontFamily: 'monospace', color: '#4b5563' }}>{item.certificate_id?.slice(0, 8)}...</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '9999px', background: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '14px 24px', fontSize: '14px', color: '#6b7280' }}>{item.retry_count}/{item.max_retries}</td>
                  <td style={{ padding: '14px 24px', fontSize: '12px', color: '#dc2626', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.error_message || '-'}</td>
                  <td style={{ padding: '14px 24px', fontSize: '14px', color: '#9ca3af' }}>{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    {item.status === 'error' && (
                      <button onClick={() => retry(item.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Reprocessar</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
