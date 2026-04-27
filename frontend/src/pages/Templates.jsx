import { useEffect, useMemo, useState } from 'react'
import { Plus, Settings, Trash2, Save, Pencil, X } from 'lucide-react'
import api from '../api/client'

const emptyFieldForm = {
  field_key: '',
  label: '',
  field_type: 'text',
  excel_cell_ref: '',
  is_required: false,
  display_order: 1,
}

const emptyTemplateConfig = {
  input_sheet: '',
  output_sheet: '',
  points_sheet: '',
  post_fill_macros: '',
  results_mapping_json: '',
}

const fieldLabelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '6px',
}

export default function Templates() {
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [excelPath, setExcelPath] = useState('')
  const [fieldForm, setFieldForm] = useState(null)
  const [editingFieldId, setEditingFieldId] = useState(null)
  const [editingFieldForm, setEditingFieldForm] = useState(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    excel_template_path: '',
    is_active: true,
    default_config: emptyTemplateConfig,
  })

  useEffect(() => { load() }, [])

  const sortedFields = useMemo(
    () => [...(selected?.fields || [])].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    [selected]
  )

  const load = async () => {
    try {
      const { data } = await api.get('/templates?active_only=false')
      setTemplates(data.data || [])
    } catch (e) {}
  }

  const hydrateTemplateForm = (template) => {
    const cfg = template.default_config || {}
    setTemplateForm({
      name: template.name || '',
      description: template.description || '',
      excel_template_path: template.excel_template_path || '',
      is_active: template.is_active ?? true,
      default_config: {
        input_sheet: cfg.input_sheet || '',
        output_sheet: cfg.output_sheet || '',
        points_sheet: cfg.points_sheet || '',
        post_fill_macros: Array.isArray(cfg.post_fill_macros) ? cfg.post_fill_macros.join(', ') : '',
        results_mapping_json: cfg.results_mapping ? JSON.stringify(cfg.results_mapping, null, 2) : '',
      },
    })
  }

  const createTemplate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/templates', {
        name,
        description: desc,
        excel_template_path: excelPath,
        default_config: {
          input_sheet: 'Dados',
          output_sheet: 'Certificado',
          points_sheet: 'Resultados - 1',
          post_fill_macros: ['Formcert'],
        },
      })
      setShowForm(false)
      setName('')
      setDesc('')
      setExcelPath('')
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro')
    }
  }

  const selectTemplate = async (id) => {
    try {
      const { data } = await api.get(`/templates/${id}`)
      setSelected(data.data)
      hydrateTemplateForm(data.data)
      setFieldForm(null)
      setEditingFieldId(null)
      setEditingFieldForm(null)
    } catch (e) {}
  }

  const saveTemplate = async () => {
    if (!selected) return
    setSavingTemplate(true)
    try {
      await api.put(`/templates/${selected.id}`, {
        ...(function buildPayload() {
          let resultsMapping = null
          const rawMapping = templateForm.default_config.results_mapping_json?.trim()

          if (rawMapping) {
            try {
              resultsMapping = JSON.parse(rawMapping)
            } catch {
              throw new Error('JSON invalido no mapeamento dos resultados')
            }
          }

          return {
        name: templateForm.name,
        description: templateForm.description,
        excel_template_path: templateForm.excel_template_path,
        is_active: templateForm.is_active,
        default_config: {
          input_sheet: templateForm.default_config.input_sheet || null,
          output_sheet: templateForm.default_config.output_sheet || null,
          points_sheet: templateForm.default_config.points_sheet || null,
          post_fill_macros: templateForm.default_config.post_fill_macros
            .split(',')
            .map(item => item.trim())
            .filter(Boolean),
          results_mapping: resultsMapping,
        },
          }
        })(),
      })
      await selectTemplate(selected.id)
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || e.message || 'Erro ao salvar template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const removeTemplate = async () => {
    if (!selected) return
    try {
      await api.delete(`/templates/${selected.id}`)
      setSelected(null)
      setShowDeleteModal(false)
      setTemplateForm({
        name: '',
        description: '',
        excel_template_path: '',
        is_active: true,
        default_config: emptyTemplateConfig,
      })
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir template')
    }
  }

  const addField = async (e) => {
    e.preventDefault()
    if (!selected) return
    try {
      await api.post(`/templates/${selected.id}/fields`, fieldForm)
      await selectTemplate(selected.id)
      setFieldForm(null)
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro')
    }
  }

  const startEditField = (field) => {
    setEditingFieldId(field.id)
    setEditingFieldForm({
      field_key: field.field_key,
      label: field.label,
      field_type: field.field_type,
      excel_cell_ref: field.excel_cell_ref || '',
      is_required: field.is_required,
      display_order: field.display_order || 0,
    })
  }

  const saveField = async (fieldId) => {
    if (!selected || !editingFieldForm) return
    try {
      await api.put(`/templates/${selected.id}/fields/${fieldId}`, editingFieldForm)
      await selectTemplate(selected.id)
      setEditingFieldId(null)
      setEditingFieldForm(null)
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao atualizar campo')
    }
  }

  const deleteField = async (fieldId) => {
    if (!selected || !confirm('Excluir campo?')) return
    try {
      await api.delete(`/templates/${selected.id}/fields/${fieldId}`)
      await selectTemplate(selected.id)
    } catch (e) {
      alert('Erro')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Templates</h3>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus style={{ width: '14px', height: '14px' }} /> Novo
          </button>
        </div>

        {showForm && (
          <form onSubmit={createTemplate} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={fieldLabelStyle}>Nome do template</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Certificado de Volume POC" required className="input-field" />
            </div>
            <div>
              <label style={fieldLabelStyle}>Descricao</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Resumo do template" className="input-field" />
            </div>
            <div>
              <label style={fieldLabelStyle}>Caminho da planilha</label>
              <input type="text" value={excelPath} onChange={e => setExcelPath(e.target.value)} placeholder="Ex: Copy of Certificado de Volume-CVM-VOL-001 Rev.73.xlsm" className="input-field" />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px', width: '100%' }}>Criar</button>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '16px', borderRadius: '12px',
                border: selected?.id === t.id ? '1px solid rgba(0,40,104,0.2)' : '1px solid #e5e7eb',
                background: selected?.id === t.id ? '#e8eef8' : '#ffffff',
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: selected?.id === t.id ? '0 1px 3px rgba(0,40,104,0.1)' : 'none',
              }}
            >
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{t.name}</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{t.field_count || 0} campos</p>
            </button>
          ))}
          {templates.length === 0 && <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>Nenhum template criado</p>}
        </div>
      </div>

      <div>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{selected.name}</h3>
                <Settings style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={fieldLabelStyle}>Nome do template</label>
                  <input className="input-field" value={templateForm.name} onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome do template" />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Caminho da planilha</label>
                  <input className="input-field" value={templateForm.excel_template_path} onChange={e => setTemplateForm(prev => ({ ...prev, excel_template_path: e.target.value }))} placeholder="Caminho da planilha" />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Descricao</label>
                  <input className="input-field" value={templateForm.description} onChange={e => setTemplateForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Descricao" />
                </div>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4b5563' }}>
                    <input type="checkbox" checked={templateForm.is_active} onChange={e => setTemplateForm(prev => ({ ...prev, is_active: e.target.checked }))} />
                    Template ativo
                  </label>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #eef2f7', background: '#fafbfd' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>Configuracao do agente</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>Aba de entrada</label>
                    <input className="input-field" value={templateForm.default_config.input_sheet} onChange={e => setTemplateForm(prev => ({ ...prev, default_config: { ...prev.default_config, input_sheet: e.target.value } }))} placeholder="Ex: Dados" />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Aba de saida</label>
                    <input className="input-field" value={templateForm.default_config.output_sheet} onChange={e => setTemplateForm(prev => ({ ...prev, default_config: { ...prev.default_config, output_sheet: e.target.value } }))} placeholder="Ex: Certificado" />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Aba de pontos</label>
                    <input className="input-field" value={templateForm.default_config.points_sheet} onChange={e => setTemplateForm(prev => ({ ...prev, default_config: { ...prev.default_config, points_sheet: e.target.value } }))} placeholder="Ex: Resultados - 1" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={fieldLabelStyle}>Macros apos preenchimento</label>
                    <input className="input-field" value={templateForm.default_config.post_fill_macros} onChange={e => setTemplateForm(prev => ({ ...prev, default_config: { ...prev.default_config, post_fill_macros: e.target.value } }))} placeholder="Ex: Formcert" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={fieldLabelStyle}>Mapeamento avancado dos resultados (JSON)</label>
                    <textarea
                      className="input-field"
                      rows={14}
                      value={templateForm.default_config.results_mapping_json}
                      onChange={e => setTemplateForm(prev => ({ ...prev, default_config: { ...prev.default_config, results_mapping_json: e.target.value } }))}
                      placeholder='{"sheet_name_pattern":"Resultados - {sheet_number}"}'
                      style={{ resize: 'vertical', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <button onClick={() => setShowDeleteModal(true)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff1f2', color: '#be123c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trash2 style={{ width: '14px', height: '14px' }} /> Excluir Template
                </button>
                <button onClick={saveTemplate} disabled={savingTemplate} className="btn-primary" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save style={{ width: '14px', height: '14px' }} /> {savingTemplate ? 'Salvando...' : 'Salvar Template'}
                </button>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Campos ({sortedFields.length})</h4>
                <button
                  onClick={() => setFieldForm({ ...emptyFieldForm, display_order: sortedFields.length + 1 })}
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} /> Campo
                </button>
              </div>

              {fieldForm && (
                <form onSubmit={addField} className="animate-fade-in" style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={fieldLabelStyle}>Chave</label>
                      <input type="text" value={fieldForm.field_key} onChange={e => setFieldForm({ ...fieldForm, field_key: e.target.value })} placeholder="Ex: contratante" required className="input-field" />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Titulo visivel</label>
                      <input type="text" value={fieldForm.label} onChange={e => setFieldForm({ ...fieldForm, label: e.target.value })} placeholder="Ex: Contratante" required className="input-field" />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Tipo</label>
                      <select value={fieldForm.field_type} onChange={e => setFieldForm({ ...fieldForm, field_type: e.target.value })} className="input-field">
                        <option value="text">Texto</option>
                        <option value="number">Numero</option>
                        <option value="date">Data</option>
                        <option value="select">Selecao</option>
                        <option value="textarea">Texto longo</option>
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Ordem</label>
                      <input type="number" value={fieldForm.display_order} onChange={e => setFieldForm({ ...fieldForm, display_order: Number(e.target.value) || 0 })} className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Referencia Excel</label>
                    <input type="text" value={fieldForm.excel_cell_ref} onChange={e => setFieldForm({ ...fieldForm, excel_cell_ref: e.target.value })} placeholder="Ex: Dados!F2" className="input-field" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4b5563', cursor: 'pointer' }}>
                      <input type="checkbox" checked={fieldForm.is_required} onChange={e => setFieldForm({ ...fieldForm, is_required: e.target.checked })} />
                      Obrigatorio
                    </label>
                    <div style={{ flex: 1 }} />
                    <button type="button" onClick={() => setFieldForm(null)} style={{ padding: '6px 12px', fontSize: '12px', color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" className="btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }}>Adicionar</button>
                  </div>
                </form>
              )}

              {sortedFields.map(field => {
                const isEditing = editingFieldId === field.id
                const activeForm = isEditing ? editingFieldForm : field
                return (
                  <div key={field.id} style={{ padding: '14px 24px', borderBottom: '1px solid #f9fafb', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{field.label}</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af' }}>{field.field_key} · {field.field_type} · ordem {field.display_order}{field.is_required ? ' · obrigatorio' : ''}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!isEditing ? (
                          <button onClick={() => startEditField(field)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                            <Pencil style={{ width: '14px', height: '14px' }} />
                          </button>
                        ) : (
                          <>
                            <button onClick={() => saveField(field.id)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#0f766e' }}>
                              <Save style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button onClick={() => { setEditingFieldId(null); setEditingFieldForm(null) }} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                              <X style={{ width: '14px', height: '14px' }} />
                            </button>
                          </>
                        )}
                        <button onClick={() => deleteField(field.id)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr 0.8fr 1.4fr', gap: '10px' }}>
                        <div>
                          <label style={fieldLabelStyle}>Chave</label>
                          <input className="input-field" value={activeForm.field_key} onChange={e => setEditingFieldForm(prev => ({ ...prev, field_key: e.target.value }))} />
                        </div>
                        <div>
                          <label style={fieldLabelStyle}>Titulo visivel</label>
                          <input className="input-field" value={activeForm.label} onChange={e => setEditingFieldForm(prev => ({ ...prev, label: e.target.value }))} />
                        </div>
                        <div>
                          <label style={fieldLabelStyle}>Tipo</label>
                          <select className="input-field" value={activeForm.field_type} onChange={e => setEditingFieldForm(prev => ({ ...prev, field_type: e.target.value }))}>
                            <option value="text">Texto</option>
                            <option value="number">Numero</option>
                            <option value="date">Data</option>
                            <option value="select">Selecao</option>
                            <option value="textarea">Texto longo</option>
                          </select>
                        </div>
                        <div>
                          <label style={fieldLabelStyle}>Ordem</label>
                          <input className="input-field" type="number" value={activeForm.display_order} onChange={e => setEditingFieldForm(prev => ({ ...prev, display_order: Number(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <label style={fieldLabelStyle}>Referencia Excel</label>
                          <input className="input-field" value={activeForm.excel_cell_ref || ''} onChange={e => setEditingFieldForm(prev => ({ ...prev, excel_cell_ref: e.target.value }))} placeholder="Dados!F2" />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', background: '#e8eef8', color: '#002868', padding: '2px 8px', borderRadius: '4px' }}>{field.excel_cell_ref || '—'}</span>
                      </div>
                    )}
                  </div>
                )
              })}

              {sortedFields.length === 0 && <p style={{ padding: '32px 24px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>Nenhum campo definido</p>}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <Settings style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>Selecione um template para ver os detalhes</p>
          </div>
        )}
      </div>

      {showDeleteModal && selected && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '24px',
        }}>
          <div className="animate-fade-in" style={{
            width: '100%',
            maxWidth: '460px',
            background: '#ffffff',
            borderRadius: '18px',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(180deg, #fff7f7 0%, #ffffff 100%)',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#be123c', textTransform: 'uppercase' }}>
                Confirmar exclusao
              </p>
              <h3 style={{ marginTop: '8px', fontSize: '20px', fontWeight: 600, color: '#111827' }}>
                Excluir template?
              </h3>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#475569' }}>
                Voce esta prestes a excluir o template <strong style={{ color: '#111827' }}>{selected.name}</strong>.
                Essa acao remove o cadastro e os campos configurados para ele.
              </p>

              <div style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                fontSize: '13px',
                color: '#9a3412',
              }}>
                Se existirem certificados dependentes desse template, vale conferir antes de prosseguir.
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '0 24px 24px',
            }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={removeTemplate}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #ef4444',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
                Excluir agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
