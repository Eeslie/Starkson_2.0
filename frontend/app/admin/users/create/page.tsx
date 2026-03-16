'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useBranches } from '@/lib/useBranches'

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'it_support', label: 'IT Support' },
  { value: 'security_officer', label: 'Security Officer' },
  { value: 'admin', label: 'Admin' },
]

export default function AdminCreateUserPage() {
  const router = useRouter()
  const { realBranches, ALL_BRANCHES_ACRONYM } = useBranches()
  const [formData, setFormData] = useState({
    fullname: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    branchAcronyms: [] as string[],
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // State for password visibility
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    const hasAllBranches = formData.branchAcronyms.includes(ALL_BRANCHES_ACRONYM)
    const hasSomeBranches = formData.branchAcronyms.filter((a) => a !== ALL_BRANCHES_ACRONYM).length > 0
    if (formData.role !== 'admin' && !hasAllBranches && !hasSomeBranches) {
      setError('Please assign at least one branch or All Branches for this role.')
      return
    }

    setLoading(true)

    try {
      await api.post('/auth/register', {
        fullname: formData.fullname,
        username: formData.username, // Admin can now enter in any case (will be stored as entered)
        password: formData.password,
        role: formData.role,
        branchAcronyms: formData.role === 'admin' ? [] : (formData.branchAcronyms.includes(ALL_BRANCHES_ACRONYM) ? [ALL_BRANCHES_ACRONYM] : formData.branchAcronyms.filter((a) => a !== ALL_BRANCHES_ACRONYM)),
      })

      setSuccess(true)
      setTimeout(() => {
        router.push('/admin/users')
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex flex-col">
        {/* Back + title */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            User Management
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create an account</h1>
        </div>

        {/* Full-screen form area */}
        <div className="flex-1 flex items-start justify-center w-full max-w-4xl mx-auto">
          <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 lg:p-16">
            <p className="text-gray-600 mb-8 text-lg">
              Add a new user to the platform. They will be able to sign in with the username and password you set.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
              <div>
                <label htmlFor="create-fullname" className="block text-base font-semibold text-gray-700 mb-2">
                  Full name
                </label>
                <input
                  id="create-fullname"
                  type="text"
                  value={formData.fullname}
                  onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                  className="w-full px-5 py-3.5 text-base border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label htmlFor="create-username" className="block text-base font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  id="create-username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })} // Accepts any case as entered
                  className="w-full px-5 py-3.5 text-base border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="e.g., John Doe, john doe, JOHN DOE"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Usernames are case-sensitive and will be stored exactly as entered (e.g., John Doe, john doe, JOHN DOE are all different)</p>
              </div>

              <div>
                <label htmlFor="create-password" className="block text-base font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-5 py-3.5 text-base border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors pr-12"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="create-confirm" className="block text-base font-semibold text-gray-700 mb-2">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="create-confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-5 py-3.5 text-base border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors pr-12"
                    required
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="create-role" className="block text-base font-semibold text-gray-700 mb-2">
                  Role
                </label>
                <select
                  id="create-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-5 py-3.5 text-base border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {formData.role !== 'admin' && (
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    Assign branch(es) <span className="text-red-500">*</span>
                  </label>
                  <p className="text-sm text-gray-500 mb-3">
                    User / IT Staff / Security Officer can create and view tickets for their assigned branches. One branch = auto-assigned when creating a ticket; 2+ or All Branches = they choose the branch per ticket.
                  </p>
                  <label className="flex items-center gap-3 p-3 mb-3 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.branchAcronyms.includes(ALL_BRANCHES_ACRONYM)}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          branchAcronyms: e.target.checked ? [ALL_BRANCHES_ACRONYM] : [],
                        })
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-900">All Branches</span>
                    <span className="text-xs text-gray-600">User has access to every branch and chooses which branch when creating a ticket.</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50/50">
                    {realBranches.map((branch) => (
                      <label
                        key={branch.acronym}
                        className={`flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 cursor-pointer ${formData.branchAcronyms.includes(ALL_BRANCHES_ACRONYM) ? 'opacity-60' : 'hover:border-blue-200'}`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.branchAcronyms.includes(branch.acronym)}
                          disabled={formData.branchAcronyms.includes(ALL_BRANCHES_ACRONYM)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const next = formData.branchAcronyms.includes(ALL_BRANCHES_ACRONYM)
                                ? [branch.acronym]
                                : [...formData.branchAcronyms.filter((a) => a !== ALL_BRANCHES_ACRONYM), branch.acronym]
                              setFormData({ ...formData, branchAcronyms: next })
                            } else {
                              setFormData({ ...formData, branchAcronyms: formData.branchAcronyms.filter((a) => a !== branch.acronym) })
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="text-sm font-medium text-gray-900">{branch.acronym}</span>
                        <span className="text-xs text-gray-500 truncate">{branch.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-3.5">
                  <p className="text-base text-red-600">{error}</p>
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-green-50 border border-green-100 px-5 py-3.5">
                  <p className="text-base text-green-600">Account created. Redirecting to User Management...</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={loading || success}
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : success ? 'Created!' : 'Create account'}
                </button>
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold rounded-xl border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}