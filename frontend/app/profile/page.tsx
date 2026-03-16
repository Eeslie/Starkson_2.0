'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, setStoredAuth } from '@/lib/auth'
import { BRANCHES, ALL_BRANCHES_ACRONYM } from '@/lib/branches'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
    // Fetch fresh user from server so Branch(es) reflects current DB (branch_acronyms)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          const fresh = res.data
          const userData = {
            id: fresh.id,
            username: fresh.username,
            fullname: fresh.fullname,
            role: fresh.role,
            branchAcronyms: fresh.branchAcronyms ?? []
          }
          setUser(userData)
          setStoredAuth(token, userData)
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!user) {
      router.push('/login')
      return
    }
  }, [user, router, mounted])

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200'
      case 'security_officer': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'it_support': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await api.post('/auth/reset-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      
      setSuccess('Password reset successfully!')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setShowResetPassword(false)
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute>
        <div className="panel-page flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="panel-page">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-10">My Profile</h1>

          <div className="panel-card overflow-hidden">
            <div className="p-10 sm:p-12">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-10">
                <div className="flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-sky-100 flex items-center justify-center ring-4 ring-sky-50">
                  <svg className="w-14 h-14 sm:w-20 sm:h-20 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="text-center sm:text-left flex-1 min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{user.fullname}</h2>
                  <p className="text-base sm:text-lg text-gray-500 font-mono mt-1 truncate">{user.username}</p>
                  <span className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-semibold border ${getRoleBadgeClass(user.role)}`}>
                    {formatRole(user.role)}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Account details</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1.5">User ID</dt>
                    <dd className="text-base text-gray-800 font-mono break-all">{user.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1.5">Role</dt>
                    <dd className="text-base text-gray-800">{formatRole(user.role)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1.5">Branch(es)</dt>
                    <dd className="text-base text-gray-800">
                      {user.role === 'admin'
                        ? '—'
                        : user.branchAcronyms && user.branchAcronyms.length > 0
                          ? user.branchAcronyms.includes(ALL_BRANCHES_ACRONYM)
                            ? 'All Branches'
                            : user.branchAcronyms
                                .map((a: string) => BRANCHES.find((b) => b.acronym === a)?.name || a)
                                .join(', ')
                          : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1.5">Password</dt>
                    <dd className="text-base text-gray-500">•••••••• (hidden)</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-10 pt-8 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="px-6 py-3 rounded-xl text-base font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors shadow-sm"
                >
                  {showResetPassword ? 'Cancel' : 'Reset Password'}
                </button>
              </div>

              {showResetPassword && (
                <div className="mt-8 p-8 sm:p-10 bg-gray-50 rounded-2xl border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Reset Password</h3>
                  <form onSubmit={handleResetPassword} className="space-y-5 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        required
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        required
                        placeholder="Min 6 characters"
                        minLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        required
                        placeholder="Re-enter new password"
                        minLength={6}
                      />
                    </div>
                    {error && <p className="text-base text-red-600">{error}</p>}
                    {success && <p className="text-base text-green-600">{success}</p>}
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 rounded-xl text-base font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Resetting…' : 'Reset Password'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}