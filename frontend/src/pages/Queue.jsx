import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Bot, Sparkles, CircleAlert, Clock3, LoaderCircle, FileText, Search } from 'lucide-react'
import api from '../api/client'

const statusLabels = {
  pending: {
    label: 'Agente em espera',
    bg: '#fff3d6',
    color: '#b45309',
    accent: '#f59e0b',
    description: 'O item ja esta na fila e aguarda a proxima janela do Agente.',
  },
  processing: {
    label: 'Agente executando',
    bg: '#dbeafe',
    color: '#1d4ed8',
    accent: '#2563eb',
    description: 'O Agente esta processando este certificado agora.',
  },
  done: {
    label: 'Concluido',
    bg: '#d1fae5',
    color: '#047857',
    accent: '#10b981',
    description: 'O processamento foi concluido com sucesso.',
  },
  error: {
    label: 'Erro',
    bg: '#fee2e2',
    color: '#dc2626',
    accent: '#ef4444',
    description: 'O Agente encontrou um erro e o item pode precisar de reprocessamento.',
  },
}

const cardStyle = {
  borderRadius: '18px',
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
}

function formatDateTime(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('pt-BR')
  } catch {
    return '-'
  }
}

function StatusPill({ status }) {
  const meta = statusLabels[status] || statusLabels.pending
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 700,
        padding: '6px 10px',
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
        }}
      />
      {meta.label}
    </span>
  )
}

