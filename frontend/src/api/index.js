import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

// ── Token management ──────────────────────────────────────────
export function getToken() {
  return sessionStorage.getItem('token')
}

export function getRole() {
  return sessionStorage.getItem('role')
}

export function getUsername() {
  return sessionStorage.getItem('username')
}

export function getCustomerId() {
  return sessionStorage.getItem('customer_id')
}

export function getRefreshToken() {
  return sessionStorage.getItem('refresh_token')
}

export function isLoggedIn() {
  return !!getToken()
}

export function isAdmin() {
  return getRole() === 'admin'
}

export function saveAuth(token, refreshToken, role, username, customerId) {
  sessionStorage.setItem('token', token)
  sessionStorage.setItem('refresh_token', refreshToken)
  sessionStorage.setItem('role', role)
  sessionStorage.setItem('username', username)
  if (customerId) sessionStorage.setItem('customer_id', String(customerId))
}

export function clearAuth() {
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('refresh_token')
  sessionStorage.removeItem('role')
  sessionStorage.removeItem('username')
  sessionStorage.removeItem('customer_id')
}

// ── Axios interceptors ────────────────────────────────────────

// attach token to every request automatically
api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// auto-refresh on 401
let isRefreshing = false
let refreshQueue = []

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      isRefreshing = true
      const refreshToken = getRefreshToken()

      if (!refreshToken) {
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(err)
      }

      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const { access_token, refresh_token: newRefresh, role, username, customer_id } = res.data
        saveAuth(access_token, newRefresh, role, username, customer_id)

        refreshQueue.forEach(({ resolve }) => resolve(access_token))
        refreshQueue = []

        original.headers.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch (refreshErr) {
        refreshQueue.forEach(({ reject }) => reject(refreshErr))
        refreshQueue = []
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────
export async function login(username, password) {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  const res = await api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

export async function getMe() {
  return api.get('/auth/me').then(r => r.data)
}

// ── Chat (streaming) ──────────────────────────────────────────
export async function sendMessage(
  { message, customerId, threadId, ticketSubject, ticketBody },
  onChunk
) {
  const token = getToken()
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      customer_id: customerId ? Number(customerId) : null,
      thread_id: threadId || 'default',
      ticket_subject: ticketSubject || null,
      ticket_body: ticketBody || null,
    }),
  })

  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return await res.json()
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value))
  }
  return null
}

// ── Approvals ─────────────────────────────────────────────────
export const getApprovals = () =>
  api.get('/approvals').then(r => r.data)

export const approveAction = (threadId, approved) =>
  api.post('/approve', { thread_id: threadId, approved }).then(r => r.data)

// ── Documents ─────────────────────────────────────────────────
export const getDocuments = () =>
  api.get('/documents').then(r => r.data)

export const addDocument = (title, content, source) =>
  api.post('/documents', { title, content, source }).then(r => r.data)

// ── Memories ──────────────────────────────────────────────────
export const getMemories = (customerId) =>
  api.get(`/memories/${customerId}`).then(r => r.data)

// ── Tickets (user) ────────────────────────────────────────────
export const createTicket = (subject, body) =>
  api.post('/tickets/mine', { subject, body }).then(r => r.data)

export const getMyTickets = () =>
  api.get('/tickets/mine').then(r => r.data)

