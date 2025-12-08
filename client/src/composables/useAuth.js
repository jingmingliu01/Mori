import { ref, computed } from 'vue'
import { logger, LogCategory } from '../utils/logger'

const API_BASE = import.meta.env.VITE_API_URL || ''
const AUTH_STORAGE_KEY = 'mori:auth'

const user = ref(null)
const token = ref(null)
const loading = ref(false)
const error = ref(null)
const initializing = ref(true)

// Validate token with the server
const validateToken = async () => {
  if (!token.value) {
    logger.info(LogCategory.AUTH, 'No stored token found, skipping validation')
    initializing.value = false
    return
  }
  
  logger.info(LogCategory.AUTH, 'Validating stored token with server')
  
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    
    if (res.ok) {
      // Token is valid, optionally update user data from server
      const data = await res.json()
      user.value = data.user
      logger.success(LogCategory.AUTH, 'Token validated successfully', { email: data.user?.email })
    } else {
      // Token is invalid, clear auth state
      logger.warn(LogCategory.AUTH, 'Token validation failed, clearing auth state', { status: res.status })
      clearAuth()
    }
  } catch (e) {
    // Network error - keep local state but warn
    logger.warn(LogCategory.AUTH, 'Token validation failed (network error)', { error: e.message })
  } finally {
    initializing.value = false
  }
}

// Load from localStorage on init
const loadStoredAuth = () => {
  logger.info(LogCategory.AUTH, 'Loading stored auth from localStorage')
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      user.value = parsed.user
      token.value = parsed.token
      logger.info(LogCategory.AUTH, 'Found stored auth', { email: parsed.user?.email })
    } else {
      logger.info(LogCategory.AUTH, 'No stored auth found')
    }
  } catch (e) {
    logger.error(LogCategory.AUTH, 'Failed to load auth state', { error: e.message })
  }
  
  // Validate token with server
  validateToken()
}

// Initialize on module load
loadStoredAuth()

const saveAuth = (userData, authToken) => {
  user.value = userData
  token.value = authToken
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userData, token: authToken }))
  logger.success(LogCategory.AUTH, 'Auth state saved', { email: userData?.email })
}

const clearAuth = () => {
  const previousEmail = user.value?.email
  user.value = null
  token.value = null
  localStorage.removeItem(AUTH_STORAGE_KEY)
  logger.info(LogCategory.AUTH, 'Auth state cleared', { previousEmail })
}

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value)

  const signup = async (email, password, name = '') => {
    logger.info(LogCategory.AUTH, 'Signup attempt', { email })
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
      logger.success(LogCategory.AUTH, 'Signup successful', { email, userId: data.user?._id })
      return data
    } catch (e) {
      logger.error(LogCategory.AUTH, 'Signup failed', { email, error: e.message })
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const login = async (email, password) => {
    logger.info(LogCategory.AUTH, 'Login attempt', { email })
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
      logger.success(LogCategory.AUTH, 'Login successful', { email, userId: data.user?._id })
      return data
    } catch (e) {
      logger.error(LogCategory.AUTH, 'Login failed', { email, error: e.message })
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    logger.info(LogCategory.AUTH, 'User logout initiated', { email: user.value?.email })
    clearAuth()
    logger.success(LogCategory.AUTH, 'User logged out successfully')
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
    initializing,
    isAuthenticated,
    signup,
    login,
    logout,
    getAuthHeaders,
  }
}

