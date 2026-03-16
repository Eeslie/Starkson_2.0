'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api, { getApiBaseUrl } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, setStoredAuth } from '@/lib/auth'
import { useBranches } from '@/lib/useBranches'
import { getAffectedSystems, getCategories, getPriorities, fetchMaintenanceData, initializeDefaults } from '@/lib/maintenance'
import SelectDropdown from '@/components/SelectDropdown'

const REQUEST_TYPES = [
  { value: 'account_password', label: 'Account & Password Issues' },
  { value: 'software_installation', label: 'Software Installation' },
  { value: 'hardware', label: 'Hardware Problems' },
  { value: 'network_internet', label: 'Network / Internet Issues' },
  { value: 'access_request', label: 'Access Requests' },
  { value: 'general', label: 'General IT Assistance' },
]

// Modern Priority Select Component - COLORS REMOVED with dynamic options
const PrioritySelect = ({ 
  value, 
  onChange,
  priorityOptions 
}: { 
  value: string; 
  onChange: (value: string) => void;
  priorityOptions: { value: string; label: string }[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedPriority = priorityOptions.find(p => p.value === value) || priorityOptions[1] || { value: 'medium', label: 'Medium' };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white text-gray-900
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-md
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-all duration-200
          font-medium text-left
        `}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full bg-gray-500`} />
          <span>{selectedPriority.label}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-40 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {priorityOptions.map((priority) => (
            <button
              key={priority.value}
              type="button"
              onClick={() => {
                onChange(priority.value);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5
                text-sm font-medium
                hover:bg-gray-50
                transition-colors duration-150
                ${value === priority.value ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}
              `}
            >
              <span className={`w-2 h-2 rounded-full bg-gray-500`} />
              <span className="flex-1 text-left">{priority.label}</span>
              {value === priority.value && (
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Modern File Attachment Component
const FileAttachment = ({ file, index, onRemove, status, isUploading }: {
  file: File;
  index: number;
  onRemove: () => void;
  status?: { status: string; message?: string };
  isUploading: boolean;
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');

  // Create preview for images
  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  const getStatusConfig = () => {
    switch (status?.status) {
      case 'success':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600' };
      case 'error':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' };
      case 'uploading':
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`group relative flex items-start gap-3 p-3 rounded-xl border ${config.bg} ${config.border} transition-all hover:shadow-md`}>
      {/* File Icon/Preview */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs">
              {file.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</span>
              {status && (
                <span className={`text-xs ${config.text} flex items-center gap-0.5`}>
                  <span>
                    {status.status === 'uploading' && 'Uploading...'}
                    {status.status === 'success' && 'Uploaded'}
                    {status.status === 'error' && (status.message || 'Failed')}
                  </span>
                </span>
              )}
            </div>
          </div>
          
          {/* Remove Button */}
          {!isUploading && (
            <button
              type="button"
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded-full"
              aria-label="Remove file"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CreateTicketPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(getStoredUser())
  const [userLoaded, setUserLoaded] = useState(false)
  const [priorityOptions, setPriorityOptions] = useState<{ value: string; label: string }[]>([])
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(true)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return
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
      .finally(() => setUserLoaded(true))
  }, [])

  const { realBranches, ALL_BRANCHES_ACRONYM } = useBranches()
  const userBranchList = user?.branchAcronyms && user.branchAcronyms.length > 0 ? user.branchAcronyms : []
  const hasAllBranches = userBranchList.includes(ALL_BRANCHES_ACRONYM)
  const realUserBranches = userBranchList.filter((a: string) => a !== ALL_BRANCHES_ACRONYM)
  const ticketBranchOptions = user?.role === 'admin'
    ? realBranches
    : hasAllBranches
      ? realBranches
      : realBranches.filter((b) => realUserBranches.includes(b.acronym))
  const singleBranchAuto = realUserBranches.length === 1 && !hasAllBranches && user?.role !== 'admin'
  const noBranchesAssigned = userLoaded && user?.role !== 'admin' && !hasAllBranches && realUserBranches.length === 0
  const defaultBranch = singleBranchAuto
    ? realUserBranches[0]
    : user?.role === 'admin' && realBranches.length > 0
      ? realBranches[0].acronym
      : ticketBranchOptions.length > 0
        ? ticketBranchOptions[0].acronym
        : ''
  const [formData, setFormData] = useState({
    requestType: '',
    title: '',
    description: '',
    affectedSystem: '',
    priority: '',
    category: '',
    branchAcronym: defaultBranch,
  })
  const [affectedSystems, setAffectedSystems] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [otherAffectedSystem, setOtherAffectedSystem] = useState('')
  const [otherCategory, setOtherCategory] = useState('')

  // Refs for polling
  const maintenancePollingRef = useRef<NodeJS.Timeout>()
  const isMaintenancePollingRef = useRef<boolean>(false)

  // Initialize defaults on mount (no longer needed but kept for compatibility)
  useEffect(() => {
    // initializeDefaults() is now a no-op since we use the database
  }, [])

  // Helper function to sort priorities in the desired order
  const sortPriorities = (priorities: string[]): string[] => {
    const priorityOrder = ['Low', 'Medium', 'High', 'Urgent'];
    
    // Separate into default priorities and custom priorities
    const defaultPriorities: string[] = [];
    const customPriorities: string[] = [];
    
    priorities.forEach(p => {
      if (priorityOrder.includes(p)) {
        defaultPriorities.push(p);
      } else {
        customPriorities.push(p);
      }
    });
    
    // Sort default priorities according to the specified order
    defaultPriorities.sort((a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b));
    
    // Sort custom priorities alphabetically (or however you want them)
    customPriorities.sort((a, b) => a.localeCompare(b));
    
    // Return default priorities first, then custom priorities
    return [...defaultPriorities, ...customPriorities];
  };

  // Load maintenance data with refresh
  const loadMaintenanceData = useCallback(async () => {
    setIsLoadingMaintenance(true)
    try {
      // Fetch maintenance data from API
      const data = await fetchMaintenanceData()
      
      console.log('Loaded affected systems:', data.affectedSystems) // Debug log
      console.log('Loaded categories:', data.categories) // Debug log
      console.log('Loaded priorities:', data.priorities) // Debug log
      
      setAffectedSystems(data.affectedSystems)
      setCategories(data.categories)
      
      // Sort priorities in the desired order: Low, Medium, High, Urgent, then custom priorities
      const sortedPriorities = sortPriorities(data.priorities);
      
      // Format priorities
      const formattedPriorities = sortedPriorities.map(p => ({
        value: p.toLowerCase().replace(/\s+/g, '_'),
        label: p
      }))
      
      setPriorityOptions(formattedPriorities)
      
      // Set default priority if available
      if (formattedPriorities.length > 0) {
        // Try to find 'medium' or use the first one
        const defaultPriority = formattedPriorities.find(p => p.value === 'medium') || formattedPriorities[0]
        setFormData(prev => ({ ...prev, priority: defaultPriority.value }))
      }
    } catch (error) {
      console.error('Error loading maintenance data:', error)
    } finally {
      setIsLoadingMaintenance(false)
    }
  }, [])

  // Function to refresh affected systems only (lighter weight)
  const refreshAffectedSystems = useCallback(async () => {
    try {
      const systems = await getAffectedSystems()
      setAffectedSystems(systems)
    } catch (error) {
      console.debug('Background affected systems refresh failed:', error)
    }
  }, [])

  // Function to refresh categories only (lighter weight)
  const refreshCategories = useCallback(async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch (error) {
      console.debug('Background categories refresh failed:', error)
    }
  }, [])

  // Function to refresh priorities only (lighter weight)
  const refreshPriorities = useCallback(async () => {
    try {
      const priorities = await getPriorities()
      
      // Sort priorities in the desired order: Low, Medium, High, Urgent, then custom priorities
      const sortedPriorities = sortPriorities(priorities);
      
      // Format priorities
      const formattedPriorities = sortedPriorities.map(p => ({
        value: p.toLowerCase().replace(/\s+/g, '_'),
        label: p
      }))
      
      setPriorityOptions(formattedPriorities)
      
      // If current priority is not in the new options, reset to default
      setFormData(prev => {
        const currentPriorityExists = formattedPriorities.some(p => p.value === prev.priority)
        if (!currentPriorityExists && formattedPriorities.length > 0) {
          const defaultPriority = formattedPriorities.find(p => p.value === 'medium') || formattedPriorities[0]
          return { ...prev, priority: defaultPriority.value }
        }
        return prev
      })
    } catch (error) {
      console.debug('Background priorities refresh failed:', error)
    }
  }, [])

  // Function to refresh all maintenance data (lighter weight combined)
  const refreshAllMaintenanceData = useCallback(async () => {
    try {
      const [systems, cats, priorities] = await Promise.all([
        getAffectedSystems(),
        getCategories(),
        getPriorities()
      ])
      
      setAffectedSystems(systems)
      setCategories(cats)
      
      // Sort priorities in the desired order: Low, Medium, High, Urgent, then custom priorities
      const sortedPriorities = sortPriorities(priorities);
      
      // Format priorities
      const formattedPriorities = sortedPriorities.map(p => ({
        value: p.toLowerCase().replace(/\s+/g, '_'),
        label: p
      }))
      
      setPriorityOptions(formattedPriorities)
      
      // If current priority is not in the new options, reset to default
      setFormData(prev => {
        const currentPriorityExists = formattedPriorities.some(p => p.value === prev.priority)
        if (!currentPriorityExists && formattedPriorities.length > 0) {
          const defaultPriority = formattedPriorities.find(p => p.value === 'medium') || formattedPriorities[0]
          return { ...prev, priority: defaultPriority.value }
        }
        return prev
      })
    } catch (error) {
      console.debug('Background maintenance data refresh failed:', error)
    }
  }, [])

  // Load data on mount and when user changes
  useEffect(() => {
    loadMaintenanceData()
    
    // Set up an interval to refresh data every 30 seconds
    const interval = setInterval(loadMaintenanceData, 30000)
    
    // Listen for maintenance data changes from the maintenance modal
    const handleMaintenanceDataChange = () => {
      loadMaintenanceData()
    }
    window.addEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('maintenanceDataChanged', handleMaintenanceDataChange)
    }
  }, [loadMaintenanceData])

  // Start polling for maintenance data updates every 10 seconds
  useEffect(() => {
    if (!userLoaded) return

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
  }, [userLoaded, refreshAllMaintenanceData])

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

  const [files, setFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<Record<number, { status: 'pending' | 'uploading' | 'success' | 'error', message?: string }>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Update branch acronym when defaultBranch changes
  useEffect(() => {
    if (defaultBranch && !formData.branchAcronym) {
      setFormData(prev => ({ ...prev, branchAcronym: defaultBranch }))
    }
  }, [defaultBranch, formData.branchAcronym])

  // Create options with "Others" at the end
  const affectedSystemOptions = [
    ...affectedSystems.map((o) => ({ value: o, label: o })),
    { value: 'others', label: 'Others' }
  ]

  const categoryOptions = [
    ...categories.map((o) => ({ value: o, label: o })),
    { value: 'others', label: 'Others' }
  ]

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      const validFiles = droppedFiles.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is too large. Maximum size is 10MB.`)
          return false
        }
        return true
      })
      setFiles(prev => [...prev, ...validFiles])
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      const validFiles = selectedFiles.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is too large. Maximum size is 10MB.`)
          return false
        }
        return true
      })
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setUploadStatus(prev => {
      const newStatus = { ...prev }
      delete newStatus[index]
      return newStatus
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (noBranchesAssigned) return
    setError('')
    setLoading(true)

    if (!formData.requestType || !formData.title || !formData.description) {
      setError('Please fill in all required fields')
      setLoading(false)
      return
    }

    if (!formData.priority) {
      setError('Please select a priority')
      setLoading(false)
      return
    }

    // Validate "Others" fields
    if (formData.affectedSystem === 'others' && !otherAffectedSystem.trim()) {
      setError('Please specify the affected system')
      setLoading(false)
      return
    }

    if (formData.category === 'others' && !otherCategory.trim()) {
      setError('Please specify the category')
      setLoading(false)
      return
    }

    const branchToSend = singleBranchAuto ? realUserBranches[0] : formData.branchAcronym
    if (!branchToSend) {
      setError('Please select a branch for this ticket.')
      setLoading(false)
      return
    }

    try {
      // Prepare payload with custom "Others" values
      const payload = { 
        ...formData, 
        branchAcronym: branchToSend,
        affectedSystem: formData.affectedSystem === 'others' ? otherAffectedSystem.trim() : formData.affectedSystem,
        category: formData.category === 'others' ? otherCategory.trim() : formData.category,
      }
      
      const response = await api.post('/tickets', payload)
      const ticketId = response.data.ticketId

      if (files.length > 0) {
        setUploading(true)
        const uploadPromises = files.map(async (file, index) => {
          setUploadStatus(prev => ({ ...prev, [index]: { status: 'uploading' } }))
          
          try {
            const uploadFormData = new FormData()
            uploadFormData.append('file', file)
            
            const token = localStorage.getItem('token')
            const response = await fetch(`${getApiBaseUrl()}/attachments/ticket/${ticketId}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: uploadFormData
            })
            
            if (response.ok) {
              setUploadStatus(prev => ({ ...prev, [index]: { status: 'success', message: 'Uploaded successfully' } }))
            } else {
              const errorData = await response.json().catch(() => ({}))
              setUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: errorData.message || 'Upload failed' } }))
              throw new Error(errorData.message || 'Upload failed')
            }
          } catch (err: any) {
            setUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: err.message || 'Upload failed' } }))
            throw err
          }
        })
        
        try {
          await Promise.all(uploadPromises)
        } catch (err) {
          console.error('Some file uploads failed:', err)
        }
        setUploading(false)
      }

      router.push(`/tickets/${ticketId}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create ticket')
      setLoading(false)
      setUploading(false)
    }
  }

  // Helper function to get priority description
  const getPriorityDescription = (priorityValue: string) => {
    const priorityMap: Record<string, string> = {
      'low': 'Non-urgent issue, can be scheduled',
      'medium': 'Standard priority for most issues',
      'high': 'Important issue needing quick resolution',
      'urgent': 'Critical issue affecting business operations',
    };
    return priorityMap[priorityValue] || 'Select a priority level';
  };

  return (
    <ProtectedRoute allowedRoles={['user', 'admin']}>
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Header with breadcrumb */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link href="/tickets" className="hover:text-blue-600 transition-colors">
                Tickets
              </Link>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-900 font-medium">Create New Ticket</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Create IT Support Ticket
            </h1>
            <p className="text-gray-500 mt-1">
              Please provide detailed information about your issue to help us resolve it faster.
            </p>
          </div>

          {/* Loading state */}
          {isLoadingMaintenance && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-blue-700">Loading maintenance data...</p>
            </div>
          )}

          {/* No branches assigned: show message and block ticket creation */}
          {userLoaded && noBranchesAssigned && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
              <p className="font-medium text-amber-800">No branches assigned</p>
              <p className="text-sm text-amber-700 mt-1">
                Your account does not have any branch assigned yet. Contact your administrator to assign you to a branch so you can create tickets.
              </p>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Branch: only show when user has 2+ branches or All Branches (single-branch users are auto-assigned) */}
            {userLoaded && !noBranchesAssigned && !singleBranchAuto && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="font-semibold text-gray-900">Branch</h2>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.branchAcronym}
                    onChange={(e) => setFormData({ ...formData, branchAcronym: e.target.value })}
                    className="w-full max-w-md px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select branch</option>
                    {ticketBranchOptions.map((b) => (
                      <option key={b.acronym} value={b.acronym}>
                        {b.acronym} – {b.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Ticket will be numbered for this branch (e.g. {formData.branchAcronym || 'D01'}-000001).</p>
                </div>
              </div>
            )}

            {singleBranchAuto && (
              <input type="hidden" name="branchAcronym" value={formData.branchAcronym} />
            )}

            {/* Request Type Card - overflow-visible so SelectDropdown opens below */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible hover:shadow-md transition-shadow">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-semibold text-gray-900">Request Details</h2>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Request Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {REQUEST_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, requestType: type.value })}
                        className={`
                          flex items-center justify-between p-3 rounded-xl border-2 transition-all
                          ${formData.requestType === type.value
                            ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                            : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                          }
                        `}
                      >
                        <span className="text-sm font-medium text-left text-gray-900">
                          {type.label}
                        </span>
                        {formData.requestType === type.value && (
                          <svg className="w-5 h-5 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                    placeholder="e.g., Cannot access email, Laptop not turning on..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[120px]"
                    rows={6}
                    placeholder="Please provide detailed information about the issue..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <SelectDropdown
                      label="Affected System"
                      value={formData.affectedSystem}
                      onChange={(v) => setFormData({ ...formData, affectedSystem: v })}
                      options={affectedSystemOptions}
                      placeholder={isLoadingMaintenance ? "Loading..." : "Select affected system"}
                    />
                    {formData.affectedSystem === 'others' && (
                      <input
                        type="text"
                        value={otherAffectedSystem}
                        onChange={(e) => setOtherAffectedSystem(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow mt-2"
                        placeholder="Please specify affected system"
                        required={formData.affectedSystem === 'others'}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <SelectDropdown
                      label="Category"
                      value={formData.category}
                      onChange={(v) => setFormData({ ...formData, category: v })}
                      options={categoryOptions}
                      placeholder={isLoadingMaintenance ? "Loading..." : "Select category"}
                    />
                    {formData.category === 'others' && (
                      <input
                        type="text"
                        value={otherCategory}
                        onChange={(e) => setOtherCategory(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow mt-2"
                        placeholder="Please specify category"
                        required={formData.category === 'others'}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-semibold text-gray-900">Priority Level</h2>
              </div>
              <div className="p-6">
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Priority <span className="text-red-500">*</span>
                  </label>
                  <PrioritySelect
                    value={formData.priority}
                    onChange={(value) => setFormData({ ...formData, priority: value })}
                    priorityOptions={priorityOptions}
                  />
                  <p className="text-xs text-gray-500 mt-4">
                    {getPriorityDescription(formData.priority)}
                  </p>
                </div>
              </div>
            </div>

            {/* Attachments Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-semibold text-gray-900">Attachments</h2>
              </div>
              <div className="p-6">
                {/* Drag & Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8
                    transition-all duration-200
                    ${dragActive 
                      ? 'border-blue-500 bg-blue-50/50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50/50'
                    }
                  `}
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept="image/*,.pdf,.doc,.docx,.txt,.log,.csv"
                    id="file-upload"
                  />
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Drag & drop files here, or click to select
                    </p>
                    <p className="text-xs text-gray-500">
                      Images, PDF, DOC, DOCX, TXT, LOG, CSV (max 10MB per file)
                    </p>
                  </div>
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-700">
                        Selected Files ({files.length})
                      </h3>
                      {!uploading && files.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFiles([]);
                            setUploadStatus({});
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                        >
                          Remove all
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {files.map((file, index) => (
                        <FileAttachment
                          key={index}
                          file={file}
                          index={index}
                          onRemove={() => removeFile(index)}
                          status={uploadStatus[index]}
                          isUploading={uploading}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                disabled={loading || uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploading || noBranchesAssigned || isLoadingMaintenance}
                className={`
                  inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white
                  bg-gradient-to-r from-blue-600 to-blue-700
                  hover:from-blue-700 hover:to-blue-800
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-sm hover:shadow-md
                  transition-all duration-200
                `}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Uploading files...</span>
                  </>
                ) : loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Creating ticket...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}