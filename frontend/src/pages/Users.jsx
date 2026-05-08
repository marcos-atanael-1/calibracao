import { useState, useEffect } from 'react'
import { Edit2, Trash2, KeyRound, X, UserPlus } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

const roleLabels = {
  super_admin: { label: 'Super Admin', bg: '#e8eef8', color: '#002868' },
  admin: { label: 'Admin', bg: '#dbeafe', color: '#1d4ed8' },
  tecnico: { label: 'Tecnico', bg: '#f3f4f6', color: '#4b5563' },
  qualidade: { label: 'Qualidade', bg: '#ede9fe', color: '#6d28d9' },
}

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}

const baseModalBox = {
  background: '#ffffff',
  borderRadius: '16px',
  width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const isMobile = useIsMobile()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [resetUser, setResetUser] = useState(null)

  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('tecnico')
  const [resetPassword, setResetPassword] = useState('')

  const canManageSuperAdmin = currentUser?.role === 'super_admin'
  const allowedRoleOptions = canManageSuperAdmin ? ['tecnico', 'admin', 'qualidade', 'super_admin'] : ['tecnico', 'admin']

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data } = await api.get('/users')
      setUsers(data.data || [])
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao carregar usuarios')
    } finally {
      setLoading(false)
    }
  }

  const isProtectedUser = (targetUser) => !canManageSuperAdmin && targetUser?.role === 'super_admin'

  const resetCreateForm = () => {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('tecnico')
  }

  const openCreate = () => {
    resetCreateForm()
    setShowCreate(true)
  }

  const openEdit = (targetUser) => {
    if (isProtectedUser(targetUser)) {
      alert('Admin nao pode gerenciar usuarios super admin')
      return
    }
    setFormName(targetUser.name)
    setFormEmail(targetUser.email)
    setFormRole(targetUser.role)
    setEditUser(targetUser)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/users', { name: formName, email: formEmail, password: formPassword, role: formRole })
      setShowCreate(false)
      resetCreateForm()
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao criar usuario')
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/users/${editUser.id}`, { name: formName, email: formEmail, role: formRole })
      setEditUser(null)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao atualizar usuario')
    }
  }

  const handleDelete = async (targetUser) => {
    if (isProtectedUser(targetUser)) {
      alert('Admin nao pode excluir usuarios super admin')
      return
    }
    if (!confirm('Deseja excluir este usuario?')) return
    try {
      await api.delete(`/users/${targetUser.id}`)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir usuario')
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/users/${resetUser.id}/reset-password`, { new_password: resetPassword })
      setResetUser(null)
      setResetPassword('')
      alert('Senha redefinida. O usuario devera trocar no proximo login.')
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao resetar senha')
    }
  }

  const handleToggleActive = async (targetUser) => {
    if (isProtectedUser(targetUser)) {
      alert('Admin nao pode alterar usuarios super admin')
      return
    }
    try {
      await api.put(`/users/${targetUser.id}`, { is_active: !targetUser.is_active })
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao alterar status')
    }
  }

  const modalBox = {
    ...baseModalBox,
    maxWidth: isMobile ? 'calc(100vw - 24px)' : '440px',
    padding: isMobile ? '20px' : '28px',
    margin: isMobile ? '12px' : '0',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: '12px' }}>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>{users.length} usuario(s) cadastrado(s)</p>
        <button
          onClick={openCreate}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', width: isMobile ? '100%' : 'auto' }}
        >
          <UserPlus style={{ width: '16px', height: '16px' }} /> Novo Usuario
        </button>
      </div>

      <div className="card table-scroll" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['NOME', 'E-MAIL', 'FUNCAO', 'STATUS', 'ACOES'].map((heading) => (
                <th
                  key={heading}
                  style={{
                    textAlign: heading === 'ACOES' ? 'right' : 'left',
                    padding: '12px 24px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6b7280',
                    letterSpacing: '0.05em',
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>Carregando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>Nenhum usuario cadastrado</td></tr>
            ) : users.map((targetUser) => {
              const roleMeta = roleLabels[targetUser.role] || roleLabels.tecnico
              const protectedUser = isProtectedUser(targetUser)

              return (
                <tr
                  key={targetUser.id}
                  style={{ borderTop: '1px solid #f3f4f6' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '14px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e8eef8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#002868' }}>
                        {targetUser.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{targetUser.name}</p>
                        {targetUser.must_change_password && (
                          <p style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>Deve trocar senha</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 24px', fontSize: '14px', color: '#6b7280' }}>{targetUser.email}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '9999px', background: roleMeta.bg, color: roleMeta.color }}>
                      {roleMeta.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <button
                      onClick={() => handleToggleActive(targetUser)}
                      disabled={protectedUser}
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        background: targetUser.is_active ? '#d1fae5' : '#fee2e2',
                        color: targetUser.is_active ? '#047857' : '#dc2626',
                        border: 'none',
                        cursor: protectedUser ? 'not-allowed' : 'pointer',
                        opacity: protectedUser ? 0.55 : 1,
                      }}
                    >
                      {targetUser.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <button disabled={protectedUser} onClick={() => openEdit(targetUser)} style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: protectedUser ? 'not-allowed' : 'pointer', color: '#6b7280', opacity: protectedUser ? 0.45 : 1 }} title="Editar">
                        <Edit2 style={{ width: '15px', height: '15px' }} />
                      </button>
                      <button disabled={protectedUser} onClick={() => { setResetUser(targetUser); setResetPassword('') }} style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: protectedUser ? 'not-allowed' : 'pointer', color: '#d97706', opacity: protectedUser ? 0.45 : 1 }} title="Resetar senha">
                        <KeyRound style={{ width: '15px', height: '15px' }} />
                      </button>
                      <button disabled={protectedUser} onClick={() => handleDelete(targetUser)} style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: protectedUser ? 'not-allowed' : 'pointer', color: '#dc2626', opacity: protectedUser ? 0.45 : 1 }} title="Excluir">
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

      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={modalBox} className="animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Novo Usuario</h3>
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
                <input type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} required className="input-field" placeholder="Senha temporaria" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Funcao</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} className="input-field">
                  {allowedRoleOptions.map((role) => (
                    <option key={role} value={role}>{roleLabels[role].label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px', width: '100%' }}>Criar Usuario</button>
            </form>
          </div>
        </div>
      )}

      {editUser && (
        <div style={modalOverlay} onClick={() => setEditUser(null)}>
          <div style={modalBox} className="animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Editar Usuario</h3>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Funcao</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} className="input-field">
                  {allowedRoleOptions.map((role) => (
                    <option key={role} value={role}>{roleLabels[role].label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px', width: '100%' }}>Salvar Alteracoes</button>
            </form>
          </div>
        </div>
      )}

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
              Definir nova senha para <strong>{resetUser.name}</strong>.
            </p>
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Nova senha temporaria *</label>
                <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} required className="input-field" placeholder="Senha temporaria" />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px', width: '100%', background: '#d97706' }}>Resetar Senha</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
