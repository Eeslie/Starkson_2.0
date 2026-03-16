'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api, { getApiBaseUrl } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'
import { formatPinoyDateTime, todayPinoy } from '@/lib/date'

interface AuditLog {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  details: unknown
  createdAt: string
  userName: string | null
  userUsername: string | null
}

export default function AdminAuditPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const PAGE_SIZE = 10
  const [data, setData] = useState<{ logs: AuditLog[]; total: number }>({ logs: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ resourceType: '', action: '', startDate: '', endDate: '', search: '' })

  const toYmdManila = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const setDatePreset = (preset: 'today' | 'this_week' | 'this_month' | 'last_month' | 'all') => {
    const todayManila = todayPinoy()
    if (preset === 'today') {
      setFilters((f) => ({ ...f, startDate: todayManila, endDate: todayManila }))
      setPage(1)
      return
    }
    if (preset === 'all') {
      setFilters((f) => ({ ...f, startDate: '', endDate: '' }))
      setPage(1)
      return
    }
    let startYmd: string
    const endYmd = todayManila
    switch (preset) {
      case 'this_week': {
        const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        startYmd = toYmdManila(weekAgo)
        break
      }
      case 'this_month':
        startYmd = todayManila.slice(0, 7) + '-01'
        break
      case 'last_month': {
        const d = new Date(todayManila + 'T12:00:00+08:00')
        d.setMonth(d.getMonth() - 1)
        d.setDate(1)
        startYmd = toYmdManila(d)
        const endOfLast = new Date(d)
        endOfLast.setMonth(endOfLast.getMonth() + 1)
        endOfLast.setDate(0)
        setFilters((f) => ({ ...f, startDate: startYmd, endDate: toYmdManila(endOfLast) }))
        setPage(1)
        return
      }
      default:
        return
    }
    setFilters((f) => ({ ...f, startDate: startYmd, endDate: endYmd }))
    setPage(1)
  }

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.resourceType) params.set('resourceType', filters.resourceType)
      if (filters.action) params.set('action', filters.action)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.search.trim()) params.set('search', filters.search.trim())
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String((page - 1) * PAGE_SIZE))
      const res = await api.get(`/audit?${params.toString()}`)
      setData({ logs: res.data.logs || [], total: res.data.total ?? res.data.logs?.length ?? 0 })
    } catch (e) {
      console.error('Failed to fetch audit logs:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted || !user) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchLogs()
  }, [mounted, user, router, page, filters.resourceType, filters.action, filters.startDate, filters.endDate, filters.search])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  const startRow = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endRow = Math.min(page * PAGE_SIZE, data.total)

  const handleExport = async (format: 'csv' | 'json') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    const params = new URLSearchParams()
    if (filters.resourceType) params.set('resourceType', filters.resourceType)
    if (filters.action) params.set('action', filters.action)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.search.trim()) params.set('search', filters.search.trim())
    params.set('format', format)
    const url = `${getApiBaseUrl()}/audit/export?${params.toString()}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `audit-report.${format}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      // ignore
    }
  }

  const fetchAllLogsForExport = async (): Promise<AuditLog[]> => {
    const allLogs: AuditLog[] = []
    const chunkSize = 1000
    let offset = 0
    let hasMore = true
    while (hasMore) {
      const params = new URLSearchParams()
      if (filters.resourceType) params.set('resourceType', filters.resourceType)
      if (filters.action) params.set('action', filters.action)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.search.trim()) params.set('search', filters.search.trim())
      params.set('limit', String(chunkSize))
      params.set('offset', String(offset))
      const res = await api.get(`/audit?${params.toString()}`)
      const logs: AuditLog[] = res.data.logs || []
      allLogs.push(...logs)
      hasMore = logs.length === chunkSize
      offset += chunkSize
    }
    return allLogs
  }

  const handleExportPdf = async () => {
  try {
    const allLogs = await fetchAllLogsForExport()
    const [jsPDFModule, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ])
    const jsPDF = jsPDFModule.default
    const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/STARKSON-LG.png` : ''
    let startY = 14
    let logoEndX = 14 // Default X position if no logo
    
    if (logoUrl) {
      try {
        const imgResp = await fetch(logoUrl)
        const imgBlob = await imgResp.blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(imgBlob)
        })
        const imgW = 45
        const imgH = 45
        doc.addImage(base64, 'PNG', 14, 2, imgW, imgH)
        // Calculate where the logo ends (x + width) plus a margin
        logoEndX = 14 + imgW + 5 // 5mm margin after logo
        startY = 24
      } catch {
        startY = 14
        logoEndX = 14
      }
    }
    
    doc.setFontSize(16)
    // Position text to the right of the logo (or at default position if no logo)
    doc.text('Audit Report (Full Report)', logoEndX, startY)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (PH time) | Total entries: ${allLogs.length}`, logoEndX, startY + 7)
    if (filters.startDate || filters.endDate) {
      doc.text(`Period: ${filters.startDate || '—'} to ${filters.endDate || '—'}`, logoEndX, startY + 14)
    }
    const tableStartY = startY + 18
    const tableData = allLogs.map((log) => [
      log.createdAt ? new Date(log.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'medium' }) : '—',
      log.action || '—',
      log.userName || log.userUsername || '—',
      (log.resourceType && log.resourceId) ? `${log.resourceType} / ${String(log.resourceId).slice(0, 8)}…` : '—',
      log.details != null ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)).slice(0, 40) : '—'
    ])
    autoTable(doc, {
      head: [['Time', 'Action', 'User', 'Resource', 'Details']],
      body: tableData,
      startY: tableStartY,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] }
    })
    doc.save('audit-report.pdf')
  } catch (e) {
    console.error('PDF export failed:', e)
    alert('Failed to generate PDF. Ensure jspdf is installed.')
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

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (action.includes('DELETE')) return 'bg-red-100 text-red-800 border-red-200'
    if (action.includes('CONVERT')) return 'bg-purple-100 text-purple-800 border-purple-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Audit Logs</h1>
        </div>
        <p className="text-gray-600 mb-8 text-base">
          Immutable activity logs — track who did what, when. Exportable audit reports for compliance (ISO 27001 / ISO 27035).
        </p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <p className="text-sm font-semibold text-gray-700">Filters & Export</p>
          </div>
          <p className="text-xs text-gray-500 mb-2">Date range is in <strong>Philippine time (PHT)</strong>. List and export (CSV, JSON, PDF) use the current filters including search (ticket ID, branch, ticket number).</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs font-medium text-gray-600 self-center mr-1">Quick range:</span>
            <button type="button" onClick={() => setDatePreset('today')} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">Today</button>
            <button type="button" onClick={() => setDatePreset('this_week')} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">This week</button>
            <button type="button" onClick={() => setDatePreset('this_month')} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">This month</button>
            <button type="button" onClick={() => setDatePreset('last_month')} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">Last month</button>
            <button type="button" onClick={() => setDatePreset('all')} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">All time</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search (ticket ID, branch, ticket #)
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1) }}
                placeholder="e.g. D01-000001, branch code, ticket number"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm focus:shadow-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Resource Type
              </label>
              <input
                type="text"
                value={filters.resourceType}
                onChange={(e) => { setFilters({ ...filters, resourceType: e.target.value }); setPage(1) }}
                placeholder="e.g. ticket, incident"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm focus:shadow-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Action
              </label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1) }}
                placeholder="e.g. CREATE_TICKET"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm focus:shadow-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                From Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                max={todayPinoy()}
                onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setPage(1) }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm focus:shadow-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                To Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                max={todayPinoy()}
                onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setPage(1) }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm focus:shadow-md"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            <button 
              onClick={() => handleExport('csv')} 
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-emerald-50 text-emerald-800 border-2 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm hover:shadow"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button 
              onClick={() => handleExport('json')} 
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-amber-50 text-amber-800 border-2 border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm hover:shadow"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Export JSON
            </button>
            <button 
              onClick={handleExportPdf} 
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-red-50 text-red-800 border-2 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all shadow-sm hover:shadow"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Activity Logs
                </h2>
                <p className="text-sm text-gray-500">Complete audit trail of all system activities</p>
              </div>
              <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <span className="text-sm font-semibold text-blue-800">{data.total} total entries</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
                  <p className="text-gray-500 font-medium">Loading audit logs...</p>
                </div>
              </div>
            ) : data.logs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-medium mb-1">No audit logs found</p>
                  <p className="text-sm text-gray-500">Activity logs will appear here as users interact with the system.</p>
                </div>
              </div>
            ) : (
              <table className="min-w-[900px] w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Resource</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="whitespace-nowrap">{formatPinoyDateTime(log.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border font-mono ${getActionBadgeColor(log.action || '')}`}>
                          {log.action || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-semibold">
                            {(log.userName || log.userUsername || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-gray-700 font-medium">{log.userName || log.userUsername || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {log.resourceType && log.resourceId ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">{log.resourceType}</span>
                            <span className="text-xs font-mono text-gray-500">{String(log.resourceId).slice(0, 8)}…</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          {log.details != null ? (
                            <div className="group/expand relative">
                              <p className="text-sm text-gray-600 truncate font-mono">
                                {typeof log.details === 'object' ? JSON.stringify(log.details).slice(0, 50) : String(log.details).slice(0, 50)}
                                {(typeof log.details === 'object' ? JSON.stringify(log.details).length : String(log.details).length) > 50 && '…'}
                              </p>
                              <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover/expand:block bg-gray-900 text-white text-xs rounded-lg p-2 max-w-md break-words shadow-xl">
                                {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {data.logs.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-700">
                Showing <span className="font-bold text-gray-900">{startRow}</span>–<span className="font-bold text-gray-900">{endRow}</span> of <span className="font-bold text-gray-900">{data.total}</span> entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="min-w-[2.25rem] px-3 py-2 rounded-lg text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-gray-600 px-3">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="min-w-[2.25rem] px-3 py-2 rounded-lg text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
