'use client'

import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Listbox, Transition } from '@headlessui/react'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'
import { formatPinoyDateTime } from '@/lib/date'
import { REAL_BRANCHES } from '@/lib/branches'
import { getTicketStatuses, getPriorities } from '@/lib/maintenance' // Added getPriorities

interface Ticket {
  id: number
  ticketNumber: string
  requestType: string
  title: string
  status: string
  priority: string
  createdAt: string
  createdByName?: string
  assignedToName?: string
  slaDue?: string
  // NEW: Category and affected system
  category?: string
  affectedSystem?: string
  convertedIncidentId?: string | null
  convertedIncidentNumber?: string | null
}

const PAGE_SIZE = 10

// Helper function to sort statuses with "All statuses" at the top and proper order
const sortStatusOptions = (statuses: { value: string; label: string }[]): { value: string; label: string }[] => {
  // Define the desired order for default statuses (excluding "All statuses")
  const statusOrder = [
    'All Statuses',
    'New',
    'Assigned',
    'In Progress',
    'Waiting for User',
    'Resolved',
    'Closed',
    'Converted to Incident'
  ];
  
  // Separate "All statuses" from the rest
  const allStatusesOption = statuses.find(opt => opt.value === '') || { value: '', label: 'All statuses' };
  const otherOptions = statuses.filter(opt => opt.value !== '');
  
  // Separate into default statuses and custom statuses
  const defaultOptions: { value: string; label: string }[] = [];
  const customOptions: { value: string; label: string }[] = [];
  
  otherOptions.forEach(opt => {
    if (statusOrder.includes(opt.label)) {
      defaultOptions.push(opt);
    } else {
      customOptions.push(opt);
    }
  });
  
  // Sort default statuses according to the specified order
  defaultOptions.sort((a, b) => statusOrder.indexOf(a.label) - statusOrder.indexOf(b.label));
  
  // Sort custom statuses alphabetically by label
  customOptions.sort((a, b) => a.label.localeCompare(b.label));
  
  // Find the index where custom statuses should be inserted (after "Waiting for User")
  const waitingForUserIndex = defaultOptions.findIndex(opt => opt.label === 'Waiting for User');
  const insertIndex = waitingForUserIndex !== -1 ? waitingForUserIndex + 1 : defaultOptions.length;
  
  // Insert custom statuses after "Waiting for User"
  const result = [...defaultOptions];
  if (insertIndex >= 0 && insertIndex <= result.length) {
    result.splice(insertIndex, 0, ...customOptions);
  } else {
    result.push(...customOptions);
  }
  
  // Return with "All statuses" at the top
  return [allStatusesOption, ...result];
};

// Helper function to sort priorities with "All priorities" at the top
const sortPriorityOptions = (priorities: { value: string; label: string }[]): { value: string; label: string }[] => {
  // Define the desired order for default priorities (excluding "All priorities")
  const priorityOrder = ['Low', 'Medium', 'High', 'Urgent'];
  
  // Separate "All priorities" from the rest
  const allPrioritiesOption = priorities.find(opt => opt.value === '') || { value: '', label: 'All priorities' };
  const otherOptions = priorities.filter(opt => opt.value !== '');
  
  // Separate into default priorities and custom priorities
  const defaultOptions: { value: string; label: string }[] = [];
  const customOptions: { value: string; label: string }[] = [];
  
  otherOptions.forEach(opt => {
    if (priorityOrder.includes(opt.label)) {
      defaultOptions.push(opt);
    } else {
      customOptions.push(opt);
    }
  });
  
  // Sort default priorities according to the specified order
  defaultOptions.sort((a, b) => priorityOrder.indexOf(a.label) - priorityOrder.indexOf(b.label));
  
  // Sort custom priorities alphabetically by label
  customOptions.sort((a, b) => a.label.localeCompare(b.label));
  
  // Return default priorities first, then custom priorities, with "All priorities" at the top
  return [allPrioritiesOption, ...defaultOptions, ...customOptions];
};

// Helper function to sort branches with "All branches" at the top
const sortBranchOptions = (branches: { acronym: string; name: string }[]): { acronym: string; name: string }[] => {
  // Sort branches alphabetically by name
  return [...branches].sort((a, b) => a.name.localeCompare(b.name));
};

