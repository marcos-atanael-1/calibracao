import { useState, useEffect } from 'react'
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../api/client'

export default function Dashboard() {
  const [stats] = useState({ total: 0, draft: 0, queued: 0, done: 0, error: 0 })
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api.get('/certificates?per_page=5').then(r => {
      setRecent(r.data?.data || [])
    }).catch(() => {})
  }, [])

  const cards = [
    { label: 'Total', value: stats.total, icon: FileText, bg: '#e8eef8', color: '#002868' },
    { label: 'Rascunhos', value: stats.draft, icon: Clock, bg: '#f3f4f6', color: '#4b5563' },
    { label: 'Concluídos', value: stats.done, icon: CheckCircle, bg: '#d1fae5', color: '#047857' },
    { label: 'Erros', value: stats.error, icon: AlertCircle, bg: '#fee2e2', color: '#dc2626' },
  ]

  const statusLabels = {
    draft: { label: 'Rascunho', bg: '#f3f4f6', color: '#4b5563' },
    queued: { label: 'Na Fila', bg: '#fef3c7', color: '#b45309' },
    processing: { label: 'Processando', bg: '#dbeafe', color: '#1d4ed8' },
    done: { label: 'Concluído', bg: '#d1fae5', color: '#047857' },
    error: { label: 'Erro', bg: '#fee2e2', color: '#dc2626' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card" style={{ padding: '20px', transition: 'box-shadow 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>{card.label}</span>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: card.bg, color: card.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon style={{ width: '18px', height: '18px' }} />
                </div>
              </div>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Recent Certificates */}
      <div className="card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Certificados Recentes</h3>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <FileText style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>Nenhum certificado ainda</p>
            <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>Crie seu primeiro certificado para começar</p>
          </div>
        ) : (
          recent.map((cert) => {
            const s = statusLabels[cert.status] || statusLabels.draft
            return (
              <div key={cert.id} style={{
                padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid #f9fafb', transition: 'background 0.15s', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{cert.certificate_number}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    {cert.instrument_tag || cert.instrument_description || '—'}
                  </p>
                </div>
                <span style={{
                  fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '9999px',
                  background: s.bg, color: s.color,
                }}>{s.label}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
