import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function ChangePassword() {
  const { user, updateUser } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)
    try {
      await api.put(`/auth/change-password/${user.id}`, { new_password: password })
      // Update local user state to remove must_change_password
      updateUser({ ...user, must_change_password: false })
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao alterar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f9fafb', fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      <div className="card animate-fade-in" style={{ padding: '32px', maxWidth: '420px', width: '100%', margin: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px', background: '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <KeyRound style={{ width: '24px', height: '24px', color: '#d97706' }} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>Alterar Senha</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            Por segurança, crie uma nova senha para continuar
          </p>
        </div>

        {error && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '10px',
            background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
            fontSize: '13px', fontWeight: 500, textAlign: 'center',
          }} className="animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Confirmar senha</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="input-field"
              placeholder="Repita a nova senha"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px', width: '100%', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? <><Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> Salvando...</> : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
