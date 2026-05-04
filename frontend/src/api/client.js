import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null
const TOKEN_REFRESH_BUFFER_SECONDS = 120

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(window.atob(padded))
  } catch {
    return null
  }
}

function shouldRefreshToken(token) {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (!exp) return false

  const nowInSeconds = Math.floor(Date.now() / 1000)
  return exp - nowInSeconds <= TOKEN_REFRESH_BUFFER_SECONDS
}

function clearSessionAndRedirect() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('refresh_token')

    if (!refreshToken) {
      clearSessionAndRedirect()
      throw new Error('Refresh token ausente')
    }

    refreshPromise = axios
      .post('/api/v1/auth/refresh', { refresh_token: refreshToken }, {
        headers: { 'Content-Type': 'application/json' },
      })
      .then(({ data }) => {
        const { access_token, refresh_token, user } = data
        localStorage.setItem('access_token', access_token)
        localStorage.setItem('refresh_token', refresh_token)
        localStorage.setItem('user', JSON.stringify(user))
        return access_token
      })
      .catch((error) => {
        clearSessionAndRedirect()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

api.interceptors.request.use((config) => {
  return config
})

api.interceptors.request.use(async (config) => {
  const isRefreshRequest = config.url?.includes('/auth/refresh')
  let token = localStorage.getItem('access_token')
  const isDemoMode = token === 'demo-token'

  if (token && !isDemoMode && !isRefreshRequest && shouldRefreshToken(token)) {
    try {
      token = await refreshAccessToken()
    } catch (error) {
      return Promise.reject(error)
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isDemoMode = localStorage.getItem('access_token') === 'demo-token'
    const originalRequest = error.config

    if (error.response?.status === 401 && !isDemoMode && !originalRequest?._retry) {
      originalRequest._retry = true

      try {
        const newAccessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
    }

    if (error.response?.status === 401 && !isDemoMode) {
      clearSessionAndRedirect()
    }

    return Promise.reject(error)
  }
)

export default api
