'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'
import { formatActionLabel, getActionIcon, timeAgo } from '@/lib/activity'
import type { ActivityItem } from '@/lib/activity'

// Add Attachment type
type Attachment = {
  id: string
  record_type: 'ticket' | 'incident'
  record_id: string
  filename: string
  original_name: string
  mime_type: string | null
  size: number | null
  file_path: string
  uploaded_by: string
  uploader_name: string
  created_at: string
  reference_number: string | null
  title: string | null
  parent_display: string
}

type ActivityCategory = 'attachments' | 'ticket_actions' | 'comments'

function getActivityCategory(action: string): ActivityCategory {
  if (action === 'UPLOAD_ATTACHMENT' || action === 'DELETE_ATTACHMENT') return 'attachments'
  if (action === 'ADD_COMMENT' || action === 'USER_COMMENT' || action === 'STAFF_COMMENT' || action === 'TICKET_COMMENT') return 'comments'
  // Ticket/incident actions (from notifications or audit)
  if (action === 'CREATE_TICKET' || action === 'UPDATE_TICKET' || action === 'TICKET_UPDATED' || action === 'NEW_TICKET_CREATED' ||
      action === 'TICKET_ASSIGNED' || action === 'DELETE_TICKET' || action === 'CONVERT_TICKET' || action === 'TICKET_CONVERTED_TO_INCIDENT' ||
      action === 'CREATE_INCIDENT' || action === 'NEW_INCIDENT_CREATED' || action === 'UPDATE_INCIDENT' || action === 'INCIDENT_UPDATED' || action === 'INCIDENT_ASSIGNED' || action === 'INCIDENT_TIMELINE_UPDATE') return 'ticket_actions'
  return 'ticket_actions'
}

