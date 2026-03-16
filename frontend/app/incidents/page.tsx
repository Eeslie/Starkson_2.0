'use client'

import { useEffect, useState, useCallback, Fragment, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Listbox, Transition } from '@headlessui/react'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'
import { formatPinoyDateTime } from '@/lib/date'
import { REAL_BRANCHES } from '@/lib/branches'
import { getIncidentStatuses, getSeverities, getIncidentCategories } from '@/lib/maintenance'

interface Incident {
  id: number
  incidentNumber: string
  category: string
  title: string
  severity: string
  status: string
  createdAt: string
  sourceTicketNumber?: string
  sourceTicketId?: string | null
  affectedAsset?: string | null
  affectedUser?: string | null
}

const PAGE_SIZE = 10

// Helper function to sort incident statuses in the desired order
const sortIncidentStatusOptions = (statuses: { value: string; label: string }[]): { value: string; label: string }[] => {
  // Define the desired order for default statuses with the EXACT labels you want
  const statusOrder = [
    'All Statuses',
    'New',
    'Triaged',
    'Investigating',
    'Contained',
    'Recovered',
    'Closed'
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
  
  // Find the index where custom statuses should be inserted (after "Contained")
  const containedIndex = defaultOptions.findIndex(opt => opt.label === 'Contained');
  const insertIndex = containedIndex !== -1 ? containedIndex + 1 : defaultOptions.length;
  
  // Insert custom statuses after "Contained" and before "Recovered"
  const result = [...defaultOptions];
  if (insertIndex >= 0 && insertIndex <= result.length) {
    result.splice(insertIndex, 0, ...customOptions);
  } else {
    result.push(...customOptions);
  }
  
  // Return with "All statuses" at the top
  return [allStatusesOption, ...result];
};

// Helper function to sort severities in the desired order
const sortSeverityOptions = (severities: { value: string; label: string }[]): { value: string; label: string }[] => {
  // Define the desired order for default severities (excluding "All severities")
  const severityOrder = ['Low', 'Medium', 'High', 'Critical'];
  
  // Separate "All severities" from the rest
  const allSeveritiesOption = severities.find(opt => opt.value === '') || { value: '', label: 'All severities' };
  const otherOptions = severities.filter(opt => opt.value !== '');
  
  // Separate into default severities and custom severities
  const defaultOptions: { value: string; label: string }[] = [];
  const customOptions: { value: string; label: string }[] = [];
  
  otherOptions.forEach(opt => {
    if (severityOrder.includes(opt.label)) {
      defaultOptions.push(opt);
    } else {
      customOptions.push(opt);
    }
  });
  
  // Sort default severities according to the specified order
  defaultOptions.sort((a, b) => severityOrder.indexOf(a.label) - severityOrder.indexOf(b.label));
  
  // Sort custom severities alphabetically by label
  customOptions.sort((a, b) => a.label.localeCompare(b.label));
  
  // Return default severities first, then custom severities at the bottom, with "All severities" at the top
  return [allSeveritiesOption, ...defaultOptions, ...customOptions];
};

// Helper function to sort categories (just alphabetically, but you can customize if needed)
const sortCategoryOptions = (categories: { value: string; label: string }[]): { value: string; label: string }[] => {
  // Separate "All categories" from the rest
  const allCategoriesOption = categories.find(opt => opt.value === '') || { value: '', label: 'All categories' };
  const otherOptions = categories.filter(opt => opt.value !== '');
  
  // Sort the rest alphabetically by label
  otherOptions.sort((a, b) => a.label.localeCompare(b.label));
  
  // Return with "All categories" at the top
  return [allCategoriesOption, ...otherOptions];
};

// Modern Status Select Component for Filters - with dynamic options
const ModernStatusFilterSelect = ({ 
  value, 
  onChange,
  options
}: { 
  value: string; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => {
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white text-gray-900
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
          transition-all duration-200 ease-in-out
          cursor-pointer font-medium text-left
        ">
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
            {options.map((option) => (
              <Listbox.Option
                key={option.value || 'all'}
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
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// Modern Severity Select Component for Filters - with dynamic options
const ModernSeverityFilterSelect = ({ 
  value, 
  onChange,
  options
}: { 
  value: string; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => {
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white text-gray-900
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
          transition-all duration-200 ease-in-out
          cursor-pointer font-medium text-left
        ">
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
            {options.map((option) => (
              <Listbox.Option
                key={option.value || 'all'}
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
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// Modern Category Select Component for Filters - with dynamic options
const ModernCategoryFilterSelect = ({ 
  value, 
  onChange,
  options
}: { 
  value: string; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => {
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white text-gray-900
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
          transition-all duration-200 ease-in-out
          cursor-pointer font-medium text-left
        ">
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
            {options.map((option) => (
              <Listbox.Option
                key={option.value || 'all'}
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
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function IncidentsPageContent() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || '',
    severity: searchParams.get('severity') || '',
    category: searchParams.get('category') || '',
    branch: searchParams.get('branch_acronym') || '',
  }))
  
  // State for dynamic filter options
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'All statuses' }
  ])
  const [severityOptions, setSeverityOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'All severities' }
  ])
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'All categories' }
  ])
  const [exporting, setExporting] = useState(false)

  // Refs for polling
  const maintenancePollingRef = useRef<NodeJS.Timeout>()
  const isMaintenancePollingRef = useRef<boolean>(false)

  // Function to refresh status options only (lighter weight)
  const refreshStatusOptions = useCallback(async () => {
    try {
      const statuses = await getIncidentStatuses()
      const statusOpts = [
        { value: '', label: 'All statuses' },
        ...(Array.isArray(statuses) ? statuses.map(status => ({
          value: status.toLowerCase().replace(/\s+/g, '_'),
          label: status
        })) : [])
      ]
      // Sort status options
      const sortedStatusOpts = sortIncidentStatusOptions(statusOpts);
      setStatusOptions(sortedStatusOpts)
    } catch (error) {
      console.debug('Background status options refresh failed:', error)
    }
  }, [])

  // Function to refresh severity options only (lighter weight)
  const refreshSeverityOptions = useCallback(async () => {
    try {
      const severities = await getSeverities()
      const severityOpts = [
        { value: '', label: 'All severities' },
        ...(Array.isArray(severities) ? severities.map(severity => ({
          value: severity.toLowerCase(),
          label: severity
        })) : [])
      ]
      // Sort severity options
      const sortedSeverityOpts = sortSeverityOptions(severityOpts);
      setSeverityOptions(sortedSeverityOpts)
    } catch (error) {
      console.debug('Background severity options refresh failed:', error)
    }
  }, [])

  // Function to refresh category options only (lighter weight)
  const refreshCategoryOptions = useCallback(async () => {
    try {
      const categories = await getIncidentCategories()
      const categoryOpts = [
        { value: '', label: 'All categories' },
        ...(Array.isArray(categories) ? categories.map(category => ({
          value: category.toLowerCase().replace(/\s+/g, '_'),
          label: category
        })) : [])
      ]
      // Sort category options
      const sortedCategoryOpts = sortCategoryOptions(categoryOpts);
      setCategoryOptions(sortedCategoryOpts)
    } catch (error) {
      console.debug('Background category options refresh failed:', error)
    }
  }, [])

  // Function to refresh all maintenance data (lighter weight combined)
  const refreshAllMaintenanceData = useCallback(async () => {
    try {
      const [statuses, severities, categories] = await Promise.all([
        getIncidentStatuses(),
        getSeverities(),
        getIncidentCategories()
      ]);
      
      // Update status options
      const statusOpts = [
        { value: '', label: 'All statuses' },
        ...(Array.isArray(statuses) ? statuses.map(status => ({
          value: status.toLowerCase().replace(/\s+/g, '_'),
          label: status
        })) : [])
      ];
      const sortedStatusOpts = sortIncidentStatusOptions(statusOpts);
      setStatusOptions(sortedStatusOpts);

      // Update severity options
      const severityOpts = [
        { value: '', label: 'All severities' },
        ...(Array.isArray(severities) ? severities.map(severity => ({
          value: severity.toLowerCase(),
          label: severity
        })) : [])
      ];
      const sortedSeverityOpts = sortSeverityOptions(severityOpts);
      setSeverityOptions(sortedSeverityOpts);

      // Update category options
      const categoryOpts = [
        { value: '', label: 'All categories' },
        ...(Array.isArray(categories) ? categories.map(category => ({
          value: category.toLowerCase().replace(/\s+/g, '_'),
          label: category
        })) : [])
      ];
      const sortedCategoryOpts = sortCategoryOptions(categoryOpts);
      setCategoryOptions(sortedCategoryOpts);
    } catch (error) {
      console.debug('Background maintenance data refresh failed:', error)
    }
  }, [])

  // Load dynamic maintenance data (async)
  const loadMaintenanceData = useCallback(async () => {
    try {
      const [statuses, severities, categories] = await Promise.all([
        getIncidentStatuses(),
        getSeverities(),
        getIncidentCategories()
      ]);
      
      // Create status options
      const statusOpts = [
        { value: '', label: 'All statuses' },
        ...(Array.isArray(statuses) ? statuses.map(status => ({
          value: status.toLowerCase().replace(/\s+/g, '_'),
          label: status
        })) : [])
      ];
      // Sort status options with custom logic (new statuses go between Contained and Recovered)
      const sortedStatusOpts = sortIncidentStatusOptions(statusOpts);
      setStatusOptions(sortedStatusOpts);

      // Create severity options
      const severityOpts = [
        { value: '', label: 'All severities' },
        ...(Array.isArray(severities) ? severities.map(severity => ({
          value: severity.toLowerCase(),
          label: severity
        })) : [])
      ];
      // Sort severity options with default ones first, custom ones at bottom
      const sortedSeverityOpts = sortSeverityOptions(severityOpts);
      setSeverityOptions(sortedSeverityOpts);

      // Create category options
      const categoryOpts = [
        { value: '', label: 'All categories' },
        ...(Array.isArray(categories) ? categories.map(category => ({
          value: category.toLowerCase().replace(/\s+/g, '_'),
          label: category
        })) : [])
      ];
      // Sort category options alphabetically
      const sortedCategoryOpts = sortCategoryOptions(categoryOpts);
      setCategoryOptions(sortedCategoryOpts);
    } catch (error) {
      console.error('Error loading maintenance data:', error);
      // Set default empty options on error
      setStatusOptions([{ value: '', label: 'All statuses' }]);
      setSeverityOptions([{ value: '', label: 'All severities' }]);
      setCategoryOptions([{ value: '', label: 'All categories' }]);
    }
  }, []);

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

  // Start polling for maintenance data updates every 5 seconds
  useEffect(() => {
    if (!mounted || !user) return

    // Clear any existing interval
    if (maintenancePollingRef.current) {
      clearInterval(maintenancePollingRef.current)
    }

    // Start polling for maintenance data updates every 5 seconds
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

  const fetchIncidents = useCallback(async (showLoading = true) => {
    if (!user) return
    try {
      if (showLoading) {
        setLoading(true)
      }
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.category) params.append('category', filters.category)
      if (filters.branch) params.append('branch_acronym', filters.branch)
      
      const response = await api.get(`/incidents?${params.toString()}`)
      const list = Array.isArray(response.data) ? response.data : []
      
      // Normalize values to match filter format
      const normalizedList = list.map((incident: any) => ({
        ...incident,
        status: incident.status ? incident.status.toLowerCase().replace(/\s+/g, '_') : 'new',
        severity: incident.severity ? incident.severity.toLowerCase() : 'medium',
        category: incident.category ? incident.category.toLowerCase().replace(/\s+/g, '_') : ''
      }))
      
      setIncidents(normalizedList.sort((a, b) => 
        new Date((b as Incident).createdAt || 0).getTime() - new Date((a as Incident).createdAt || 0).getTime()
      ))
    } catch (error) {
      console.error('Failed to fetch incidents:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [user, filters.status, filters.severity, filters.category, filters.branch])

  // Initial load - shows loading spinner
  useEffect(() => {
    if (!mounted) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchIncidents(true)
  }, [user, router, mounted, fetchIncidents])

  // Background updates - NO LOADING STATE
  useEffect(() => {
    if (!mounted || !user) return
    
    const interval = setInterval(() => {
      fetchIncidents(false) // Silent background update - no loading state
    }, 30000) // Poll every 30 seconds
    
    return () => clearInterval(interval)
  }, [mounted, user, fetchIncidents])

  // When filters change, fetch with loading state
  useEffect(() => {
    if (!mounted || !user || loading) return
    fetchIncidents(true) // Show loading when filters change
  }, [filters])

  // Keyword search: split query into words, match any incident field (case-insensitive)
  const keywords = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredIncidents = keywords.length === 0
    ? incidents
    : incidents.filter((inc) => {
        const searchText = [
          inc.incidentNumber,
          inc.title,
          inc.category,
          inc.severity,
          inc.status,
          inc.affectedAsset,
          inc.affectedUser,
          inc.sourceTicketNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return keywords.every((kw) => searchText.includes(kw))
      })

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const paginatedIncidents = filteredIncidents.slice(start, start + PAGE_SIZE)

  // Clamp page when list shrinks (e.g. after filter/search)
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [filteredIncidents.length, totalPages, page])

  // Helper function to get display label for status
  const getStatusLabel = (status: string) => {
    const matchingOption = statusOptions.find(opt => opt.value === status);
    if (matchingOption) return matchingOption.label;
    // If not found in options, try to format it nicely
    return status ? status.replace(/_/g, ' ') : 'new';
  };

  // Helper function to get display label for severity
  const getSeverityLabel = (severity: string) => {
    const matchingOption = severityOptions.find(opt => opt.value === severity);
    if (matchingOption) return matchingOption.label;
    return severity || 'medium';
  };

  // Helper function to get display label for category
  const getCategoryLabel = (category: string) => {
    const matchingOption = categoryOptions.find(opt => opt.value === category);
    if (matchingOption) return matchingOption.label;
    return category ? category.replace(/_/g, ' ') : '';
  };

  const csvEscape = (val: unknown) => {
    if (val == null) return ''
    const s = String(val)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const handleExportIncidentsCSV = () => {
    const headers = ['Incident #', 'Title', 'Category', 'Severity', 'Status', 'Affected Asset', 'Affected User', 'Source Ticket', 'Created']
    const rows = filteredIncidents.map((inc) => [
      inc.incidentNumber || `#${inc.id}`,
      inc.title || '',
      getCategoryLabel(inc.category || ''),
      getSeverityLabel(inc.severity || 'medium'),
      getStatusLabel(inc.status || 'new'),
      inc.affectedAsset || '',
      inc.affectedUser || '',
      inc.sourceTicketNumber || '',
      inc.createdAt ? new Date(inc.createdAt).toISOString() : '',
    ])
    const csv = ['\uFEFF' + headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `incidents-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleExportIncidentsPDF = async () => {
  setExporting(true)
  try {
    const [jsPDFModule, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const jsPDF = jsPDFModule.default
    const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Prepare table data - match the columns in the incidents table (excluding SLA)
    const tableData = filteredIncidents.map((inc) => [
      inc.incidentNumber || `#${inc.id}`,
      getCategoryLabel(inc.category || ''),
      (inc.title || '').slice(0, 30),
      getSeverityLabel(inc.severity || 'medium'),
      getStatusLabel(inc.status || 'new'),
      inc.affectedAsset || '—',
      inc.affectedUser || '—',
      inc.sourceTicketNumber || '—',
      inc.createdAt ? new Date(inc.createdAt).toLocaleDateString() : '—',
    ])

    // Logo handling - exactly like audit logs and tickets
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
    
    // Header - exactly like audit logs and tickets
    doc.setFontSize(16)
    doc.text('Incidents Export (Full Report)', logoEndX, startY)
    
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString('en-PH', { 
      timeZone: 'Asia/Manila',
      dateStyle: 'full',
      timeStyle: 'short'
    })} (PH time) | Total incidents: ${filteredIncidents.length}`, logoEndX, startY + 7)
    
    // Add filter information if any filters are applied
    const filterParts = []
    if (filters.status) filterParts.push(`Status: ${statusOptions.find(o => o.value === filters.status)?.label || filters.status}`)
    if (filters.severity) filterParts.push(`Severity: ${severityOptions.find(o => o.value === filters.severity)?.label || filters.severity}`)
    if (filters.category) filterParts.push(`Category: ${categoryOptions.find(o => o.value === filters.category)?.label || filters.category}`)
    if (filters.branch) filterParts.push(`Branch: ${REAL_BRANCHES.find(b => b.acronym === filters.branch)?.name || filters.branch}`)
    if (searchQuery.trim()) filterParts.push(`Search: "${searchQuery.trim()}"`)
    
    if (filterParts.length > 0) {
      doc.text(`Filters: ${filterParts.join(' • ')}`, logoEndX, startY + 14)
    }
    
    const tableStartY = startY + (filterParts.length > 0 ? 20 : 18)
    
    // Generate table with all columns from incidents table
    autoTable(doc, {
      head: [['Incident #', 'Category', 'Title', 'Severity', 'Status', 'Asset', 'User', 'Source Ticket', 'Created']],
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
        0: { cellWidth: 18 }, // Incident #
        1: { cellWidth: 18 }, // Category
        2: { cellWidth: 35 }, // Title
        3: { cellWidth: 15 }, // Severity
        4: { cellWidth: 16 }, // Status
        5: { cellWidth: 18 }, // Affected Asset
        6: { cellWidth: 18 }, // Affected User
        7: { cellWidth: 18 }, // Source Ticket
        8: { cellWidth: 16 }, // Created
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
    doc.save(`incidents-export-${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (e) {
    console.error('PDF export failed:', e)
    alert('Failed to generate PDF.')
  } finally {
    setExporting(false)
  }
}

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['security_officer', 'admin']}>
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
    <ProtectedRoute allowedRoles={['security_officer', 'admin']}>
      <div className="panel-page">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cybersecurity Incidents</h1>
              <button
                type="button"
                onClick={() => fetchIncidents(true)}
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
              <Link href="/incidents/create" className="btn-primary-incidents shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Incident
              </Link>
            )}
          </div>

          {/* Filters Card */}
          <div className="panel-card border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Filter incidents</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                <ModernStatusFilterSelect
                  value={filters.status}
                  onChange={(value) => { setFilters({ ...filters, status: value }); setPage(1) }}
                  options={statusOptions}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Severity</label>
                <ModernSeverityFilterSelect
                  value={filters.severity}
                  onChange={(value) => { setFilters({ ...filters, severity: value }); setPage(1) }}
                  options={severityOptions}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                <ModernCategoryFilterSelect
                  value={filters.category}
                  onChange={(value) => { setFilters({ ...filters, category: value }); setPage(1) }}
                  options={categoryOptions}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Branch</label>
                <Listbox value={filters.branch} onChange={(value) => { setFilters({ ...filters, branch: value }); setPage(1) }}>
                  <div className="relative">
                    <Listbox.Button className="relative w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white text-gray-900 rounded-xl border border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer font-medium text-left">
                      <span>{filters.branch ? REAL_BRANCHES.find((b) => b.acronym === filters.branch)?.name ?? filters.branch : 'All branches'}</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Listbox.Button>
                    <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                      <Listbox.Options className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto">
                        <Listbox.Option value="" className={({ active }) => `cursor-pointer py-2.5 px-4 ${active ? 'bg-gray-50' : ''}`}>All branches</Listbox.Option>
                        {REAL_BRANCHES.map((b) => (
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
            {hasRole(user, 'security_officer', 'admin') && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-gray-500">Export current view (filters + search):</span>
                <button
                  type="button"
                  onClick={handleExportIncidentsCSV}
                  disabled={exporting || filteredIncidents.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportIncidentsPDF}
                  disabled={exporting || filteredIncidents.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {exporting ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-200 border-t-red-600" /> : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  )}
                  Export PDF
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="panel-card border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-red-600 mb-4" />
              <p>Loading incidents...</p>
            </div>
          ) : incidents.length === 0 ? (
            <div className="panel-card border border-gray-200 text-center py-12 text-gray-500">No incidents found</div>
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
                        placeholder="Search incidents by #, title, category, severity, status, affected asset/user..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow"
                      />
                    </div>
                    {searchQuery.trim() && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                          {filteredIncidents.length} result{filteredIncidents.length !== 1 ? 's' : ''}
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
                  {filteredIncidents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No incidents match your search. Try different keywords.
                    </div>
                  ) : (
                    <table className="min-w-[1000px] w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Incident #</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Category</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Title</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Severity</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Affected Asset</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Affected User</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Source Ticket</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Created</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedIncidents.map((incident) => {
                          return (
                            <tr key={incident.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Link href={`/incidents/${incident.id}`} className="font-mono text-red-600 hover:text-red-700 font-medium transition-colors">
                                  {incident.incidentNumber || `#${incident.id}`}
                                </Link>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {getCategoryLabel(incident.category) || '—'}
                              </td>
                              <td className="px-4 py-4 min-w-[140px]">
                                <Link href={`/incidents/${incident.id}`} className="text-gray-900 hover:text-red-600 transition-colors line-clamp-2">
                                  {incident.title || 'Untitled'}
                                </Link>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {getSeverityLabel(incident.severity || 'medium')}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {getStatusLabel(incident.status || 'new')}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {incident.affectedAsset || '—'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {incident.affectedUser || '—'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {incident.sourceTicketNumber ? (
                                  <Link href={incident.sourceTicketId ? `/tickets/${incident.sourceTicketId}` : '#'} className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                                    {incident.sourceTicketNumber}
                                  </Link>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatPinoyDateTime(incident.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {filteredIncidents.length > 0 && (
                  <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-3">
                    <p className="text-sm text-gray-600">
                      Showing {start + 1}–{Math.min(start + PAGE_SIZE, filteredIncidents.length)} of {filteredIncidents.length} incidents
                      {searchQuery.trim() ? ` (filtered from ${incidents.length})` : ''}
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

export default function IncidentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600" />
        </div>
      }
    >
      <IncidentsPageContent />
    </Suspense>
  )
}