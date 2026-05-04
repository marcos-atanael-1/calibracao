import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Trash2, Save, X, SlidersHorizontal, List } from 'lucide-react'
import api from '../api/client'
import useIsMobile from '../hooks/useIsMobile'

function getErrorMessage(error, fallback = 'Erro') {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  return fallback
}

const emptyInstrumentForm = {
  name: '',
  description: '',
  template_id: '',
  is_active: true,
}

export default function SettingsPage() {
  const isMobile = useIsMobile()
  const [settings, setSettings] = useState([])
  const [templates, setTemplates] = useState([])
  const [instrumentTypes, setInstrumentTypes] = useState([])
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newItem, setNewItem] = useState('')
  const [editValues, setEditValues] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [instrumentForm, setInstrumentForm] = useState(emptyInstrumentForm)
  const [editingInstrumentId, setEditingInstrumentId] = useState('')
  const [savingInstrument, setSavingInstrument] = useState(false)
  const [showInstrumentModal, setShowInstrumentModal] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [settingsResponse, templatesResponse, instrumentsResponse] = await Promise.all([
        api.get('/settings'),
        api.get('/templates?active_only=false'),
        api.get('/instrument-types?active_only=false'),
      ])
      setSettings(settingsResponse.data.data || [])
      setTemplates(templatesResponse.data.data || [])
      setInstrumentTypes(instrumentsResponse.data.data || [])
    } catch {}
  }

  const selectSetting = (setting) => {
    setSelected(setting)
    setEditValues([...(setting.values || [])])
    setInstrumentForm(emptyInstrumentForm)
    setEditingInstrumentId('')
    setShowInstrumentModal(false)
  }

  const closeInstrumentModal = () => {
    setShowInstrumentModal(false)
    setInstrumentForm(emptyInstrumentForm)
    setEditingInstrumentId('')
  }

  const openCreateInstrumentModal = () => {
    setInstrumentForm(emptyInstrumentForm)
    setEditingInstrumentId('')
    setShowInstrumentModal(true)
  }

  const createSetting = async (e) => {
    e.preventDefault()
    try {
      await api.post('/settings', {
        key: newKey,
        label: newLabel,
        description: newDesc,
        values: [],
      })
      setShowForm(false)
      setNewKey('')
      setNewLabel('')
      setNewDesc('')
      load()
    } catch (error) {
      alert(getErrorMessage(error))
    }
  }

  const addItem = () => {
    if (!newItem.trim()) return
    setEditValues((prev) => [...prev, newItem.trim()])
    setNewItem('')
  }

  const removeItem = (idx) => {
    setEditValues((prev) => prev.filter((_, i) => i !== idx))
  }

  const saveValues = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const { data } = await api.put(`/settings/${selected.id}`, { values: editValues })
      const updated = data.data
      setSelected(updated)
      setSettings((prev) => prev.map((setting) => (setting.id === updated.id ? updated : setting)))
    } catch (error) {
      alert(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const deleteSetting = async (id) => {
    if (!confirm('Excluir esta configuração?')) return
    try {
      await api.delete(`/settings/${id}`)
      if (selected?.id === id) setSelected(null)
      load()
    } catch {
      alert('Erro ao excluir')
    }
  }

  const saveInstrumentType = async (e) => {
    e.preventDefault()
    setSavingInstrument(true)
    try {
      const payload = {
        name: instrumentForm.name.trim(),
        description: instrumentForm.description.trim() || null,
        template_id: instrumentForm.template_id || null,
        is_active: instrumentForm.is_active,
      }

      if (editingInstrumentId) {
        await api.put(`/instrument-types/${editingInstrumentId}`, payload)
      } else {
        await api.post('/instrument-types', payload)
      }

      closeInstrumentModal()
      const { data } = await api.get('/instrument-types?active_only=false')
      setInstrumentTypes(data.data || [])
    } catch (error) {
      alert(getErrorMessage(error))
    } finally {
      setSavingInstrument(false)
    }
  }

  const editInstrumentType = (item) => {
    setEditingInstrumentId(item.id)
    setInstrumentForm({
      name: item.name || '',
      description: item.description || '',
      template_id: item.template_id || '',
      is_active: item.is_active ?? true,
    })
    setShowInstrumentModal(true)
  }

  const deleteInstrumentType = async (id) => {
    if (!confirm('Excluir este instrumento?')) return
    try {
      await api.delete(`/instrument-types/${id}`)
      if (editingInstrumentId === id) {
        closeInstrumentModal()
      }
      const { data } = await api.get('/instrument-types?active_only=false')
      setInstrumentTypes(data.data || [])
    } catch (error) {
      alert(getErrorMessage(error))
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredSettings = settings.filter((setting) => {
    if (!normalizedSearch) return true

    const haystack = [
      setting.label,
      setting.key,
      setting.description,
      ...(setting.values || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })

  const selectedIsInstruments = selected?.key === 'instruments'
  const instrumentTemplateMap = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates]
  )

  const instrumentCountForCard = selectedIsInstruments
    ? instrumentTypes.length
    : (selected?.values || []).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '24px', minHeight: '500px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Listas de Opções</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus style={{ width: '14px', height: '14px' }} /> Nova
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <Search
            style={{
              width: '15px',
              height: '15px',
              color: '#94a3b8',
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar listas e opções..."
            className="input-field"
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {showForm && (
          <form
            onSubmit={createSetting}
            className="card animate-fade-in"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Chave (ex: calibration_types)"
              required
              className="input-field"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nome (ex: Tipos de Calibração)"
              required
              className="input-field"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descrição (opcional)"
              className="input-field"
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '8px' }}>
                Criar
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredSettings.map((setting) => {
            const count = setting.key === 'instruments' ? instrumentTypes.length : (setting.values || []).length
            return (
              <button
                key={setting.id}
                onClick={() => selectSetting(setting)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px',
                  borderRadius: '12px',
                  border: selected?.id === setting.id ? '1px solid rgba(0,40,104,0.2)' : '1px solid #e5e7eb',
                  background: selected?.id === setting.id ? '#e8eef8' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: selected?.id === setting.id ? '0 1px 3px rgba(0,40,104,0.1)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{setting.label}</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                      {count} itens
                    </p>
                  </div>
                  <List style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                </div>
              </button>
            )
          })}

          {settings.length === 0 && (
            <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>
              Nenhuma configuração criada
            </p>
          )}

          {settings.length > 0 && filteredSettings.length === 0 && (
            <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>
              Nenhuma lista encontrada para essa busca
            </p>
          )}
        </div>
      </div>

      <div>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#111827' }}>{selected.label}</h3>
                  {selected.description && (
                    <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{selected.description}</p>
                  )}
                </div>
                {!selectedIsInstruments && (
                  <button
                    onClick={() => deleteSetting(selected.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 500,
                    }}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} /> Excluir
                  </button>
                )}
              </div>
              <p
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  background: '#f9fafb',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  color: '#6b7280',
                  display: 'inline-block',
                }}
              >
                Chave: {selected.key}
              </p>
            </div>

            {selectedIsInstruments ? (
              <>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      Instrumentos ({instrumentCountForCard})
                    </h4>
                    <button
                      type="button"
                      onClick={openCreateInstrumentModal}
                      className="btn-primary"
                      style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus style={{ width: '14px', height: '14px' }} /> Novo instrumento
                    </button>
                  </div>

                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    {instrumentTypes.map((item) => {
                      const template = instrumentTemplateMap.get(item.template_id)
                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '14px 24px',
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr auto',
                            gap: '12px',
                            alignItems: 'center',
                            borderBottom: '1px solid #f8fafc',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{item.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                              {item.description || 'Sem descrição'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', color: '#334155' }}>{template?.name || 'Sem template'}</div>
                            <div style={{ fontSize: '12px', color: item.is_active ? '#15803d' : '#b45309', marginTop: '4px' }}>
                              {item.is_active ? 'Ativo' : 'Inativo'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => editInstrumentType(item)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#334155',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteInstrumentType(item.id)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {instrumentTypes.length === 0 && (
                      <p style={{ padding: '32px 24px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>
                        Nenhum instrumento cadastrado.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    Opções ({instrumentCountForCard})
                  </h4>
                  <button
                    onClick={saveValues}
                    disabled={saving}
                    className="btn-primary"
                    style={{ padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>

                <div
                  style={{
                    padding: '12px 24px',
                    borderBottom: '1px solid #f3f4f6',
                    background: '#fafafa',
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addItem()
                      }
                    }}
                    placeholder="Digite uma nova opção e pressione Enter..."
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn-primary"
                    style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    <Plus style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {editValues.map((value, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #f9fafb',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fafafa'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#374151' }}>{value}</span>
                      <button
                        onClick={() => removeItem(idx)}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#d1d5db',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#dc2626'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#d1d5db'
                        }}
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
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <SlidersHorizontal style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              Selecione uma lista para gerenciar suas opções
            </p>
          </div>
        )}
      </div>

      {selectedIsInstruments && showInstrumentModal && (
        <div
          onClick={closeInstrumentModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '14px' : '24px',
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={saveInstrumentType}
            onClick={(e) => e.stopPropagation()}
            className="card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: isMobile ? 'calc(100vw - 20px)' : '680px',
              padding: isMobile ? '16px' : '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                  {editingInstrumentId ? 'Editar instrumento' : 'Novo instrumento'}
                </h4>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  Defina qual template será usado automaticamente para este instrumento.
                </p>
              </div>
              <button
                type="button"
                onClick={closeInstrumentModal}
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Nome do instrumento</label>
                <input
                  value={instrumentForm.name}
                  onChange={(e) => setInstrumentForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  required
                  placeholder="Ex: Micropipeta de Volume Fixo"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Template</label>
                <select
                  value={instrumentForm.template_id}
                  onChange={(e) => setInstrumentForm((prev) => ({ ...prev, template_id: e.target.value }))}
                  className="input-field"
                  required
                >
                  <option value="">Selecione...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Descrição</label>
                <input
                  value={instrumentForm.description}
                  onChange={(e) => setInstrumentForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="input-field"
                  placeholder="Resumo opcional"
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={instrumentForm.is_active}
                  onChange={(e) => setInstrumentForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Instrumento ativo no formulário
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={closeInstrumentModal}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button type="submit" disabled={savingInstrument} className="btn-primary" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Save style={{ width: '14px', height: '14px' }} /> {savingInstrument ? 'Salvando...' : 'Salvar instrumento'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
