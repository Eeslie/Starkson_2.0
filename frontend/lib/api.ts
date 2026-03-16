import axios from 'axios'
import { clearStoredAuth } from '@/lib/auth'

// Get the base API URL from environment variable
export const getApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  // Ensure it ends with /api
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear both token and user so providers (e.g. NotificationProvider) don't
      // refetch on next load and trigger another 401 → redirect loop
      clearStoredAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
