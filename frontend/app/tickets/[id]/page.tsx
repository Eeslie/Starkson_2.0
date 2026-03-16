'use client'

import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Listbox, Transition } from '@headlessui/react'
import api, { getApiBaseUrl } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'
import { formatPinoyDateTime } from '@/lib/date'
import { getIncidentCategories, getSeverities, getTicketStatuses } from '@/lib/maintenance'

interface TimelineEntry {
  id: string
  action: string
  description?: string
  createdAt?: string
  created_at?: string
  userName?: string
  user?: { fullname?: string; username?: string }
  isInternal?: boolean
  is_internal?: boolean
}

interface Ticket {
  id: number
  ticket_number?: string
  ticketNumber?: string
  request_type?: string
  requestType?: string
  title: string
  description: string
  status: string
  priority: string
  category: string
  affected_system?: string
  affectedSystem?: string
  createdBy: number
  createdByName: string
  assignedTo: number | null
  assignedToName: string | null
  sla_due?: string
  slaDue?: string
  created_at?: string
  createdAt?: string
  updatedAt?: string
  comments: Comment[]
  attachments: Attachment[]
  timeline?: TimelineEntry[]
  incidentTimeline?: TimelineEntry[]
  isConverted?: boolean
  convertedIncidentId?: string | null
  convertedIncidentNumber?: string | null
}

interface Comment {
  id: number
  comment: string
  isInternal: boolean
  createdAt: string
  userId: number
}

interface Attachment {
  id: number
  originalName?: string
  original_name?: string
  mimeType?: string
  mime_type?: string
  size: number
  filePath?: string
  file_path?: string
  createdAt?: string
  created_at?: string
}

