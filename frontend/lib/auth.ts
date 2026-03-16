// Auth utilities for role-based access control

export type UserRole = 'user' | 'it_support' | 'security_officer' | 'admin'

export interface User {
  id: number
  username: string
  fullname: string
  role: UserRole
  branchAcronyms?: string[]
}

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export const setStoredAuth = (token: string, user: User) => {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export const clearStoredAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export const hasRole = (user: User | null, ...roles: UserRole[]): boolean => {
  if (!user) return false
  return roles.includes(user.role)
}

export const canAccessTicket = (user: User | null, ticketCreatedBy: number): boolean => {
  if (!user) return false
  if (hasRole(user, 'admin', 'it_support', 'security_officer')) return true
  return user.id === ticketCreatedBy
}

export const canAccessIncident = (user: User | null): boolean => {
  return hasRole(user, 'security_officer', 'admin')
}
