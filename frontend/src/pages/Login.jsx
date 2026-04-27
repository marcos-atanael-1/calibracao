import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(email, password)
    if (result.success) {
      navigate('/')
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <img src="/logo-elus.png" alt="Elus Instrumentação" className="login-logo-img" />
        </div>

        <p className="login-welcome">Bem-vindo de volta</p>

        {error && (
          <div className="login-error animate-fade-in">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com.br"
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <div className="login-field-header">
              <label htmlFor="login-password">Senha</label>
              <a href="#" className="login-forgot" onClick={e => { e.preventDefault(); alert('Solicite a redefinição ao administrador.') }}>
                Esqueci minha senha
              </a>
            </div>
            <div className="login-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label className="login-remember">
            <input type="checkbox" />
            Manter conectado neste dispositivo
          </label>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading ? (
              <>
                <Loader2 className="login-btn-spinner" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>

      <p className="login-footer">
        &copy; {new Date().getFullYear()} Elus Instrumentação. Todos os direitos reservados.
      </p>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        .login-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #f0f2f5 0%, #e8ecf1 100%);
          font-family: 'DM Sans', 'Inter', sans-serif;
          padding: 24px;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: #ffffff;
          border-radius: 16px;
          padding: 40px 40px 36px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.06);
          animation: card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes card-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .login-logo-img {
          height: 100px;
          width: auto;
          object-fit: contain;
        }

        .login-welcome {
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 28px;
          letter-spacing: 0.01em;
        }

        .login-error {
          margin-bottom: 16px;
          padding: 10px 14px;
          border-radius: 8px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          font-size: 13px;
          font-weight: 500;
          text-align: center;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .login-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }

        .login-field-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .login-field-header label {
          margin-bottom: 0;
        }

        .login-forgot {
          font-size: 12px;
          color: #002868;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s;
        }

        .login-forgot:hover {
          color: #003d99;
          text-decoration: underline;
        }

        .login-field input {
          width: 100%;
          padding: 9px 14px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #eef0f4;
          color: #111827;
          font-size: 14px;
          font-family: 'DM Sans', 'Inter', sans-serif;
          transition: all 0.2s ease;
          outline: none;
        }

        .login-field input::placeholder {
          color: #c4c9d2;
        }

        .login-field input:focus {
          border-color: #002868;
          background: #eef0f4;
          box-shadow: 0 0 0 3px rgba(0, 40, 104, 0.08);
        }

        /* Remember checkbox */
        .login-remember {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #6b7280;
          cursor: pointer;
          user-select: none;
        }

        .login-remember input[type="checkbox"] {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid #d1d5db;
          accent-color: #002868;
          cursor: pointer;
        }

        /* Password wrapper */
        .login-password-wrapper {
          position: relative;
        }

        .login-password-wrapper input {
          padding-right: 44px;
        }

        .login-toggle-pw {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          padding: 6px;
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
        }

        .login-toggle-pw:hover {
          color: #374151;
        }

        .login-btn {
          width: 100%;
          padding: 12px;
          margin-top: 4px;
          border: none;
          border-radius: 8px;
          background: #002868;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .login-btn:hover:not(:disabled) {
          background: #003d99;
          box-shadow: 0 4px 12px rgba(0, 40, 104, 0.25);
        }

        .login-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .login-btn-spinner {
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .login-footer {
          margin-top: 28px;
          font-size: 12px;
          color: #9ca3af;
          text-align: center;
          animation: card-in 0.5s ease 0.3s both;
        }

        @media (max-width: 520px) {
          .login-card { padding: 32px 24px 28px; }
          .login-logo-img { height: 72px; }
        }
      `}</style>
    </div>
  )
}
