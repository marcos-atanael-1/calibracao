import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, KeyRound, X, UserPlus } from 'lucide-react'
import api from '../api/client'

const roleLabels = {
  super_admin: { label: 'Super Admin', bg: '#e8eef8', color: '#002868' },
  admin: { label: 'Admin', bg: '#dbeafe', color: '#1d4ed8' },
  tecnico: { label: 'Técnico', bg: '#f3f4f6', color: '#4b5563' },
}

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}

const modalBox = {
  background: '#ffffff', borderRadius: '16px', padding: '28px',
  width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [resetUser, setResetUser] = useState(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('tecnico')
  const [resetPassword, setResetPassword] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    try { const { data } = await api.get('/users'); setUsers(data.data || []) }
    catch(e) {} finally { setLoading(false) }
  }

  const openCreate = () => {
    setFormName(''); setFormEmail(''); setFormPassword(''); setFormRole('tecnico')
    setShowCreate(true)
  }

  const openEdit = (u) => {
    setFormName(u.name); setFormEmail(u.email); setFormRole(u.role)
    setEditUser(u)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/users', { name: formName, email: formEmail, password: formPassword, role: formRole })
      setShowCreate(false); load()
    } catch(e) { alert(e.response?.data?.detail || 'Erro ao criar') }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/users/${editUser.id}`, { name: formName, email: formEmail, role: formRole })
      setEditUser(null); load()
    } catch(e) { alert(e.response?.data?.detail || 'Erro ao atualizar') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir este usuário?')) return
    try { await api.delete(`/users/${id}`); load() }
    catch(e) { alert(e.response?.data?.detail || 'Erro ao excluir') }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/users/${resetUser.id}/reset-password`, { new_password: resetPassword })
      setResetUser(null); setResetPassword('')
      alert('Senha redefinida! O usuário deverá trocar no próximo login.')
    } catch(e) { alert(e.response?.data?.detail || 'Erro') }
  }

  const handleToggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active })
      load()
    } catch(e) { alert('Erro ao alterar status') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>{users.length} usuário(s) cadastrado(s)</p>
        <button onClick={openCreate} className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
          <UserPlus style={{ width: '16px', height: '16px' }} /> Novo Usuário
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['NOME', 'E-MAIL', 'FUNÇÃO', 'STATUS', 'AÇÕES'].map(h => (
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
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>Carregando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>Nenhum usuário cadastrado</p>
              </td></tr>
            ) : users.map(u => {
              const r = roleLabels[u.role] || roleLabels.tecnico
              return (
                <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '14px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: '#e8eef8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 600, color: '#002868',
                      }}>
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{u.name}</p>
                        {u.must_change_password && (
                          <p style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>⚠ Deve trocar senha</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 24px', fontSize: '14px', color: '#6b7280' }}>{u.email}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '9999px', background: r.bg, color: r.color }}>{r.label}</span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <button onClick={() => handleToggleActive(u)} style={{
                      fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '9999px',
                      background: u.is_active ? '#d1fae5' : '#fee2e2',
                      color: u.is_active ? '#047857' : '#dc2626',
                      border: 'none', cursor: 'pointer',
                    }}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <button onClick={() => openEdit(u)} style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }} title="Editar">
                        <Edit2 style={{ width: '15px', height: '15px' }} />
                      </button>
                      <button onClick={() => { setResetUser(u); setResetPassword('') }} style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d97706' }} title="Resetar senha">
                        <KeyRound style={{ width: '15px', height: '15px' }} />
                      </button>
                      <button onClick={() => handleDelete(u.id)} style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626' }} title="Excluir">
                        <Trash2 style={{ width: '15px', height: '15px' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={modalBox} className="animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Novo Usuário</h3>
              <button onClick={() => setShowCreate(false)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Nome *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} required className="input-field" placeholder="Nome completo" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>E-mail *</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} required className="input-field" placeholder="usuario@empresa.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Senha inicial *</label>
                <input type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} required className="input-field" placeholder="Senha temporária" />
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>O usuário será obrigado a trocar no primeiro login</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Função</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} className="input-field">
                  <option value="tecnico">Técnico</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px', width: '100%', marginTop: '4px' }}>Criar Usuário</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div style={modalOverlay} onClick={() => setEditUser(null)}>
          <div style={modalBox} className="animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Editar Usuário</h3>
              <button onClick={() => setEditUser(null)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Nome</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} required className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>E-mail</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} required className="input-field" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Função</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} className="input-field">
                  <option value="tecnico">Técnico</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px', width: '100%', marginTop: '4px' }}>Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div style={modalOverlay} onClick={() => setResetUser(null)}>
          <div style={modalBox} className="animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Resetar Senha</h3>
              <button onClick={() => setResetUser(null)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              Definir nova senha para <strong>{resetUser.name}</strong> ({resetUser.email}).
              O usuário será obrigado a trocar no próximo login.
            </p>
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Nova senha temporária *</label>
                <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} required className="input-field" placeholder="Senha temporária" />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px', width: '100%', marginTop: '4px', background: '#d97706' }}>Resetar Senha</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
