import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, X, SlidersHorizontal, List } from 'lucide-react'
import api from '../api/client'

export default function SettingsPage() {
  const [settings, setSettings] = useState([])
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newItem, setNewItem] = useState('')
  const [editValues, setEditValues] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data } = await api.get('/settings')
      setSettings(data.data || [])
    } catch (e) {}
  }

  const selectSetting = (s) => {
    setSelected(s)
    setEditValues([...(s.values || [])])
  }

  const createSetting = async (e) => {
    e.preventDefault()
    try {
      await api.post('/settings', { key: newKey, label: newLabel, description: newDesc, values: [] })
      setShowForm(false); setNewKey(''); setNewLabel(''); setNewDesc(''); load()
    } catch (e) { alert(e.response?.data?.detail || 'Erro') }
  }

  const addItem = () => {
    if (!newItem.trim()) return
    setEditValues(prev => [...prev, newItem.trim()])
    setNewItem('')
  }

  const removeItem = (idx) => {
    setEditValues(prev => prev.filter((_, i) => i !== idx))
  }

  const saveValues = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const { data } = await api.put(`/settings/${selected.id}`, { values: editValues })
      const updated = data.data
      setSelected(updated)
      setSettings(prev => prev.map(s => s.id === updated.id ? updated : s))
    } catch (e) { alert(e.response?.data?.detail || 'Erro') }
    finally { setSaving(false) }
  }

  const deleteSetting = async (id) => {
    if (!confirm('Excluir esta configuração?')) return
    try {
      await api.delete(`/settings/${id}`)
      if (selected?.id === id) setSelected(null)
      load()
    } catch (e) { alert('Erro ao excluir') }
  }

  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', minHeight: '500px' }}>
      {/* Left — List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Listas de Opções</h3>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus style={{ width: '14px', height: '14px' }} /> Nova
          </button>
        </div>

        {showForm && (
          <form onSubmit={createSetting} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Chave (ex: calibration_types)" required className="input-field" />
            <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nome (ex: Tipos de Calibração)" required className="input-field" />
            <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição (opcional)" className="input-field" />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '8px' }}>Criar</button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {settings.map(s => (
            <button key={s.id} onClick={() => selectSetting(s)}
              style={{
                width: '100%', textAlign: 'left', padding: '16px', borderRadius: '12px',
                border: selected?.id === s.id ? '1px solid rgba(0,40,104,0.2)' : '1px solid #e5e7eb',
                background: selected?.id === s.id ? '#e8eef8' : '#ffffff',
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: selected?.id === s.id ? '0 1px 3px rgba(0,40,104,0.1)' : 'none',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{s.label}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{(s.values || []).length} itens</p>
                </div>
                <List style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
              </div>
            </button>
          ))}
          {settings.length === 0 && <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>Nenhuma configuração criada</p>}
        </div>
      </div>

      {/* Right — Detail */}
      <div>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#111827' }}>{selected.label}</h3>
                  {selected.description && <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{selected.description}</p>}
                </div>
                <button onClick={() => deleteSetting(selected.id)} style={{
                  padding: '6px 12px', borderRadius: '8px', border: '1px solid #fecaca',
                  background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500
                }}>
                  <Trash2 style={{ width: '14px', height: '14px' }} /> Excluir
                </button>
              </div>
              <p style={{ fontSize: '12px', fontFamily: 'monospace', background: '#f9fafb', padding: '4px 8px', borderRadius: '4px', color: '#6b7280', display: 'inline-block' }}>
                Chave: {selected.key}
              </p>
            </div>

            {/* Items */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Opções ({editValues.length})</h4>
                <button onClick={saveValues} disabled={saving} className="btn-primary" style={{ padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>

              {/* Add new item */}
              <div style={{ padding: '12px 24px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', gap: '8px' }}>
                <input
                  type="text" value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                  placeholder="Digite uma nova opção e pressione Enter..."
                  className="input-field" style={{ flex: 1 }}
                />
                <button type="button" onClick={addItem} className="btn-primary" style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <Plus style={{ width: '14px', height: '14px' }} />
                </button>
              </div>

              {/* Items list */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {editValues.map((val, idx) => (
                  <div key={idx} style={{
                    padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: '1px solid #f9fafb', transition: 'background 0.1s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '14px', color: '#374151' }}>{val}</span>
                    <button onClick={() => removeItem(idx)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#d1d5db', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                      onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                    >
                      <X style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                ))}
                {editValues.length === 0 && (
                  <p style={{ padding: '32px 24px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>
                    Nenhuma opção cadastrada. Adicione itens acima.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <SlidersHorizontal style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>Selecione uma lista para gerenciar suas opções</p>
          </div>
        )}
      </div>
    </div>
  )
}
