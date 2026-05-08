import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CornerUpLeft,
  Download,
  Eye,
  GripVertical,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

const columns = [
  { key: 'backlog', label: 'Para analisar', accent: '#2563eb', droppable: true },
  { key: 'review', label: 'Em análise', accent: '#4f46e5', droppable: true },
  { key: 'adjustment', label: 'Aguardando técnico', accent: '#d97706', droppable: true },
  { key: 'generation', label: 'Em nova geração', accent: '#0f766e', droppable: true },
  { key: 'approved', label: 'Aprovados', accent: '#15803d', droppable: true },
]

const tabs = [
  { key: 'dados', label: 'Dados do técnico' },
  { key: 'historico', label: 'Histórico' },
  { key: 'pdf', label: 'PDF' },
]


const technicalStatusLabels = {
  draft: 'Rascunho',
  queued: 'Na fila',
  processing: 'Processando',
  done: 'Pronto',
  error: 'Erro',
}

const summaryFields = [
  { label: 'O.S.', key: 'service_order_number', source: 'root' },
  { label: 'Empresa', key: 'empresa', source: 'extra' },
  { label: 'Cliente', key: 'contratante', source: 'extra' },
  { label: 'Interessado', key: 'interessado', source: 'extra' },
  { label: 'Endereço', key: 'endereco', source: 'extra' },
  { label: 'Endereço do interessado', key: 'endereco_interessado', source: 'extra' },
  { label: 'Instrumento', key: 'instrumento', source: 'extra' },
  { label: 'Escopo', key: 'escopo', source: 'extra' },
  { label: 'Fabricante', key: 'manufacturer', source: 'root' },
  { label: 'Modelo', key: 'model', source: 'root' },
  { label: 'Identificação', key: 'identificacao', source: 'extra' },
  { label: 'Número de série', key: 'serial_number', source: 'root' },
  { label: 'Técnico', key: 'tecnico', source: 'extra' },
  { label: 'Tipo de calibração', key: 'tipo_calibracao', source: 'extra' },
]

const environmentFields = [
  { label: 'Padrão de temperatura', key: 'padrao_temperatura' },
  { label: 'Temperatura inicial', key: 'temperatura_inicial' },
  { label: 'Temperatura final', key: 'temperatura_final' },
  { label: 'Padrão de umidade', key: 'padrao_umidade' },
  { label: 'Umidade inicial', key: 'umidade_inicial' },
  { label: 'Umidade final', key: 'umidade_final' },
  { label: 'Padrão de pressão', key: 'padrao_pressao' },
  { label: 'Pressão inicial', key: 'pressao_inicial' },
  { label: 'Pressão final', key: 'pressao_final' },
]


const qualityStatusLabels = {
  pending_review: 'Para analisar',
  in_review: 'Em análise',
  waiting_technician: 'Aguardando técnico',
  ready_for_reprocess: 'Pronto para nova geração',
  reprocessing: 'Reprocessando',
  awaiting_final_validation: 'Aguardando validação final',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
}

function getBoardColumnKey(status) {
  if (status === 'pending_review') return 'backlog'
  if (status === 'in_review' || status === 'awaiting_final_validation') return 'review'
  if (status === 'waiting_technician') return 'adjustment'
  if (status === 'ready_for_reprocess' || status === 'reprocessing') return 'generation'
  if (status === 'approved') return 'approved'
  return 'backlog'
}

function formatDateTime(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function valueOrDash(value) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function clonePoints(certificate) {
  return JSON.parse(JSON.stringify(certificate?.extra_fields?.canais_calibracao || []))
}

function buildEditableState(certificate) {
  return {
    service_order_number: certificate?.service_order_number || '',
    manufacturer: certificate?.manufacturer || '',
    model: certificate?.model || '',
    serial_number: certificate?.serial_number || '',
    extra_fields: {
      ...(certificate?.extra_fields || {}),
      canais_calibracao: clonePoints(certificate),
    },
  }
}

function eventTypeLabel(eventType) {
  const labels = {
    submitted_to_quality: 'Enviado para a Qualidade',
    initial_generation_completed: 'Geração inicial concluída',
    quality_assumed: 'Análise assumida',
    comment: 'Comentário',
    returned_to_technician: 'Devolvido ao técnico',
    technician_requested_reprocess: 'Técnico pediu nova geração',
    quality_requested_reprocess: 'Qualidade pediu nova geração',
    reprocess_completed: 'Reprocessamento concluído',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    quality_edited_form: 'Qualidade editou o formulário',
    technician_edited_form: 'Técnico editou o formulário',
    quality_status_moved: 'Movido no kanban',
  }
  return labels[eventType] || eventType
}

function ActionButton({ children, tone = 'neutral', disabled = false, onClick }) {
  const styles = {
    neutral: { border: '1px solid #dbe2ea', background: '#ffffff', color: '#334155' },
    primary: { border: '1px solid #d7e3f4', background: '#f8fbff', color: '#33527a' },
    success: { border: '1px solid #d9ebe0', background: '#f8fcfa', color: '#2f6b4f' },
    warning: { border: '1px solid #eadfce', background: '#fffdfa', color: '#9a6b2f' },
    danger: { border: '1px solid #eed8d8', background: '#fffafb', color: '#a45a5a' },
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[tone],
        borderRadius: '10px',
        padding: '7px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 700,
        fontSize: '11.5px',
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
      }}
    >
      {children}
    </button>
  )
}