function ActivityColumn({
  title,
  icon,
  items,
  formatLabel,
  getIcon,
  onItemClick,
  clickedCommentIds,
}: {
  title: string
  icon: React.ReactNode
  items: ActivityItem[]
  formatLabel: (item: ActivityItem) => { label: string; href: string | null }
  getIcon: (action: string) => React.ReactNode
  onItemClick?: (item: ActivityItem, href: string) => void
  clickedCommentIds?: Set<string>
}) {
  const isComment = (a: string) => ['ADD_COMMENT', 'USER_COMMENT', 'STAFF_COMMENT', 'TICKET_COMMENT'].includes(a)
  return (
    <div className="panel-card flex flex-col h-full min-h-[200px]">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-100 text-sky-600">{icon}</span>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 flex-1">No activity</p>
      ) : (
        <ul
          className={`space-y-2 flex-1 min-h-0 ${items.length >= 6 ? 'max-h-[320px] overflow-y-auto' : ''}`}
        >
          {items.map((item) => {
            const { label, href } = formatLabel(item)
            const commentClicked = isComment(item.action) && clickedCommentIds?.has(item.id)
            // Only comments should be clickable, not ticket actions
            const canClick = isComment(item.action) && href && !commentClicked
            
            return (
              <li
                key={item.id}
                className={`flex items-start gap-2 py-2 border-b border-gray-100 last:border-0 ${canClick ? 'cursor-pointer hover:bg-sky-50/50 rounded-lg -mx-1 px-1' : ''}`}
                onClick={() => {
                  if (canClick && href && onItemClick) {
                    onItemClick(item, href)
                  }
                }}
                onKeyDown={(e) => {
                  if (canClick && href && onItemClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onItemClick(item, href)
                  }
                }}
                role={canClick ? 'button' : undefined}
                tabIndex={canClick ? 0 : undefined}
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex-shrink-0 mt-0.5">
                  {getIcon(item.action)}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900 line-clamp-2 block">
                    {label}
                  </span>
                  {typeof item.details === 'object' && item.details !== null && (item.details as Record<string, unknown>)?.message != null && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{String((item.details as Record<string, unknown>).message)}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">{timeAgo(item.createdAt)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Component for displaying attachments - REMOVED ICONS
function AttachmentsColumn({
  attachments,
  loading,
  onAttachmentClick,
}: {
  attachments: Attachment[]
  loading: boolean
  onAttachmentClick: (attachment: Attachment) => void
}) {
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="panel-card flex flex-col h-full min-h-[200px]">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </span>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Recent Attachments</h3>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-gray-500 flex-1">No attachments yet</p>
      ) : (
        <ul className="space-y-2 flex-1 min-h-0 max-h-[320px] overflow-y-auto">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <button
                type="button"
                onClick={() => onAttachmentClick(attachment)}
                className="w-full flex items-start gap-2 py-2 border-b border-gray-100 last:border-0 text-left cursor-pointer hover:bg-emerald-50/50 rounded-lg -mx-1 px-1 transition-colors"
              >
                {/* REMOVED THE ICON SPAN COMPLETELY */}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900 hover:text-emerald-600 transition-colors line-clamp-1 block">
                    {attachment.original_name}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="truncate max-w-[150px]">
                      {attachment.record_type === 'ticket' ? '🎫' : '⚠️'} {attachment.parent_display}
                    </span>
                    {attachment.size && attachment.size > 0 && (
                      <span className="flex-shrink-0">• {formatFileSize(attachment.size)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Uploaded {timeAgo(attachment.created_at)} by {attachment.uploader_name}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    tickets: 0,
    incidents: 0,
    openTickets: 0,
    resolvedTickets: 0,
    // Security Officer specific stats
    assignedIncidents: 0,
    openIncidents: 0,
    resolvedIncidents: 0,
  })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [clickedCommentIds, setClickedCommentIds] = useState<Set<string>>(new Set())
  const [recentIncidents, setRecentIncidents] = useState<{ id: string; incident_number: string; title: string; status: string }[]>([])
  const [topCategories, setTopCategories] = useState<{ category: string; count: number }[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [incidentsLoading, setIncidentsLoading] = useState(false)
  
  // Use refs to track state
  const isMounted = useRef(true)
  const pollingIntervalRef = useRef<NodeJS.Timeout>()
  const lastFetchRef = useRef<number>(Date.now())
  const initialFetchDone = useRef(false)
  
  const isAdmin = hasRole(user, 'admin')
  const isSecurityOfficer = hasRole(user, 'security_officer')
  const isITSupport = hasRole(user, 'it_support')
  const isAdminOrSO = isAdmin || isSecurityOfficer

  const handleActivityClick = useCallback((item: ActivityItem, href: string) => {
    const isComment = ['ADD_COMMENT', 'USER_COMMENT', 'STAFF_COMMENT', 'TICKET_COMMENT'].includes(item.action)
    if (isComment) {
      setClickedCommentIds((prev) => new Set(prev).add(item.id))
    }
    router.push(href)
  }, [router])

  const handleAttachmentClick = useCallback((attachment: Attachment) => {
    // Navigate to the ticket or incident that owns this attachment
    if (attachment.record_type === 'ticket') {
      router.push(`/tickets/${attachment.record_id}`)
    } else {
      router.push(`/incidents/${attachment.record_id}`)
    }
  }, [router])

  useEffect(() => {
    setMounted(true)
    isMounted.current = true
    const currentUser = getStoredUser()
    setUser(currentUser)
    
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }

    // Silent fetch stats in the background - no loading state
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats')
        if (isMounted.current) {
          console.log('Dashboard stats received:', response.data)
          setStats(response.data)
        }
      } catch (error: any) {
        console.error('Failed to fetch stats:', error)
      }
    }
    
    // Only fetch if not done yet
    if (!initialFetchDone.current) {
      fetchStats()
      initialFetchDone.current = true
    }

    // Silent background polling every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [user, router, mounted])

  const fetchActivity = useCallback(async () => {
    if (!user || !isMounted.current) return
    try {
      const res = await api.get('/dashboard/activity?limit=25')
      if (isMounted.current) {
        setActivity(res.data?.activity ?? [])
      }
    } catch (e) {
      console.error('Failed to fetch activity:', e)
      if (isMounted.current) {
        setActivity([])
      }
    } finally {
      if (isMounted.current) {
        setActivityLoading(false)
      }
    }
  }, [user])

  // Fetch attachments
  const fetchAttachments = useCallback(async () => {
    if (!user || !isMounted.current) return
    try {
      const res = await api.get('/attachments/recent?limit=20')
      if (isMounted.current) {
        setAttachments(res.data?.attachments ?? [])
      }
    } catch (e) {
      console.error('Failed to fetch attachments:', e)
      if (isMounted.current) {
        setAttachments([])
      }
    }
  }, [user])

  // Initial data fetch
  useEffect(() => {
    if (!mounted || !user) return
    
    setActivityLoading(true)
    setAttachmentsLoading(true)
    
    Promise.all([fetchActivity(), fetchAttachments()]).finally(() => {
      if (isMounted.current) {
        setActivityLoading(false)
        setAttachmentsLoading(false)
        lastFetchRef.current = Date.now()
      }
    })
  }, [user, mounted, fetchActivity, fetchAttachments])

  // Silent background polling - NO LOADING STATES
  useEffect(() => {
    if (!mounted || !user) return
    
    const pollData = async () => {
      if (!isMounted.current) return
      
      // Silent fetch in background - don't show loading
      try {
        await Promise.all([fetchActivity(), fetchAttachments()])
        lastFetchRef.current = Date.now()
      } catch (error) {
        console.error('Background polling error:', error)
      }
    }
    
    // Poll every 30 seconds silently
    pollingIntervalRef.current = setInterval(pollData, 30000)
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [mounted, user, fetchActivity, fetchAttachments])

  // Visibility change - SILENT FETCH, NO RELOAD
  useEffect(() => {
    if (!mounted || !user) return
    
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted.current) {
        const timeSinceLastFetch = Date.now() - lastFetchRef.current
        // Only fetch if it's been more than 10 seconds since last fetch
        if (timeSinceLastFetch > 10000) {
          // Silent background fetch - no loading states
          Promise.all([fetchActivity(), fetchAttachments()])
            .then(() => {
              lastFetchRef.current = Date.now()
            })
            .catch(console.error)
        }
      }
    }
    
    window.addEventListener('visibilitychange', onVisibilityChange)
    return () => window.removeEventListener('visibilitychange', onVisibilityChange)
  }, [mounted, user, fetchActivity, fetchAttachments])

  const fetchRecentIncidents = useCallback(async () => {
    if (!user || !hasRole(user, 'admin', 'security_officer') || !isMounted.current) return
    setIncidentsLoading(true)
    try {
      const res = await api.get('/incidents')
      const list = Array.isArray(res.data) ? res.data : []
      if (isMounted.current) {
        setRecentIncidents(
          list.slice(0, 8).map((inc: { id: string; incident_number?: string; incidentNumber?: string; title?: string; status?: string }) => ({
            id: inc.id,
            incident_number: inc.incident_number || inc.incidentNumber || '',
            title: inc.title || 'Incident',
            status: inc.status || 'new',
          }))
        )
        const categoryCounts: Record<string, number> = {}
        list.forEach((inc: { category?: string }) => {
          const cat = inc.category || 'Uncategorized'
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
        })
        const top = Object.entries(categoryCounts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
        setTopCategories(top)
      }
    } catch {
      if (isMounted.current) {
        setRecentIncidents([])
        setTopCategories([])
      }
    } finally {
      if (isMounted.current) {
        setIncidentsLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    if (!mounted || !user || !isAdminOrSO) return
    fetchRecentIncidents()
  }, [mounted, user, isAdminOrSO, fetchRecentIncidents])

  if (!mounted || !user) {
    return (
      <ProtectedRoute>
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
    <ProtectedRoute>
      <div className="panel-page">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <span className="text-sm text-gray-500">Today</span>
        </div>

        {/* Stat cards with icons and subtitles - NO LOADING STATE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isAdmin ? (
            // Admin sees all stats
            <>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Total Tickets</h3>
                <p className="panel-card-value">{stats.tickets}</p>
                <p className="text-sm text-gray-500 mt-1">All time tickets</p>
              </div>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Incidents</h3>
                <p className="panel-card-value">{stats.incidents}</p>
                <p className="text-sm text-gray-500 mt-1">Security incidents</p>
              </div>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Open Tickets</h3>
                <p className="panel-card-value">{stats.openTickets}</p>
                <p className="text-sm text-gray-500 mt-1">Awaiting resolution</p>
              </div>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Resolved & Recovered</h3>
                <p className="panel-card-value">{stats.resolvedTickets}</p>
                <p className="text-sm text-gray-500 mt-1">Resolved tickets & incidents</p>
              </div>
            </>
          ) : isSecurityOfficer ? (
            // Security Officer sees incident-specific stats - 3 cards only, no Total Tickets
            <>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 text-purple-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Assigned to me</h3>
                <p className="panel-card-value">{stats.assignedIncidents || 0}</p>
                <p className="text-sm text-gray-500 mt-1">All incidents assigned to you</p>
              </div>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Open Incidents</h3>
                <p className="panel-card-value">{stats.openIncidents || 0}</p>
                <p className="text-sm text-gray-500 mt-1">Active investigations assigned to you</p>
              </div>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Resolved & Recovered</h3>
                <p className="panel-card-value">{stats.resolvedIncidents || 0}</p>
                <p className="text-sm text-gray-500 mt-1">Recovered & closed incidents</p>
              </div>
            </>
          ) : (
            // Regular user or IT Support sees their stats
            <>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">My Tickets</h3>
                <p className="panel-card-value">{stats.tickets}</p>
                <p className="text-sm text-gray-500 mt-1">Total tickets created</p>
              </div>
              {/* Only show My Incidents for regular users, not IT Support */}
              {!isITSupport && (
                <div className="panel-card relative">
                  <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="panel-card-title uppercase tracking-wide">My Incidents</h3>
                  <p className="panel-card-value">{stats.incidents}</p>
                  <p className="text-sm text-gray-500 mt-1">Security incidents from your tickets</p>
                </div>
              )}
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Open Tickets</h3>
                <p className="panel-card-value">{stats.openTickets}</p>
                <p className="text-sm text-gray-500 mt-1">Awaiting resolution</p>
              </div>
              <div className="panel-card relative">
                <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="panel-card-title uppercase tracking-wide">Resolved & Recovered</h3>
                <p className="panel-card-value">{stats.resolvedTickets}</p>
                <p className="text-sm text-gray-500 mt-1">Resolved tickets & incidents</p>
              </div>
            </>
          )}
        </div>

        {/* Recent Activity - 3 columns with Attachments */}
        <div>
          <h2 className="panel-section-title mb-4">Recent Activity</h2>
          {activityLoading ? (
            <div className="panel-card flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-600 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {isAdminOrSO ? (
                <>
                  <ActivityColumn
                    title="Ticket actions"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    }
                    items={activity.filter((a) => getActivityCategory(a.action) === 'ticket_actions')}
                    formatLabel={formatActionLabel}
                    getIcon={getActionIcon}
                    onItemClick={handleActivityClick}
                    clickedCommentIds={clickedCommentIds}
                  />
                  <div className="panel-card flex flex-col h-full min-h-[200px]">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Recent Incidents</h3>
                    </div>
                    {incidentsLoading ? (
                      <div className="flex-1 flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-500 border-t-transparent" />
                      </div>
                    ) : recentIncidents.length === 0 ? (
                      <p className="text-sm text-gray-500 flex-1">No incidents</p>
                    ) : (
                      <ul className="space-y-2 flex-1 min-h-0 max-h-[320px] overflow-y-auto">
                        {recentIncidents.map((inc) => (
                          <li key={inc.id}>
                            <button
                              type="button"
                              onClick={() => router.push(`/incidents/${inc.id}`)}
                              className="w-full flex items-start gap-2 py-2 border-b border-gray-100 last:border-0 text-left cursor-pointer hover:bg-amber-50/50 rounded-lg -mx-1 px-1 transition-colors"
                            >
                              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-gray-900 hover:text-amber-600 transition-colors line-clamp-2 block">
                                  {inc.incident_number} — {inc.title}
                                </span>
                                <p className="text-xs text-gray-500 mt-0.5 capitalize">{inc.status.replace(/_/g, ' ')}</p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="panel-card flex flex-col h-full min-h-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Top categories</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Displaying the categories of many kinds of incidents</p>
                    {incidentsLoading ? (
                      <div className="flex-1 flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500 border-t-transparent" />
                      </div>
                    ) : topCategories.length === 0 ? (
                      <p className="text-sm text-gray-500 flex-1">No incident categories yet</p>
                    ) : (
                      <ul className="space-y-2 flex-1 min-h-0 max-h-[320px] overflow-y-auto">
                        {topCategories.map(({ category, count }) => (
                          <li key={category}>
                            <button
                              type="button"
                              onClick={() => router.push(`/incidents?category=${encodeURIComponent(category)}`)}
                              className="w-full flex items-center justify-between gap-2 py-2.5 px-3 border border-gray-100 rounded-xl text-left cursor-pointer hover:border-violet-200 hover:bg-violet-50/50 transition-colors"
                            >
                              <span className="text-sm font-medium text-gray-900 capitalize">{category.replace(/_/g, ' ')}</span>
                              <span className="text-sm text-gray-500 font-medium tabular-nums">{count} {count === 1 ? 'incident' : 'incidents'}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AttachmentsColumn
                    attachments={attachments}
                    loading={attachmentsLoading}
                    onAttachmentClick={handleAttachmentClick}
                  />
                  <ActivityColumn
                    title="Ticket actions"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    }
                    items={activity.filter((a) => getActivityCategory(a.action) === 'ticket_actions')}
                    formatLabel={formatActionLabel}
                    getIcon={getActionIcon}
                    onItemClick={handleActivityClick}
                    clickedCommentIds={clickedCommentIds}
                  />
                  <ActivityColumn
                    title="Comments"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    }
                    items={activity.filter((a) => getActivityCategory(a.action) === 'comments')}
                    formatLabel={formatActionLabel}
                    getIcon={getActionIcon}
                    onItemClick={handleActivityClick}
                    clickedCommentIds={clickedCommentIds}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}