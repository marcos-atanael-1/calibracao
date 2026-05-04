import { useEffect, useState } from 'react'
import { Sparkles, KeyRound, Save, ShieldCheck } from 'lucide-react'
import api from '../api/client'
import useIsMobile from '../hooks/useIsMobile'

const cardStyle = {
  borderRadius: '18px',
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
}

export default function AISetupPage() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    openai_api_key: '',
    openai_model: 'gpt-5.4',
    is_enabled: false,
    masked_api_key: null,
    has_api_key: false,
  })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const { data } = await api.get('/ai-setup')
      const setup = data.data
      setForm({
        openai_api_key: '',
        openai_model: setup.openai_model || 'gpt-5.4',
        is_enabled: !!setup.is_enabled,
        masked_api_key: setup.masked_api_key || null,
        has_api_key: !!setup.has_api_key,
      })
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao carregar IA Setup')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        openai_api_key: form.openai_api_key,
        openai_model: form.openai_model,
        is_enabled: form.is_enabled,
      }
      const { data } = await api.put('/ai-setup', payload)
      const setup = data.data
      setForm((prev) => ({
        ...prev,
        openai_api_key: '',
        openai_model: setup.openai_model,
        is_enabled: !!setup.is_enabled,
        masked_api_key: setup.masked_api_key || null,
        has_api_key: !!setup.has_api_key,
      }))
      setMessage('Configuracao de IA salva com sucesso.')
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao salvar IA Setup')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '920px' }}>
      <div style={{ ...cardStyle, padding: isMobile ? '18px' : '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '999px', background: '#eef4ff', color: '#1d4ed8', fontSize: '12px', fontWeight: 700 }}>
              <Sparkles style={{ width: '14px', height: '14px' }} />
              IA Setup
            </div>
            <h3 style={{ marginTop: '14px', fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: '#0f172a' }}>
              Configuracao da OpenAI
            </h3>
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#475569', lineHeight: 1.7, maxWidth: '680px' }}>
              Este modulo centraliza a chave da API e o modelo que serao usados na leitura inteligente dos prints da planilha para sugerir campos de templates.
            </p>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: isMobile ? '100%' : '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '13px', fontWeight: 700 }}>
              <ShieldCheck style={{ width: '16px', height: '16px' }} />
              Seguranca do Setup
            </div>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
              A chave fica salva no banco e a tela mostra apenas uma versao mascarada para consulta.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ ...cardStyle, padding: isMobile ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {loading ? (
          <p style={{ fontSize: '14px', color: '#64748b' }}>Carregando configuracao...</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Modelo da OpenAI
                </label>
                <input
                  className="input-field"
                  type="text"
                  value={form.openai_model}
                  onChange={(e) => setForm((prev) => ({ ...prev, openai_model: e.target.value }))}
                  placeholder="gpt-5.4"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Status da integracao
                </label>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, is_enabled: !prev.is_enabled }))}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: `1px solid ${form.is_enabled ? '#93c5fd' : '#e5e7eb'}`,
                    background: form.is_enabled ? '#eff6ff' : '#ffffff',
                    color: form.is_enabled ? '#1d4ed8' : '#475569',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {form.is_enabled ? 'IA habilitada' : 'IA desabilitada'}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Chave da API OpenAI
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                <input
                  className="input-field"
                  type="password"
                  value={form.openai_api_key}
                  onChange={(e) => setForm((prev) => ({ ...prev, openai_api_key: e.target.value }))}
                  placeholder={form.has_api_key ? 'Deixe em branco para manter a chave atual' : 'Cole aqui a chave da OpenAI'}
                  style={{ paddingLeft: '38px' }}
                />
              </div>
              <p style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                {form.has_api_key
                  ? `Chave cadastrada atualmente: ${form.masked_api_key || 'mascarada'}`
                  : 'Nenhuma chave cadastrada ainda.'}
              </p>
            </div>

            {message && (
              <div style={{ padding: '12px 14px', borderRadius: '12px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: '13px', fontWeight: 600 }}>
                {message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 18px', width: isMobile ? '100%' : 'auto' }}
              >
                <Save style={{ width: '15px', height: '15px' }} />
                {saving ? 'Salvando...' : 'Salvar configuracao'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
