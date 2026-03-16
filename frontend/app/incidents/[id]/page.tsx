'use client'

import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Listbox, Transition } from '@headlessui/react'
import api, { getApiBaseUrl } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'
import { formatPinoyDateTime } from '@/lib/date'
import { getIncidentStatuses } from '@/lib/maintenance'

interface Incident {
  id: number
  incidentNumber: string
  category: string
  title: string
  description: string
  severity: string
  status: string
  impactConfidentiality: string
  impactIntegrity: string
  impactAvailability: string
  affectedAsset: string
  affectedUser: string
  affectedUserId?: string
  rootCause: string
  resolutionSummary: string
  assignedToName: string
  createdByName: string
  sourceTicketNumber: string
  sourceTicketId?: string | null
  createdAt: string
  timeline: TimelineEntry[]
  attachments: Attachment[]
}

interface TimelineEntry {
  id: number
  action: string
  description: string
  userName: string
  createdAt: string
}

interface Attachment {
  id: number
  originalName: string
  size: number
  createdAt: string
}

// Helper function to sort incident statuses with "All statuses" at the top and proper order
const sortIncidentStatusOptions = (statuses: { value: string; label: string }[]): { value: string; label: string }[] => {
  // Define the desired order for default statuses
  const statusOrder = [
    'All Statuses',
    'New',
    'Triaged',
    'Investigating',
    'Contained',
    'Recovered',
    'Closed'
  ];
  
  // Separate into default statuses and custom statuses
  const defaultOptions: { value: string; label: string }[] = [];
  const customOptions: { value: string; label: string }[] = [];
  
  statuses.forEach(opt => {
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
  
  // Find the index where custom statuses should be inserted (after "Contained")
  const containedIndex = defaultOptions.findIndex(opt => opt.label === 'Contained');
  const insertIndex = containedIndex !== -1 ? containedIndex + 1 : defaultOptions.length;
  
  // Insert custom statuses after "Contained"
  const result = [...defaultOptions];
  if (insertIndex >= 0 && insertIndex <= result.length) {
    result.splice(insertIndex, 0, ...customOptions);
  } else {
    result.push(...customOptions);
  }
  
  return result;
};

// Modern Status Select Component for Incidents - COLORS REMOVED with dynamic options
const ModernIncidentStatusSelect = ({ 
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
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedOption = statusOptions.find(opt => opt.value === value) || { value: '', label: value?.replace(/_/g, ' ') || 'New' };

  const handleStatusChange = (newStatus: string) => {
    setIsOpen(false); // Close the dropdown first
    onChange(newStatus); // Then call the parent's onChange
  };

  return (
    <Listbox 
      value={value} 
      onChange={handleStatusChange} 
      disabled={disabled}
    >
      {({ open }) => {
        // Sync our internal state with Listbox's open state
        if (open !== isOpen) {
          setIsOpen(open);
        }
        return (
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
              <span className="capitalize">{selectedOption.label}</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Listbox.Button>
            
            <Transition
              as={Fragment}
              show={isOpen}
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
                        <span className={`flex-1 text-sm font-medium capitalize ${
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
        );
      }}
    </Listbox>
  );
};

// Pill/badge colors for Severity (and Impact (CIA) — same value)
function getSeverityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    none: 'bg-gray-100 text-gray-800',
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }
  return map[severity?.toLowerCase()] ?? 'bg-gray-100 text-gray-800'
}

// Read from API response (camelCase or snake_case)
function getIncidentField(incident: any, camel: string, snake?: string): string {
  if (!incident) return ''
  const s = snake ?? camel.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
  const v = incident[camel] ?? incident[s]
  return v != null ? String(v) : ''
}

export default function IncidentDetailsPage() {
  // DEBUG: Force a visible alert to confirm component is running
  if (typeof window !== 'undefined') {
    console.log('%c🔵 INCIDENT PAGE LOADED - CHECKING USER ROLE', 'font-size: 16px; font-weight: bold; color: blue;');
  }
  
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false)
  const [timelineEntry, setTimelineEntry] = useState({ action: '', description: '' })
  const [investigationModalOpen, setInvestigationModalOpen] = useState(false)
  const [investigationForm, setInvestigationForm] = useState({ rootCause: '', resolutionSummary: '' })
  // NEW: Loading states for actions
  const [addingTimeline, setAddingTimeline] = useState(false)
  const [savingInvestigation, setSavingInvestigation] = useState(false)
  // NEW: State for dynamic status options
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>([])

  // Refs for polling
  const maintenancePollingRef = useRef<NodeJS.Timeout>()
  const timelinePollingRef = useRef<NodeJS.Timeout>()
  const investigationPollingRef = useRef<NodeJS.Timeout>()
  const isMaintenancePollingRef = useRef<boolean>(false)
  const isTimelinePollingRef = useRef<boolean>(false)
  const isInvestigationPollingRef = useRef<boolean>(false)
  const lastTimelineIdsRef = useRef<Set<number>>(new Set())
  const lastInvestigationRef = useRef<{ rootCause: string; resolutionSummary: string }>({ rootCause: '', resolutionSummary: '' })
  const lastStatusRef = useRef<string>('')

  // Function to refresh status options only (lighter weight)
  const refreshStatusOptions = useCallback(async () => {
    try {
      const statuses = await getIncidentStatuses()
      const options = Array.isArray(statuses) ? statuses.map(status => ({
        value: status.toLowerCase().replace(/\s+/g, '_'),
        label: status
      })) : []
      
      // Sort the status options in the desired order
      const sortedOptions = sortIncidentStatusOptions(options);
      setStatusOptions(sortedOptions)
    } catch (error) {
      console.debug('Background status options refresh failed:', error)
    }
  }, [])

  // Function to fetch only timeline (lighter weight) - WITH DEBUGGING
  const fetchTimelineOnly = useCallback(async () => {
    if (!params.id) return
    
    const incidentId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!incidentId) return
    
    try {
      console.log(`%c🟢 [${user?.role}] Fetching timeline for incident ${incidentId}...`, 'color: green;');
      const response = await api.get(`/incidents/${incidentId}/timeline`)
      const newTimeline = response.data as TimelineEntry[]
      console.log(`%c🟢 [${user?.role}] Timeline response:`, newTimeline.length, 'entries', 'color: green;');
      
      setIncident(prev => {
        if (!prev) return prev
        
        const newTimelineIds = new Set<number>(newTimeline.map((entry: TimelineEntry) => entry.id))
        
        // Check if there are new timeline entries
        const hasNewTimeline = Array.from(newTimelineIds).some(id => !lastTimelineIdsRef.current.has(id))
        
        if (hasNewTimeline) {
          console.log(`%c🟢 [${user?.role}] 🔔 NEW TIMELINE ENTRIES DETECTED!`, 'font-size: 14px; font-weight: bold; color: purple;');
          console.log('Previous IDs:', Array.from(lastTimelineIdsRef.current));
          console.log('New IDs:', Array.from(newTimelineIds));
          lastTimelineIdsRef.current = newTimelineIds
          
          return {
            ...prev,
            timeline: newTimeline
          }
        } else {
          console.log(`%c🟢 [${user?.role}] No new timeline entries`, 'color: gray;');
        }
        
        return prev
      })
    } catch (error) {
      console.error(`%c🔴 [${user?.role}] Timeline fetch FAILED:`, error, 'color: red; font-weight: bold;');
    }
  }, [params.id, user])

  // Function to fetch status only (lighter weight)
  const fetchStatusOnly = useCallback(async () => {
    if (!params.id) return
    
    const incidentId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!incidentId) return
    
    try {
      const response = await api.get(`/incidents/${incidentId}/status`)
      const { status } = response.data as { status: string }
      
      setIncident(prev => {
        if (!prev) return prev
        
        if (status !== lastStatusRef.current) {
          console.log(`[${user?.role}] Status changed from ${lastStatusRef.current} to ${status}`)
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
  }, [params.id, user])

  // Function to fetch investigation only (lighter weight)
  const fetchInvestigationOnly = useCallback(async () => {
    if (!params.id) return
    
    const incidentId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!incidentId) return
    
    try {
      const response = await api.get(`/incidents/${incidentId}/investigation`)
      const { rootCause, resolutionSummary } = response.data
      
      setIncident(prev => {
        if (!prev) return prev
        
        // Check if investigation data has changed
        if (rootCause !== lastInvestigationRef.current.rootCause || 
            resolutionSummary !== lastInvestigationRef.current.resolutionSummary) {
          console.log(`[${user?.role}] Investigation data changed`)
          lastInvestigationRef.current = { rootCause, resolutionSummary }
          
          return {
            ...prev,
            rootCause,
            resolutionSummary
          }
        }
        
        return prev
      })
    } catch (error) {
      console.debug('Background investigation fetch failed:', error)
    }
  }, [params.id, user])

  // Function to refresh all incident data (for initial load and manual refresh)
  const refreshAllIncidentData = useCallback(async () => {
    if (!params.id) return
    
    const incidentId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!incidentId) return
    
    try {
      console.log(`[${user?.role}] Refreshing all incident data...`)
      const response = await api.get(`/incidents/${incidentId}`)
      setIncident(response.data)
      
      // Update refs with current data
      if (response.data.timeline) {
        lastTimelineIdsRef.current = new Set<number>(response.data.timeline.map((entry: TimelineEntry) => entry.id))
      }
      lastStatusRef.current = response.data.status
      lastInvestigationRef.current = { 
        rootCause: response.data.rootCause, 
        resolutionSummary: response.data.resolutionSummary 
      }
    } catch (error) {
      console.error('Failed to refresh incident data:', error)
    }
  }, [params.id, user])

  // Load dynamic incident statuses from maintenance (async)
  const loadStatusOptions = useCallback(async () => {
    try {
      const statuses = await getIncidentStatuses()
      const options = Array.isArray(statuses) ? statuses.map(status => ({
        value: status.toLowerCase().replace(/\s+/g, '_'),
        label: status
      })) : []
      
      // Sort the status options in the desired order
      const sortedOptions = sortIncidentStatusOptions(options);
      setStatusOptions(sortedOptions)
    } catch (error) {
      console.error('Error loading incident statuses:', error)
      setStatusOptions([])
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
    
    loadStatusOptions()
    
    // Listen for maintenance data changes from the maintenance modal
    const handleMaintenanceDataChange = () => {
      loadStatusOptions()
    }
    window.addEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
    
    return () => {
      window.removeEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
    }
  }, [loadStatusOptions])

  // Start polling for status options updates every 10 seconds
  useEffect(() => {
    if (!mounted || !user || !params.id) return

    // Clear any existing interval
    if (maintenancePollingRef.current) {
      clearInterval(maintenancePollingRef.current)
    }

    // Start polling for status options updates every 10 seconds
    maintenancePollingRef.current = setInterval(() => {
      if (!isMaintenancePollingRef.current) {
        isMaintenancePollingRef.current = true
        refreshStatusOptions().finally(() => {
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
  }, [mounted, user, params.id, refreshStatusOptions])

  // Start polling for timeline updates every 2 seconds - WITH FORCED DEBUGGING
  useEffect(() => {
    if (!mounted || !user || !params.id) return

    console.log(`%c🔵 [${user?.role}] ===== SETTING UP TIMELINE POLLING =====`, 'font-size: 14px; font-weight: bold; color: blue;');
    console.log(`%c🔵 [${user?.role}] Should run every 2 seconds`, 'color: blue;');
    
    let pollCount = 0;

    // Clear any existing interval
    if (timelinePollingRef.current) {
      clearInterval(timelinePollingRef.current)
    }

    // Start polling for timeline updates every 2 seconds
    timelinePollingRef.current = setInterval(() => {
      pollCount++;
      console.log(`%c🟠 [${user?.role}] POLL #${pollCount} - Fetching timeline...`, 'color: orange; font-weight: bold;');
      
      if (!isTimelinePollingRef.current) {
        isTimelinePollingRef.current = true
        fetchTimelineOnly().finally(() => {
          isTimelinePollingRef.current = false
        })
      } else {
        console.log(`%c🟠 [${user?.role}] POLL #${pollCount} - Skipped (already running)`, 'color: gray;');
      }
    }, 2000)

    // Cleanup on unmount
    return () => {
      console.log(`%c🔴 [${user?.role}] ===== CLEANING UP TIMELINE POLLING =====`, 'font-size: 14px; font-weight: bold; color: red;');
      if (timelinePollingRef.current) {
        clearInterval(timelinePollingRef.current)
        timelinePollingRef.current = undefined
      }
    }
  }, [mounted, user, params.id, fetchTimelineOnly])

  // Start polling for investigation updates every 3 seconds
  useEffect(() => {
    if (!mounted || !user || !params.id) return

    // Clear any existing interval
    if (investigationPollingRef.current) {
      clearInterval(investigationPollingRef.current)
    }

    // Start polling for investigation updates every 3 seconds
    investigationPollingRef.current = setInterval(() => {
      if (!isInvestigationPollingRef.current) {
        isInvestigationPollingRef.current = true
        Promise.all([
          fetchInvestigationOnly(),
          fetchStatusOnly()
        ]).finally(() => {
          isInvestigationPollingRef.current = false
        })
      }
    }, 3000)

    // Cleanup on unmount
    return () => {
      if (investigationPollingRef.current) {
        clearInterval(investigationPollingRef.current)
        investigationPollingRef.current = undefined
      }
    }
  }, [mounted, user, params.id, fetchInvestigationOnly, fetchStatusOnly])

  // Force an immediate refresh when the component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && params.id) {
        console.log(`[${user?.role}] Tab became visible, refreshing data...`)
        Promise.all([
          refreshStatusOptions(),
          fetchTimelineOnly(),
          fetchStatusOnly(),
          fetchInvestigationOnly()
        ])
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [params.id, user, refreshStatusOptions, fetchTimelineOnly, fetchStatusOnly, fetchInvestigationOnly])

  const fetchIncident = useCallback(async () => {
    try {
      console.log(`[${user?.role}] Initial fetch of incident data...`)
      const response = await api.get(`/incidents/${params.id}`)
      setIncident(response.data)
      
      // Update refs with current data
      if (response.data.timeline) {
        lastTimelineIdsRef.current = new Set<number>(response.data.timeline.map((entry: TimelineEntry) => entry.id))
        console.log(`[${user?.role}] Initial timeline entries:`, lastTimelineIdsRef.current.size)
      }
      lastStatusRef.current = response.data.status
      lastInvestigationRef.current = { 
        rootCause: response.data.rootCause, 
        resolutionSummary: response.data.resolutionSummary 
      }
    } catch (error) {
      console.error('Failed to fetch incident:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id, user])

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }
    fetchIncident()
  }, [params.id, user, router, mounted, fetchIncident])

  const handleStatusChange = async (newStatus: string) => {
    if (!incident || updatingStatus) return;
    
    // Show confirmation modal for 'recovered' and 'closed' statuses
    if (newStatus === 'recovered' || newStatus === 'closed') {
      setPendingStatus(newStatus);
      setShowStatusConfirmModal(true);
    } else {
      await executeStatusChange(newStatus);
    }
  }

  const executeStatusChange = async (newStatus: string) => {
    if (!incident || updatingStatus) return;
    
    setUpdatingStatus(true);
    try {
      await api.put(`/incidents/${params.id}`, { status: newStatus })
      // Optimistically update the UI
      setIncident(prev => prev ? { ...prev, status: newStatus } : null)
      lastStatusRef.current = newStatus
    } catch (error) {
      console.error('Failed to update status:', error)
      // Revert optimistic update on error
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

  const handleAddTimelineEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!timelineEntry.action.trim() || !timelineEntry.description.trim()) return

    setAddingTimeline(true)
    try {
      console.log(`[${user?.role}] Adding timeline entry...`)
      await api.post(`/incidents/${params.id}/timeline`, timelineEntry)
      setTimelineEntry({ action: '', description: '' })
      // Fetch updated timeline immediately
      await fetchTimelineOnly()
    } catch (error) {
      console.error('Failed to add timeline entry:', error)
    } finally {
      setAddingTimeline(false)
    }
  }

  const openInvestigationModal = () => {
    const rc = (incident as any)?.rootCause ?? (incident as any)?.root_cause ?? ''
    const res = (incident as any)?.resolutionSummary ?? (incident as any)?.resolution_summary ?? ''
    setInvestigationForm({ rootCause: rc, resolutionSummary: res })
    setInvestigationModalOpen(true)
  }

  const handleSaveInvestigation = async (e: React.FormEvent) => {
    e.preventDefault()
    const rootCause = investigationForm.rootCause.trim()
    const resolutionSummary = investigationForm.resolutionSummary.trim()
    
    setSavingInvestigation(true)
    try {
      await api.put(`/incidents/${params.id}`, {
        rootCause: rootCause || null,
        resolutionSummary: resolutionSummary || null
      })
      setInvestigationModalOpen(false)
      // Fetch updated investigation data immediately
      await fetchInvestigationOnly()
    } catch (error) {
      console.error('Failed to save investigation:', error)
    } finally {
      setSavingInvestigation(false)
    }
  }

  const handleClearInvestigation = async () => {
    setSavingInvestigation(true)
    try {
      await api.put(`/incidents/${params.id}`, {
        rootCause: null,
        resolutionSummary: null
      })
      setInvestigationModalOpen(false)
      setInvestigationForm({ rootCause: '', resolutionSummary: '' })
      // Fetch updated investigation data immediately
      await fetchInvestigationOnly()
    } catch (error) {
      console.error('Failed to clear investigation:', error)
    } finally {
      setSavingInvestigation(false)
    }
  }

  // Helper function to get display label for status
  const getStatusDisplayLabel = (statusValue: string) => {
    const matchingOption = statusOptions.find(opt => opt.value === statusValue);
    if (matchingOption) return matchingOption.label;
    return statusValue ? statusValue.replace(/_/g, ' ') : 'new';
  };

  if (!mounted || !user || loading || !incident) {
    return (
      <ProtectedRoute allowedRoles={['security_officer', 'admin', 'it_support']}>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // IT Support has read-only access; no one can edit when incident is closed
  const isReadOnly = user?.role === 'it_support' || incident?.status === 'closed'

  return (
    <ProtectedRoute allowedRoles={['security_officer', 'admin', 'it_support']}>
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">{incident.title || 'Untitled Incident'}</h1>
            <p className="text-gray-500 font-mono text-sm mt-0.5">{incident.incidentNumber || `#${incident.id}`}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{incident.description}</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Timeline</h2>
                {/* Timeline container with fixed height and scrollbar */}
                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {incident.timeline && incident.timeline.length > 0 ? (
                    incident.timeline.map((entry: any) => {
                      const entryDate = entry.created_at || entry.createdAt
                      const formattedDate = formatPinoyDateTime(entryDate)
                      
                      return (
                        <div key={entry.id} className="border-b border-gray-200 pb-3 last:border-0">
                          <p className="text-sm font-medium text-gray-900">- <span className="font-bold">{entry.action}</span></p>
                          <p className="text-sm text-gray-700 ml-4">{entry.description}</p>
                          <p className="text-xs text-gray-500 ml-4">by {entry.userName || 'Unknown User'}</p>
                          <p className="text-xs text-gray-400 ml-4">{formattedDate}</p>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-sm italic">No timeline entries yet</p>
                  )}
                </div>
                {!isReadOnly && (
                  <form onSubmit={handleAddTimelineEntry} className="space-y-4 pt-2 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Action *</label>
                      <input
                        type="text"
                        value={timelineEntry.action}
                        onChange={(e) => setTimelineEntry({ ...timelineEntry, action: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Investigation started"
                        required
                        disabled={addingTimeline}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                      <textarea
                        value={timelineEntry.description}
                        onChange={(e) => setTimelineEntry({ ...timelineEntry, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[88px]"
                        rows={3}
                        placeholder="Detailed description of the action taken..."
                        required
                        disabled={addingTimeline}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="submit" 
                        disabled={addingTimeline}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                      >
                        {addingTimeline ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Adding...</span>
                          </>
                        ) : (
                          'Add Timeline Entry'
                        )}
                      </button>
                      {incident.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={openInvestigationModal}
                          disabled={addingTimeline}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                        >
                          {incident.rootCause || incident.resolutionSummary ? 'Edit' : 'Add'} Root Cause & Resolution
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {investigationModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => !savingInvestigation && setInvestigationModalOpen(false)}>
                  <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Investigation – Root Cause & Resolution</h2>
                    <form onSubmit={handleSaveInvestigation} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Root Cause</label>
                        <textarea
                          value={investigationForm.rootCause}
                          onChange={(e) => setInvestigationForm({ ...investigationForm, rootCause: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[100px]"
                          rows={4}
                          placeholder="Document root cause analysis..."
                          disabled={savingInvestigation}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Resolution Summary</label>
                        <textarea
                          value={investigationForm.resolutionSummary}
                          onChange={(e) => setInvestigationForm({ ...investigationForm, resolutionSummary: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[100px]"
                          rows={4}
                          placeholder="Document resolution summary..."
                          disabled={savingInvestigation}
                        />
                      </div>
                      <div className="flex flex-wrap gap-3 justify-between pt-2">
                        <button
                          type="button"
                          onClick={handleClearInvestigation}
                          disabled={savingInvestigation}
                          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Clear contents
                        </button>
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={() => !savingInvestigation && setInvestigationModalOpen(false)} 
                            disabled={savingInvestigation}
                            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={savingInvestigation}
                            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                          >
                            {savingInvestigation ? (
                              <>
                                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {incident.attachments && incident.attachments.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Evidence Attachments</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {incident.attachments.map((att: any) => {
                      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
                      const downloadUrl = `${getApiBaseUrl()}/attachments/download/${att.id}`
                      return (
                        <button
                          key={att.id}
                          onClick={(e) => {
                            e.preventDefault()
                            fetch(downloadUrl, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            })
                              .then(response => response.blob())
                              .then(blob => {
                                const blobUrl = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = blobUrl
                                a.download = att.original_name || att.originalName || 'attachment'
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                window.URL.revokeObjectURL(blobUrl)
                              })
                              .catch(error => {
                                console.error('Download error:', error)
                                alert('Failed to download file')
                              })
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all text-left group"
                        >
                          <span className="text-2xl">📎</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                              {att.original_name || att.originalName || 'Attachment'}
                            </p>
                            <p className="text-xs text-gray-500">{(att.size / 1024).toFixed(2)} KB</p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
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
                    {isReadOnly || incident.status === 'recovered' || incident.status === 'closed' ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-gray-900 font-medium capitalize">
                          {getStatusDisplayLabel(incident.status)}
                        </span>
                      </div>
                    ) : (
                      <ModernIncidentStatusSelect
                        value={incident.status}
                        onChange={handleStatusChange}
                        disabled={updatingStatus}
                        statusOptions={statusOptions}
                      />
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Severity</span>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getSeverityBadgeClass(getIncidentField(incident, 'severity'))}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'critical' ? 'bg-red-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'high' ? 'bg-orange-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`} />
                        {getIncidentField(incident, 'severity') || '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Category</span>
                    <p className="mt-1 text-gray-900 capitalize">{incident.category?.replace(/_/g, ' ') ?? '—'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Impact (CIA)</span>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getSeverityBadgeClass(getIncidentField(incident, 'severity'))}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'critical' ? 'bg-red-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'high' ? 'bg-orange-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`} />
                        {getIncidentField(incident, 'severity') || '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Affected Asset</span>
                    <span className="ml-1 text-xs text-gray-400">(from ticket)</span>
                    <p className="mt-1 text-gray-900">{getIncidentField(incident, 'affectedAsset') || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Affected User</span>
                    <span className="ml-1 text-xs text-gray-400">(ticket creator)</span>
                    <p className="mt-1 text-gray-900">
                      {getIncidentField(incident, 'affectedUser') || 'N/A'}
                      {getIncidentField(incident, 'affectedUserId') && (
                        <span className="ml-1 text-xs text-gray-400">(ID: {getIncidentField(incident, 'affectedUserId')})</span>
                      )}
                    </p>
                  </div>
                  {incident.sourceTicketNumber && (
                    <div>
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Source Ticket</span>
                      <p className="mt-1">
                        <Link 
                          href={incident.sourceTicketId ? `/tickets/${incident.sourceTicketId}` : '#'} 
                          className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                        >
                          {incident.sourceTicketNumber}
                        </Link>
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Assigned To</span>
                    <p className="mt-1 text-gray-900">{incident.assignedToName || 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created By</span>
                    <p className="mt-1 text-gray-900">{incident.createdByName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created</span>
                    <p className="mt-1 text-gray-900">
                      {formatPinoyDateTime(incident.createdAt) || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Investigation</h2>
                <div className="space-y-4">
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Root Cause</span>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-xl">
                      {(incident as any).rootCause ?? (incident as any).root_cause ?? 'Not documented'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Resolution Summary</span>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-xl">
                      {(incident as any).resolutionSummary ?? (incident as any).resolution_summary ?? 'Not documented'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Change Confirmation Modal for Recovered Incident */}
        {showStatusConfirmModal && pendingStatus === 'recovered' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Recover Incident</h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">
                  Are you sure you want to mark this incident as recovered? This indicates that the system has been restored to normal operation.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleStatusConfirm}
                    disabled={updatingStatus}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {updatingStatus ? 'Updating...' : 'Yes, Mark as Recovered'}
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

        {/* Status Change Confirmation Modal for Closing Incident */}
        {showStatusConfirmModal && pendingStatus === 'closed' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Close Incident</h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">
                  Are you sure you want to close this incident? This action is irreversible and the incident will be marked as complete.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleStatusConfirm}
                    disabled={updatingStatus}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {updatingStatus ? 'Closing...' : 'Yes, Close Incident'}
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
      </div>
    </ProtectedRoute>
  )
}