// Modern Status Select Component with dynamic options
const ModernStatusSelect = ({ 
  value, 
  onChange, 
  disabled,
  statusOptions
}: { 
  value: string; 
  onChange: (value: string) => void; 
  disabled?: boolean;
  statusOptions: { value: string; label: string }[];
}) => {
  const selectedOption = statusOptions.find(opt => opt.value === value) || { value: '', label: value?.replace(/_/g, ' ') || 'New' };

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className="relative mt-1">
        <Listbox.Button className={`
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white text-gray-900
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-md
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          transition-all duration-200 ease-in-out
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          font-medium text-left
        `}>
          <span>{selectedOption.label}</span>
          <svg
            className="w-4 h-4 text-gray-500 transition-transform duration-200 ui-open:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Listbox.Button>
        
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto focus:outline-none">
            {statusOptions.map((option) => (
              <Listbox.Option
                key={option.value}
                value={option.value}
                className={({ active }) => `
                  relative cursor-pointer select-none py-2.5 px-4
                  ${active ? 'bg-gray-50' : ''}
                  transition-colors duration-150
                `}
              >
                {({ selected }) => (
                  <div className="flex items-center justify-between">
                    <span className={`flex-1 text-sm font-medium ${
                      selected ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {option.label}
                    </span>
                    {selected && (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

export default function TicketDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertData, setConvertData] = useState({ 
    category: '', 
    severity: 'medium', 
    description: '', 
    assignedTo: '',
    otherCategory: '' // Add field for "Other" category
  })
  const [securityOfficers, setSecurityOfficers] = useState<{ id: string; fullname: string; username: string }[]>([])
  const [securityOfficersLoading, setSecurityOfficersLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [fileUploadStatus, setFileUploadStatus] = useState<Record<number, { status: 'pending' | 'uploading' | 'success' | 'error', message?: string }>>({})
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({ title: '', description: '', affectedSystem: '', priority: 'medium' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [incidentCategories, setIncidentCategories] = useState<string[]>([])
  const [severities, setSeverities] = useState<string[]>([])
  const [ticketStatuses, setTicketStatuses] = useState<{ value: string; label: string }[]>([])

  // Add refs for incident timeline polling
  const incidentTimelinePollingRef = useRef<NodeJS.Timeout>()
  const isIncidentTimelinePollingRef = useRef<boolean>(false)
  const lastIncidentTimelineIdsRef = useRef<Set<string>>(new Set())

  // Helper function to sort incident categories with "Other" at the end
  const sortIncidentCategories = (categories: string[]): string[] => {
    // Separate "Other" from the rest
    const otherIndex = categories.findIndex(c => c.toLowerCase() === 'other');
    let other = '';
    const otherCategories: string[] = [];
    
    if (otherIndex !== -1) {
      other = categories[otherIndex];
      // Get all categories except "Other"
      const rest = categories.filter((_, index) => index !== otherIndex);
      
      // Sort the rest alphabetically
      rest.sort((a, b) => a.localeCompare(b));
      
      // Return sorted categories with "Other" at the end
      return [...rest, other];
    }
    
    // If no "Other", just sort alphabetically
    return [...categories].sort((a, b) => a.localeCompare(b));
  };

  // Helper function to sort severities in the desired order
  const sortSeverities = (severities: string[]): string[] => {
    // Define the desired order for default severities
    const severityOrder = ['Low', 'Medium', 'High', 'Critical'];
    
    // Separate into default severities and custom severities
    const defaultSeverities: string[] = [];
    const customSeverities: string[] = [];
    
    severities.forEach(severity => {
      if (severityOrder.includes(severity)) {
        defaultSeverities.push(severity);
      } else {
        customSeverities.push(severity);
      }
    });
    
    // Sort default severities according to the specified order
    defaultSeverities.sort((a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b));
    
    // Sort custom severities alphabetically
    customSeverities.sort((a, b) => a.localeCompare(b));
    
    // Return default severities first, then custom severities
    return [...defaultSeverities, ...customSeverities];
  };

  // Helper function to sort ticket statuses in the desired order
  const sortTicketStatuses = (statuses: string[]): string[] => {
    // Define the desired order for default statuses
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
    
    // Separate into default statuses and custom statuses
    const defaultStatuses: string[] = [];
    const customStatuses: string[] = [];
    
    statuses.forEach(status => {
      if (statusOrder.includes(status)) {
        defaultStatuses.push(status);
      } else {
        customStatuses.push(status);
      }
    });
    
    // Sort default statuses according to the specified order
    defaultStatuses.sort((a, b) => statusOrder.indexOf(a) - statusOrder.indexOf(b));
    
    // Sort custom statuses alphabetically
    customStatuses.sort((a, b) => a.localeCompare(b));
    
    // Find the index where custom statuses should be inserted (after "Waiting for User")
    const insertIndex = defaultStatuses.findIndex(s => s === 'Waiting for User') + 1;
    
    // Insert custom statuses after "Waiting for User"
    const result = [...defaultStatuses];
    if (insertIndex >= 0 && insertIndex <= result.length) {
      result.splice(insertIndex, 0, ...customStatuses);
    } else {
      // If "Waiting for User" not found, append custom statuses at the end
      result.push(...customStatuses);
    }
    
    return result;
  };

  // Refs for polling
  const pollingIntervalRef = useRef<NodeJS.Timeout>()
  const maintenancePollingRef = useRef<NodeJS.Timeout>()
  const lastCommentIdsRef = useRef<Set<number>>(new Set())
  const lastAttachmentIdsRef = useRef<Set<number>>(new Set())
  const lastStatusRef = useRef<string>('')
  const isPollingRef = useRef<boolean>(false)
  const isMaintenancePollingRef = useRef<boolean>(false)
  const ticketIdRef = useRef<string | null>(null)

  // Function to fetch incident timeline only (for converted tickets)
  const fetchIncidentTimelineOnly = useCallback(async () => {
    if (!params.id || !ticket?.convertedIncidentId) return
    
    const incidentId = ticket.convertedIncidentId
    if (!incidentId) return
    
    try {
      console.log(`%c🔵 [${user?.role}] Fetching incident timeline for ticket...`, 'color: blue;');
      const response = await api.get(`/incidents/${incidentId}/timeline`)
      const newTimeline = response.data as TimelineEntry[]
      
      setTicket(prev => {
        if (!prev) return prev
        
        const newTimelineIds = new Set<string>(newTimeline.map((entry: TimelineEntry) => entry.id))
        
        // Check if there are new timeline entries
        const hasNewTimeline = Array.from(newTimelineIds).some(id => !lastIncidentTimelineIdsRef.current.has(id))
        
        if (hasNewTimeline) {
          console.log(`%c🔵 [${user?.role}] 🔔 NEW INCIDENT TIMELINE ENTRIES DETECTED!`, 'font-size: 14px; font-weight: bold; color: purple;');
          lastIncidentTimelineIdsRef.current = newTimelineIds
          
          return {
            ...prev,
            incidentTimeline: newTimeline
          }
        } else {
          console.log(`%c🔵 [${user?.role}] No new incident timeline entries`, 'color: gray;');
        }
        
        return prev
      })
    } catch (error) {
      console.error(`%c🔴 [${user?.role}] Incident timeline fetch FAILED:`, error, 'color: red; font-weight: bold;');
    }
  }, [params.id, ticket?.convertedIncidentId, user])

  // Start polling for incident timeline updates when ticket is converted
  useEffect(() => {
    if (!mounted || !user || !params.id || !ticket?.convertedIncidentId) return

    console.log(`%c🔵 [${user?.role}] ===== SETTING UP INCIDENT TIMELINE POLLING FOR CONVERTED TICKET =====`, 'font-size: 14px; font-weight: bold; color: blue;');
    
    // Clear any existing interval
    if (incidentTimelinePollingRef.current) {
      clearInterval(incidentTimelinePollingRef.current)
    }

    // Start polling for incident timeline updates every 2 seconds
    incidentTimelinePollingRef.current = setInterval(() => {
      if (!isIncidentTimelinePollingRef.current) {
        isIncidentTimelinePollingRef.current = true
        fetchIncidentTimelineOnly().finally(() => {
          isIncidentTimelinePollingRef.current = false
        })
      }
    }, 2000)

    // Cleanup on unmount
    return () => {
      if (incidentTimelinePollingRef.current) {
        clearInterval(incidentTimelinePollingRef.current)
        incidentTimelinePollingRef.current = undefined
      }
    }
  }, [mounted, user, params.id, ticket?.convertedIncidentId, fetchIncidentTimelineOnly])

  // Fetch all maintenance data when component mounts
  const loadMaintenanceData = useCallback(async () => {
    try {
      const [incidentCats, severities, statuses] = await Promise.all([
        getIncidentCategories(),
        getSeverities(),
        getTicketStatuses()
      ])
      
      // Sort incident categories with "Other" at the end
      const sortedIncidentCats = sortIncidentCategories(Array.isArray(incidentCats) ? incidentCats : []);
      setIncidentCategories(sortedIncidentCats)
      
      // Sort severities in the desired order
      const sortedSeverities = sortSeverities(Array.isArray(severities) ? severities : []);
      setSeverities(sortedSeverities)
      
      // Sort statuses in the desired order
      const sortedStatuses = sortTicketStatuses(Array.isArray(statuses) ? statuses : []);
      
      const formattedStatuses = sortedStatuses.map(status => ({
        value: status.toLowerCase().replace(/\s+/g, '_'),
        label: status
      }))
      setTicketStatuses(formattedStatuses)
    } catch (error) {
      console.error('Error loading maintenance data:', error)
    }
  }, [])

  // Function to refresh incident categories only (lighter weight)
  const refreshIncidentCategories = useCallback(async () => {
    try {
      const categories = await getIncidentCategories()
      const sortedCategories = sortIncidentCategories(Array.isArray(categories) ? categories : []);
      setIncidentCategories(sortedCategories)
    } catch (error) {
      console.debug('Background incident categories refresh failed:', error)
    }
  }, [])

  // Function to refresh severities only (lighter weight)
  const refreshSeverities = useCallback(async () => {
    try {
      const severities = await getSeverities()
      const sortedSeverities = sortSeverities(Array.isArray(severities) ? severities : []);
      setSeverities(sortedSeverities)
    } catch (error) {
      console.debug('Background severities refresh failed:', error)
    }
  }, [])

  // Function to refresh status options only (lighter weight)
  const refreshStatusOptions = useCallback(async () => {
    try {
      const statuses = await getTicketStatuses()
      
      // Sort statuses in the desired order
      const sortedStatuses = sortTicketStatuses(Array.isArray(statuses) ? statuses : []);
      
      const formattedStatuses = sortedStatuses.map(status => ({
        value: status.toLowerCase().replace(/\s+/g, '_'),
        label: status
      }))
      setTicketStatuses(formattedStatuses)
    } catch (error) {
      console.debug('Background status options refresh failed:', error)
    }
  }, [])

  // Function to refresh all maintenance data (lighter weight combined)
  const refreshAllMaintenanceData = useCallback(async () => {
    try {
      const [categories, severities, statuses] = await Promise.all([
        getIncidentCategories(),
        getSeverities(),
        getTicketStatuses()
      ])
      
      // Sort incident categories with "Other" at the end
      const sortedCategories = sortIncidentCategories(Array.isArray(categories) ? categories : []);
      setIncidentCategories(sortedCategories)
      
      // Sort severities in the desired order
      const sortedSeverities = sortSeverities(Array.isArray(severities) ? severities : []);
      setSeverities(sortedSeverities)
      
      // Sort statuses in the desired order
      const sortedStatuses = sortTicketStatuses(Array.isArray(statuses) ? statuses : []);
      
      const formattedStatuses = sortedStatuses.map(status => ({
        value: status.toLowerCase().replace(/\s+/g, '_'),
        label: status
      }))
      setTicketStatuses(formattedStatuses)
    } catch (error) {
      console.debug('Background maintenance data refresh failed:', error)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      loadMaintenanceData()
      
      // Listen for maintenance data changes from the maintenance modal
      const handleMaintenanceDataChange = () => {
        loadMaintenanceData()
      }
      window.addEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
      
      return () => {
        window.removeEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
      }
    }
  }, [mounted, loadMaintenanceData])

  // Poll for maintenance data updates (incident categories, severities, statuses)
  useEffect(() => {
    if (!mounted || !user || !params.id) return

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
  }, [mounted, user, params.id, refreshAllMaintenanceData])

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
  }, [])

  // Fetch incident categories and severities when convert modal opens
  useEffect(() => {
    if (showConvertModal) {
      const loadConvertModalData = async () => {
        try {
          const [incidentCats, severities] = await Promise.all([
            getIncidentCategories(),
            getSeverities()
          ])
          
          // Sort incident categories with "Other" at the end
          const sortedIncidentCats = sortIncidentCategories(Array.isArray(incidentCats) ? incidentCats : []);
          setIncidentCategories(sortedIncidentCats)
          
          // Sort severities in the desired order
          const sortedSeverities = sortSeverities(Array.isArray(severities) ? severities : []);
          setSeverities(sortedSeverities)
        } catch (error) {
          console.error('Error loading convert modal data:', error)
        }
      }
      loadConvertModalData()
    }
  }, [showConvertModal])

  // Fetch both security officers and admins when convert modal opens
  useEffect(() => {
    if (!showConvertModal) return
    setSecurityOfficersLoading(true)
    
    Promise.all([
      api.get('/users/security-officers'),
      api.get('/users/admins')
    ])
      .then(([securityRes, adminsRes]) => {
        const securityOfficers = Array.isArray(securityRes.data) ? securityRes.data : []
        const admins = Array.isArray(adminsRes.data) ? adminsRes.data : []
        
        const combined = [...securityOfficers, ...admins]
        const uniqueUsers = combined.reduce((acc: any[], current) => {
          const exists = acc.find(user => user.id === current.id)
          if (!exists) {
            acc.push(current)
          }
          return acc
        }, [])
        
        setSecurityOfficers(uniqueUsers)
      })
      .catch(() => setSecurityOfficers([]))
      .finally(() => setSecurityOfficersLoading(false))
  }, [showConvertModal])

  // Function to fetch only comments (lighter weight)
  const fetchCommentsOnly = useCallback(async () => {
    if (!params.id) return
    
    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return
    
    try {
      const response = await api.get(`/tickets/${ticketId}/comments`)
      const newComments = response.data as Comment[]
      
      setTicket(prev => {
        if (!prev) return prev
        
        const newCommentIds = new Set<number>(newComments.map((c: Comment) => c.id))
        
        const hasNewComments = Array.from(newCommentIds).some(id => !lastCommentIdsRef.current.has(id))
        
        if (hasNewComments) {
          lastCommentIdsRef.current = newCommentIds
          
          return {
            ...prev,
            comments: newComments
          }
        }
        
        return prev
      })
    } catch (error) {
      console.debug('Background comment fetch failed:', error)
    }
  }, [params.id])

  // Function to fetch attachments only (lighter weight)
  const fetchAttachmentsOnly = useCallback(async () => {
    if (!params.id) return
    
    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return
    
    try {
      const response = await api.get(`/attachments/ticket/${ticketId}`)
      const newAttachments = response.data as Attachment[]
      
      setTicket(prev => {
        if (!prev) return prev
        
        const newAttachmentIds = new Set<number>(newAttachments.map((a: Attachment) => a.id))
        
        const hasNewAttachments = Array.from(newAttachmentIds).some(id => !lastAttachmentIdsRef.current.has(id))
        
        if (hasNewAttachments) {
          lastAttachmentIdsRef.current = newAttachmentIds
          
          return {
            ...prev,
            attachments: newAttachments
          }
        }
        
        return prev
      })
    } catch (error) {
      console.debug('Background attachment fetch failed:', error)
    }
  }, [params.id])

  // Function to fetch status only (lighter weight)
  const fetchStatusOnly = useCallback(async () => {
    if (!params.id) return
    
    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return
    
    try {
      const response = await api.get(`/tickets/${ticketId}/status`)
      const { status } = response.data as { status: string }
      
      setTicket(prev => {
        if (!prev) return prev
        
        if (status !== lastStatusRef.current) {
          lastStatusRef.current = status
          
          return {
            ...prev,
            status
          }
        }
        
        return prev
      })
    } catch (error) {
      console.debug('Background status fetch failed:', error)
    }
  }, [params.id])

  // Function to fetch full ticket (for initial load)
  const fetchTicket = useCallback(async () => {
    if (!params.id) return
    
    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.get(`/tickets/${ticketId}`)
      const ticketData = response.data as Ticket
      setTicket(ticketData)
      
      // Update refs with current IDs
      if (ticketData.comments) {
        lastCommentIdsRef.current = new Set<number>(ticketData.comments.map((c: Comment) => c.id))
      }
      if (ticketData.attachments) {
        lastAttachmentIdsRef.current = new Set<number>(ticketData.attachments.map((a: Attachment) => a.id))
      }
      lastStatusRef.current = ticketData.status
      
      // Initialize incident timeline IDs if present
      if (ticketData.incidentTimeline) {
        lastIncidentTimelineIdsRef.current = new Set<string>(ticketData.incidentTimeline.map((entry: TimelineEntry) => entry.id))
      }
      
      ticketIdRef.current = ticketId
    } catch (error: any) {
      console.error('Failed to fetch ticket:', error)
      
      if (error.response?.status === 404 || error.message?.includes('404')) {
        setError('Ticket not found')
      } else if (error.response?.status === 403) {
        setError('You do not have permission to view this ticket')
      } else {
        setError('Failed to load ticket. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }
    
    fetchTicket()
  }, [params.id, user, router, mounted, fetchTicket])

  // Start polling when component is mounted
  useEffect(() => {
    if (!mounted || !user || !params.id) return

    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return

    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Start polling for updates every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      if (!isPollingRef.current) {
        isPollingRef.current = true
        Promise.all([
          fetchCommentsOnly(),
          fetchAttachmentsOnly(),
          fetchStatusOnly()
        ]).finally(() => {
          isPollingRef.current = false
        })
      }
    }, 2000)

    // Cleanup on unmount or when ticket ID changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = undefined
      }
    }
  }, [mounted, user, params.id, fetchCommentsOnly, fetchAttachmentsOnly, fetchStatusOnly])

  // Force an immediate fetch when the component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && params.id) {
        Promise.all([
          fetchCommentsOnly(),
          fetchAttachmentsOnly(),
          fetchStatusOnly(),
          refreshAllMaintenanceData() // Refresh all maintenance data
        ])
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [params.id, fetchCommentsOnly, fetchAttachmentsOnly, fetchStatusOnly, refreshAllMaintenanceData])

  // Initialize edit data when ticket loads
  useEffect(() => {
    if (ticket) {
      setEditData({
        title: ticket.title || '',
        description: ticket.description || '',
        affectedSystem: ticket.affectedSystem || ticket.affected_system || '',
        priority: ticket.priority || 'medium'
      })
    }
  }, [ticket])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const validFiles = files.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} is too large. Maximum size is 10MB.`)
          return false
        }
        return true
      })
      setSelectedFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddComment = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!comment.trim() && selectedFiles.length === 0) return;

    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!ticketId) return;

    setUploadingFiles(true);
    try {
      if (comment.trim()) {
        await api.post(`/tickets/${ticketId}/comments`, { comment, isInternal });
        setComment('');
        setIsInternal(false);
      }

      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(async (file, index) => {
          setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'uploading' } }));
          
          try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            
            const token = localStorage.getItem('token');
            const response = await fetch(`${getApiBaseUrl()}/attachments/ticket/${ticketId}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: uploadFormData
            });
            
            if (response.ok) {
              setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'success', message: 'Uploaded successfully' } }));
            } else {
              const errorData = await response.json().catch(() => ({}));
              setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: errorData.message || 'Upload failed' } }));
              throw new Error(errorData.message || 'Upload failed');
            }
          } catch (err: any) {
            setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: err.message || 'Upload failed' } }));
            throw err;
          }
        });
        
        try {
          await Promise.all(uploadPromises);
        } catch (err) {
          console.error('Some file uploads failed:', err);
        }
        
        setTimeout(() => {
          setSelectedFiles([]);
          setFileUploadStatus({});
        }, 2000);
      }

      // Immediately fetch updates after posting
      await Promise.all([
        fetchCommentsOnly(),
        fetchAttachmentsOnly()
      ]);
    } catch (error) {
      console.error('Failed to add comment/upload files:', error);
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default to avoid newline
      handleAddComment(e);
    }
    // If Shift+Enter is pressed, let the default behavior happen (new line)
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || updatingStatus) return;
    
    if (newStatus === 'resolved' || newStatus === 'closed') {
      setPendingStatus(newStatus);
      setShowStatusConfirmModal(true);
    } else {
      await executeStatusChange(newStatus);
    }
  }

  const executeStatusChange = async (newStatus: string) => {
    if (!ticket || updatingStatus) return;
    
    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return
    
    setUpdatingStatus(true);
    try {
      await api.put(`/tickets/${ticketId}`, { status: newStatus })
      // Optimistically update the UI
      setTicket(prev => prev ? { ...prev, status: newStatus } : null)
      lastStatusRef.current = newStatus
    } catch (error) {
      console.error('Failed to update status:', error)
      await fetchStatusOnly()
    } finally {
      setUpdatingStatus(false);
      setPendingStatus(null);
      setShowStatusConfirmModal(false);
    }
  }

  const handleStatusConfirm = () => {
    if (pendingStatus) {
      executeStatusChange(pendingStatus);
    }
  }

  const handleStatusCancel = () => {
    setPendingStatus(null);
    setShowStatusConfirmModal(false);
  }

  const handleConvertToIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticket) {
      alert('Ticket not found')
      return
    }
    if (ticket.isConverted) {
      alert('This ticket has already been converted to an incident.')
      if (ticket.convertedIncidentId) {
        router.push(`/incidents/${ticket.convertedIncidentId}`)
      }
      return
    }

    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return

    setConverting(true)
    try {
      const categoryMap: Record<string, string> = {
        'Phishing': 'phishing',
        'Malware': 'malware',
        'Unauthorized Access': 'unauthorized_access',
        'Data Exposure': 'data_exposure',
        'Policy Violation': 'policy_violation',
        'System Compromise': 'system_compromise',
        'Other': 'other'
      }

      // Check if "Other" is selected and use the custom value
      let finalCategory = convertData.category;
      if (convertData.category === 'other' && convertData.otherCategory.trim()) {
        finalCategory = convertData.otherCategory.trim().toLowerCase().replace(/\s+/g, '_');
      } else {
        const selectedDisplayName = incidentCategories.find(
          cat => cat.toLowerCase().replace(/\s+/g, '_') === convertData.category
        ) || convertData.category;
        finalCategory = categoryMap[selectedDisplayName] || convertData.category;
      }

      const payload: Record<string, string> = { 
        category: finalCategory, 
        severity: convertData.severity, 
        description: convertData.description || '' 
      }
      
      if (convertData.assignedTo) payload.assignedTo = convertData.assignedTo
      
      const response = await api.post(`/tickets/${ticketId}/convert`, payload)
      const { incidentId, incidentNumber } = response.data || {}
      setTicket((prev) => (prev ? {
        ...prev,
        status: 'converted_to_incident',
        isConverted: true,
        convertedIncidentId: incidentId ?? prev.convertedIncidentId,
        convertedIncidentNumber: incidentNumber ?? prev.convertedIncidentNumber,
      } : prev))
      setShowConvertModal(false)
      fetchTicket()
    } catch (error: any) {
      console.error('Failed to convert ticket:', error)
      const errorMessage = error.response?.data?.message || 'Failed to convert ticket. It may have already been converted.'
      alert(errorMessage)
      if (error.response?.status === 400 && error.response?.data?.incidentId) {
        router.push(`/incidents/${error.response.data.incidentId}`)
      } else {
        fetchTicket()
      }
    } finally {
      setConverting(false)
    }
  }
  
  const handleEditTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canModify) {
      alert('This ticket cannot be edited (resolved, closed, or converted)')
      return
    }

    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return

    try {
      await api.put(`/tickets/${ticketId}`, editData)
      setShowEditModal(false)
      fetchTicket()
    } catch (error: any) {
      console.error('Failed to update ticket:', error)
      alert(error.response?.data?.message || 'Failed to update ticket')
    }
  }

  const handleDeleteTicket = async () => {
    if (!canDelete) {
      alert('This ticket cannot be deleted (resolved, closed, or converted)')
      return
    }

    const ticketId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ticketId) return

    setDeleting(true)
    try {
      await api.delete(`/tickets/${ticketId}`)
      router.push('/tickets')
    } catch (error: any) {
      console.error('Failed to delete ticket:', error)
      alert(error.response?.data?.message || 'Failed to delete ticket')
      setDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-blue-500',
      'assigned': 'bg-purple-500',
      'in_progress': 'bg-yellow-500',
      'waiting for user': 'bg-orange-500',
      'waiting_for_user': 'bg-orange-500',
      'resolved': 'bg-green-500',
      'closed': 'bg-gray-500',
      'converted_to_incident': 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusDisplayLabel = (statusValue: string) => {
    const matchingOption = ticketStatuses.find(opt => opt.value === statusValue);
    if (matchingOption) return matchingOption.label;
    return statusValue ? statusValue.replace(/_/g, ' ') : 'New';
  };

  if (!mounted || !user || loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !ticket) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h2>
              <p className="text-gray-600 mb-6">{error || 'The ticket you are looking for does not exist or you do not have permission to view it.'}</p>
              <Link
                href="/tickets"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Tickets
              </Link>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const canEdit = hasRole(user, 'it_support', 'admin') || (user?.id === ticket.createdBy && ticket.status === 'new')
  const canDelete = !ticket.isConverted && !ticket.convertedIncidentId && 
                    !['resolved', 'closed'].includes(ticket.status) &&
                    (hasRole(user, 'it_support', 'admin') || (user?.id === ticket.createdBy))
  const canModify = canEdit && !ticket.isConverted && !ticket.convertedIncidentId && 
                    !['resolved', 'closed'].includes(ticket.status)
  const canConvert = hasRole(user, 'it_support', 'admin') && 
                     !ticket.isConverted && 
                     !ticket.convertedIncidentId && 
                     !['resolved', 'closed'].includes(ticket.status)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">{ticket.title || 'Untitled Ticket'}</h1>
              <p className="text-gray-500 font-mono text-sm mt-0.5">{ticket.ticket_number || ticket.ticketNumber || `#${ticket.id}`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canModify && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
                  disabled={updatingStatus}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
                  disabled={updatingStatus}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
              {hasRole(user, 'it_support', 'admin') && (
                <>
                  {canConvert ? (
                    <button
                      onClick={() => setShowConvertModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
                      disabled={updatingStatus}
                    >
                      Convert to Incident
                    </button>
                  ) : ticket.isConverted || ticket.convertedIncidentId ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl border border-gray-200">
                      <span className="text-gray-600">Converted to:</span>
                      {ticket.convertedIncidentId ? (
                        <Link 
                          href={`/incidents/${ticket.convertedIncidentId}`}
                          className="text-red-600 hover:underline font-mono font-semibold"
                        >
                          {ticket.convertedIncidentNumber || 'View Incident'}
                        </Link>
                      ) : (
                        <span className="text-red-600 font-mono font-semibold">
                          {ticket.convertedIncidentNumber || 'Incident'}
                        </span>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description || 'No description provided'}</p>
              </div>

              {(ticket.isConverted || (ticket.incidentTimeline && ticket.incidentTimeline.length > 0)) ? (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                      {ticket.isConverted ? 'Incident Timeline' : 'Timeline'}
                      {ticket.convertedIncidentNumber && (
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          (Incident: {ticket.convertedIncidentNumber})
                        </span>
                      )}
                    </h2>
                  </div>
                  
                  {/* Scrollable timeline container - same as admin view */}
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {ticket.incidentTimeline && ticket.incidentTimeline.length > 0 ? (
                      ticket.incidentTimeline.map((t: any) => {
                      const timelineDate = t.created_at || t.createdAt
                      const formattedDate = formatPinoyDateTime(timelineDate)
                      
                      const userName = t.userName || t.user?.fullname || 'System'
                      const action = t.action || 'UPDATE'
                      
                      return (
                        <div key={t.id} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-semibold text-gray-800">{userName}</span>
                              <span className="text-xs text-gray-500">{formattedDate}</span>
                            </div>
                            <p className="text-sm text-gray-600 font-medium">{action.replace(/_/g, ' ')}</p>
                            {t.description && (
                              <p className="text-sm text-gray-700 mt-1">{t.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    })) : (
                      <p className="text-gray-500 text-sm italic">
                        {ticket.isConverted 
                          ? 'No timeline entries yet. Security Officer investigation updates will appear here.' 
                          : 'No timeline entries yet.'}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Comments</h2>
                <div className="max-h-96 overflow-y-auto space-y-4 mb-4 pr-2 border-b border-gray-200 pb-4">
                  {ticket.comments && ticket.comments.length > 0 ? (
                    ticket.comments.map((c: any) => {
                      const commentDate = c.created_at || c.createdAt
                      const formattedDate = formatPinoyDateTime(commentDate)
                      
                      const isInternal = c.is_internal || c.isInternal
                      const userName = c.userName || c.user?.fullname || 'Unknown User'
                      
                      return (
                        <div key={c.id} className={`p-4 rounded-xl border-l-4 ${isInternal ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-blue-500'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-sm font-semibold text-gray-800">{userName}</span>
                              {isInternal && (
                                <span className="ml-2 text-xs font-medium bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">🔒 Internal</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap ml-4">{formattedDate}</span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap text-sm">{c.comment}</p>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-sm italic">No comments yet. Start the conversation below.</p>
                  )}
                </div>
                <form onSubmit={handleAddComment} className="space-y-4">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[88px]"
                    rows={3}
                    placeholder="Add a comment..."
                    disabled={uploadingFiles}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attach Files</label>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors"
                      accept="image/*,.pdf,.doc,.docx,.txt,.log,.csv"
                      disabled={uploadingFiles}
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Images, PDF, DOC, DOCX, TXT, LOG, CSV (max 10MB per file)</p>
                    
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((file, index) => {
                          const fileStatus = fileUploadStatus[index]
                          const isImage = file.type.startsWith('image/')
                          
                          return (
                            <div key={index} className={`flex items-center justify-between p-3 rounded-xl text-sm border ${
                              fileStatus?.status === 'success' ? 'bg-green-50 border-green-200' :
                              fileStatus?.status === 'error' ? 'bg-red-50 border-red-200' :
                              fileStatus?.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                              'bg-gray-50 border-gray-200'
                            }`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {isImage && (
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-8 h-8 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="text-gray-700 truncate block">{file.name}</span>
                                  {fileStatus && (
                                    <span className={`text-xs ${
                                      fileStatus.status === 'success' ? 'text-green-600' :
                                      fileStatus.status === 'error' ? 'text-red-600' :
                                      'text-blue-600'
                                    }`}>
                                      {fileStatus.status === 'uploading' && '⏳ Uploading...'}
                                      {fileStatus.status === 'success' && '✅ Uploaded successfully'}
                                      {fileStatus.status === 'error' && `❌ ${fileStatus.message || 'Upload failed'}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</span>
                                {!uploadingFiles && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      removeFile(index)
                                      setFileUploadStatus(prev => {
                                        const newStatus = { ...prev }
                                        delete newStatus[index]
                                        return newStatus
                                      })
                                    }}
                                    className="text-red-600 hover:text-red-800 text-xs"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {hasRole(user, 'it_support', 'admin') && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={uploadingFiles}
                      />
                      <span className="text-sm text-gray-600">Internal note (not visible to user)</span>
                    </label>
                  )}
                  <button 
                    type="submit" 
                    disabled={uploadingFiles}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {uploadingFiles ? 'Posting...' : 'Add Comment'}
                  </button>
                </form>
              </div>

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Attachments ({ticket.attachments.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ticket.attachments.map((att) => {
                      const isImage = att.mimeType?.startsWith('image/') || att.mime_type?.startsWith('image/')
                      const originalName = att.originalName || att.original_name || 'Unknown'
                      const size = att.size || 0
                      const token = localStorage.getItem('token')
                      const cloudinaryPath = att.filePath || att.file_path
                      const isCloudinaryUrl = cloudinaryPath && cloudinaryPath.startsWith('http')
                      const viewUrl = isCloudinaryUrl 
                        ? (cloudinaryPath || '')
                        : `${getApiBaseUrl()}/attachments/view/${att.id}?token=${token}`
                      const downloadUrl = `${getApiBaseUrl()}/attachments/download/${att.id}`
                      
                      const handleDownload = async (e: React.MouseEvent) => {
                        e.preventDefault()
                        
                        try {
                          const response = await fetch(downloadUrl, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          })
                          if (response.ok) {
                            const blob = await response.blob()
                            const blobUrl = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = blobUrl
                            a.download = originalName
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            window.URL.revokeObjectURL(blobUrl)
                          } else {
                            const errorData = await response.json().catch(() => ({}))
                            alert(errorData.message || 'Failed to download file')
                          }
                        } catch (error) {
                          console.error('Download error:', error)
                          alert('Failed to download file')
                        }
                      }

                      return (
                        <div key={att.id} className="border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow bg-white">
                          {isImage ? (
                            <div className="space-y-2">
                              <div 
                                className="w-full h-32 bg-gray-100 rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                                onClick={() => window.open(viewUrl, '_blank')}
                              >
                                <img
                                  src={viewUrl}
                                  alt={originalName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    const parent = target.parentElement
                                    if (parent) {
                                      parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-4xl">🖼️</div>'
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity rounded flex items-center justify-center pointer-events-none">
                                  <span className="text-white text-xs opacity-0 group-hover:opacity-100">Click to view full size</span>
                                </div>
                              </div>
                              <button
                                onClick={handleDownload}
                                className="block text-sm font-medium text-blue-600 hover:text-blue-700 truncate w-full text-left transition-colors"
                              >
                                {originalName}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center text-4xl">
                                📎
                              </div>
                              <button
                                onClick={handleDownload}
                                className="block text-sm font-medium text-blue-600 hover:text-blue-700 truncate w-full text-left transition-colors"
                              >
                                {originalName}
                              </button>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">{(size / 1024).toFixed(2)} KB</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Details</h2>
                <div className="space-y-4">
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</span>
                    {canModify && hasRole(user, 'it_support', 'admin') ? (
                      <ModernStatusSelect
                        value={ticket.status}
                        onChange={handleStatusChange}
                        disabled={updatingStatus}
                        statusOptions={ticketStatuses}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(ticket.status)}`} />
                        <p className="text-gray-900 font-medium capitalize">
                          {getStatusDisplayLabel(ticket.status)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Priority</span>
                    <p className="mt-1 text-gray-900 capitalize">{ticket.priority || 'medium'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Category</span>
                    <p className="mt-1 text-gray-900 capitalize">
                      {ticket.category
                        ? ticket.category
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Request Type</span>
                    <p className="mt-1 text-gray-900 capitalize">
                      {(ticket.request_type || ticket.requestType)
                        ? (ticket.request_type || ticket.requestType || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Affected System</span>
                    <p className="mt-1 text-gray-900">{ticket?.affected_system || ticket?.affectedSystem || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created By</span>
                    <p className="mt-1 text-gray-900">{ticket.createdByName || 'N/A'}</p>
                  </div>
                  {(ticket.sla_due || ticket.slaDue) ? (
                    <div>
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">SLA Due</span>
                      <p className={`mt-1 ${(ticket.sla_due || ticket.slaDue) && new Date(ticket.sla_due || ticket.slaDue || '') < new Date() ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {formatPinoyDateTime(ticket.sla_due || ticket.slaDue || undefined)}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created</span>
                    <p className="mt-1 text-gray-900">
                      {formatPinoyDateTime(ticket.created_at || ticket.createdAt || undefined) || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Change Confirmation Modal */}
        {showStatusConfirmModal && pendingStatus && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  pendingStatus === 'resolved' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {pendingStatus === 'resolved' ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {pendingStatus === 'resolved' ? 'Resolve Ticket' : 'Close Ticket'}
                </h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">
                  {pendingStatus === 'resolved' 
                    ? 'Are you sure you want to mark this ticket as resolved? This will indicate that the issue has been fixed.'
                    : 'Are you sure you want to close this ticket? Closed tickets cannot be edited or reopened.'}
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleStatusConfirm}
                    disabled={updatingStatus}
                    className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white shadow-sm transition-colors ${
                      pendingStatus === 'resolved' 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-600 hover:bg-gray-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {updatingStatus ? 'Updating...' : `Yes, ${pendingStatus === 'resolved' ? 'Resolve' : 'Close'} Ticket`}
                  </button>
                  <button
                    onClick={handleStatusCancel}
                    disabled={updatingStatus}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Ticket</h2>
              <form onSubmit={handleEditTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-y"
                    rows={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Affected System</label>
                  <input
                    type="text"
                    value={editData.affectedSystem}
                    onChange={(e) => setEditData({ ...editData, affectedSystem: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority *</label>
                  <select
                    value={editData.priority}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">Save Changes</button>
                  <button type="button" onClick={() => setShowEditModal(false)} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100">
              <h2 className="text-xl font-bold mb-4 text-red-600">Delete Ticket</h2>
              <p className="mb-5 text-gray-600">
                Are you sure you want to delete this ticket? This action cannot be undone and will also delete all associated comments and attachments.
              </p>
              <div className="flex gap-3">
                <button onClick={handleDeleteTicket} disabled={deleting} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Convert Modal */}
        {showConvertModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-red-600">Convert Ticket to Incident</h2>
              <form onSubmit={handleConvertToIncident} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to Security Officer or Admin </label>
                  <select
                    value={convertData.assignedTo}
                    onChange={(e) => setConvertData({ ...convertData, assignedTo: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required={securityOfficers.length > 0}
                    disabled={securityOfficersLoading}
                  >
                    <option value="">
                      {securityOfficersLoading ? 'Loading…' : 'Select User'}
                    </option>
                    {securityOfficers.map((so) => (
                      <option key={so.id} value={so.id}>
                        {so.fullname}
                      </option>
                    ))}
                  </select>
                  {!securityOfficersLoading && securityOfficers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No active Security Officers or Admins found. Add one in User Management.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Incident Category *</label>
                  <select
                    value={convertData.category}
                    onChange={(e) => setConvertData({ ...convertData, category: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="">Select category</option>
                    {incidentCategories.length > 0 ? (
                      incidentCategories.map((category) => {
                        const dbValue = category.toLowerCase().replace(/\s+/g, '_')
                        return (
                          <option key={category} value={dbValue}>
                            {category}
                          </option>
                        )
                      })
                    ) : (
                      <>
                        <option value="phishing">Phishing</option>
                        <option value="malware">Malware</option>
                        <option value="unauthorized_access">Unauthorized Access</option>
                        <option value="data_exposure">Data Exposure</option>
                        <option value="policy_violation">Policy Violation</option>
                        <option value="system_compromise">System Compromise</option>
                        <option value="other">Other</option>
                      </>
                    )}
                  </select>
                  {incidentCategories.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No incident categories configured. Using default options.
                    </p>
                  )}
                </div>
                
                {/* "Other" category text field - appears when "Other" is selected */}
                {convertData.category === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Please specify category</label>
                    <input
                      type="text"
                      value={convertData.otherCategory}
                      onChange={(e) => setConvertData({ ...convertData, otherCategory: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Enter custom category"
                      required={convertData.category === 'other'}
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity *</label>
                  <select
                    value={convertData.severity}
                    onChange={(e) => setConvertData({ ...convertData, severity: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="">Select severity</option>
                    {severities.length > 0 ? (
                      severities.map((severity) => {
                        const dbValue = severity.toLowerCase()
                        return (
                          <option key={severity} value={dbValue}>
                            {severity}
                          </option>
                        )
                      })
                    ) : (
                      <>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </>
                    )}
                  </select>
                  {severities.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No severities configured. Using default options.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={convertData.description}
                    onChange={(e) => setConvertData({ ...convertData, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[80px] resize-y"
                    rows={4}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={converting} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors">
                    {converting ? 'Converting…' : 'Convert'}
                  </button>
                  <button type="button" disabled={converting} onClick={() => setShowConvertModal(false)} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}