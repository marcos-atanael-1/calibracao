import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, LogOut, KeyRound, Check, Loader2, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'

const pageTitles = {
  '/': 'Dashboard',
  '/certificates': 'Certificados',
  '/certificates/new': 'Novo Certificado',
  '/templates': 'Templates',
  '/queue': 'Agente de Processamento',
  '/users': 'Usuarios',
  '/settings': 'Configuracoes',
}

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const location = useLocation()
  const { user, logout, updateUser } = useAuth()

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChangePw = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPw.length < 6) {
      setPwError('A nova senha deve ter pelo menos 6 caracteres')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('As senhas nao coincidem')
      return
    }

    setPwLoading(true)
    try {
      await api.put(`/auth/change-password/${user.id}`, { new_password: newPw })
      updateUser({ ...user, must_change_password: false })
      setPwSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => {
        setPwSuccess(false)
        setIsPasswordModalOpen(false)
      }, 3000)
    } catch (err) {
      setPwError(err.response?.data?.detail || 'Erro ao alterar senha')
    } finally {
      setPwLoading(false)
    }
  }

  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }

  const getTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (location.pathname === path) return title
    }
    if (location.pathname.startsWith('/certificates/')) return 'Certificado'
    return 'Pagina'
  }

  return (
    <header style={{
      height: '64px', background: '#ffffff', borderBottom: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', position: 'sticky', top: 0, zIndex: 20,
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{getTitle()}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button style={{
          position: 'relative', padding: '8px', borderRadius: '8px', border: 'none',
          background: 'transparent', color: '#9ca3af', cursor: 'pointer',
        }}>
          <Bell style={{ width: '20px', height: '20px' }} />
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            width: '8px', height: '8px', background: '#dc2626', borderRadius: '50%',
          }}></span>
        </button>

        <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />

        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', borderRadius: '8px', padding: '4px 8px',
              transition: 'background 0.15s',
              background: dropdownOpen ? '#f3f4f6' : 'transparent',
            }}
            onMouseEnter={e => { if (!dropdownOpen) e.currentTarget.style.background = '#f3f4f6' }}
            onMouseLeave={e => { if (!dropdownOpen) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', background: '#e8eef8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#002868' }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937', lineHeight: 1 }}>{user?.name || 'Usuario'}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{user?.role || 'tecnico'}</p>
            </div>
          </div>

          {dropdownOpen && (
            <div className="animate-fade-in" style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '200px', background: '#ffffff', borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb',
              overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 50,
            }}>
              <button
                onClick={() => { setDropdownOpen(false); setIsPasswordModalOpen(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
                  border: 'none', background: 'transparent', width: '100%',
                  textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#374151',
                  borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <KeyRound style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                Trocar Senha
              </button>
              <button
                onClick={() => { setDropdownOpen(false); logout() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
                  border: 'none', background: 'transparent', width: '100%',
                  textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#ef4444',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut style={{ width: '16px', height: '16px' }} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {isPasswordModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px',
        }}>
          <div className="animate-fade-in" style={{
            background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound style={{ width: '20px', height: '20px', color: '#002868' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Trocar Senha</h3>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {pwError && (
                <div style={{
                  marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                  fontSize: '14px', fontWeight: 500,
                }} className="animate-fade-in">
                  {pwError}
                </div>
              )}

              {pwSuccess && (
                <div style={{
                  marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
                  background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#047857',
                  fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                }} className="animate-fade-in">
                  <Check style={{ width: '18px', height: '18px' }} /> Senha alterada com sucesso!
                </div>
              )}

              <form onSubmit={handleChangePw} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Senha atual</label>
                  <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required className="input-field" placeholder="Digite sua senha atual" />
                </div>
                <div>
                  <label style={labelStyle}>Nova senha</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required className="input-field" placeholder="Minimo 6 caracteres" />
                </div>
                <div>
                  <label style={labelStyle}>Confirmar nova senha</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required className="input-field" placeholder="Repita a nova senha" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="button" onClick={() => setIsPasswordModalOpen(false)} style={{
                    padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
                    background: '#ffffff', color: '#374151', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={pwLoading} className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {pwLoading
                      ? <><Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> Salvando...</>
                      : 'Salvar Senha'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