function DataField({ label, value, editing, onChange }) {
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</p>
      {editing ? (
        <input className="input-field" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ marginTop: '4px' }} />
      ) : (
        <p style={{ marginTop: '4px', fontSize: '13px', color: '#334155' }}>{valueOrDash(value)}</p>
      )}
    </div>
  )
}

function getInitials(name) {
  return String(name || 'U').trim().charAt(0).toUpperCase() || 'U'
}

function AvatarCircle({ user, size = 28, fontSize = 11 }) {
  return (
    <div
      title={user?.name || 'Responsável'}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: '#e8eef8',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid #dbe2ea',
      }}
    >
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user?.name || 'Responsável'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: `${fontSize}px`, fontWeight: 700, color: '#002868' }}>
          {getInitials(user?.name)}
        </span>
      )}
    </div>
  )
}

export default function QualityPage() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submittingAction, setSubmittingAction] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const [hoverColumn, setHoverColumn] = useState('')
  const [activeTab, setActiveTab] = useState('dados')
  const [editingData, setEditingData] = useState(false)
  const [draftData, setDraftData] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [openColumnSearch, setOpenColumnSearch] = useState('')
  const [columnSearches, setColumnSearches] = useState({})
  const [serviceOrderSearch, setServiceOrderSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)

  const revokePreviewUrl = () => {
    setPreviewUrl((currentUrl) => {
      if (currentUrl?.startsWith('blob:')) {
        window.URL.revokeObjectURL(currentUrl)
      }
      return ''
    })
  }

  const loadBoard = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const { data } = await api.get('/quality/board')
      const nextItems = (data?.data || []).filter(
        (item) => !['draft', 'error'].includes(String(item?.status || '').toLowerCase()),
      )
      setItems(nextItems)
    } catch (error) {
      if (!silent) {
        alert(error.response?.data?.detail || 'Erro ao carregar o fluxo da Qualidade')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadPreview = async (certificateId) => {
    setPreviewLoading(true)
    try {
      const response = await api.get(`/certificates/${certificateId}/pdf/preview`, {
        responseType: 'blob',
      })
      revokePreviewUrl()
      setPreviewUrl(window.URL.createObjectURL(response.data))
    } catch {
      revokePreviewUrl()
    } finally {
      setPreviewLoading(false)
    }
  }

  const downloadOfficialPdf = async (certificateId, certificateNumber) => {
    try {
      const response = await api.get(`/certificates/${certificateId}/pdf`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `certificado_${certificateNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert(error.response?.data?.detail || 'Não foi possível baixar o PDF oficial')
    }
  }

  useEffect(() => {
    loadBoard()
    return () => revokePreviewUrl()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadBoard({ silent: true })
      if (selected?.certificate?.id) {
        openDetails(selected.certificate.id, { silent: true })
      }
    }, 10000)
    return () => window.clearInterval(interval)
  }, [selected?.certificate?.id])

  useEffect(() => {
    if (selected?.certificate?.id && activeTab === 'pdf' && !previewUrl && !previewLoading) {
      loadPreview(selected.certificate.id)
    }
  }, [activeTab, selected?.certificate?.id])

  const companyOptions = useMemo(
    () =>
      [...new Set(items.map((item) => item.extra_fields?.empresa).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')),
    [items],
  )

  const technicianOptions = useMemo(
    () =>
      [...new Set(items.map((item) => item.extra_fields?.tecnico).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')),
    [items],
  )

  const filteredItems = useMemo(() => {
    const serviceOrderTerm = serviceOrderSearch.trim().toLowerCase()
    const clientTerm = clientSearch.trim().toLowerCase()

    return items.filter((item) => {
      const serviceOrder = String(item.service_order_number || '').toLowerCase()
      const client = String(item.extra_fields?.contratante || '').toLowerCase()
      const company = String(item.extra_fields?.empresa || '')
      const technician = String(item.extra_fields?.tecnico || '')
      const assignedToMe = user?.id && item.quality_assigned_to === user.id

      if (serviceOrderTerm && !serviceOrder.includes(serviceOrderTerm)) return false
      if (clientTerm && !client.includes(clientTerm)) return false
      if (companyFilter && company !== companyFilter) return false
      if (technicianFilter && technician !== technicianFilter) return false
      if (onlyMine && !assignedToMe) return false
      return true
    })
  }, [items, serviceOrderSearch, clientSearch, companyFilter, technicianFilter, onlyMine, user?.id])

  const grouped = useMemo(
    () =>
      columns.reduce((acc, column) => {
        const columnTerm = String(columnSearches[column.key] || '').trim().toLowerCase()
        acc[column.key] = filteredItems.filter((item) => {
          if (getBoardColumnKey(item.quality_status) !== column.key) return false
          if (!columnTerm) return true

          const haystack = [
            item.certificate_number,
            item.service_order_number,
            item.extra_fields?.contratante,
            item.extra_fields?.empresa,
            item.extra_fields?.tecnico,
            item.extra_fields?.instrumento,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return haystack.includes(columnTerm)
        })
        return acc
      }, {}),
    [filteredItems, columnSearches],
  )

  const openDetails = async (certificateId, { silent = false } = {}) => {
    if (!silent) setDetailLoading(true)
    try {
      const { data } = await api.get(`/quality/${certificateId}`)
      setSelected(data?.data || null)
      setDraftData(buildEditableState(data?.data?.certificate))
      setEditingData(false)
      setActiveTab('dados')
      revokePreviewUrl()
    } catch (error) {
      if (!silent) {
        alert(error.response?.data?.detail || 'Erro ao carregar os detalhes da Qualidade')
      }
    } finally {
      if (!silent) setDetailLoading(false)
    }
  }

  const closeDetails = () => {
    setSelected(null)
    setActionModal(null)
    setActionMessage('')
    setActiveTab('dados')
    setEditingData(false)
    setDraftData(null)
    revokePreviewUrl()
  }

  const runAction = async (actionKey, request) => {
    if (!selected?.certificate?.id) return
    setSubmittingAction(actionKey)
    try {
      await request()
      setActionModal(null)
      setActionMessage('')
      await Promise.all([
        loadBoard({ silent: true }),
        openDetails(selected.certificate.id, { silent: true }),
      ])
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao executar a ação da Qualidade')
    } finally {
      setSubmittingAction('')
    }
  }

  const saveInlineEdits = async () => {
    if (!selected?.certificate?.id || !draftData) return
    setSubmittingAction('save-inline')
    try {
      const payload = {
        service_order_number: draftData.service_order_number,
        manufacturer: draftData.manufacturer,
        model: draftData.model,
        serial_number: draftData.serial_number,
        extra_fields: draftData.extra_fields,
        enqueue_for_processing: false,
      }
      await api.put(`/certificates/${selected.certificate.id}`, payload)
      await Promise.all([
        loadBoard({ silent: true }),
        openDetails(selected.certificate.id, { silent: true }),
      ])
      setEditingData(false)
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao salvar alterações no formulário')
    } finally {
      setSubmittingAction('')
    }
  }

  const moveCard = async (item, targetColumn) => {
    if (!item || !targetColumn || getBoardColumnKey(item.quality_status) === targetColumn) return
    setSubmittingAction(`move-${item.id}`)
    try {
      if (targetColumn === 'generation') {
        await api.post(`/quality/${item.id}/reprocess`, {
          message: 'Certificado movido no kanban para nova gera??o.',
        })
      } else if (targetColumn === 'approved') {
        await api.post(`/quality/${item.id}/approve`)
      } else {
        const targetStatus = {
          backlog: 'pending_review',
          review: 'in_review',
          adjustment: 'waiting_technician',
        }[targetColumn]

        if (!targetStatus) return

        await api.post(`/quality/${item.id}/move`, {
          target_status: targetStatus,
          message: `Certificado movido no kanban para ${columns.find((column) => column.key === targetColumn)?.label || targetColumn}.`,
        })
      }

      await loadBoard({ silent: true })
      if (selected?.certificate?.id === item.id) {
        await openDetails(item.id, { silent: true })
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao mover o card no kanban')
    } finally {
      setSubmittingAction('')
      setDraggedId(null)
      setHoverColumn('')
    }
  }

  const updateDraftExtra = (key, value) => {
    setDraftData((current) => ({
      ...current,
      extra_fields: {
        ...current.extra_fields,
        [key]: value,
      },
    }))
  }

  const updatePoint = (channelIndex, pointIndex, field, value) => {
    setDraftData((current) => {
      const next = JSON.parse(JSON.stringify(current))
      next.extra_fields.canais_calibracao[channelIndex].points[pointIndex][field] = value
      return next
    })
  }

  const updatePointMeasurement = (channelIndex, pointIndex, measurementIndex, field, value) => {
    setDraftData((current) => {
      const next = JSON.parse(JSON.stringify(current))
      const point = next.extra_fields.canais_calibracao[channelIndex].points[pointIndex]
      if (!Array.isArray(point.massas)) point.massas = []
      if (!point.massas[measurementIndex]) {
        point.massas[measurementIndex] = {
          medicao: measurementIndex + 1,
          massa_aparente: '',
          temperatura_fluido: '',
        }
      }
      point.massas[measurementIndex][field] = value
      return next
    })
  }

  const current = selected?.certificate
  const timeline = selected?.timeline || []
  const pointRows = draftData?.extra_fields?.canais_calibracao || current?.extra_fields?.canais_calibracao || []
  const qualityStatusLabel = qualityStatusLabels[current?.quality_status] || current?.quality_status
  const timelinePreview = timeline.slice().reverse()

  const openActionModal = (type) => {
    setActionModal(type)
    setActionMessage('')
  }

  const confirmActionModal = () => {
    if (!current?.id || !actionModal) return

    if (actionModal === 'return') {
      const message = actionMessage.trim()
      if (!message) {
        alert('Informe o comentário da devolução para o técnico.')
        return
      }
      runAction('return', () =>
        api.post(`/quality/${current.id}/return`, {
          message,
        }),
      )
      return
    }

    if (actionModal === 'comment') {
      const message = actionMessage.trim()
      if (!message) {
        alert('Informe um comentário para registrar no histórico.')
        return
      }
      runAction('comment', () =>
        api.post(`/quality/${current.id}/comment`, {
          message,
        }),
      )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div
        className="card"
        style={{
          padding: '14px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(150px, 1fr) minmax(180px, 1.2fr) minmax(170px, 0.9fr) minmax(170px, 0.9fr) auto auto',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <input
          className="input-field"
          value={serviceOrderSearch}
          onChange={(event) => setServiceOrderSearch(event.target.value)}
          placeholder="Buscar por O.S."
        />
        <input
          className="input-field"
          value={clientSearch}
          onChange={(event) => setClientSearch(event.target.value)}
          placeholder="Buscar por cliente"
        />
        <select className="input-field" value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
          <option value="">Todas as empresas</option>
          {companyOptions.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>
        <select className="input-field" value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>
          <option value="">Todos os técnicos</option>
          {technicianOptions.map((technician) => (
            <option key={technician} value={technician}>
              {technician}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyMine((currentValue) => !currentValue)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: '10px',
            border: onlyMine ? '1px solid #bfdbfe' : '1px solid #dbe2ea',
            background: onlyMine ? '#eff6ff' : '#ffffff',
            color: onlyMine ? '#1d4ed8' : '#334155',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {onlyMine ? 'Meus cards' : 'Somente meus cards'}
        </button>
        <button
          type="button"
          onClick={() => loadBoard({ silent: true })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: '10px',
            border: '1px solid #dbe2ea',
            background: '#ffffff',
            color: '#334155',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <RefreshCw style={{ width: '14px', height: '14px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
          <LoaderCircle style={{ width: '20px', height: '20px', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          Carregando fluxo da Qualidade...
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', padding: '4px 4px 14px 4px', scrollSnapType: isMobile ? 'x proximity' : 'none' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(5, 82vw)' : 'repeat(5, minmax(0, 1fr))',
              gap: '14px',
              alignItems: 'start',
              width: '100%',
              minWidth: isMobile ? 'max-content' : '0',
            }}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className="card"
                onDragOver={(event) => {
                  if (!column.droppable) return
                  event.preventDefault()
                  setHoverColumn(column.key)
                }}
                onDragLeave={() => setHoverColumn((currentColumn) => (currentColumn === column.key ? '' : currentColumn))}
                onDrop={(event) => {
                  event.preventDefault()
                  const itemId = event.dataTransfer.getData('text/plain')
                  const item = items.find((entry) => entry.id === itemId)
                  setHoverColumn('')
                  moveCard(item, column.key)
                }}
                style={{
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  minHeight: 'calc(100vh - 210px)',
                  maxHeight: 'calc(100vh - 210px)',
                  background: '#fbfcfe',
                  borderColor: hoverColumn === column.key ? '#cbd5e1' : '#e5e7eb',
                  boxShadow: hoverColumn === column.key ? '0 0 0 2px rgba(148, 163, 184, 0.14), 0 18px 40px rgba(15, 23, 42, 0.08)' : '0 10px 24px rgba(15, 23, 42, 0.04)',
                  transform: hoverColumn === column.key ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease',
                  scrollSnapAlign: 'start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', color: '#0f172a', minWidth: 0 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: column.accent, boxShadow: `0 0 0 4px ${column.accent}14` }} />
                    {column.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#f1f5f9', borderRadius: '999px', padding: '4px 8px' }}>
                      {(grouped[column.key] || []).length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenColumnSearch((currentValue) => (currentValue === column.key ? '' : column.key))}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        background: openColumnSearch === column.key ? '#f8fafc' : '#ffffff',
                        color: '#64748b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreHorizontal style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>

                {openColumnSearch === column.key && (
                  <div style={{ position: 'relative' }}>
                    <Search style={{ width: '14px', height: '14px', color: '#94a3b8', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="input-field"
                      value={columnSearches[column.key] || ''}
                      onChange={(event) =>
                        setColumnSearches((currentValue) => ({
                          ...currentValue,
                          [column.key]: event.target.value,
                        }))
                      }
                      placeholder="Pesquisar cards"
                      style={{ paddingLeft: '34px' }}
                    />
                  </div>
                )}

                {(grouped[column.key] || []).length === 0 ? (
                  <div style={{ flex: 1, border: '1px dashed #d7dee8', borderRadius: '14px', padding: '18px', color: '#94a3b8', fontSize: '13px', background: '#ffffff' }}>
                    Nenhum certificado nesta etapa.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '4px' }}>
                    {(grouped[column.key] || []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        draggable={column.droppable}
                        onDragStart={(event) => {
                          setDraggedId(item.id)
                          event.dataTransfer.setData('text/plain', item.id)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDraggedId(null)
                          setHoverColumn('')
                        }}
                        onClick={() => openDetails(item.id)}
                        style={{
                          textAlign: 'left',
                          border: draggedId === item.id ? '1px solid #94a3b8' : '1px solid #e5e7eb',
                          borderRadius: '14px',
                          background: '#ffffff',
                          padding: '12px',
                          cursor: 'pointer',
                          boxShadow: draggedId === item.id
                            ? '0 24px 40px rgba(15, 23, 42, 0.18)'
                            : '0 8px 20px rgba(15, 23, 42, 0.06)',
                          opacity: submittingAction === `move-${item.id}` ? 0.7 : 1,
                          transform: draggedId === item.id ? 'rotate(1deg) scale(1.02) translateY(-2px)' : 'translateY(0) scale(1)',
                          transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <GripVertical style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{item.certificate_number}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {item.quality_assigned_user && (
                              <AvatarCircle user={item.quality_assigned_user} size={24} fontSize={10} />
                            )}
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '999px', padding: '2px 7px' }}>{technicalStatusLabels[item.status] || item.status}</span>
                          </div>
                        </div>
                        <p style={{ marginTop: '8px', fontSize: '12px', color: '#334155' }}>O.S.: {valueOrDash(item.service_order_number)}</p>
                        <p style={{ marginTop: '4px', fontSize: '12px', color: '#475569' }}>
                          {(item.extra_fields?.empresa || 'Sem empresa')} • {(item.extra_fields?.contratante || 'Sem cliente')}
                        </p>
                        <p style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                          {item.extra_fields?.instrumento || item.instrument_description || 'Instrumento não informado'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '0' : '24px',
            zIndex: 80,
          }}
          onClick={closeDetails}
        >
          <div
            className="animate-fade-in"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: isMobile ? '100%' : 'min(1180px, 96vw)',
              height: isMobile ? '100%' : 'min(92vh, 920px)',
              background: '#ffffff',
              overflowY: 'auto',
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: isMobile ? '0' : '22px',
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f7' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Qualidade</p>
                  <h3 style={{ marginTop: '4px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>{current?.certificate_number}</h3>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: '#eef2ff', color: '#4338ca' }}>{qualityStatusLabel}</span>
                    <span className="badge" style={{ background: '#f8fafc', color: '#475569' }}>
                      {technicalStatusLabels[current?.status] || current?.status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDetails}
                  aria-label="Fechar modal"
                  style={{
                    width: '38px',
                    height: '38px',
                    border: '1px solid #dbe2ea',
                    background: '#ffffff',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    flexShrink: 0,
                  }}
                >
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Documento
                    </span>
                    <ActionButton tone="neutral" onClick={() => setActiveTab((currentTab) => (currentTab === 'pdf' ? 'dados' : 'pdf'))}>
                      <Eye style={{ width: '15px', height: '15px' }} />
                      {activeTab === 'pdf' ? 'Dados' : 'Ver PDF'}
                    </ActionButton>
                    <ActionButton
                      tone="neutral"
                      onClick={() => downloadOfficialPdf(current?.id, current?.certificate_number)}
                    >
                      <Download style={{ width: '15px', height: '15px' }} />
                      Baixar
                    </ActionButton>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Edição
                    </span>
                    {editingData ? (
                      <>
                        <ActionButton tone="primary" disabled={submittingAction === 'save-inline'} onClick={saveInlineEdits}>
                          <Save style={{ width: '14px', height: '14px' }} />
                          Salvar
                        </ActionButton>
                        <ActionButton tone="neutral" onClick={() => { setEditingData(false); setDraftData(buildEditableState(current)) }}>
                          <X style={{ width: '14px', height: '14px' }} />
                          Cancelar
                        </ActionButton>
                      </>
                    ) : (
                      <ActionButton tone="neutral" onClick={() => setEditingData(true)}>
                        <Pencil style={{ width: '14px', height: '14px' }} />
                        Editar
                      </ActionButton>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Fluxo
                  </span>

                  {current?.quality_status === 'pending_review' && (
                    <ActionButton tone="primary" onClick={() => runAction('claim', () => api.post(`/quality/${current.id}/claim`))}>
                      <ShieldCheck style={{ width: '15px', height: '15px' }} />
                      Assumir
                    </ActionButton>
                  )}

                  <ActionButton
                    tone="warning"
                    disabled={submittingAction !== ''}
                    onClick={() => openActionModal('return')}
                  >
                    <CornerUpLeft style={{ width: '15px', height: '15px' }} />
                    Devolver
                  </ActionButton>

                  <ActionButton
                    tone="primary"
                    onClick={() => runAction('reprocess', () => api.post(`/quality/${current.id}/reprocess`, { message: comment.trim() || 'A Qualidade solicitou nova gera??o do certificado.' }))}
                  >
                    <RotateCw style={{ width: '15px', height: '15px' }} />
                    Reprocessar
                  </ActionButton>

                  <ActionButton tone="success" onClick={() => runAction('approve', () => api.post(`/quality/${current.id}/approve`))}>
                    <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                    Aprovar
                  </ActionButton>

                  <ActionButton
                    tone="danger"
                    disabled={submittingAction !== ''}
                    onClick={() =>
                      runAction('reject', () =>
                        api.post(`/quality/${current.id}/reject`, {
                          message: comment.trim() || 'A Qualidade rejeitou o certificado.',
                        }),
                      )
                    }
                  >
                    <XCircle style={{ width: '15px', height: '15px' }} />
                    Rejeitar
                  </ActionButton>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 22px', borderBottom: '1px solid #eef2f7', display: 'flex', gap: '8px', overflowX: 'auto' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    borderBottom: activeTab === tab.key ? '2px solid #002868' : '2px solid transparent',
                    color: activeTab === tab.key ? '#002868' : '#64748b',
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '14px 8px 12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: '18px' }}>
              {detailLoading ? (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <LoaderCircle style={{ width: '18px', height: '18px', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                  Carregando detalhes...
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {activeTab === 'dados' && (
                      <>
                        <div className="card" style={{ padding: '16px' }}>
                          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Dados preenchidos pelo técnico</h4>
                              <p style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                                Revise e, se necessário, ajuste os dados diretamente aqui no modal.
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px 16px' }}>
                            {summaryFields.map((field) => (
                              <DataField
                                key={field.key}
                                label={field.label}
                                value={field.source === 'root' ? draftData?.[field.key] : draftData?.extra_fields?.[field.key]}
                                editing={editingData}
                                onChange={(value) => {
                                  if (field.source === 'root') {
                                    setDraftData((currentDraft) => ({ ...currentDraft, [field.key]: value }))
                                  } else {
                                    updateDraftExtra(field.key, value)
                                  }
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="card" style={{ padding: '16px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Condições ambientais e padrões</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px 16px' }}>
                            {environmentFields.map((field) => (
                              <DataField
                                key={field.key}
                                label={field.label}
                                value={draftData?.extra_fields?.[field.key]}
                                editing={editingData}
                                onChange={(value) => updateDraftExtra(field.key, value)}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="card" style={{ padding: '16px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Pontos de calibração</h4>
                          {pointRows.length === 0 ? (
                            <p style={{ fontSize: '13px', color: '#94a3b8' }}>Nenhum ponto cadastrado.</p>
                          ) : (
                            <div style={{ display: 'grid', gap: '10px' }}>
                              {pointRows.map((channel, channelIndex) =>
                                (channel.points || []).map((point, pointIndex) => (
                                  <div key={`${channelIndex}-${pointIndex}`} style={{ border: '1px solid #eef2f7', borderRadius: '12px', padding: '12px 14px', background: '#ffffff' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                                        Canal {channel.channel_number || channelIndex + 1} • Ponto {point.point_number || pointIndex + 1}
                                      </p>
                                      <p style={{ fontSize: '12px', color: '#64748b' }}>{valueOrDash(point.escopo)}</p>
                                    </div>
                                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: '8px 12px' }}>
                                      <DataField label="Valor nominal" value={point.valor_nominal} editing={editingData} onChange={(value) => updatePoint(channelIndex, pointIndex, 'valor_nominal', value)} />
                                      <DataField label="Menor divisão" value={point.menor_divisao} editing={editingData} onChange={(value) => updatePoint(channelIndex, pointIndex, 'menor_divisao', value)} />
                                      <DataField label="Balança" value={point.balanca_utilizada} editing={editingData} onChange={(value) => updatePoint(channelIndex, pointIndex, 'balanca_utilizada', value)} />
                                      <DataField label="Termômetro" value={point.termometro} editing={editingData} onChange={(value) => updatePoint(channelIndex, pointIndex, 'termometro', value)} />
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
                                                <tr key={`${channelIndex}-${pointIndex}-${measurementIndex}`} style={{ borderTop: measurementIndex === 0 ? '1px solid #eef2f7' : '1px solid #f1f5f9' }}>
                                                  <td style={{ padding: '8px 10px', fontSize: '12px', color: '#334155' }}>
                                                    {measurement.medicao || measurementIndex + 1}
                                                  </td>
                                                  <td style={{ padding: '8px 10px' }}>
                                                    {editingData ? (
                                                      <input
                                                        className="input-field"
                                                        value={measurement.massa_aparente || ''}
                                                        onChange={(event) => updatePointMeasurement(channelIndex, pointIndex, measurementIndex, 'massa_aparente', event.target.value)}
                                                        style={{ minWidth: '100px' }}
                                                      />
                                                    ) : (
                                                      <span style={{ fontSize: '12px', color: '#334155' }}>{valueOrDash(measurement.massa_aparente)}</span>
                                                    )}
                                                  </td>
                                                  <td style={{ padding: '8px 10px' }}>
                                                    {editingData ? (
                                                      <input
                                                        className="input-field"
                                                        value={measurement.temperatura_fluido || ''}
                                                        onChange={(event) => updatePointMeasurement(channelIndex, pointIndex, measurementIndex, 'temperatura_fluido', event.target.value)}
                                                        style={{ minWidth: '100px' }}
                                                      />
                                                    ) : (
                                                      <span style={{ fontSize: '12px', color: '#334155' }}>{valueOrDash(measurement.temperatura_fluido)}</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )),
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {activeTab === 'historico' && (
                      <div className="card" style={{ padding: '16px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Histórico e comentários</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? 'unset' : '620px', overflowY: 'auto' }}>
                          {timeline.length === 0 ? (
                            <p style={{ fontSize: '13px', color: '#94a3b8' }}>Nenhum registro ainda.</p>
                          ) : (
                            timeline.map((event) => (
                              <div key={event.id} style={{ border: '1px solid #eef2f7', borderRadius: '12px', padding: '12px 14px', background: '#ffffff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                    {event.author_name || event.author_role || 'Sistema'}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDateTime(event.created_at)}</span>
                                </div>
                                <p style={{ marginTop: '6px', fontSize: '12px', color: '#64748b', fontWeight: 700 }}>{eventTypeLabel(event.event_type)}</p>
                                {event.message && (
                                  <p style={{ marginTop: '6px', fontSize: '13px', lineHeight: 1.6, color: '#334155' }}>{event.message}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'pdf' && (
                      <div className="card" style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>PDF em revisão</h4>
                          <p style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                            Use esta aba apenas quando quiser validar a saída visual do certificado.
                          </p>
                        </div>

                        {previewLoading ? (
                          <div style={{ height: isMobile ? '360px' : '640px', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <LoaderCircle style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                          </div>
                        ) : previewUrl ? (
                          <iframe title={`Preview ${current?.certificate_number}`} src={previewUrl} style={{ width: '100%', height: isMobile ? '360px' : '640px', border: '1px solid #e5e7eb', borderRadius: '12px' }} />
                        ) : (
                          <div style={{ height: isMobile ? '360px' : '640px', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            Não foi possível carregar o PDF neste ambiente.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Resumo do fluxo</h4>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <p style={{ fontSize: '13px', color: '#334155' }}><strong>Status técnico:</strong> {technicalStatusLabels[current?.status] || current?.status}</p>
                        <p style={{ fontSize: '13px', color: '#334155' }}><strong>Status da Qualidade:</strong> {qualityStatusLabel}</p>
                        <p style={{ fontSize: '13px', color: '#334155' }}><strong>Última atualização:</strong> {formatDateTime(current?.updated_at)}</p>
                        <p style={{ fontSize: '13px', color: '#334155' }}><strong>Precisa reprocessar:</strong> {current?.requires_reprocess ? 'Sim' : 'Não'}</p>
                      </div>
                    </div>

                    <div className="card" style={{ padding: '16px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>Comentário da Qualidade</h4>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                        <p style={{ fontSize: '12px', color: '#64748b' }}>
                          Acompanhe o histórico de ações e registre novos comentários quando necessário.
                        </p>
                        <ActionButton tone="neutral" onClick={() => openActionModal('comment')}>
                          <MessageSquare style={{ width: '14px', height: '14px' }} />
                          Comentar
                        </ActionButton>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? 'unset' : '360px', overflowY: 'auto' }}>
                        {timelinePreview.length === 0 ? (
                          <p style={{ fontSize: '13px', color: '#94a3b8' }}>Nenhum histórico registrado ainda.</p>
                        ) : (
                          timelinePreview.map((event) => (
                            <div key={event.id} style={{ border: '1px solid #eef2f7', borderRadius: '12px', padding: '12px 14px', background: '#ffffff' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                  {event.author_name || event.author_role || 'Sistema'}
                                </span>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDateTime(event.created_at)}</span>
                              </div>
                              <p style={{ marginTop: '6px', fontSize: '12px', color: '#64748b', fontWeight: 700 }}>{eventTypeLabel(event.event_type)}</p>
                              {event.message && (
                                <p style={{ marginTop: '6px', fontSize: '13px', lineHeight: 1.6, color: '#334155' }}>{event.message}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      {current?.quality_assigned_user && (
                        <div
                          style={{
                            marginTop: '14px',
                            paddingTop: '14px',
                            borderTop: '1px solid #eef2f7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                        >
                          <AvatarCircle user={current.quality_assigned_user} size={36} fontSize={12} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>
                              Responsável pela Qualidade
                            </p>
                            <p style={{ marginTop: '4px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                              {current.quality_assigned_user.name || 'Não definido'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selected && actionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.38)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 95,
          }}
          onClick={() => {
            if (submittingAction) return
            setActionModal(null)
            setActionMessage('')
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="card"
            style={{
              width: 'min(520px, 100%)',
              padding: '22px',
              borderRadius: '20px',
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  {actionModal === 'return' ? 'Devolver para o técnico' : 'Novo comentário'}
                </h4>
                <p style={{ marginTop: '6px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                  {actionModal === 'return'
                    ? 'Descreva o que precisa ser ajustado antes de devolver o card para o técnico.'
                    : 'Registre uma observação para manter a timeline do certificado atualizada.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (submittingAction) return
                  setActionModal(null)
                  setActionMessage('')
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '999px',
                  border: '1px solid #dbe2ea',
                  background: '#ffffff',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: '15px', height: '15px' }} />
              </button>
            </div>

            <textarea
              className="input-field"
              value={actionMessage}
              onChange={(event) => setActionMessage(event.target.value)}
              placeholder={
                actionModal === 'return'
                  ? 'Explique para o técnico o que precisa ser corrigido...'
                  : 'Escreva o comentário da Qualidade...'
              }
              rows={7}
              style={{ marginTop: '16px', resize: 'vertical' }}
            />

            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <ActionButton
                tone="neutral"
                disabled={submittingAction !== ''}
                onClick={() => {
                  setActionModal(null)
                  setActionMessage('')
                }}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                tone={actionModal === 'return' ? 'warning' : 'primary'}
                disabled={submittingAction !== ''}
                onClick={confirmActionModal}
              >
                {actionModal === 'return' ? 'Confirmar devolução' : 'Salvar comentário'}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
