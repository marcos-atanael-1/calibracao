import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Eye,
  Bot,
  Download,
  Building2,
  UserRound,
  Filter,
  LoaderCircle,
  RefreshCw,
  MessageSquare,
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

const statusMeta = {
  draft: {
    label: 'Rascunho',
    bg: '#f3f4f6',
    color: '#4b5563',
    accent: '#6b7280',
    agentTitle: 'Certificado em rascunho',
    agentMessage: 'Este certificado ainda n?o foi enviado para o fluxo automatizado do Agente.',
  },
  queued: {
    label: 'Agente na fila',
    bg: '#fff3d6',
    color: '#b45309',
    accent: '#f59e0b',
    agentTitle: 'Agente aguardando inicio',
    agentMessage: 'Este certificado ja entrou na fila e sera assumido pelo Agente assim que a execucao atual terminar.',
  },
  processing: {
    label: 'Agente gerando',
    bg: '#dbeafe',
    color: '#1d4ed8',
    accent: '#2563eb',
    agentTitle: 'Agente gerando certificado agora',
    agentMessage: 'O Agente j? iniciou este processamento, est? preenchendo a planilha oficial e montando o PDF do certificado.',
  },
  done: {
    label: 'Certificado pronto',
    bg: '#d1fae5',
    color: '#047857',
    accent: '#10b981',
    agentTitle: 'Certificado finalizado',
    agentMessage: 'O Agente concluiu a gera?o. Voc? j? pode visualizar ou baixar o PDF final.',
  },
  error: {
    label: 'Erro no Agente',
    bg: '#fee2e2',
    color: '#dc2626',
    accent: '#ef4444',
    agentTitle: 'Agente precisa de revis?o',
    agentMessage: 'A execucao foi interrompida. Vale revisar os dados preenchidos e tentar novamente.',
  },
}

const qualityStatusMeta = {
  pending_review: { label: 'Para analisar', bg: '#eff6ff', color: '#2563eb' },
  in_review: { label: 'Em AnÃ¡lise', bg: '#f5f3ff', color: '#7c3aed' },
  waiting_technician: { label: 'Aguardando tÃ©cnico', bg: '#fff7ed', color: '#c2410c' },
  ready_for_reprocess: { label: 'Pronto para nova geraÃ§Ã£o', bg: '#ecfeff', color: '#0f766e' },
  reprocessing: { label: 'Reprocessando', bg: '#f0f9ff', color: '#0284c7' },
  awaiting_final_validation: { label: 'Aguardando validaÃ§Ã£o final', bg: '#eef2ff', color: '#4f46e5' },
  approved: { label: 'Aprovado', bg: '#f0fdf4', color: '#15803d' },
  rejected: { label: 'Rejeitado', bg: '#fef2f2', color: '#dc2626' },
}

const cardStyle = {
  borderRadius: '18px',
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
}

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join(' | ')
  }
  return fallback
}

function valueOrDash(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleDateString('pt-BR')
  } catch {
    return '-'
  }
}

function getTimelineAuthorName(event) {
  const raw = event?.author_name || event?.author_role || 'Sistema'
  const normalized = String(raw).trim().toLowerCase()
  if (normalized === 'system') return 'Sistema'
  return raw
}

function getTimelineFallbackMessage(eventType) {
  return {
    submitted_to_quality: 'Certificado enviado para a fila inicial da Qualidade.',
    quality_assumed: 'A Qualidade assumiu este certificado para an?lise.',
    returned_to_technician: 'O certificado foi devolvido ao t?cnico para ajuste.',
    technician_replied: 'O t?cnico respondeu e reenviou o certificado.',
    reprocess_requested: 'Uma nova gera?o do certificado foi solicitada.',
    reprocess_started: 'O Agente iniciou uma nova gera?o do certificado.',
    reprocess_completed: 'O Agente concluiu a nova gera?o do certificado.',
    approved: 'A Qualidade aprovou o certificado.',
    rejected: 'A Qualidade rejeitou o certificado.',
    comment: 'Novo coment?rio registrado no fluxo da Qualidade.',
    form_edited: 'Os dados do certificado foram ajustados.',
  }[eventType] || 'Movimenta?o registrada no fluxo da Qualidade.'
}

function StatusPill({ status }) {
  const meta = statusMeta[status] || statusMeta.draft
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 600,
        padding: '5px 10px',
        borderRadius: '999px',
        background: meta.bg,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: meta.accent,
          boxShadow: `0 0 0 4px ${meta.bg}`,
        }}
      />
      {meta.label}
    </span>
  )
}

