'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

interface SlaRule {
  id: string
  priority: string
  response_time_minutes?: number
  resolution_time_hours?: number
  responseTimeMinutes?: number
  resolutionTimeHours?: number
  is_active?: boolean
  isActive?: boolean
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low']

export default function AdminSlaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [rules, setRules] = useState<SlaRule[]>([])
  const [compliance, setCompliance] = useState<Record<string, { total: number; breached: number }>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingRule, setEditingRule] = useState<SlaRule | null>(null)
  const [form, setForm] = useState({ priority: 'medium', responseTimeMinutes: 240, resolutionTimeHours: 48 })

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  const fetchRules = async () => {
    try {
      const res = await api.get('/sla')
      setRules(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      console.error('Failed to fetch SLA:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompliance = async () => {
    try {
      const res = await api.get('/sla/compliance')
      setCompliance(res.data || {})
    } catch (_) {}
  }

  useEffect(() => {
    if (!mounted || !user) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchRules()
    fetchCompliance()
  }, [mounted, user, router])

  const openAdd = () => {
    setForm({ priority: 'medium', responseTimeMinutes: 240, resolutionTimeHours: 48 })
    setEditingRule(null)
    setModal('add')
  }

  const openEdit = (rule: SlaRule) => {
    setEditingRule(rule)
    setForm({
      priority: rule.priority,
      responseTimeMinutes: rule.responseTimeMinutes ?? rule.response_time_minutes ?? 0,
      resolutionTimeHours: rule.resolutionTimeHours ?? rule.resolution_time_hours ?? 0
    })
    setModal('edit')
  }

  const handleSave = async () => {
    try {
      if (modal === 'add') {
        await api.post('/sla', {
          priority: form.priority,
          responseTimeMinutes: form.responseTimeMinutes,
          resolutionTimeHours: form.resolutionTimeHours
        })
      } else if (editingRule) {
        await api.put(`/sla/${editingRule.id}`, {
          responseTimeMinutes: form.responseTimeMinutes,
          resolutionTimeHours: form.resolutionTimeHours
        })
      }
      setModal(null)
      setEditingRule(null)
      fetchRules()
      fetchCompliance()
    } catch (e: any) {
      console.error('Save SLA error:', e)
      alert(e.response?.data?.message || 'Failed to save')
    }
  }

  const handleDelete = async (rule: SlaRule) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete SLA rule for priority "${rule.priority}"?`)) return
    try {
      await api.delete(`/sla/${rule.id}`)
      fetchRules()
      fetchCompliance()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to delete')
    }
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-600 rounded-full" />
        </div>
      </ProtectedRoute>
    )
  }

  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { color: string; bg: string; icon: string }> = {
      urgent: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '🔥' },
      high: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '⚡' },
      medium: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '📋' },
      low: { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '📌' },
    }
    return configs[priority] || configs.medium
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Admin Panel
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SLA & Priority Management</h1>
        </div>
        <p className="text-gray-600 mb-8 text-base">Configure service level agreements, monitor compliance, and set priority-based response times.</p>

        {/* SLA breach indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {PRIORITIES.map((p) => {
            const c = compliance[p] || { total: 0, breached: 0 }
            const config = getPriorityConfig(p)
            const breachRate = c.total > 0 ? ((c.breached / c.total) * 100).toFixed(1) : '0'
            return (
              <div key={p} className={`bg-white rounded-xl shadow-sm border-2 ${config.bg} p-6 hover:shadow-md transition-shadow`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider capitalize">{p}</h3>
                  <span className="text-2xl">{config.icon}</span>
                </div>
                <div className="space-y-1">
                  <p className={`text-3xl font-bold ${c.breached > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {c.breached > 0 ? (
                      <span className="flex items-center gap-2">
                        {c.breached}
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        0
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-medium text-gray-600">
                    {c.breached > 0 ? `${breachRate}% breach rate` : 'No breaches'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{c.total} total tickets</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                SLA Rules
              </h2>
              <p className="text-sm text-gray-500">Configure response and resolution times by priority level</p>
            </div>
            <button 
              onClick={openAdd} 
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Rule
            </button>
          </div>
          {loading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
                <p className="text-gray-500 font-medium">Loading SLA rules...</p>
              </div>
            </div>
          ) : rules.length === 0 ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium mb-1">No SLA rules configured</p>
                <p className="text-sm text-gray-500 mb-4">Get started by adding your first SLA rule.</p>
                <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add First Rule
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[600px] w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Response Time</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Resolution Time</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((r) => {
                    const config = getPriorityConfig(r.priority)
                    return (
                      <tr key={r.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border ${config.bg} ${config.color}`}>
                            <span>{config.icon}</span>
                            {r.priority.charAt(0).toUpperCase() + r.priority.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="font-semibold text-gray-900">{r.responseTimeMinutes ?? r.response_time_minutes ?? '—'}</span>
                            <span className="text-xs text-gray-500">min</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold text-gray-900">{r.resolutionTimeHours ?? r.resolution_time_hours ?? '—'}</span>
                            <span className="text-xs text-gray-500">hrs</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openEdit(r)} 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(r)} 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full p-8 transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">{modal === 'add' ? 'Add SLA Rule' : 'Edit SLA Rule'}</h3>
              </div>
              <div className="space-y-5">
                {modal === 'add' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Priority Level
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-all"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Response Time (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.responseTimeMinutes}
                    onChange={(e) => setForm({ ...form, responseTimeMinutes: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="e.g., 240"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Time to acknowledge and start working on the ticket</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Resolution Time (hours)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.resolutionTimeHours}
                    onChange={(e) => setForm({ ...form, resolutionTimeHours: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="e.g., 48"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Total time to resolve the ticket completely</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-6 mt-6 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => setModal(null)} 
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleSave} 
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Rule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
