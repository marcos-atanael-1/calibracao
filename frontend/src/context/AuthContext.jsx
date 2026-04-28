import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(false)

  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const { access_token, refresh_token, must_change_password, user: userData } = data
      const userWithFlag = { ...userData, must_change_password: must_change_password || false }
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      localStorage.setItem('user', JSON.stringify(userWithFlag))
      setUser(userWithFlag)
      return { success: true }
    } catch (error) {
      // Demo mode: if backend is offline (network error or proxy 502/503)
      const status = error.response?.status
      const isBackendOffline = !error.response || status === 502 || status === 503 || status === 504
      if (isBackendOffline) {
        const demoUser = {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Admin (Demo)',
          email: email,
          role: 'admin',
          is_active: true,
          must_change_password: false,
        }
        localStorage.setItem('access_token', 'demo-token')
        localStorage.removeItem('refresh_token')
        localStorage.setItem('user', JSON.stringify(demoUser))
        setUser(demoUser)
        return { success: true }
      }
      return {
        success: false,
        message: error.response?.data?.detail || 'Erro ao fazer login',
      }
    } finally {
      setLoading(false)
    }
  }

  const updateUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
