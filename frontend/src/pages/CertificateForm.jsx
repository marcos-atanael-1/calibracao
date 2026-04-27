import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import api from '../api/client'

const normalizeSettingToken = (value) => (
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
)

const buildFormOptions = (settingsList) => {
  const normalizedSettings = (settingsList || []).map((setting) => ({
    ...setting,
    _tokens: [
      normalizeSettingToken(setting.key),
      normalizeSettingToken(setting.label),
    ].filter(Boolean),
  }))

  const resolve = (...aliases) => {
    const aliasTokens = aliases.map(normalizeSettingToken).filter(Boolean)

    const matches = normalizedSettings.filter((setting) =>
      setting._tokens.some((token) => aliasTokens.includes(token))
    )

    if (matches.length === 0) return []

    matches.sort((a, b) => {
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime()
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime()
      return bDate - aDate
    })

    const bestMatch = matches.find((setting) => (setting.values || []).length > 0) || matches[0]
    return bestMatch.values || []
  }

  return {
    calibration_types: resolve('calibration_types', 'tipos_de_calibracao', 'tipo_da_calibracao'),
    indication_types: resolve('indication_types', 'tipos_de_indicacao', 'tipo_de_indicacao'),
    materials: resolve('materials', 'materiais', 'material'),
    scopes: resolve('scopes', 'escopos', 'escopo'),
    methods: resolve('methods', 'metodos', 'metodo'),
    temperature_standards: resolve('temperature_standards', 'padroes_de_temperatura', 'padrao_de_temperatura'),
    humidity_standards: resolve('humidity_standards', 'padroes_de_umidade', 'padrao_de_umidade'),
    pressure_standards: resolve('pressure_standards', 'padroes_de_pressao', 'padrao_de_pressao'),
    companies: resolve('companies', 'empresas', 'empresa'),
    instruments: resolve('instruments', 'instrumentos', 'instrumento'),
    technicians: resolve('technicians', 'tecnicos', 'tecnico'),
    balances: resolve('balances', 'balancas', 'balanca_utilizada', 'balanca'),
    thermometers: resolve('thermometers', 'termometros', 'termometro'),
    point_scopes: resolve('point_scopes', 'escopos_do_ponto', 'escopo_do_ponto'),
    apparent_mass_units: resolve('apparent_mass_units', 'unidades_massa_aparente', 'massa_aparente_unidade'),
  }
}

const defaultPointScopes = ['Dispensadores', 'Microvolume', 'Picnometro', 'Seringa', 'Titulador', 'Vidraria de Laboratorio']
const defaultApparentMassUnits = ['ug', 'mg', 'g', 'kg']

function createEmptyPoint(pointNumber) {
  return {
    point_number: pointNumber,
    valor_nominal: '',
    menor_divisao: '',
    padrao_utilizado: '',
    balanca_utilizada: '',
    termometro: '',
    escopo: '',
    massa_aparente_unidade: 'kg',
    observacao: '',
    massas: Array.from({ length: 10 }, (_, index) => ({
      medicao: index + 1,
      massa_aparente: '',
      temperatura_fluido: '',
    })),
  }
}

function createEmptyChannel(channelNumber, pointsPerChannel) {
  const totalPoints = Math.max(1, Number.parseInt(pointsPerChannel, 10) || 1)
  return {
    channel_number: channelNumber,
    identificacao_canal: '',
    observacao: '',
    points: Array.from({ length: totalPoints }, (_, index) => createEmptyPoint(index + 1)),
  }
}

