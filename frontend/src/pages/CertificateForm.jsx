import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import api from '../api/client'
import useIsMobile from '../hooks/useIsMobile'

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
    measurement_units: resolve('measurement_units', 'unidades_de_medicao', 'unidade_de_medicao'),
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
const defaultMeasurementUnits = ['L', 'dL', 'cL', 'mL', 'µL', 'dm³', 'cm³', 'mm³']
const measurementModes = [
  { value: 'ponto_fixo', label: 'Ponto Fixo' },
  { value: 'multipontos', label: 'Multipontos' },
  { value: 'faixa_variavel', label: 'Faixa Variavel' },
]

function createEmptyPoint(pointNumber) {
  return {
    point_number: pointNumber,
    valor_nominal: '',
    menor_divisao: '',
    padrao_utilizado: '',
    balanca_utilizada: '',
    termometro: '',
    escopo: '',
    massa_aparente_unidade: 'g',
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

function findOption(optionsList, preferredValue, fallbackValue = '') {
  if (!Array.isArray(optionsList) || optionsList.length === 0) {
    return preferredValue || fallbackValue
  }

  const directMatch = optionsList.find((item) => item === preferredValue)
  if (directMatch) return directMatch

  const normalizedPreferred = normalizeSettingToken(preferredValue)
  const normalizedMatch = optionsList.find((item) => normalizeSettingToken(item) === normalizedPreferred)
  if (normalizedMatch) return normalizedMatch

  return fallbackValue && optionsList.includes(fallbackValue) ? fallbackValue : (preferredValue || optionsList[0] || '')
}

function generateExampleCertificateNumber() {
  const now = new Date()
  const stamp = `${now.getMonth() + 1}`.padStart(2, '0') + `${now.getDate()}`.padStart(2, '0')
  const randomBlock = Math.floor(1000 + Math.random() * 9000)
  return `${stamp}${randomBlock}`
}

function normalizeMeasurementUnitValue(value) {
  const raw = (value || '').toString().trim()
  if (!raw) return ''

  const normalizedToken = normalizeSettingToken(raw)
  const aliases = {
    ul: 'µL',
    l: 'L',
    dl: 'dL',
    cl: 'cL',
    ml: 'mL',
    dm3: 'dm³',
    cm3: 'cm³',
    mm3: 'mm³',
  }

  return aliases[normalizedToken] || raw
}

function normalizeMeasurementUnitValueSafe(value) {
  const raw = (value || '').toString().trim()
  if (!raw) return ''

  const normalizedToken = raw
    .toLowerCase()
    .replace(/[ÂâÃ¢Ã‚]/g, '')
    .replace(/\u00B5/g, 'u')
    .replace(/\u03BC/g, 'u')
    .replace(/\u00B3/g, '3')
    .replace(/\s+/g, '')

  const aliases = {
    ul: '\u00B5L',
    l: 'L',
    dl: 'dL',
    cl: 'cL',
    ml: 'mL',
    dm3: 'dm\u00B3',
    cm3: 'cm\u00B3',
    mm3: 'mm\u00B3',
  }

  return aliases[normalizedToken] || raw
}

export default function CertificateForm() {
  const isMobile = useIsMobile()
  const nav = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [instrumentTypes, setInstrumentTypes] = useState([])
  const [savingMode, setSavingMode] = useState('')
  const [loadingDraft, setLoadingDraft] = useState(isEditing)
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
    tipo_faixa: 'multipontos',
    capacidade: '',
    faixa_inicial: '',
    faixa_final: '',
    capacidade_maxima: '',
    unidade_medicao: '\u00B5L',
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
    Promise.all([
      api.get('/settings'),
      api.get('/instrument-types?active_only=false'),
    ]).then(([settingsResponse, instrumentTypesResponse]) => {
      setOptions(buildFormOptions(settingsResponse.data.data || []))
      setInstrumentTypes(instrumentTypesResponse.data.data || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) {
      setLoadingDraft(false)
      return
    }

    api.get(`/certificates/${id}`).then((response) => {
      const certificate = response.data.data
      const extra = certificate.extra_fields || {}

      setForm((prev) => ({
        ...prev,
        template_id: certificate.template_id || '',
        certificate_number: certificate.certificate_number || '',
        empresa: extra.empresa || '',
        tipo_calibracao: extra.tipo_calibracao || '',
        numero_orcamento: extra.numero_orcamento || '',
        contratante: extra.contratante || '',
        endereco: extra.endereco || '',
        interessado: extra.interessado || '',
        endereco_interessado: extra.endereco_interessado || '',
        instrumento: extra.instrumento || certificate.instrument_description || '',
        fabricante: certificate.manufacturer || '',
        modelo: certificate.model || '',
        identificacao: extra.identificacao || certificate.instrument_tag || '',
        numero_serie: certificate.serial_number || '',
        tipo_indicacao: extra.tipo_indicacao || '',
        material: extra.material || '',
        escopo: extra.escopo || '',
        tipo_faixa: extra.tipo_faixa || 'multipontos',
        capacidade: extra.capacidade || '',
        faixa_inicial: extra.faixa_inicial || '',
        faixa_final: extra.faixa_final || '',
        capacidade_maxima: extra.capacidade_maxima || '',
        unidade_medicao: normalizeMeasurementUnitValueSafe(extra.unidade_medicao || certificate.unit || '\u00B5L'),
        menor_divisao: extra.menor_divisao || '',
        metodo: extra.metodo || '',
        qtd_canais: extra.qtd_canais || '1',
        pontos_por_canal: extra.pontos_por_canal || '1',
        data_calibracao: extra.data_calibracao || (certificate.calibration_date ? String(certificate.calibration_date).slice(0, 10) : ''),
        data_emissao: extra.data_emissao || '',
        proxima_calibracao: extra.proxima_calibracao || '',
        tecnico: extra.tecnico || '',
        padrao_temperatura: extra.padrao_temperatura || '',
        temperatura_inicial: extra.temperatura_inicial || '',
        temperatura_final: extra.temperatura_final || '',
        padrao_umidade: extra.padrao_umidade || '',
        umidade_inicial: extra.umidade_inicial || '',
        umidade_final: extra.umidade_final || '',
        padrao_pressao: extra.padrao_pressao || '',
        pressao_inicial: extra.pressao_inicial || '',
        pressao_final: extra.pressao_final || '',
        observacoes: extra.observacoes || '',
      }))

      if (Array.isArray(extra.canais_calibracao) && extra.canais_calibracao.length > 0) {
        setChannels(extra.canais_calibracao)
      }
      setActiveChannelTab(0)
    }).catch((err) => {
      alert(err.response?.data?.detail || 'Erro ao carregar rascunho')
      nav('/certificates')
    }).finally(() => {
      setLoadingDraft(false)
    })
  }, [id, nav])

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

  useEffect(() => {
    const normalizedInstrument = normalizeSettingToken(form.instrumento)
    if (!normalizedInstrument) return

    const matchedInstrumentType = instrumentTypes.find((item) =>
      normalizeSettingToken(item.name) === normalizedInstrument
    )

    if (!matchedInstrumentType?.template_id) return
    if (form.template_id === matchedInstrumentType.template_id) return

    setForm((prev) => ({ ...prev, template_id: matchedInstrumentType.template_id }))
  }, [form.instrumento, form.template_id, instrumentTypes])

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

  const measurementUnits = (options.measurement_units || []).length > 0
    ? options.measurement_units.map(normalizeMeasurementUnitValueSafe)
    : defaultMeasurementUnits.map(normalizeMeasurementUnitValueSafe)
  const selectableInstrumentTypes = useMemo(
    () => instrumentTypes.filter((item) => item.is_active && item.template_id),
    [instrumentTypes]
  )
  const instrumentOptions = useMemo(() => {
    const names = selectableInstrumentTypes.map((item) => item.name)
    if (form.instrumento && !names.some((item) => normalizeSettingToken(item) === normalizeSettingToken(form.instrumento))) {
      names.unshift(form.instrumento)
    }
    return names
  }, [form.instrumento, selectableInstrumentTypes])
  const selectedInstrumentType = useMemo(
    () => instrumentTypes.find((item) => normalizeSettingToken(item.name) === normalizeSettingToken(form.instrumento)),
    [form.instrumento, instrumentTypes]
  )

  const selectedMeasurementMode = form.tipo_faixa || 'multipontos'

  const buildCertificatePayload = () => {
    let rangeMin = ''
    let rangeMax = ''
    let unit = normalizeMeasurementUnitValueSafe(form.unidade_medicao || '')

    if (selectedMeasurementMode === 'ponto_fixo') {
      rangeMin = form.capacidade || ''
    } else if (selectedMeasurementMode === 'multipontos') {
      rangeMin = form.faixa_inicial || ''
      rangeMax = form.faixa_final || ''
    } else if (selectedMeasurementMode === 'faixa_variavel') {
      rangeMax = form.capacidade_maxima || ''
    }

    return {
      rangeMin,
      rangeMax,
      unit,
    }
  }

  const submit = async (e, enqueueForProcessing = true) => {
    if (e?.preventDefault) e.preventDefault()
    setSavingMode(enqueueForProcessing ? 'final' : 'draft')
    try {
      const { template_id, certificate_number, ...extra } = form
      const { rangeMin, rangeMax, unit } = buildCertificatePayload()
      const payload = {
        template_id,
        certificate_number,
        instrument_tag: form.identificacao,
        instrument_description: form.instrumento,
        manufacturer: form.fabricante,
        model: form.modelo,
        serial_number: form.numero_serie,
        range_min: rangeMin,
        range_max: rangeMax,
        unit,
        calibration_date: form.data_calibracao || null,
        extra_fields: {
          ...extra,
          canais_calibracao: channels,
          pontos_calibracao: flattenedPoints,
        },
        points: [],
        enqueue_for_processing: enqueueForProcessing,
      }

      if (isEditing) {
        await api.put(`/certificates/${id}`, payload)
      } else {
        await api.post('/certificates', payload)
      }

      nav('/certificates')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar')
    } finally {
      setSavingMode('')
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

  const renderInstrumentField = () => {
    if (instrumentOptions.length > 0) {
      return (
        <div>
          <label style={labelStyle}>Instrumento</label>
          <select value={form.instrumento} onChange={(e) => set('instrumento', e.target.value)} className="input-field">
            <option value="">Selecione...</option>
            {instrumentOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {selectedInstrumentType?.template_id && (
            <p style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
              Template vinculado automaticamente ao instrumento selecionado.
            </p>
          )}
        </div>
      )
    }

    return renderInput('Instrumento', 'instrumento')
  }

  const pointScopes = (options.point_scopes || []).length > 0 ? options.point_scopes : defaultPointScopes
  const apparentMassUnits = (options.apparent_mass_units || []).length > 0 ? options.apparent_mass_units : defaultApparentMassUnits
  const activeChannel = channels[activeChannelTab]

  const fillExampleData = () => {
    const micropipeta = selectableInstrumentTypes.find((instrumentType) =>
      normalizeSettingToken(instrumentType.name).includes('micropipeta_de_volume_fixo')
    )

    setForm((prev) => ({
      ...prev,
      certificate_number: generateExampleCertificateNumber(),
      empresa: findOption(options.companies, 'Elus', 'Elus'),
      tipo_calibracao: findOption(options.calibration_types, 'Acreditado Interno', 'Acreditado Interno'),
      numero_orcamento: '12345',
      contratante: 'Testando',
      endereco: 'Rua do Teste',
      interessado: 'Teste interessado',
      endereco_interessado: 'Rua do interessado',
      instrumento: micropipeta?.name || 'Micropipeta de Volume Fixo',
      fabricante: 'teste',
      modelo: 'teste',
      identificacao: 'teste',
      numero_serie: 'teste',
      tipo_indicacao: findOption(options.indication_types, 'Digital', 'Digital'),
      material: findOption(options.materials, 'Bronze', 'Bronze'),
      escopo: findOption(options.scopes, 'Microvolume', 'Microvolume'),
      tipo_faixa: 'multipontos',
      capacidade: '',
      faixa_inicial: '0',
      faixa_final: '100',
      capacidade_maxima: '',
      unidade_medicao: '\u00B5L',
      menor_divisao: '0,1',
      metodo: findOption(options.methods, 'Normal', 'Normal'),
      qtd_canais: '1',
      pontos_por_canal: '3',
      data_calibracao: '2026-04-27',
      data_emissao: '2026-04-27',
      proxima_calibracao: '2026-04-30',
      tecnico: findOption(options.technicians, 'Carlos Augusto Benevides'),
      padrao_temperatura: findOption(options.temperature_standards, 'E.TH.LQ-001 (OUT)', 'E.TH.LQ-001 (OUT)'),
      temperatura_inicial: '21',
      temperatura_final: '21',
      padrao_umidade: findOption(options.humidity_standards, 'E.TH.LQ-001', 'E.TH.LQ-001'),
      umidade_inicial: '51',
      umidade_final: '56',
      padrao_pressao: findOption(options.pressure_standards, 'E.TH.LQ-001', 'E.TH.LQ-001'),
      pressao_inicial: '930',
      pressao_final: '930',
      observacoes: '',
    }))

    const makeMassRows = (value) => {
      const rows = Array.from({ length: 10 }, (_, index) => ({
        medicao: index + 1,
        massa_aparente: value,
        temperatura_fluido: '20',
      }))
      return rows
    }

    makeMassRows('0.01')[6].massa_aparente = '-0.99'

    setChannels([
      {
        channel_number: 1,
        identificacao_canal: 'teste',
        observacao: '',
        points: [
          {
            point_number: 1,
            valor_nominal: '10',
            menor_divisao: '0,1',
            padrao_utilizado: '',
            balanca_utilizada: findOption(options.balances, 'E.MS.LQ-005', 'E.MS.LQ-005'),
            termometro: findOption(options.thermometers, 'E.TH.LQ-009', 'E.TH.LQ-009'),
            escopo: findOption(pointScopes, 'Microvolume', 'Microvolume'),
            massa_aparente_unidade: findOption(apparentMassUnits, 'g', 'g'),
            massas: makeMassRows('0.01'),
          },
          {
            point_number: 2,
            valor_nominal: '50',
            menor_divisao: '0,1',
            padrao_utilizado: '',
            balanca_utilizada: findOption(options.balances, 'E.MS.LQ-005', 'E.MS.LQ-005'),
            termometro: findOption(options.thermometers, 'E.TH.LQ-009', 'E.TH.LQ-009'),
            escopo: findOption(pointScopes, 'Microvolume', 'Microvolume'),
            massa_aparente_unidade: findOption(apparentMassUnits, 'g', 'g'),
            massas: makeMassRows('0.05'),
          },
          {
            point_number: 3,
            valor_nominal: '100',
            menor_divisao: '0,1',
            padrao_utilizado: '',
            balanca_utilizada: findOption(options.balances, 'E.MS.LQ-005', 'E.MS.LQ-005'),
            termometro: findOption(options.thermometers, 'E.TH.LQ-009', 'E.TH.LQ-009'),
            escopo: findOption(pointScopes, 'Microvolume', 'Microvolume'),
            massa_aparente_unidade: findOption(apparentMassUnits, 'g', 'g'),
            massas: makeMassRows('0.1'),
          },
        ],
      },
    ])
    setActiveChannelTab(0)
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <button onClick={() => nav('/certificates')} style={{
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
          color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer',
        }}>
          <ArrowLeft style={{ width: '16px', height: '16px' }} /> Voltar
        </button>

        <button
          type="button"
          onClick={fillExampleData}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Preencher Exemplo POC
        </button>
      </div>

      {loadingDraft ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
          Carregando rascunho...
        </div>
      ) : (
      <form onSubmit={(e) => submit(e, true)} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Dados do Certificado')}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            {renderInput('Nº do Certificado', 'certificate_number', 'text', true, '05041234')}
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            {renderInstrumentField()}
            {renderInput('Fabricante', 'fabricante')}
            {renderInput('Modelo', 'modelo')}
            {renderInput('Identificacao', 'identificacao')}
            {renderInput('Numero de Serie', 'numero_serie')}
            {renderSelect('Tipo de Indicacao', 'tipo_indicacao', 'indication_types')}
            {renderSelect('Material', 'material', 'materials')}
            {renderSelect('Escopo', 'escopo', 'scopes')}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tipo</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {measurementModes.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => set('tipo_faixa', mode.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '999px',
                      border: form.tipo_faixa === mode.value ? '1px solid #002868' : '1px solid #dbe2ea',
                      background: form.tipo_faixa === mode.value ? '#e8eef8' : '#ffffff',
                      color: form.tipo_faixa === mode.value ? '#002868' : '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedMeasurementMode === 'ponto_fixo' && (
              <>
                {renderInput('Capacidade', 'capacidade')}
                <div>
                  <label style={labelStyle}>Unidade</label>
                  <select value={form.unidade_medicao} onChange={(e) => set('unidade_medicao', e.target.value)} className="input-field">
                    <option value="">Selecione...</option>
                    {measurementUnits.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                {renderInput('Menor Divisao', 'menor_divisao')}
              </>
            )}

            {selectedMeasurementMode === 'multipontos' && (
              <>
                {renderInput('Faixa Inicial', 'faixa_inicial')}
                {renderInput('Faixa Final', 'faixa_final')}
                <div>
                  <label style={labelStyle}>Unidade</label>
                  <select value={form.unidade_medicao} onChange={(e) => set('unidade_medicao', e.target.value)} className="input-field">
                    <option value="">Selecione...</option>
                    {measurementUnits.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                {renderInput('Menor Divisao', 'menor_divisao')}
              </>
            )}

            {selectedMeasurementMode === 'faixa_variavel' && (
              <>
                {renderInput('Capacidade Maxima', 'capacidade_maxima')}
                <div>
                  <label style={labelStyle}>Unidade</label>
                  <select value={form.unidade_medicao} onChange={(e) => set('unidade_medicao', e.target.value)} className="input-field">
                    <option value="">Selecione...</option>
                    {measurementUnits.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </>
            )}

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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            {renderInput('Data da Calibracao', 'data_calibracao', 'date')}
            {renderInput('Data de Emissao', 'data_emissao', 'date')}
            {renderInput('Proxima Calibracao', 'proxima_calibracao', 'date')}
            {renderSelect('Tecnico', 'tecnico', 'technicians')}
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {sectionTitle('Condicoes Ambientais')}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
                        gridTemplateColumns: isMobile ? '1fr' : '72px 1fr 1fr',
                        gap: '0',
                        background: '#eef3f8',
                        borderBottom: '1px solid #dbe2ea',
                      }}>
                        <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>Medicao</div>
                        <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          Massa aparente ({point.massa_aparente_unidade || 'g'})
                        </div>
                        <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>Temperatura do fluido</div>
                      </div>

                      {point.massas.map((massa, massIdx) => (
                        <div
                          key={massa.medicao}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '72px 1fr 1fr',
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={(e) => submit(e, false)}
            disabled={savingMode !== ''}
            style={{
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              cursor: savingMode !== '' ? 'not-allowed' : 'pointer',
              opacity: savingMode !== '' ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            <Save style={{ width: '16px', height: '16px' }} />
            {savingMode === 'draft' ? 'Salvando rascunho...' : 'Salvar rascunho'}
          </button>
          <button type="submit" disabled={savingMode !== ''} className="btn-primary" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', opacity: savingMode !== '' ? 0.7 : 1 }}>
            <Save style={{ width: '16px', height: '16px' }} /> {savingMode === 'final' ? 'Enviando ao Agente...' : (isEditing ? 'Salvar e enviar ao Agente' : 'Salvar e enviar ao Agente')}
          </button>
        </div>
      </form>
      )}
    </div>
  )
}