function ProcessingPulse({ status }) {
  const meta = statusMeta[status] || statusMeta.processing
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div
        style={{
          width: '62px',
          height: '62px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${meta.accent} 0%, ${meta.accent}33 45%, transparent 70%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: '50%',
            border: `2px solid ${meta.accent}55`,
            animation: 'agent-pulse 1.8s ease-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '-16px',
            borderRadius: '50%',
            border: `2px solid ${meta.accent}22`,
            animation: 'agent-pulse 1.8s ease-out 0.35s infinite',
          }}
        />
        <Bot style={{ width: '26px', height: '26px', color: meta.accent }} />
      </div>

      <div>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{meta.agentTitle}</p>
        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginTop: '4px' }}>{meta.agentMessage}</p>
      </div>
    </div>
  )
}

function DetailField({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#94a3b8', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', color: '#0f172a' }}>{valueOrDash(value)}</span>
    </div>
  )
}

function getCertificateDisplayStatus(status, qualityStatus) {
  if (status === 'done' && qualityStatus !== 'approved') {
    return {
      label: 'Em Análise',
      bg: '#f5f3ff',
      color: '#7c3aed',
      accent: '#8b5cf6',
    }
  }

  return statusMeta[status] || statusMeta.draft
}

export default function Certificates() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const nav = useNavigate()
  const [certs, setCerts] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [serviceOrderFilter, setServiceOrderFilter] = useState('')
  const [budgetFilter, setBudgetFilter] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [certificateToDelete, setCertificateToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [qualityTimeline, setQualityTimeline] = useState([])
  const [qualityComment, setQualityComment] = useState('')
  const [detailTab, setDetailTab] = useState('dados')

  useEffect(() => {
    load()
  }, [])

  const load = async ({ silent = false } = {}) => {
    try {
      const { data } = await api.get('/certificates?per_page=1000')
      const items = data.data || []
      setCerts(items)
      if (selectedCertificate?.id) {
        const updatedSummary = items.find((item) => item.id === selectedCertificate.id)
        if (updatedSummary) {
          setSelectedCertificate((prev) => ({ ...prev, ...updatedSummary }))
        }
      }
    } catch (e) {
      if (!silent) {
        alert(getErrorMessage(e, 'Erro ao carregar certificados'))
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshList = async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  const companyOptions = useMemo(() => {
    const values = new Set()
    certs.forEach((certificate) => {
      const company = certificate.extra_fields?.empresa
      if (company) values.add(company)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [certs])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return certs.filter((certificate) => {
      const extra = certificate.extra_fields || {}
      const haystack = [
        certificate.certificate_number,
        certificate.service_order_number,
        certificate.instrument_tag,
        certificate.instrument_description,
        extra.empresa,
        extra.contratante,
        extra.interessado,
        extra.numero_orcamento,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (query && !haystack.includes(query)) return false
      if (statusFilter !== 'all' && certificate.status !== statusFilter) return false
      if (companyFilter !== 'all' && extra.empresa !== companyFilter) return false
      if (serviceOrderFilter.trim() && !String(certificate.service_order_number || '').toLowerCase().includes(serviceOrderFilter.trim().toLowerCase())) return false
      if (budgetFilter.trim() && !String(extra.numero_orcamento || '').toLowerCase().includes(budgetFilter.trim().toLowerCase())) return false

      return true
    }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }, [certs, search, statusFilter, companyFilter, serviceOrderFilter, budgetFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, companyFilter, serviceOrderFilter, budgetFilter])

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const openDeleteModal = (certificate) => {
    setCertificateToDelete(certificate)
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    if (deleting) return
    setShowDeleteModal(false)
    setCertificateToDelete(null)
  }

  const del = async () => {
    if (!certificateToDelete) return

    setDeleting(true)
    try {
      await api.delete(`/certificates/${certificateToDelete.id}`)
      setCerts((prev) => prev.filter((item) => item.id !== certificateToDelete.id))
      closeDeleteModal()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao excluir certificado'))
    } finally {
      setDeleting(false)
    }
  }

  const openDetails = async (certificate) => {
    setShowDetailModal(true)
    setDetailLoading(true)
    setSelectedCertificate(certificate)
    setQualityComment('')
    setDetailTab('dados')

    try {
      const [certificateResponse, timelineResponse] = await Promise.all([
        api.get(`/certificates/${certificate.id}`),
        api.get(`/quality/${certificate.id}/timeline`),
      ])
      const data = certificateResponse.data
      setSelectedCertificate(data.data)
      setQualityTimeline(timelineResponse.data?.data || [])
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao carregar os detalhes do certificado'))
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetails = () => {
    setShowDetailModal(false)
    setSelectedCertificate(null)
    setDetailLoading(false)
    setQualityTimeline([])
    setQualityComment('')
    setDetailTab('dados')
  }

  const refreshSelectedCertificate = async ({ silent = false } = {}) => {
    if (!selectedCertificate?.id) return
    try {
      const [certificateResponse, timelineResponse] = await Promise.all([
        api.get(`/certificates/${selectedCertificate.id}`),
        api.get(`/quality/${selectedCertificate.id}/timeline`),
      ])
      setSelectedCertificate(certificateResponse.data.data)
      setQualityTimeline(timelineResponse.data?.data || [])
    } catch (e) {
      if (!silent) {
        alert(getErrorMessage(e, 'Erro ao atualizar os detalhes do certificado'))
      }
    }
  }

  const downloadPdf = (certificateId) => {
    api.get(`/certificates/${certificateId}/pdf`, { responseType: 'blob' }).then((response) => {
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `certificado-${certificateId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }).catch((error) => {
      alert(getErrorMessage(error, 'Erro ao baixar certificado'))
    })
  }

  const openPreview = (certificateId) => {
    window.open(`/api/v1/certificates/${certificateId}/pdf/preview`, '_blank', 'noopener,noreferrer')
  }

  const submitQualityComment = async () => {
    if (!selectedCertificate?.id || !qualityComment.trim()) return
    try {
      await api.post(`/quality/${selectedCertificate.id}/comment`, { message: qualityComment.trim() })
      setQualityComment('')
      await refreshSelectedCertificate({ silent: true })
    } catch (error) {
      alert(getErrorMessage(error, 'Erro ao enviar coment?rio'))
    }
  }

  const selectedExtra = selectedCertificate?.extra_fields || {}
  const selectedChannels = selectedExtra.canais_calibracao || []
  const selectedStatus = selectedCertificate?.status || 'draft'
  const selectedQualityStatus = selectedCertificate?.quality_status || 'pending_review'
  const selectedQualityMeta = qualityStatusMeta[selectedQualityStatus] || qualityStatusMeta.pending_review
  const isQualityApproved = selectedQualityStatus === 'approved'
  const canDownloadOfficial = selectedQualityStatus === 'approved' || ['qualidade', 'super_admin'].includes(user?.role)
  const canTechnicianAdjust = user?.role === 'tecnico' && selectedQualityStatus === 'waiting_technician'
  const canTechnicianDeleteDraft = user?.role === 'tecnico' && selectedStatus === 'draft' && selectedCertificate?.created_by === user?.id
  const previewPdfUrl = selectedCertificate?.id ? `/api/v1/certificates/${selectedCertificate.id}/pdf/preview` : ''
  const qualityFlowStatuses = ['pending_review', 'in_review', 'waiting_technician', 'ready_for_reprocess', 'reprocessing', 'awaiting_final_validation']
  const hasLiveCertificates = certs.some((certificate) =>
    certificate.status === 'queued' ||
    certificate.status === 'processing' ||
    qualityFlowStatuses.includes(certificate.quality_status)
  )
  const selectedCertificateIsLive =
    selectedStatus === 'queued' ||
    selectedStatus === 'processing' ||
    qualityFlowStatuses.includes(selectedQualityStatus)
  const detailTabs = [
    { key: 'dados', label: 'Dados' },
    { key: 'pdf', label: 'PDF certificado' },
    { key: 'quality', label: 'Acompanhamento' },
  ]
  const detailStatusMeta = getCertificateDisplayStatus(selectedStatus, selectedQualityStatus)

  useEffect(() => {
    if (!hasLiveCertificates) return undefined

    const interval = window.setInterval(() => {
      load({ silent: true })
    }, 8000)

    return () => window.clearInterval(interval)
  }, [hasLiveCertificates, selectedCertificate?.id])

  useEffect(() => {
    if (!showDetailModal || !selectedCertificate?.id || !selectedCertificateIsLive) return undefined

    const interval = window.setInterval(() => {
      refreshSelectedCertificate({ silent: true })
    }, 5000)

    return () => window.clearInterval(interval)
  }, [showDetailModal, selectedCertificate?.id, selectedCertificateIsLive])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ ...cardStyle, padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Filter style={{ width: '16px', height: '16px', color: '#64748b' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Filtros da lista
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 1.2fr) repeat(4, minmax(140px, 0.78fr)) auto auto', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9ca3af' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por O.S., numero, instrumento, empresa ou cliente..."
              className="input-field"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            {Object.entries(statusMeta).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>

          <select className="input-field" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="all">Todas as empresas</option>
            {companyOptions.map((company) => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>

          <input
            type="text"
            value={serviceOrderFilter}
            onChange={(e) => setServiceOrderFilter(e.target.value)}
            placeholder="Filtrar por O.S..."
            className="input-field"
          />

          <input
            type="text"
            value={budgetFilter}
            onChange={(e) => setBudgetFilter(e.target.value)}
            placeholder="Filtrar por orcamento..."
            className="input-field"
          />

          <button
            type="button"
            onClick={refreshList}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1px solid #dbe2ea',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw style={{ width: '15px', height: '15px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>

          <button
            onClick={() => nav('/certificates/new')}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 16px', boxShadow: '0 10px 24px rgba(0, 40, 104, 0.12)', whiteSpace: 'nowrap' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Novo Certificado
          </button>
        </div>
      </div>

      <div className="table-scroll" style={{ ...cardStyle, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1060px' }}>
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['O.S.', 'NUMERO', 'ORCAMENTO', 'EMPRESA', 'CLIENTE', 'INSTRUMENTO', 'STATUS', 'DATA'].map((heading) => (
                <th
                  key={heading}
                  style={{
                    textAlign: 'left',
                    padding: '14px 20px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#64748b',
                    letterSpacing: '0.07em',
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '56px 24px', textAlign: 'center', fontSize: '14px', color: '#94a3b8' }}>
                  Carregando certificados...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '56px 24px', textAlign: 'center' }}>
                  <FileText style={{ width: '42px', height: '42px', color: '#cbd5e1', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>Nenhum certificado encontrado</p>
                  <p style={{ marginTop: '4px', fontSize: '13px', color: '#94a3b8' }}>
                    Ajuste os filtros ou crie um novo certificado para iniciar o fluxo do Agente.
                  </p>
                </td>
              </tr>
            ) : (
              paginated.map((certificate) => {
                const extra = certificate.extra_fields || {}
                const rowStatusMeta = getCertificateDisplayStatus(certificate.status, certificate.quality_status)
                return (
                  <tr
                    key={certificate.id}
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      transition: 'all 0.18s ease',
                      boxShadow: 'inset 0 0 0 0 rgba(0, 40, 104, 0)',
                    }}
                    onClick={() => openDetails(certificate)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f8ff'
                      e.currentTarget.style.cursor = 'pointer'
                      e.currentTarget.style.boxShadow = 'inset 4px 0 0 0 rgba(0, 40, 104, 0.9)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.boxShadow = 'inset 0 0 0 0 rgba(0, 40, 104, 0)'
                    }}
                  >
                    <td style={{ padding: '18px 20px', fontSize: '13px', color: '#334155', verticalAlign: 'middle' }}>
                      {valueOrDash(certificate.service_order_number)}
                    </td>
                    <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{certificate.certificate_number}</span>
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: '13px', color: '#334155', verticalAlign: 'middle' }}>
                      {valueOrDash(extra.numero_orcamento)}
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: '13px', color: '#334155', verticalAlign: 'middle' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.45 }} title={valueOrDash(extra.empresa)}>
                        {valueOrDash(extra.empresa)}
                      </div>
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: '13px', color: '#334155', verticalAlign: 'middle' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.45 }} title={valueOrDash(extra.contratante)}>
                        {valueOrDash(extra.contratante)}
                      </div>
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: '13px', color: '#64748b', verticalAlign: 'middle' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.45 }} title={certificate.instrument_description || '-'}>
                        {certificate.instrument_description || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '5px 10px',
                          borderRadius: '999px',
                          background: rowStatusMeta.bg,
                          color: rowStatusMeta.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: rowStatusMeta.accent,
                            boxShadow: `0 0 0 4px ${rowStatusMeta.bg}`,
                          }}
                        />
                        {rowStatusMeta.label}
                      </span>
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: '13px', color: '#94a3b8', verticalAlign: 'middle' }}>{formatDate(certificate.created_at)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '0 4px' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Mostrando {Math.min((page - 1) * pageSize + 1, filtered.length)}-{Math.min(page * pageSize, filtered.length)} de {filtered.length} certificado(s)
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #dbe2ea',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.55 : 1,
              }}
            >
              Anterior
            </button>

            <span style={{ minWidth: '74px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #dbe2ea',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.55 : 1,
              }}
            >
              Proxima
            </button>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: isMobile ? '14px' : '24px',
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              width: '100%',
              maxWidth: isMobile ? 'calc(100vw - 20px)' : '1080px',
              maxHeight: '90vh',
              overflow: 'auto',
              background: '#ffffff',
              borderRadius: '22px',
              boxShadow: '0 30px 80px rgba(15, 23, 42, 0.3)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                padding: '24px 28px',
                borderBottom: '1px solid #eef2f7',
                background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '18px',
              }}
            >
              <div>
                <p style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                  Painel do certificado
                </p>
                <h3 style={{ marginTop: '8px', fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedCertificate?.certificate_number || 'Carregando...'}
                </h3>
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '5px 10px',
                      borderRadius: '999px',
                      background: detailStatusMeta.bg,
                      color: detailStatusMeta.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: detailStatusMeta.accent,
                        boxShadow: `0 0 0 4px ${detailStatusMeta.bg}`,
                      }}
                    />
                    {detailStatusMeta.label}
                  </span>
                </div>
              </div>

              <button
                onClick={closeDetails}
                style={{
                  border: '1px solid #dbe2ea',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '999px',
                  width: '40px',
                  height: '40px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Fechar"
              >
                X
              </button>
            </div>

            <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {detailLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '280px', color: '#64748b', gap: '10px' }}>
                  <LoaderCircle style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                  Carregando formul?rio preenchido...
                </div>
              ) : (
                <>
                  {(selectedStatus === 'queued' || selectedStatus === 'processing') && (
                    <div
                      style={{
                        padding: '20px 22px',
                        borderRadius: '18px',
                        background: selectedStatus === 'processing' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'linear-gradient(135deg, #fff8eb 0%, #fff1cf 100%)',
                        border: `1px solid ${selectedStatus === 'processing' ? '#bfdbfe' : '#fde68a'}`,
                      }}
                    >
                      <ProcessingPulse status={selectedStatus} />
                    </div>
                  )}

                  {selectedStatus === 'done' && (
                    <div
                      style={{
                        padding: '18px 20px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #effcf6 0%, #dff7ec 100%)',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '16px', fontWeight: 700, color: '#065f46' }}>
                          {isQualityApproved ? 'Certificado aprovado pela Qualidade' : 'Certificado em Análise'}
                        </p>
                        <p style={{ marginTop: '4px', fontSize: '13px', color: '#047857' }}>
                          {isQualityApproved
                            ? 'A vers?o oficial j? foi liberada pela Qualidade e est? dispon?vel para visualiza?o e download.'
                            : 'O Agente concluiu o processamento. O certificado agora está em análise da Qualidade e você pode acompanhar comentários, status e a versão em revisão no sistema.'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setDetailTab(detailTab === 'pdf' ? 'dados' : 'pdf')}
                          style={{
                            border: '1px solid #bfdbfe',
                            background: '#ffffff',
                            color: '#1d4ed8',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          <Eye style={{ width: '14px', height: '14px' }} />
                          {detailTab === 'pdf' ? 'Voltar aos dados' : 'Ver PDF'}
                        </button>
                        <button
                          onClick={() => canDownloadOfficial && downloadPdf(selectedCertificate.id)}
                          disabled={!canDownloadOfficial}
                          style={{
                            border: `1px solid ${canDownloadOfficial ? '#86efac' : '#d1d5db'}`,
                            background: '#ffffff',
                            color: canDownloadOfficial ? '#047857' : '#94a3b8',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            cursor: canDownloadOfficial ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          <Download style={{ width: '14px', height: '14px' }} />
                          {canDownloadOfficial ? 'Baixar certificado' : 'Aguardando aprova?o'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {detailTabs.map((tab) => {
                      const active = detailTab === tab.key
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setDetailTab(tab.key)}
                          style={{
                            border: `1px solid ${active ? '#bfdbfe' : '#dbe2ea'}`,
                            background: active ? '#eff6ff' : '#ffffff',
                            color: active ? '#1d4ed8' : '#475569',
                            borderRadius: '999px',
                            padding: '9px 14px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>

                  {selectedStatus === 'draft' && (
                    <div
                      style={{
                        padding: '18px 20px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
                        border: '1px solid #dbe2ea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Rascunho salvo</p>
                        <p style={{ marginTop: '4px', fontSize: '13px', color: '#475569' }}>
                          Este certificado ainda n?o foi enviado ao Agente. Voc? pode continuar o preenchimento de onde parou.
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => nav(`/certificates/${selectedCertificate.id}/edit`)}
                          style={{
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          <Eye style={{ width: '14px', height: '14px' }} />
                          Continuar preenchimento
                        </button>
                        {canTechnicianDeleteDraft && (
                          <button
                            type="button"
                            onClick={() => openDeleteModal(selectedCertificate)}
                            style={{
                              border: '1px solid #fecaca',
                              background: '#ffffff',
                              color: '#dc2626',
                              borderRadius: '10px',
                              padding: '10px 14px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            <Trash2 style={{ width: '14px', height: '14px' }} />
                            Excluir rascunho
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {canTechnicianAdjust && (
                    <div
                      style={{
                        padding: '18px 20px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #fff8eb 0%, #fff1cf 100%)',
                        border: '1px solid #fde68a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '16px', fontWeight: 700, color: '#92400e' }}>Ajustes solicitados pela Qualidade</p>
                        <p style={{ marginTop: '4px', fontSize: '13px', color: '#b45309' }}>
                          Revise os comentarios, ajuste o formulario e reenviÐµ para nova geracao do Agente.
                        </p>
                      </div>
                      <button
                        onClick={() => nav(`/certificates/${selectedCertificate.id}/edit`)}
                        style={{
                          border: '1px solid #f59e0b',
                          background: '#ffffff',
                          color: '#b45309',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                        }}
                      >
                        <Eye style={{ width: '14px', height: '14px' }} />
                        Ajustar e reenviar
                      </button>
                    </div>
                  )}

                  {detailTab === 'pdf' && selectedStatus === 'done' && previewPdfUrl && (
                    <div style={{ ...cardStyle, padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            {canDownloadOfficial ? 'PDF oficial' : 'PDF em an?lise da Qualidade'}
                          </h4>
                          <p style={{ marginTop: '4px', fontSize: '13px', color: '#64748b' }}>
                            {canDownloadOfficial
                              ? 'Esta ? a vers?o oficial liberada pela Qualidade.'
                              : 'Esta ? a vers?o pr?-pronta que est? em revis?o pela Qualidade.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPreview(selectedCertificate.id)}
                          style={{
                            border: '1px solid #dbe2ea',
                            background: '#ffffff',
                            color: '#334155',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          <Eye style={{ width: '14px', height: '14px' }} />
                          Abrir em nova aba
                        </button>
                      </div>
                      <iframe
                        title={`PDF ${selectedCertificate.id}`}
                        src={previewPdfUrl}
                        style={{ width: '100%', height: isMobile ? '360px' : '640px', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                      />
                    </div>
                  )}

                  {detailTab === 'dados' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: '18px' }}>
                        <div style={{ ...cardStyle, padding: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <Building2 style={{ width: '16px', height: '16px', color: '#475569' }} />
                            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Dados do certificado</h4>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '16px 18px' }}>
                            <DetailField label="Ordem de servi?o" value={selectedCertificate?.service_order_number} />
                            <DetailField label="Empresa" value={selectedExtra.empresa} />
                            <DetailField label="Tipo da calibra?o" value={selectedExtra.tipo_calibracao} />
                            <DetailField label="Cliente" value={selectedExtra.contratante} />
                            <DetailField label="Interessado" value={selectedExtra.interessado} />
                            <DetailField label="Endere?o" value={selectedExtra.endereco} />
                            <DetailField label="Endere?o do interessado" value={selectedExtra.endereco_interessado} />
                            <DetailField label="N?mero do or?amento" value={selectedExtra.numero_orcamento} />
                            <DetailField label="Tecnico" value={selectedExtra.tecnico} />
                            <DetailField label="Data da calibra?o" value={formatDate(selectedExtra.data_calibracao || selectedCertificate?.calibration_date)} />
                            <DetailField label="Data de emissao" value={formatDate(selectedExtra.data_emissao)} />
                            <DetailField label="Pr?xima calibra?o" value={formatDate(selectedExtra.proxima_calibracao)} />
                            <DetailField label="Observacoes gerais" value={selectedExtra.observacoes} />
                          </div>
                        </div>

                        <div style={{ ...cardStyle, padding: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <UserRound style={{ width: '16px', height: '16px', color: '#475569' }} />
                            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Instrumento e m?todo</h4>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                            <DetailField label="Instrumento" value={selectedExtra.instrumento || selectedCertificate?.instrument_description} />
                            <DetailField label="Escopo" value={selectedExtra.escopo} />
                            <DetailField label="Fabricante" value={selectedCertificate?.manufacturer} />
                            <DetailField label="Modelo" value={selectedCertificate?.model} />
                            <DetailField label="Identifica?o" value={selectedExtra.identificacao || selectedCertificate?.instrument_tag} />
                            <DetailField label="N?mero de s?rie" value={selectedCertificate?.serial_number} />
                            <DetailField label="Tipo" value={selectedExtra.tipo_faixa} />
                            <DetailField label="M?todo" value={selectedExtra.metodo} />
                            <DetailField label="Qtd canais" value={selectedExtra.qtd_canais} />
                            <DetailField label="Pontos por canal" value={selectedExtra.pontos_por_canal} />
                          </div>
                        </div>
                      </div>

                      <div style={{ ...cardStyle, padding: '20px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Condi?es ambientais</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '16px 18px' }}>
                          <DetailField label="Padr?o temperatura" value={selectedExtra.padrao_temperatura} />
                          <DetailField label="Temperatura inicial" value={selectedExtra.temperatura_inicial} />
                          <DetailField label="Temperatura final" value={selectedExtra.temperatura_final} />
                          <DetailField label="Padr?o umidade" value={selectedExtra.padrao_umidade} />
                          <DetailField label="Umidade inicial" value={selectedExtra.umidade_inicial} />
                          <DetailField label="Umidade final" value={selectedExtra.umidade_final} />
                          <DetailField label="Padr?o press?o" value={selectedExtra.padrao_pressao} />
                          <DetailField label="Pressao inicial" value={selectedExtra.pressao_inicial} />
                          <DetailField label="Pressao final" value={selectedExtra.pressao_final} />
                        </div>
                      </div>

                      <div style={{ ...cardStyle, padding: '20px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Canais e pontos preenchidos</h4>

                        {selectedChannels.length === 0 ? (
                          <p style={{ fontSize: '14px', color: '#94a3b8' }}>Nenhuma estrutura detalhada de canal foi registrada para este certificado.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {selectedChannels.map((channel) => (
                              <div key={channel.channel_number} style={{ border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid #eef2f7' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                    <div>
                                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Canal {channel.channel_number}</p>
                                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                                        Identifica?o: {valueOrDash(channel.identificacao_canal)} | Observa?o: {valueOrDash(channel.observacao)}
                                      </p>
                                    </div>
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                      {(channel.points || []).length} ponto(s)
                                    </span>
                                  </div>
                                </div>

                                <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                  {(channel.points || []).map((point) => (
                                    <div key={point.point_number} style={{ border: '1px solid #eef2f7', borderRadius: '14px', padding: '14px' }}>
                                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#002868', marginBottom: '10px' }}>Ponto {point.point_number}</p>
                                      <div style={{ display: 'grid', gap: '8px' }}>
                                        <DetailField label="Valor nominal" value={point.valor_nominal} />
                                        <DetailField label="Menor divis?o" value={point.menor_divisao} />
                                        <DetailField label="Balan?a" value={point.balanca_utilizada} />
                                        <DetailField label="Term?metro" value={point.termometro} />
                                        <DetailField label="Escopo" value={point.escopo} />
                                        <DetailField label="Crit?rio NBR" value={point.criterio_nbr} />
                                        {point.criterio_nbr === 'Cliente' && (
                                          <>
                                            <DetailField label="Crit?rio cliente" value={point.criterio_cliente_valor} />
                                            <DetailField label="Unidade crit?rio cliente" value={point.criterio_cliente_unidade} />
                                          </>
                                        )}
                                        <DetailField label="Unidade da massa" value={point.massa_aparente_unidade} />
                                      </div>
                                      {Array.isArray(point.massas) && point.massas.length > 0 && (
                                        <div style={{ marginTop: '12px' }}>
                                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                                            Resultados coletados
                                          </p>
                                          <div style={{ overflowX: 'auto', border: '1px solid #eef2f7', borderRadius: '10px' }}>
                                            <table style={{ width: '100%', minWidth: '360px', borderCollapse: 'collapse' }}>
                                              <thead>
                                                <tr style={{ background: '#f8fafc' }}>
                                                  <th style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'left', color: '#64748b', textTransform: 'uppercase' }}>Medição</th>
                                                  <th style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'left', color: '#64748b', textTransform: 'uppercase' }}>Massa aparente</th>
                                                  <th style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'left', color: '#64748b', textTransform: 'uppercase' }}>Temperatura do fluido</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {point.massas.map((measurement, measurementIndex) => (
                                                  <tr key={`${channel.channel_number}-${point.point_number}-${measurementIndex}`} style={{ borderTop: measurementIndex === 0 ? '1px solid #eef2f7' : '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 10px', fontSize: '12px', color: '#334155' }}>
                                                      {measurement.medicao || measurementIndex + 1}
                                                    </td>
                                                    <td style={{ padding: '8px 10px', fontSize: '12px', color: '#334155' }}>
                                                      {valueOrDash(measurement.massa_aparente)}
                                                    </td>
                                                    <td style={{ padding: '8px 10px', fontSize: '12px', color: '#334155' }}>
                                                      {valueOrDash(measurement.temperatura_fluido)}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {detailTab === 'quality' && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.1fr', gap: '18px' }}>
                      <div style={{ ...cardStyle, padding: '20px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Acompanhamento da Qualidade</h4>
                        <div style={{ display: 'grid', gap: '10px' }}>
                          <DetailField label="Status da Qualidade" value={selectedQualityMeta.label} />
                          <DetailField label="Vers?o oficial liberada" value={canDownloadOfficial ? 'Sim' : 'Nao'} />
                          <DetailField label="Status t?cnico" value={statusMeta[selectedStatus]?.label || selectedStatus} />
                        </div>

                        <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <textarea
                            value={qualityComment}
                            onChange={(event) => setQualityComment(event.target.value)}
                            className="input-field"
                            rows={4}
                            placeholder="Registre uma d?vida, resposta ou contexto para o fluxo da Qualidade..."
                            style={{ resize: 'vertical' }}
                          />
                          <button
                            type="button"
                            disabled={!qualityComment.trim()}
                            onClick={submitQualityComment}
                            style={{
                              alignSelf: 'flex-start',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              borderRadius: '10px',
                              padding: '10px 14px',
                              cursor: !qualityComment.trim() ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: 700,
                              opacity: !qualityComment.trim() ? 0.7 : 1,
                            }}
                          >
                            <MessageSquare style={{ width: '14px', height: '14px' }} />
                            Enviar coment?rio
                          </button>
                        </div>
                      </div>

                      <div style={{ ...cardStyle, padding: '20px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Hist?rico e coment?rios</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? '420px' : '680px', overflowY: 'auto', paddingRight: '4px' }}>
                          {qualityTimeline.length === 0 ? (
                            <p style={{ fontSize: '13px', color: '#94a3b8' }}>Nenhuma movimenta?o registrada ainda.</p>
                          ) : (
                            qualityTimeline.map((event) => (
                              <div key={event.id} style={{ border: '1px solid #eef2f7', borderRadius: '12px', padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                    {getTimelineAuthorName(event)}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(event.created_at)}</span>
                                </div>
                                {(event.message || event.event_type) && (
                                  <p style={{ marginTop: '6px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                                    {event.message || getTimelineFallbackMessage(event.event_type)}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && certificateToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: isMobile ? '14px' : '24px',
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              width: '100%',
              maxWidth: isMobile ? 'calc(100vw - 20px)' : '460px',
              background: '#ffffff',
              borderRadius: '18px',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid #f1f5f9',
                background: 'linear-gradient(180deg, #fff7f7 0%, #ffffff 100%)',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#be123c',
                  textTransform: 'uppercase',
                }}
              >
                Confirmar exclusao
              </p>
              <h3 style={{ marginTop: '8px', fontSize: '20px', fontWeight: 600, color: '#111827' }}>
                Excluir certificado?
              </h3>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#475569' }}>
                Voce esta prestes a excluir o certificado{' '}
                <strong style={{ color: '#111827' }}>{certificateToDelete.certificate_number}</strong>.
                Essa acao remove o registro da lista e tambem tira o item da fila, se ele ainda estiver pendente.
              </p>

              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  fontSize: '13px',
                  color: '#9a3412',
                }}
              >
                Use essa exclusao para certificados ainda nao concluidos. Se o PDF ja foi gerado, vale revisar antes de apagar.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '0 24px 24px',
              }}
            >
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={del}
                disabled={deleting}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #ef4444',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
                {deleting ? 'Excluindo...' : 'Excluir agora'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes agent-pulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.22); opacity: 0; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

