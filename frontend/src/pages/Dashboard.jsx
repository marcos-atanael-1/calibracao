import { useState, useEffect } from 'react'
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

export default function Dashboard() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [stats, setStats] = useState({ total: 0, draft: 0, queued: 0, processing: 0, done: 0, error: 0 })
  const [qualityStats, setQualityStats] = useState({ pending_review: 0, in_review: 0, waiting_technician: 0, awaiting_final_validation: 0, approved: 0 })
  const [recent, setRecent] = useState([])

  useEffect(() => {
    if (user?.role === 'qualidade') {
      api.get('/quality/stats').then((r) => {
        setQualityStats(r.data?.data || { pending_review: 0, in_review: 0, waiting_technician: 0, awaiting_final_validation: 0, approved: 0 })
      }).catch(() => {})
      api.get('/quality/board').then((r) => {
        setRecent((r.data?.data || []).slice(0, 6))
      }).catch(() => {})
      return
    }

    api.get('/certificates/stats').then((r) => {
      setStats(r.data?.data || { total: 0, draft: 0, queued: 0, processing: 0, done: 0, error: 0 })
    }).catch(() => {})

    api.get('/certificates?page=1&per_page=5').then((r) => {
      setRecent(r.data?.data || [])
    }).catch(() => {})
  }, [user?.role])

  const cards = user?.role === 'qualidade'
    ? [
      { label: 'Para analisar', value: qualityStats.pending_review, icon: FileText, bg: '#e8eef8', color: '#002868' },
      { label: 'Em analise', value: qualityStats.in_review, icon: Clock, bg: '#f5f3ff', color: '#7c3aed' },
      { label: 'Aguardando tecnico', value: qualityStats.waiting_technician, icon: Clock, bg: '#fff7ed', color: '#b45309' },
      { label: 'Validacao final', value: qualityStats.awaiting_final_validation, icon: CheckCircle, bg: '#eef2ff', color: '#4338ca' },
      { label: 'Aprovados', value: qualityStats.approved, icon: CheckCircle, bg: '#d1fae5', color: '#047857' },
    ]
    : [
      { label: 'Total', value: stats.total, icon: FileText, bg: '#e8eef8', color: '#002868' },
      { label: 'Rascunhos', value: stats.draft, icon: Clock, bg: '#f3f4f6', color: '#4b5563' },
      { label: 'Na fila', value: stats.queued + stats.processing, icon: Clock, bg: '#fff7ed', color: '#b45309' },
      { label: 'Concluidos', value: stats.done, icon: CheckCircle, bg: '#d1fae5', color: '#047857' },
      { label: 'Erros', value: stats.error, icon: AlertCircle, bg: '#fee2e2', color: '#dc2626' },
    ]

  const statusLabels = {
    draft: { label: 'Rascunho', bg: '#f3f4f6', color: '#4b5563' },
    queued: { label: 'Na fila', bg: '#fef3c7', color: '#b45309' },
    processing: { label: 'Processando', bg: '#dbeafe', color: '#1d4ed8' },
    done: { label: 'Concluido', bg: '#d1fae5', color: '#047857' },
    error: { label: 'Erro', bg: '#fee2e2', color: '#dc2626' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '20px' }}>
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card" style={{ padding: '20px', transition: 'box-shadow 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>{card.label}</span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: card.bg,
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon style={{ width: '18px', height: '18px' }} />
                </div>
              </div>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
            {user?.role === 'qualidade' ? 'Fila recente da Qualidade' : 'Certificados Recentes'}
          </h3>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <FileText style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                    {user?.role === 'qualidade' ? 'Nenhum certificado aguardando a Qualidade' : 'Nenhum certificado ainda'}
                  </p>
            <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>
              {user?.role === 'qualidade' ? 'Assim que novos certificados chegarem, eles aparecerao aqui.' : 'Crie seu primeiro certificado para comecar'}
            </p>
          </div>
        ) : (
          recent.map((cert) => {
            const s = statusLabels[cert.status] || statusLabels.draft
            const serviceOrder = cert.service_order_number || '-'
            const company = cert.extra_fields?.empresa || '-'
            const client = cert.extra_fields?.contratante || '-'
            const instrument = cert.instrument_tag || cert.instrument_description || cert.extra_fields?.instrumento || '-'
            return (
              <div
                key={cert.id}
                style={{
                  padding: '14px 24px',
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'minmax(170px, 0.9fr) minmax(140px, 0.75fr) minmax(150px, 0.85fr) minmax(170px, 0.95fr) minmax(180px, 1fr) auto',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  gap: isMobile ? '10px' : '0',
                  borderBottom: '1px solid #f9fafb',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '14px',
                      background: '#eef4ff',
                      color: '#1d4ed8',
                      border: '1px solid #dbeafe',
                      fontSize: '13px',
                      fontWeight: 800,
                      letterSpacing: '0.01em',
                      width: 'fit-content',
                    }}
                  >
                    <span style={{ fontSize: '11px', opacity: 0.78 }}>O.S.</span>
                    <span style={{ fontSize: '16px', lineHeight: 1 }}>{serviceOrder}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Certificado
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{cert.certificate_number}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Empresa
                  </span>
                  <span style={{ fontSize: '14px', color: '#334155' }}>{company}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Cliente
                  </span>
                  <span style={{ fontSize: '14px', color: '#334155' }}>{client}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Instrumento
                  </span>
                  <span style={{ fontSize: '14px', color: '#334155' }}>{instrument}</span>
                </div>

                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: s.bg,
                    color: s.color,
                  }}
                >
                  {user?.role === 'qualidade'
                    ? ({
                      pending_review: 'Para analisar',
                      in_review: 'Em analise',
                      waiting_technician: 'Aguardando tecnico',
                      ready_for_reprocess: 'Nova geracao',
                      reprocessing: 'Reprocessando',
                      awaiting_final_validation: 'Validacao final',
                      approved: 'Aprovado',
                    }[cert.quality_status] || cert.quality_status || s.label)
                    : s.label}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
