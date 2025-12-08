import { ref, computed } from 'vue'

const API_BASE = import.meta.env.VITE_API_URL || ''
const AUTH_STORAGE_KEY = 'mori:auth'

const user = ref(null)
const token = ref(null)
const loading = ref(false)
const error = ref(null)

// Load from localStorage on init
const loadStoredAuth = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      user.value = parsed.user
      token.value = parsed.token
    }
  } catch (e) {
    console.warn('Failed to load auth state', e)
  }
}

// Initialize on module load
loadStoredAuth()

const saveAuth = (userData, authToken) => {
  user.value = userData
  token.value = authToken
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userData, token: authToken }))
}

const clearAuth = () => {
  user.value = null
  token.value = null
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value)

  const signup = async (email, password, name = '') => {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed')
      }
      saveAuth(data.user, data.token)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const login = async (email, password) => {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }
      saveAuth(data.user, data.token)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    clearAuth()
  }

  const getAuthHeaders = () => {
    if (!token.value) return {}
    return { Authorization: `Bearer ${token.value}` }
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    signup,
    login,
    logout,
    getAuthHeaders,
  }
}

