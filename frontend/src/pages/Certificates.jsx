import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FileText, Download, Send, Trash2 } from 'lucide-react'
import api from '../api/client'

const statusLabels = {
  draft: { label: 'Rascunho', bg: '#f3f4f6', color: '#4b5563' },
  queued: { label: 'Na Fila', bg: '#fef3c7', color: '#b45309' },
  processing: { label: 'Processando', bg: '#dbeafe', color: '#1d4ed8' },
  done: { label: 'Concluído', bg: '#d1fae5', color: '#047857' },
  error: { label: 'Erro', bg: '#fee2e2', color: '#dc2626' },
}

export default function Certificates() {
  const nav = useNavigate()
  const [certs, setCerts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    try { const { data } = await api.get('/certificates'); setCerts(data.data || []) }
    catch(e) {} finally { setLoading(false) }
  }

  const enqueue = async (id) => {
    try { await api.post(`/certificates/${id}/queue`); load() }
    catch(e) { alert(e.response?.data?.detail || 'Erro') }
  }

  const del = async (id) => {
    if (!confirm('Excluir?')) return
    try { await api.delete(`/certificates/${id}`); load() }
    catch(e) { alert(e.response?.data?.detail || 'Erro') }
  }

  const filtered = certs.filter(c =>
    c.certificate_number?.toLowerCase().includes(search.toLowerCase()) ||
    c.instrument_tag?.toLowerCase().includes(search.toLowerCase())
  )

  const iconBtn = { padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Actions bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ position: 'relative', maxWidth: '320px', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9ca3af' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar certificados..."
            className="input-field"
            style={{ paddingLeft: '36px' }}
          />
        </div>
        <button onClick={() => nav('/certificates/new')} className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> Novo Certificado
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['NÚMERO', 'INSTRUMENTO', 'STATUS', 'DATA', 'AÇÕES'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'AÇÕES' ? 'right' : 'left',
                  padding: '12px 24px', fontSize: '11px', fontWeight: 600,
                  color: '#6b7280', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center' }}>
                <FileText style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>Nenhum certificado encontrado</p>
              </td></tr>
            ) : filtered.map(c => {
              const s = statusLabels[c.status] || statusLabels.draft
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #f3f4f6', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '14px 24px', fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{c.certificate_number}</td>
                  <td style={{ padding: '14px 24px', fontSize: '14px', color: '#6b7280' }}>{c.instrument_tag || '—'}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '9999px', background: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '14px 24px', fontSize: '14px', color: '#9ca3af' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      {c.status === 'draft' && <button onClick={() => enqueue(c.id)} style={{...iconBtn, color: '#002868'}} title="Processar"><Send style={{ width: '16px', height: '16px' }} /></button>}
                      {c.status === 'done' && <button style={{...iconBtn, color: '#047857'}} title="PDF"><Download style={{ width: '16px', height: '16px' }} /></button>}
                      {(c.status === 'draft' || c.status === 'error') && <button onClick={() => del(c.id)} style={{...iconBtn, color: '#dc2626'}} title="Excluir"><Trash2 style={{ width: '16px', height: '16px' }} /></button>}
                    </div>
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