export default function Queue() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [retryingId, setRetryingId] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setRefreshing(true)
      const { data } = await api.get('/queue', {
        params: { t: Date.now() },
      })
      const baseItems = data.data || []

      const enrichedItems = await Promise.all(
        baseItems.map(async (item) => {
          if (item.certificate?.certificate_number) return item

          try {
            const certificateResponse = await api.get(`/certificates/${item.certificate_id}`)
            return {
              ...item,
              certificate: certificateResponse.data.data,
            }
          } catch {
            return item
          }
        })
      )

      setItems(enrichedItems)
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao carregar o Agente')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const retry = async (id) => {
    try {
      setRetryingId(id)
      await api.post(`/queue/${id}/retry`)
      await load()

      if (selectedItem?.id === id) {
        const updated = items.find((item) => item.id === id)
        if (updated) {
          setSelectedItem({ ...updated, status: 'pending', error_message: null })
        }
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao reprocessar')
    } finally {
      setRetryingId('')
    }
  }

  const openDetails = async (item) => {
    setSelectedItem(item)
    setSelectedCertificate(null)
    setShowDetailModal(true)
    setDetailLoading(true)

    try {
      const { data } = await api.get(`/certificates/${item.certificate_id}`)
      setSelectedCertificate(data.data)
    } catch {
      setSelectedCertificate(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetails = () => {
    setShowDetailModal(false)
    setSelectedItem(null)
    setSelectedCertificate(null)
    setDetailLoading(false)
  }

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      },
      { total: 0, pending: 0, processing: 0, done: 0, error: 0 }
    )
  }, [items])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items

    return items.filter((item) => {
      const certificateNumber = item.certificate?.certificate_number || ''
      const certificateLabel = item.certificate?.instrument_description || ''
      const company = item.certificate?.extra_fields?.empresa || ''
      const client = item.certificate?.extra_fields?.contratante || ''
      const worker = item.worker_id || ''
      const error = item.error_message || ''

      const haystack = [
        certificateNumber,
        certificateLabel,
        company,
        client,
        worker,
        error,
        item.certificate_id,
        item.id,
      ].join(' ').toLowerCase()

      return haystack.includes(query)
    })
  }, [items, search])

  const selectedMeta = statusLabels[selectedItem?.status] || statusLabels.pending
  const selectedExtra = selectedCertificate?.extra_fields || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 420px) 1fr auto', gap: '18px', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9ca3af' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar certificado, empresa, cliente ou erro..."
            className="input-field"
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total', value: summary.total },
              { label: 'Em espera', value: summary.pending },
              { label: 'Executando', value: summary.processing },
              { label: 'Concluidos', value: summary.done },
              { label: 'Erros', value: summary.error },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>{item.label}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={load}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#ffffff',
            background: '#002868',
            border: '1px solid #002868',
            cursor: 'pointer',
            transition: 'all 0.15s',
            alignSelf: 'center',
            boxShadow: '0 10px 24px rgba(0, 40, 104, 0.14)',
            opacity: refreshing ? 0.8 : 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#003b99'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#002868'
          }}
          disabled={refreshing}
        >
          <RefreshCw style={{ width: '16px', height: '16px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ width: '17%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['CERTIFICADO', 'TENTATIVAS', 'ERRO', 'CRIADO EM', 'INICIADO EM', 'STATUS'].map((heading) => (
                <th
                  key={heading}
                  style={{
                    textAlign: 'left',
                    padding: '12px 20px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#6b7280',
                    letterSpacing: '0.06em',
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
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>
                  Carregando...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center' }}>
                  <Bot style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '14px', color: '#9ca3af' }}>Nenhum item encontrado para o agente</p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderTop: '1px solid #f3f4f6',
                      transition: 'all 0.18s ease',
                      boxShadow: 'inset 0 0 0 0 rgba(0, 40, 104, 0)',
                    }}
                    onClick={() => openDetails(item)}
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
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        {item.certificate?.certificate_number || String(item.certificate_id || '').slice(0, 8)}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', verticalAlign: 'middle' }}>
                      {item.retry_count}/{item.max_retries}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '12px', color: item.error_message ? '#dc2626' : '#94a3b8', verticalAlign: 'middle' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.error_message || 'Sem Erros'}>
                        {item.error_message || 'Sem Erros'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '13px', color: '#64748b', verticalAlign: 'middle' }}>
                      {formatDateTime(item.created_at)}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', verticalAlign: 'middle' }}>
                      {formatDateTime(item.started_at)}
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <StatusPill status={item.status} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showDetailModal && selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '24px',
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '920px',
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
                  Painel do Agente
                </p>
                <h3 style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                  Item {selectedItem.id.slice(0, 8)}...
                </h3>
                <div style={{ marginTop: '10px' }}>
                  <StatusPill status={selectedItem.status} />
                </div>
              </div>

              <button
                onClick={closeDetails}
                style={{
                  border: '1px solid #dbe2ea',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Fechar
              </button>
            </div>

            <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  ...cardStyle,
                  padding: '18px 20px',
                  background:
                    selectedItem.status === 'processing'
                      ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                      : selectedItem.status === 'pending'
                        ? 'linear-gradient(135deg, #fff8eb 0%, #fff1cf 100%)'
                        : selectedItem.status === 'done'
                          ? 'linear-gradient(135deg, #effcf6 0%, #dff7ec 100%)'
                          : 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#ffffff',
                      color: selectedMeta.color,
                    }}
                  >
                    {selectedItem.status === 'processing' ? (
                      <LoaderCircle style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite' }} />
                    ) : selectedItem.status === 'done' ? (
                      <Sparkles style={{ width: '24px', height: '24px' }} />
                    ) : selectedItem.status === 'error' ? (
                      <CircleAlert style={{ width: '24px', height: '24px' }} />
                    ) : (
                      <Bot style={{ width: '24px', height: '24px' }} />
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{selectedMeta.label}</p>
                    <p style={{ marginTop: '4px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>{selectedMeta.description}</p>
                  </div>
                </div>
              </div>

              {detailLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px', color: '#64748b', gap: '10px' }}>
                  <LoaderCircle style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                  Carregando detalhes do processamento...
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }}>
                    <div style={{ ...cardStyle, padding: '20px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Dados tecnicos</h4>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <DetailRow label="Queue ID" value={selectedItem.id} mono />
                        <DetailRow label="Certificate ID" value={selectedItem.certificate_id} mono />
                        <DetailRow label="Worker ID" value={selectedItem.worker_id || '-'} />
                        <DetailRow label="Tentativas" value={`${selectedItem.retry_count}/${selectedItem.max_retries}`} />
                        <DetailRow label="Criado em" value={formatDateTime(selectedItem.created_at)} />
                        <DetailRow label="Iniciado em" value={formatDateTime(selectedItem.started_at)} />
                        <DetailRow label="Concluido em" value={formatDateTime(selectedItem.completed_at)} />
                      </div>
                    </div>

                    <div style={{ ...cardStyle, padding: '20px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Erro e rastreio</h4>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <DetailRow label="Status" value={selectedMeta.label} />
                        <DetailRow label="Erro" value={selectedItem.error_message || 'Sem Erros'} error={Boolean(selectedItem.error_message)} />
                        <DetailRow label="Empresa" value={selectedExtra.empresa || '-'} />
                        <DetailRow label="Cliente" value={selectedExtra.contratante || '-'} />
                        <DetailRow label="Certificado" value={selectedCertificate?.certificate_number || '-'} />
                        <DetailRow label="Instrumento" value={selectedCertificate?.instrument_description || '-'} />
                      </div>
                    </div>
                  </div>

                  {selectedCertificate && (
                    <div style={{ ...cardStyle, padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <FileText style={{ width: '16px', height: '16px', color: '#475569' }} />
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Resumo do certificado associado</h4>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px 18px' }}>
                        <DetailRow label="Numero" value={selectedCertificate.certificate_number} />
                        <DetailRow label="Tecnico" value={selectedExtra.tecnico || '-'} />
                        <DetailRow label="Data da calibracao" value={selectedExtra.data_calibracao || '-'} />
                        <DetailRow label="Tipo" value={selectedExtra.tipo_faixa || '-'} />
                        <DetailRow label="Metodo" value={selectedExtra.metodo || '-'} />
                        <DetailRow label="Orcamento" value={selectedExtra.numero_orcamento || '-'} />
                      </div>
                    </div>
                  )}

                  {selectedItem.status === 'error' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => retry(selectedItem.id)}
                        disabled={retryingId === selectedItem.id}
                        className="btn-primary"
                        style={{ padding: '10px 16px', opacity: retryingId === selectedItem.id ? 0.7 : 1 }}
                      >
                        {retryingId === selectedItem.id ? 'Reenviando...' : 'Reprocessar no Agente'}
                      </button>
                    </div>
                  )}
                </>
              )}
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

function DetailRow({ label, value, mono = false, error = false }) {
  return (
    <div style={{ display: 'grid', gap: '4px' }}>
      <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '14px',
          color: error ? '#dc2626' : '#0f172a',
          fontFamily: mono ? 'Consolas, Monaco, monospace' : 'inherit',
          wordBreak: 'break-word',
          lineHeight: 1.5,
        }}
      >
        {value}
      </span>
    </div>
  )
}