export default function TicketsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ status: '', priority: '', branch: '' })
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'All statuses' }
  ])
  // NEW: State for dynamic priority options
  const [priorityOptions, setPriorityOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'All priorities' }
  ])
  // Sorted branches
  const [sortedBranches, setSortedBranches] = useState<{ acronym: string; name: string }[]>([])
  const [exporting, setExporting] = useState(false)

  // Refs for polling
  const maintenancePollingRef = useRef<NodeJS.Timeout>()
  const isMaintenancePollingRef = useRef<boolean>(false)

  // Function to refresh status options only (lighter weight)
  const refreshStatusOptions = useCallback(async () => {
    try {
      const statuses = await getTicketStatuses()
      const statusOpts = [
        { value: '', label: 'All statuses' },
        ...(Array.isArray(statuses) ? statuses.map(status => ({
          value: status.toLowerCase().replace(/\s+/g, '_'),
          label: status
        })) : [])
      ]
      // Sort status options
      const sortedStatusOpts = sortStatusOptions(statusOpts);
      setStatusOptions(sortedStatusOpts)
    } catch (error) {
      console.debug('Background status options refresh failed:', error)
    }
  }, [])

  // Function to refresh priority options only (lighter weight)
  const refreshPriorityOptions = useCallback(async () => {
    try {
      const priorities = await getPriorities()
      const priorityOpts = [
        { value: '', label: 'All priorities' },
        ...(Array.isArray(priorities) ? priorities.map(priority => ({
          value: priority.toLowerCase(),
          label: priority
        })) : [])
      ]
      // Sort priority options
      const sortedPriorityOpts = sortPriorityOptions(priorityOpts);
      setPriorityOptions(sortedPriorityOpts)
    } catch (error) {
      console.debug('Background priority options refresh failed:', error)
    }
  }, [])

  // Function to refresh all maintenance data (lighter weight combined)
  const refreshAllMaintenanceData = useCallback(async () => {
    try {
      const [statuses, priorities] = await Promise.all([
        getTicketStatuses(),
        getPriorities()
      ])
      
      // Update status options
      const statusOpts = [
        { value: '', label: 'All statuses' },
        ...(Array.isArray(statuses) ? statuses.map(status => ({
          value: status.toLowerCase().replace(/\s+/g, '_'),
          label: status
        })) : [])
      ]
      const sortedStatusOpts = sortStatusOptions(statusOpts);
      setStatusOptions(sortedStatusOpts)

      // Update priority options
      const priorityOpts = [
        { value: '', label: 'All priorities' },
        ...(Array.isArray(priorities) ? priorities.map(priority => ({
          value: priority.toLowerCase(),
          label: priority
        })) : [])
      ]
      const sortedPriorityOpts = sortPriorityOptions(priorityOpts);
      setPriorityOptions(sortedPriorityOpts)

      // Sort branches (static, but keep for consistency)
      const sorted = sortBranchOptions(REAL_BRANCHES);
      setSortedBranches(sorted);
    } catch (error) {
      console.debug('Background maintenance data refresh failed:', error)
    }
  }, [])

  // Load dynamic status options from maintenance (async)
  const loadMaintenanceData = useCallback(async () => {
    try {
      const statuses = await getTicketStatuses()
      const statusOpts = [
        { value: '', label: 'All statuses' },
        ...(Array.isArray(statuses) ? statuses.map(status => ({
          value: status.toLowerCase().replace(/\s+/g, '_'),
          label: status
        })) : [])
      ]
      // Sort status options
      const sortedStatusOpts = sortStatusOptions(statusOpts);
      setStatusOptions(sortedStatusOpts)

      // Load dynamic priority options from maintenance
      const priorities = await getPriorities()
      const priorityOpts = [
        { value: '', label: 'All priorities' },
        ...(Array.isArray(priorities) ? priorities.map(priority => ({
          value: priority.toLowerCase(),
          label: priority
        })) : [])
      ]
      // Sort priority options
      const sortedPriorityOpts = sortPriorityOptions(priorityOpts);
      setPriorityOptions(sortedPriorityOpts)

      // Sort branches
      const sorted = sortBranchOptions(REAL_BRANCHES);
      setSortedBranches(sorted);
    } catch (error) {
      console.error('Error loading maintenance data:', error)
      // Set default options on error
      setStatusOptions([{ value: '', label: 'All statuses' }])
      setPriorityOptions([{ value: '', label: 'All priorities' }])
      setSortedBranches(sortBranchOptions(REAL_BRANCHES));
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
    
    loadMaintenanceData()
    
    // Listen for maintenance data changes from the maintenance modal
    const handleMaintenanceDataChange = () => {
      loadMaintenanceData()
    }
    window.addEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
    
    return () => {
      window.removeEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
    }
  }, [loadMaintenanceData])

  // Start polling for maintenance data updates every 10 seconds
  useEffect(() => {
    if (!mounted || !user) return

    // Clear any existing interval
    if (maintenancePollingRef.current) {
      clearInterval(maintenancePollingRef.current)
    }

    // Start polling for maintenance data updates every 10 seconds
    maintenancePollingRef.current = setInterval(() => {
      if (!isMaintenancePollingRef.current) {
        isMaintenancePollingRef.current = true
        refreshAllMaintenanceData().finally(() => {
          isMaintenancePollingRef.current = false
        })
      }
    }, 5000)

    // Cleanup on unmount
    return () => {
      if (maintenancePollingRef.current) {
        clearInterval(maintenancePollingRef.current)
        maintenancePollingRef.current = undefined
      }
    }
  }, [mounted, user, refreshAllMaintenanceData])

  // Force an immediate refresh when the component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAllMaintenanceData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshAllMaintenanceData])

  const fetchTickets = useCallback(async (showLoading = true) => {
    if (!user) return
    try {
      if (showLoading) {
        setLoading(true)
      }
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.branch) params.append('branch_acronym', filters.branch)
      const response = await api.get(`/tickets?${params.toString()}`)
      const list = Array.isArray(response.data) ? response.data : []
      
      // Normalize the status and priority values to match the filter format
      const normalizedList = list.map((ticket: any) => ({
        ...ticket,
        // Ensure status is in the same format as filter values (lowercase with underscores)
        status: ticket.status ? ticket.status.toLowerCase().replace(/\s+/g, '_') : 'new',
        // Ensure priority is in the same format as filter values (lowercase)
        priority: ticket.priority ? ticket.priority.toLowerCase() : 'medium',
        // Category and affected system are passed through as-is (may be undefined)
        category: ticket.category,
        affectedSystem: ticket.affectedSystem || ticket.affected_system,
      }))
      
      setTickets(normalizedList.sort((a, b) => 
        new Date((b as Ticket).createdAt || 0).getTime() - new Date((a as Ticket).createdAt || 0).getTime()
      ))
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [user, filters.status, filters.priority, filters.branch])

  // Initial load - shows loading spinner
  useEffect(() => {
    if (!mounted) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchTickets(true)
  }, [user, router, mounted, fetchTickets])

  // Background updates - NO LOADING STATE
  useEffect(() => {
    if (!mounted || !user) return
    
    const interval = setInterval(() => {
      fetchTickets(false) // Silent background update - no loading state
    }, 30000) // Poll every 30 seconds
    
    return () => clearInterval(interval)
  }, [mounted, user, fetchTickets])

  // When filters change, fetch with loading state
  useEffect(() => {
    if (!mounted || !user || loading) return
    fetchTickets(true) // Show loading when filters change
  }, [filters])

  // Handle click on converted incident link - REDIRECTS TO TICKET PAGE
  const handleIncidentLinkClick = (e: React.MouseEvent, ticketId: number) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/tickets/${ticketId}`)
  }

  // Keyword search: split query into words, match any ticket field (case-insensitive)
  const keywords = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredTickets = keywords.length === 0
    ? tickets
    : tickets.filter((t) => {
        const searchText = [
          t.ticketNumber,
          t.title,
          t.requestType,
          t.status,
          t.priority,
          t.createdByName,
          t.assignedToName,
          t.convertedIncidentNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return keywords.every((kw) => searchText.includes(kw))
      })

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const paginatedTickets = filteredTickets.slice(start, start + PAGE_SIZE)

  // Clamp page when list shrinks (e.g. after filter/search)
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [filteredTickets.length, totalPages, page])

  // UPDATED: Only converted_to_incident has red color, others are gray
  const getStatusColor = (status: string) => {
    // Only converted_to_incident gets special coloring
    if (status === 'converted_to_incident') {
      return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
    }
    
    // All other statuses are gray
    return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };
  }

  // Helper function to get display label for status
  const getStatusLabel = (status: string) => {
    if (status === 'converted_to_incident') return 'Converted to Incident'
    // Try to find a matching label in status options
    const matchingOption = statusOptions.find(opt => opt.value === status)
    if (matchingOption) return matchingOption.label
    return status ? status.replace(/_/g, ' ') : 'new'
  }

  // NEW: Helper function to get display label for priority
  const getPriorityLabel = (priority: string) => {
    // Try to find a matching label in priority options
    const matchingOption = priorityOptions.find(opt => opt.value === priority)
    if (matchingOption) return matchingOption.label
    return priority ? priority : 'medium'
  }

  // Priority now uses consistent gray styling (no colors)
  const getPriorityColor = (priority: string) => {
    // All priorities use the same gray styling
    return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };
  }

  const isSLABreached = (slaDue: string | undefined) => {
    if (!slaDue) return false
    return new Date(slaDue) < new Date()
  }

  // Export current filtered + searched list (CSV or PDF)
  const csvEscape = (val: unknown) => {
    if (val == null) return ''
    const s = String(val)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const handleExportTicketsCSV = () => {
    const headers = ['Ticket #', 'Type', 'Title', 'Status', 'Priority', 'Created By', 'Assigned To', 'Created', 'SLA Due']
    const rows = filteredTickets.map((t) => [
      t.ticketNumber || `#${t.id}`,
      (t.requestType || '').replace(/_/g, ' '),
      t.title || '',
      getStatusLabel(t.status || 'new'),
      getPriorityLabel(t.priority || 'medium'),
      t.createdByName || '',
      t.assignedToName || '',
      t.createdAt ? new Date(t.createdAt).toISOString() : '',
      t.slaDue ? new Date(t.slaDue).toISOString() : '',
    ])
    const csv = ['\uFEFF' + headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

 const handleExportTicketsPDF = async () => {
  setExporting(true)
  try {
    const [jsPDFModule, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const jsPDF = jsPDFModule.default
    const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) // Changed to portrait

    // Prepare table data - removed SLA column
    const tableData = filteredTickets.map((t) => [
      t.ticketNumber || `#${t.id}`,
      (t.requestType || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      (t.title || '').slice(0, 25), // Reduced character limit for portrait
      t.category || '—',
      t.affectedSystem || '—',
      getStatusLabel(t.status || 'new'),
      getPriorityLabel(t.priority || 'medium'),
      t.createdByName || '—',
      t.assignedToName || '—',
      t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—',
    ])

    // Logo handling - exactly like audit logs
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
    
    // Header - exactly like audit logs
    doc.setFontSize(16)
    doc.text('Tickets Export (Full Report)', logoEndX, startY)
    
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString('en-PH', { 
      timeZone: 'Asia/Manila',
      dateStyle: 'full',
      timeStyle: 'short'
    })} (PH time) | Total tickets: ${filteredTickets.length}`, logoEndX, startY + 7)
    
    // Add filter information if any filters are applied
    const filterParts = []
    if (filters.status) filterParts.push(`Status: ${statusOptions.find(o => o.value === filters.status)?.label || filters.status}`)
    if (filters.priority) filterParts.push(`Priority: ${priorityOptions.find(o => o.value === filters.priority)?.label || filters.priority}`)
    if (filters.branch) filterParts.push(`Branch: ${sortedBranches.find(b => b.acronym === filters.branch)?.name || filters.branch}`)
    if (searchQuery.trim()) filterParts.push(`Search: "${searchQuery.trim()}"`)
    
    if (filterParts.length > 0) {
      doc.text(`Filters: ${filterParts.join(' • ')}`, logoEndX, startY + 14)
    }
    
    const tableStartY = startY + (filterParts.length > 0 ? 20 : 18)
    
    // Generate table without SLA column
    autoTable(doc, {
      head: [['Ticket #', 'Type', 'Title', 'Category', 'System', 'Status', 'Priority', 'Created By', 'Assigned To', 'Created']],
      body: tableData,
      startY: tableStartY,
      styles: { 
        fontSize: 7,
        cellPadding: 1.5,
      },
      headStyles: { 
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 18 }, // Ticket #
        1: { cellWidth: 16 }, // Type
        2: { cellWidth: 30 }, // Title
        3: { cellWidth: 16 }, // Category
        4: { cellWidth: 18 }, // Affected System
        5: { cellWidth: 16 }, // Status
        6: { cellWidth: 15 }, // Priority
        7: { cellWidth: 18 }, // Created By
        8: { cellWidth: 18 }, // Assigned To
        9: { cellWidth: 16 }, // Created
      },
      margin: { left: 14, right: 14 },
    })

    // Add footer with page numbers after table generation
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }
    doc.save(`tickets-export-${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (e) {
    console.error('PDF export failed:', e)
    alert('Failed to generate PDF.')
  } finally {
    setExporting(false)
  }
}

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['user', 'it_support', 'admin']}>
        <div className="panel-page flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['user', 'it_support', 'admin']}>
      <div className="panel-page">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">IT Support Tickets</h1>
              <button
                type="button"
                onClick={() => fetchTickets(true)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                title="Refresh list"
              >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            {user?.role === 'user' && (
              <Link href="/tickets/create" className="btn-primary-tickets shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Ticket
              </Link>
            )}
          </div>

          {/* Filters - same style as incidents */}
          <div className="panel-card border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Filter tickets</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                <Listbox value={filters.status} onChange={(value) => { setFilters((f) => ({ ...f, status: value })); setPage(1) }}>
                  <div className="relative">
                    <Listbox.Button className="relative w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white text-gray-900 rounded-xl border border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium text-left">
                      <span>{statusOptions.find((o) => o.value === filters.status)?.label ?? 'All statuses'}</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Listbox.Button>
                    <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                      <Listbox.Options className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto">
                        {statusOptions.map((opt) => (
                          <Listbox.Option key={opt.value || 'all'} value={opt.value} className={({ active }) => `cursor-pointer py-2.5 px-4 ${active ? 'bg-gray-50' : ''}`}>
                            {opt.label}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Priority</label>
                <Listbox value={filters.priority} onChange={(value) => { setFilters((f) => ({ ...f, priority: value })); setPage(1) }}>
                  <div className="relative">
                    <Listbox.Button className="relative w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white text-gray-900 rounded-xl border border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium text-left">
                      <span>{priorityOptions.find((o) => o.value === filters.priority)?.label ?? 'All priorities'}</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Listbox.Button>
                    <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                      <Listbox.Options className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto">
                        {priorityOptions.map((opt) => (
                          <Listbox.Option key={opt.value || 'all'} value={opt.value} className={({ active }) => `cursor-pointer py-2.5 px-4 ${active ? 'bg-gray-50' : ''}`}>
                            {opt.label}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Branch</label>
                <Listbox value={filters.branch} onChange={(value) => { setFilters((f) => ({ ...f, branch: value })); setPage(1) }}>
                  <div className="relative">
                    <Listbox.Button className="relative w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white text-gray-900 rounded-xl border border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium text-left">
                      <span>{filters.branch ? sortedBranches.find((b) => b.acronym === filters.branch)?.name ?? filters.branch : 'All branches'}</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Listbox.Button>
                    <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                      <Listbox.Options className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto">
                        <Listbox.Option value="" className={({ active }) => `cursor-pointer py-2.5 px-4 ${active ? 'bg-gray-50' : ''}`}>All branches</Listbox.Option>
                        {sortedBranches.map((b) => (
                          <Listbox.Option key={b.acronym} value={b.acronym} className={({ active }) => `cursor-pointer py-2.5 px-4 ${active ? 'bg-gray-50' : ''}`}>
                            {b.name}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
            </div>
            {hasRole(user, 'it_support', 'admin') && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-gray-500">Export current view (filters + search):</span>
                <button
                  type="button"
                  onClick={handleExportTicketsCSV}
                  disabled={exporting || filteredTickets.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {exporting ? null : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  )}
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportTicketsPDF}
                  disabled={exporting || filteredTickets.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {exporting ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-200 border-t-blue-600" /> : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  )}
                  Export PDF
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="panel-card border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
              <p>Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="panel-card border border-gray-200 text-center py-12 text-gray-500">No tickets found</div>
          ) : (
            <>
              {/* Table Card with Integrated Search */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Search Bar - Integrated into table card header */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="search"
                        placeholder="Search tickets by #, title, type, status, priority, assignee, created by..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                      />
                    </div>
                    {searchQuery.trim() && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          {filteredTickets.length} result{filteredTickets.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setPage(1);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-auto max-h-[calc(100vh-20rem)] min-h-[220px]">
                  {filteredTickets.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No tickets match your search. Try different keywords.
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ticket #</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Affected System</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created By</th>
                          {hasRole(user, 'it_support', 'admin') && (
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned To</th>
                          )}
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SLA</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedTickets.map((ticket) => {
                          const statusColors = getStatusColor(ticket.status || 'new');
                          const priorityColors = getPriorityColor(ticket.priority || 'medium');
                          
                          return (
                            <tr key={ticket.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Link href={`/tickets/${ticket.id}`} className="font-mono text-blue-600 hover:text-blue-700 font-medium transition-colors">
                                  {ticket.ticketNumber || `#${ticket.id}`}
                                </Link>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {ticket.requestType
                                  ? (ticket.requestType).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                                  : 'N/A'}
                              </td>
                              <td className="px-6 py-4">
                                <Link href={`/tickets/${ticket.id}`} className="text-gray-900 hover:text-blue-600 transition-colors line-clamp-2">
                                  {ticket.title || 'Untitled'}
                                </Link>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {ticket.category || '—'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {ticket.affectedSystem || '—'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                                    {ticket.status === 'converted_to_incident' ? (
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                                    ) : null}
                                    {getStatusLabel(ticket.status || 'new')}
                                  </span>
                                  {ticket.status === 'converted_to_incident' && ticket.convertedIncidentId && (
                                    <button
                                      onClick={(e) => {
                                        if (ticket.convertedIncidentId) {
                                          handleIncidentLinkClick(e, ticket.id);
                                        }
                                      }}
                                      className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline inline-flex items-center gap-0.5"
                                      title={`View ticket ${ticket.ticketNumber || ''}`}
                                    >
                                      → {ticket.convertedIncidentNumber || 'INC-' + ticket.convertedIncidentId.substring(0, 8)}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${priorityColors.bg} ${priorityColors.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${priorityColors.dot}`} />
                                  {getPriorityLabel(ticket.priority || 'medium')}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {ticket.createdByName || <span className="text-gray-400">Unknown</span>}
                              </td>
                              {hasRole(user, 'it_support', 'admin') && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {ticket.assignedToName || <span className="text-gray-400">Unassigned</span>}
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatPinoyDateTime(ticket.createdAt) || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {ticket.slaDue ? (
                                  <span className={`text-xs font-medium ${isSLABreached(ticket.slaDue) ? 'text-red-600' : 'text-gray-600'}`}>
                                    {isSLABreached(ticket.slaDue)
                                      ? '⚠ Breached'
                                      : formatPinoyDateTime(ticket.slaDue)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {filteredTickets.length > 0 && (
                  <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-3">
                    <p className="text-sm text-gray-600">
                      Showing {start + 1}–{Math.min(start + PAGE_SIZE, filteredTickets.length)} of {filteredTickets.length} tickets
                      {searchQuery.trim() ? ` (filtered from ${tickets.length})` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setPage((p) => Math.max(1, p - 1))} 
                        disabled={page <= 1} 
                        className="btn-pagination"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
                      <button 
                        type="button" 
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                        disabled={page >= totalPages} 
                        className="btn-pagination"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}