export default function CertificateForm() {
  const nav = useNavigate()
  const [templates, setTemplates] = useState([])
  const [saving, setSaving] = useState(false)
  const [options, setOptions] = useState({})
  const [activeChannelTab, setActiveChannelTab] = useState(0)

  const [form, setForm] = useState({
    template_id: '',
    certificate_number: '',
    empresa: '',
    tipo_calibracao: '',
    numero_orcamento: '',
    contratante: '',
    endereco: '',
    interessado: '',
    endereco_interessado: '',
    instrumento: '',
    fabricante: '',
    modelo: '',
    identificacao: '',
    numero_serie: '',
    tipo_indicacao: '',
    material: '',
    escopo: '',
    faixa_medicao: '',
    menor_divisao: '',
    metodo: '',
    qtd_canais: '1',
    pontos_por_canal: '1',
    data_calibracao: '',
    data_emissao: '',
    proxima_calibracao: '',
    tecnico: '',
    padrao_temperatura: '',
    temperatura_inicial: '',
    temperatura_final: '',
    padrao_umidade: '',
    umidade_inicial: '',
    umidade_final: '',
    padrao_pressao: '',
    pressao_inicial: '',
    pressao_final: '',
    observacoes: '',
  })

  const [channels, setChannels] = useState([createEmptyChannel(1, 1)])

  useEffect(() => {
    api.get('/templates').then((r) => setTemplates(r.data.data || [])).catch(() => {})
    api.get('/settings').then((r) => {
      setOptions(buildFormOptions(r.data.data || []))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const channelCount = Math.max(1, Number.parseInt(form.qtd_canais, 10) || 1)
    const pointsPerChannel = Math.max(1, Number.parseInt(form.pontos_por_canal, 10) || 1)

    setChannels((prev) => {
      const nextChannels = Array.from({ length: channelCount }, (_, channelIndex) => {
        const existingChannel = prev[channelIndex]
        const baseChannel = existingChannel || createEmptyChannel(channelIndex + 1, pointsPerChannel)
        const existingPoints = baseChannel.points || []

        const nextPoints = Array.from({ length: pointsPerChannel }, (_, pointIndex) => {
          const existingPoint = existingPoints[pointIndex]
          if (existingPoint) {
            return {
              ...existingPoint,
              point_number: pointIndex + 1,
              massas: Array.from({ length: 10 }, (_, massIndex) => ({
                medicao: massIndex + 1,
                massa_aparente: existingPoint.massas?.[massIndex]?.massa_aparente || '',
                temperatura_fluido: existingPoint.massas?.[massIndex]?.temperatura_fluido || '',
              })),
            }
          }
          return createEmptyPoint(pointIndex + 1)
        })

        return {
          ...baseChannel,
          channel_number: channelIndex + 1,
          points: nextPoints,
        }
      })

      return nextChannels
    })

    setActiveChannelTab((prev) => Math.min(prev, channelCount - 1))
  }, [form.qtd_canais, form.pontos_por_canal])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const updateChannel = (channelIdx, key, value) => {
    setChannels((prev) => prev.map((channel, index) => (
      index === channelIdx ? { ...channel, [key]: value } : channel
    )))
  }

  const updatePoint = (channelIdx, pointIdx, key, value) => {
    setChannels((prev) => prev.map((channel, index) => {
      if (index !== channelIdx) return channel
      return {
        ...channel,
        points: channel.points.map((point, pointIndex) => (
          pointIndex === pointIdx ? { ...point, [key]: value } : point
        )),
      }
    }))
  }

  const updateMassa = (channelIdx, pointIdx, massaIdx, key, value) => {
    setChannels((prev) => prev.map((channel, index) => {
      if (index !== channelIdx) return channel
      return {
        ...channel,
        points: channel.points.map((point, pointIndex) => {
          if (pointIndex !== pointIdx) return point
          return {
            ...point,
            massas: point.massas.map((massa, massIndex) => (
              massIndex === massaIdx ? { ...massa, [key]: value } : massa
            )),
          }
        }),
      }
    }))
  }

  const flattenedPoints = useMemo(
    () => channels.flatMap((channel) => channel.points.map((point) => ({
      ...point,
      channel_number: channel.channel_number,
      identificacao_canal: channel.identificacao_canal,
      channel_observacao: channel.observacao,
    }))),
    [channels]
  )

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { template_id, certificate_number, ...extra } = form
      await api.post('/certificates', {
        template_id,
        certificate_number,
        instrument_tag: form.identificacao,
        instrument_description: form.instrumento,
        manufacturer: form.fabricante,
        model: form.modelo,
        serial_number: form.numero_serie,
        range_min: form.faixa_medicao,
        range_max: '',
        unit: '',
        calibration_date: form.data_calibracao || null,
        extra_fields: {
          ...extra,
          canais_calibracao: channels,
          pontos_calibracao: flattenedPoints,
        },
        points: [],
      })
      nav('/certificates')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }
  const sectionTitle = (title) => (
    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {title}
    </h3>
  )

  const renderSelect = (label, field, optKey, required = false) => (
    <div>
      <label style={labelStyle}>{label} {required && '*'}</label>
      <select value={form[field]} onChange={(e) => set(field, e.target.value)} required={required} className="input-field">
        <option value="">Selecione...</option>
        {(options[optKey] || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )

  const renderInput = (label, field, type = 'text', required = false, placeholder = '') => (
    <div>
      <label style={labelStyle}>{label} {required && '*'}</label>
      <input type={type} value={form[field]} onChange={(e) => set(field, e.target.value)} required={required} className="input-field" placeholder={placeholder} />
    </div>
  )

  const renderSmartField = (label, field, optKey, type = 'text', required = false, placeholder = '') => {
    if ((options[optKey] || []).length > 0) {
      return renderSelect(label, field, optKey, required)
    }
    return renderInput(label, field, type, required, placeholder)
  }

  const pointScopes = (options.point_scopes || []).length > 0 ? options.point_scopes : defaultPointScopes
  const apparentMassUnits = (options.apparent_mass_units || []).length > 0 ? options.apparent_mass_units : defaultApparentMassUnits
  const activeChannel = channels[activeChannelTab]

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <button onClick={() => nav('/certificates')} style={{
        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
        color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer',
      }}>
        <ArrowLeft style={{ width: '16px', height: '16px' }} /> Voltar
      </button>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Template')}
          <select value={form.template_id} onChange={(e) => set('template_id', e.target.value)} required className="input-field">
            <option value="">Selecione um template...</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Dados do Certificado')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {renderInput('Nº do Certificado', 'certificate_number', 'text', true, 'CAL-2026-001')}
            {renderSmartField('Empresa', 'empresa', 'companies')}
            {renderSelect('Tipo da Calibracao', 'tipo_calibracao', 'calibration_types')}
            {renderInput('Nº do Orcamento', 'numero_orcamento')}
            {renderInput('Contratante', 'contratante')}
            {renderInput('Endereco', 'endereco')}
            {renderInput('Interessado', 'interessado')}
            {renderInput('Endereco (Interessado)', 'endereco_interessado')}
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Instrumento')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {renderSmartField('Instrumento', 'instrumento', 'instruments')}
            {renderInput('Fabricante', 'fabricante')}
            {renderInput('Modelo', 'modelo')}
            {renderInput('Identificacao', 'identificacao')}
            {renderInput('Numero de Serie', 'numero_serie')}
            {renderSelect('Tipo de Indicacao', 'tipo_indicacao', 'indication_types')}
            {renderSelect('Material', 'material', 'materials')}
            {renderSelect('Escopo', 'escopo', 'scopes')}
            {renderInput('Faixa de Medicao', 'faixa_medicao')}
            {renderInput('Menor Divisao', 'menor_divisao')}
            {renderSelect('Metodo', 'metodo', 'methods')}
            {renderInput('Qtd Canais/Seringas', 'qtd_canais', 'number')}
            <div>
              <label style={labelStyle}>Pontos por Canal *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.pontos_por_canal}
                onChange={(e) => set('pontos_por_canal', e.target.value)}
                className="input-field"
                placeholder="Ex: 3"
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Datas')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {renderInput('Data da Calibracao', 'data_calibracao', 'date')}
            {renderInput('Data de Emissao', 'data_emissao', 'date')}
            {renderInput('Proxima Calibracao', 'proxima_calibracao', 'date')}
            {renderSelect('Tecnico', 'tecnico', 'technicians')}
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Condicoes Ambientais')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {renderSelect('Padrao de Temperatura', 'padrao_temperatura', 'temperature_standards')}
            {renderInput('Temperatura Inicial', 'temperatura_inicial', 'number')}
            {renderInput('Temperatura Final', 'temperatura_final', 'number')}
            {renderSelect('Padrao de Umidade', 'padrao_umidade', 'humidity_standards')}
            {renderInput('Umidade Inicial', 'umidade_inicial', 'number')}
            {renderInput('Umidade Final', 'umidade_final', 'number')}
            {renderSelect('Padrao de Pressao', 'padrao_pressao', 'pressure_standards')}
            {renderInput('Pressao Inicial', 'pressao_inicial', 'number')}
            {renderInput('Pressao Final', 'pressao_final', 'number')}
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle(`Canais e Pontos (${channels.length} canal(is) x ${Math.max(1, Number.parseInt(form.pontos_por_canal, 10) || 1)} ponto(s))`)}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            {channels.map((channel, index) => (
              <button
                key={channel.channel_number}
                type="button"
                onClick={() => setActiveChannelTab(index)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '999px',
                  border: activeChannelTab === index ? '1px solid #002868' : '1px solid #dbe2ea',
                  background: activeChannelTab === index ? '#e8eef8' : '#ffffff',
                  color: activeChannelTab === index ? '#002868' : '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Canal {channel.channel_number}
              </button>
            ))}
          </div>

          {activeChannel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '14px' }}>
                  Dados do Canal {activeChannel.channel_number}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Identificacao do Canal/Seringa</label>
                    <input
                      type="text"
                      value={activeChannel.identificacao_canal}
                      onChange={(e) => updateChannel(activeChannelTab, 'identificacao_canal', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Observacao do Canal</label>
                    <input
                      type="text"
                      value={activeChannel.observacao}
                      onChange={(e) => updateChannel(activeChannelTab, 'observacao', e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {activeChannel.points.map((point, pointIdx) => (
                <div key={`${activeChannel.channel_number}-${point.point_number}`} style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#002868', marginBottom: '16px' }}>
                    Ponto {point.point_number}
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Valor Nominal</label>
                      <input type="number" step="any" value={point.valor_nominal} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'valor_nominal', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Menor Divisao</label>
                      <input type="text" value={point.menor_divisao} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'menor_divisao', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Padrao Utilizado</label>
                      <input type="text" value={point.padrao_utilizado} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'padrao_utilizado', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Observacao do Ponto</label>
                      <input type="text" value={point.observacao} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'observacao', e.target.value)} className="input-field" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Balanca utilizada</label>
                      {(options.balances || []).length > 0 ? (
                        <select value={point.balanca_utilizada} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'balanca_utilizada', e.target.value)} className="input-field">
                          <option value="">Selecione...</option>
                          {(options.balances || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={point.balanca_utilizada} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'balanca_utilizada', e.target.value)} className="input-field" />
                      )}
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Termometro</label>
                      {(options.thermometers || []).length > 0 ? (
                        <select value={point.termometro} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'termometro', e.target.value)} className="input-field">
                          <option value="">Selecione...</option>
                          {(options.thermometers || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={point.termometro} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'termometro', e.target.value)} className="input-field" />
                      )}
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Escopo</label>
                      <select value={point.escopo} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'escopo', e.target.value)} className="input-field">
                        <option value="">Selecione...</option>
                        {pointScopes.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px' }}>Tipo da Massa aparente</label>
                      <select value={point.massa_aparente_unidade} onChange={(e) => updatePoint(activeChannelTab, pointIdx, 'massa_aparente_unidade', e.target.value)} className="input-field">
                        {apparentMassUnits.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>Resultados do Ponto</label>
                    <div style={{ border: '1px solid #dbe2ea', borderRadius: '12px', overflow: 'hidden', background: '#ffffff' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '72px 1fr 1fr',
                        gap: '0',
                        background: '#eef3f8',
                        borderBottom: '1px solid #dbe2ea',
                      }}>
                        <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>Medicao</div>
                        <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          Massa aparente ({point.massa_aparente_unidade || 'kg'})
                        </div>
                        <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>Temperatura do fluido</div>
                      </div>

                      {point.massas.map((massa, massIdx) => (
                        <div
                          key={massa.medicao}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '72px 1fr 1fr',
                            gap: '0',
                            borderBottom: massIdx === point.massas.length - 1 ? 'none' : '1px solid #eef2f7',
                          }}
                        >
                          <div style={{
                            padding: '10px 12px',
                            fontSize: '12px',
                            color: '#64748b',
                            background: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                          }}>
                            {massa.medicao}º
                          </div>
                          <div style={{ padding: '8px' }}>
                            <input
                              type="number"
                              step="any"
                              value={massa.massa_aparente}
                              onChange={(e) => updateMassa(activeChannelTab, pointIdx, massIdx, 'massa_aparente', e.target.value)}
                              className="input-field"
                              placeholder="Ex: 0,1"
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div style={{ padding: '8px' }}>
                            <input
                              type="number"
                              step="any"
                              value={massa.temperatura_fluido}
                              onChange={(e) => updateMassa(activeChannelTab, pointIdx, massIdx, 'temperatura_fluido', e.target.value)}
                              className="input-field"
                              placeholder="Ex: 20"
                              style={{ margin: 0 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Observacoes')}
          <textarea
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            className="input-field"
            placeholder="Observacoes gerais sobre a calibracao..."
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save style={{ width: '16px', height: '16px' }} /> {saving ? 'Salvando...' : 'Salvar Certificado'}
          </button>
        </div>
      </form>
    </div>
  )
}
