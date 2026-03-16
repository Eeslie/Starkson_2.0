'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  getAffectedSystems,
  getCategories,
  getIncidentCategories,
  getSeverities,
  getTicketStatuses,
  getPriorities,
  getIncidentStatuses,
  addMaintenanceItem,
  deleteMaintenanceItem,
  clearMaintenanceCache,
} from '@/lib/maintenance'

type Branch = { acronym: string; name: string }

type ManageType = 'branches' | 'category' | 'affected_system' | 'incident_category' | 'severity' | 'ticket_status' | 'priority' | 'incident_status' | null
type ActionType = 'add' | 'delete' | null

const LABELS: Record<NonNullable<ManageType>, { singular: string; plural: string }> = {
  branches: { singular: 'Branch', plural: 'Branches' },
  category: { singular: 'Category', plural: 'Categories' },
  affected_system: { singular: 'Affected System', plural: 'Affected Systems' },
  incident_category: { singular: 'Incident Category', plural: 'Incident Categories' },
  severity: { singular: 'Severity', plural: 'Severities' },
  ticket_status: { singular: 'Ticket Status', plural: 'Ticket Statuses' },
  priority: { singular: 'Priority', plural: 'Priorities' },
  incident_status: { singular: 'Incident Status', plural: 'Incident Statuses' },
}

// Helper function to determine if "a" or "an" should be used
const getArticle = (word: string): string => {
  const firstLetter = word.charAt(0).toLowerCase();
  return ['a', 'e', 'i', 'o', 'u'].includes(firstLetter) ? 'an' : 'a';
};

// Loading Spinner Component
const LoadingSpinner = ({ size = 'w-5 h-5' }: { size?: string }) => (
  <svg className={`animate-spin ${size} text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// Export Options Modal Component
const ExportOptionsModal = ({ 
  isOpen, 
  onClose, 
  branches,
  searchQuery 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  branches: Branch[];
  searchQuery: string;
}) => {
  const [exportLoading, setExportLoading] = useState(false);

  // Filter branches based on search query (same as in view modal)
  const filteredBranches = branches.filter(branch => 
    branch.acronym.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    setExportLoading(true);
    try {
      // Prepare CSV content
      const headers = ['Acronym', 'Name'];
      const csvContent = [
        headers.join(','),
        ...filteredBranches.map(branch => 
          `"${branch.acronym}","${branch.name}"`
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `branches_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
      onClose();
    }
  };

  const handleExportPDF = async () => {
    setExportLoading(true);
    try {
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);
      
      const jsPDF = jsPDFModule.default;
      const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/STARKSON-LG.png` : '';
      let startY = 14;
      let logoEndX = 14; // Default X position if no logo
      
      if (logoUrl) {
        try {
          const imgResp = await fetch(logoUrl);
          const imgBlob = await imgResp.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imgBlob);
          });
          const imgW = 45;
          const imgH = 45;
          doc.addImage(base64, 'PNG', 14, 2, imgW, imgH);
          // Calculate where the logo ends (x + width) plus a margin
          logoEndX = 14 + imgW + 5; // 5mm margin after logo
          startY = 24;
        } catch {
          startY = 14;
          logoEndX = 14;
        }
      }
      
      doc.setFontSize(16);
      // Position text to the right of the logo (or at default position if no logo)
      doc.text('Branches Report', logoEndX, startY);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (PH time) | Total branches: ${filteredBranches.length}`, logoEndX, startY + 7);
      
      // Add search filter info if applicable
      if (searchQuery) {
        doc.text(`Filter: "${searchQuery}"`, logoEndX, startY + 14);
      }

      const tableStartY = startY + (searchQuery ? 21 : 18);
      
      const tableData = filteredBranches.map((branch) => [
        branch.acronym,
        branch.name
      ]);

      autoTable(doc, {
        head: [['Acronym', 'Name']],
        body: tableData,
        startY: tableStartY,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [66, 66, 66] }
      });

      doc.save(`branches_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to generate PDF. Make sure jspdf and jspdf-autotable are installed.');
    } finally {
      setExportLoading(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Export Branches</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Choose export format for {filteredBranches.length} branch{filteredBranches.length !== 1 ? 'es' : ''}
            {searchQuery && ` matching "${searchQuery}"`}.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleExportCSV}
              disabled={exportLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exportLoading ? (
                <>
                  <LoadingSpinner />
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export as CSV
                </>
              )}
            </button>
            
            <button
              onClick={handleExportPDF}
              disabled={exportLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exportLoading ? (
                <>
                  <LoadingSpinner />
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Export as PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={exportLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// View Branches Modal Component
const ViewBranchesModal = ({ 
  isOpen, 
  onClose, 
  branches 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  branches: Branch[];
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  // Filter branches based on search query
  const filteredBranches = branches.filter(branch => 
    branch.acronym.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All Branches</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {/* Search and Export */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="search"
                  placeholder="Search branches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                />
              </div>
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>

            {/* Results count */}
            <p className="text-sm text-gray-500 mb-3">
              Showing {filteredBranches.length} of {branches.length} branches
            </p>

            {/* Branches Table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acronym</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBranches.length > 0 ? (
                    filteredBranches.map((branch) => (
                      <tr key={branch.acronym} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{branch.acronym}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{branch.name}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                        No branches match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Export Options Modal */}
      <ExportOptionsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        branches={branches}
        searchQuery={searchQuery}
      />
    </>
  );
};

export default function MaintenanceModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [manageType, setManageType] = useState<ManageType>(null)
  const [actionType, setActionType] = useState<ActionType>(null)
  const [categories, setCategoriesState] = useState<string[]>([])
  const [affectedSystems, setAffectedSystemsState] = useState<string[]>([])
  const [incidentCategories, setIncidentCategoriesState] = useState<string[]>([])
  const [severities, setSeveritiesState] = useState<string[]>([])
  const [ticketStatuses, setTicketStatusesState] = useState<string[]>([])
  const [priorities, setPrioritiesState] = useState<string[]>([])
  const [incidentStatuses, setIncidentStatusesState] = useState<string[]>([])
  const [branches, setBranchesState] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchError, setBranchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  // State for view branches modal
  const [showViewBranchesModal, setShowViewBranchesModal] = useState(false)
  // Loading states for add/delete operations
  const [addLoading, setAddLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  // State for multi-select delete
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)

  const fetchBranches = async () => {
    try {
      setBranchesLoading(true)
      setBranchError('')
      const res = await api.get('/branches')
      setBranchesState(res.data || [])
    } catch (err: any) {
      setBranchError(err.response?.data?.message || 'Failed to load branches')
      setBranchesState([])
    } finally {
      setBranchesLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setManageType(null)
      setActionType(null)
      loadMaintenanceData()
      fetchBranches()
      setSuccessMessage('')
      setErrorMessage('')
      setSelectedItems([])
    }
  }, [isOpen])

  const loadMaintenanceData = async () => {
    try {
      const [categories, affectedSystems, incidentCategories, severities, ticketStatuses, priorities, incidentStatuses] = await Promise.all([
        getCategories(),
        getAffectedSystems(),
        getIncidentCategories(),
        getSeverities(),
        getTicketStatuses(),
        getPriorities(),
        getIncidentStatuses(),
      ])
      setCategoriesState(categories)
      setAffectedSystemsState(affectedSystems)
      setIncidentCategoriesState(incidentCategories)
      setSeveritiesState(severities)
      setTicketStatusesState(ticketStatuses)
      setPrioritiesState(priorities)
      setIncidentStatusesState(incidentStatuses)
    } catch (error) {
      console.error('Error loading maintenance data:', error)
    }
  }

  const refreshLists = async () => {
    await loadMaintenanceData()
  }

  // Dispatch custom event to notify other components of maintenance data changes
  const notifyMaintenanceDataChange = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('maintenanceDataChanged'))
    }
  }

  const handleAddCategory = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const list = await getCategories()
      if (list.includes(trimmed)) {
        setSuccessMessage(`Category "${trimmed}" already exists`)
        setAddLoading(false)
        return
      }
      await addMaintenanceItem('category', trimmed)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Category "${trimmed}" added successfully`)
      setErrorMessage('')
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      console.error('Add category error:', error)
      const errorMsg = error.response?.data?.message || error.message || `Failed to add category "${trimmed}"`
      setErrorMessage(errorMsg)
      setSuccessMessage('')
    } finally {
      setAddLoading(false)
    }
  }

  
  const handleDeleteCategory = async (name: string) => {
    setDeleteLoading(true)
    try {
      await deleteMaintenanceItem('category', name)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Category "${name}" deleted successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to delete category "${name}"`)
      setSuccessMessage('')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAddAffectedSystem = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const list = await getAffectedSystems()
      if (list.includes(trimmed)) {
        setSuccessMessage(`Affected System "${trimmed}" already exists`)
        setAddLoading(false)
        return
      }
      await addMaintenanceItem('affected_system', trimmed)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Affected System "${trimmed}" added successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to add affected system "${trimmed}"`)
      setSuccessMessage('')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteAffectedSystem = async (name: string) => {
    setDeleteLoading(true)
    try {
      await deleteMaintenanceItem('affected_system', name)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Affected System "${name}" deleted successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to delete affected system "${name}"`)
      setSuccessMessage('')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAddIncidentCategory = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const list = await getIncidentCategories()
      if (list.includes(trimmed)) {
        setSuccessMessage(`Incident Category "${trimmed}" already exists`)
        setAddLoading(false)
        return
      }
      await addMaintenanceItem('incident_category', trimmed)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Incident Category "${trimmed}" added successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to add incident category "${trimmed}"`)
      setSuccessMessage('')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteIncidentCategory = async (name: string) => {
    setDeleteLoading(true)
    try {
      await deleteMaintenanceItem('incident_category', name)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Incident Category "${name}" deleted successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to delete incident category "${name}"`)
      setSuccessMessage('')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle Add Severity
  const handleAddSeverity = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const list = await getSeverities()
      if (list.includes(trimmed)) {
        setSuccessMessage(`Severity "${trimmed}" already exists`)
        setAddLoading(false)
        return
      }
      await addMaintenanceItem('severity', trimmed)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Severity "${trimmed}" added successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to add severity "${trimmed}"`)
      setSuccessMessage('')
    } finally {
      setAddLoading(false)
    }
  }

  // Handle Delete Severity
  const handleDeleteSeverity = async (name: string) => {
    setDeleteLoading(true)
    try {
      await deleteMaintenanceItem('severity', name)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Severity "${name}" deleted successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to delete severity "${name}"`)
      setSuccessMessage('')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle Add Ticket Status
  const handleAddTicketStatus = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const list = await getTicketStatuses()
      if (list.includes(trimmed)) {
        setSuccessMessage(`Ticket Status "${trimmed}" already exists`)
        setAddLoading(false)
        return
      }
      await addMaintenanceItem('ticket_status', trimmed)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Ticket Status "${trimmed}" added successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to add ticket status "${trimmed}"`)
      setSuccessMessage('')
    } finally {
      setAddLoading(false)
    }
  }

  // Handle Delete Ticket Status
  const handleDeleteTicketStatus = async (name: string) => {
    setDeleteLoading(true)
    try {
      await deleteMaintenanceItem('ticket_status', name)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Ticket Status "${name}" deleted successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to delete ticket status "${name}"`)
      setSuccessMessage('')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle Add Priority
  const handleAddPriority = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const list = await getPriorities()
      if (list.includes(trimmed)) {
        setSuccessMessage(`Priority "${trimmed}" already exists`)
        setAddLoading(false)
        return
      }
      await addMaintenanceItem('priority', trimmed)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Priority "${trimmed}" added successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to add priority "${trimmed}"`)
      setSuccessMessage('')
    } finally {
      setAddLoading(false)
    }
  }

  // Handle Delete Priority
  const handleDeletePriority = async (name: string) => {
    setDeleteLoading(true)
    try {
      await deleteMaintenanceItem('priority', name)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Priority "${name}" deleted successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to delete priority "${name}"`)
      setSuccessMessage('')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle Add Incident Status
  const handleAddIncidentStatus = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const list = await getIncidentStatuses()
      if (list.includes(trimmed)) {
        setSuccessMessage(`Incident Status "${trimmed}" already exists`)
        setAddLoading(false)
        return
      }
      await addMaintenanceItem('incident_status', trimmed)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Incident Status "${trimmed}" added successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to add incident status "${trimmed}"`)
      setSuccessMessage('')
    } finally {
      setAddLoading(false)
    }
  }

  // Handle Delete Incident Status
  const handleDeleteIncidentStatus = async (name: string) => {
    setDeleteLoading(true)
    try {
      await deleteMaintenanceItem('incident_status', name)
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      setSuccessMessage(`Incident Status "${name}" deleted successfully`)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || `Failed to delete incident status "${name}"`)
      setSuccessMessage('')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAddBranch = async (acronym: string, name: string) => {
    setAddLoading(true)
    try {
      setBranchError('')
      await api.post('/branches', { acronym: acronym.trim().toUpperCase(), name: name.trim() })
      await fetchBranches()
      setSuccessMessage(`Branch "${acronym}" added successfully`)
      // Close modal after successful addition
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (err: any) {
      setBranchError(err.response?.data?.message || 'Failed to add branch')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteBranch = async (acronym: string) => {
    setDeleteLoading(true)
    try {
      setBranchError('')
      await api.delete(`/branches/${encodeURIComponent(acronym)}`)
      await fetchBranches()
      setSuccessMessage(`Branch "${acronym}" deleted successfully`)
      // Close modal after successful deletion
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (err: any) {
      setBranchError(err.response?.data?.message || 'Failed to delete branch')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle multi-select delete
  const handleMultiDelete = async () => {
    if (selectedItems.length === 0 || !manageType) return
    
    setDeleteLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    
    try {
      const typeMap: Record<string, string> = {
        'category': 'category',
        'affected_system': 'affected_system',
        'incident_category': 'incident_category',
        'severity': 'severity',
        'ticket_status': 'ticket_status',
        'priority': 'priority',
        'incident_status': 'incident_status'
      }
      
      const apiType = typeMap[manageType]
      
      if (!apiType) {
        throw new Error(`Invalid type for bulk delete: ${manageType}`)
      }
      
      // Delete items sequentially
      for (const item of selectedItems) {
        await deleteMaintenanceItem(apiType, item)
      }
      
      clearMaintenanceCache()
      await refreshLists()
      notifyMaintenanceDataChange()
      
      const singular = LABELS[manageType].singular
      const plural = LABELS[manageType].plural
      setSuccessMessage(`${selectedItems.length} ${selectedItems.length === 1 ? singular : plural} deleted successfully`)
      setSelectedItems([])
      
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      setErrorMessage(error.response?.data?.message || error.message || `Failed to delete selected items`)
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirmModal(false)
    }
  }

  const toggleSelectItem = (item: string) => {
    setSelectedItems(prev => 
      prev.includes(item)
        ? prev.filter(i => i !== item)
        : [...prev, item]
    )
  }

  const toggleSelectAll = (options: string[]) => {
    if (selectedItems.length === options.length) {
      setSelectedItems([])
    } else {
      setSelectedItems([...options])
    }
  }

  const goBack = () => {
    setSuccessMessage('') // Clear success message when navigating
    setSelectedItems([]) // Clear selected items
    if (actionType) {
      setActionType(null)
    } else if (manageType) {
      setManageType(null)
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  // Get the button text for add/delete actions
  const getAddButtonText = () => {
    if (!manageType) return '';
    const singular = LABELS[manageType].singular;
    const article = getArticle(singular);
    return `Add ${article} ${singular}`;
  };

  const getDeleteButtonText = () => {
    if (!manageType) return '';
    const plural = LABELS[manageType].plural;
    return `Delete ${plural}`;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {actionType
                ? manageType
                  ? `${actionType === 'add' ? 'Add' : 'Delete'} ${actionType === 'add' ? getArticle(LABELS[manageType].singular) : getArticle(LABELS[manageType].singular)} ${LABELS[manageType].singular}`
                  : 'Maintenance'
                : manageType
                  ? `Manage ${LABELS[manageType].plural}`
                  : 'Maintenance'}
            </h2>
            <button
              type="button"
              onClick={goBack}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successMessage}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errorMessage}
              </div>
            )}

            {!manageType ? (
              /* Step 1: Choose what to manage */
              <div className="space-y-4">
                {/* For Users Section - Moved to the top */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">For Users</h3>
                  <div className="space-y-2">
                    {/* Manage Branches Button */}
                    <button
                      type="button"
                      onClick={() => setManageType('branches')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Branches</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    {/* View All Branches Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowViewBranchesModal(true);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">View All Branches</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* For Tickets Section */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">For Tickets</h3>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setManageType('category')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Category</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageType('affected_system')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Affected System</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {/* Manage Ticket Status Button */}
                    <button
                      type="button"
                      onClick={() => setManageType('ticket_status')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Ticket Status</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {/* Manage Priority Button */}
                    <button
                      type="button"
                      onClick={() => setManageType('priority')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Priority</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* For Incidents Section */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">For Incidents</h3>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setManageType('incident_category')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Incident Category</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {/* Manage Severity Button */}
                    <button
                      type="button"
                      onClick={() => setManageType('severity')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Severity</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {/* Manage Incident Status Button */}
                    <button
                      type="button"
                      onClick={() => setManageType('incident_status')}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">Manage Incident Status</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : !actionType ? (
              /* Step 2: Add or Delete */
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActionType('add')}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                >
                  <span className="font-medium text-gray-900">
                    {getAddButtonText()}
                  </span>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('delete')}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50/50 transition-colors text-left"
                >
                  <span className="font-medium text-gray-900">
                    {getDeleteButtonText()}
                  </span>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ) : manageType === 'branches' ? (
              <>
                {branchError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {branchError}
                  </div>
                )}
                {actionType === 'add' ? (
                  <BranchAddForm 
                    onSubmit={handleAddBranch} 
                    loading={branchesLoading || addLoading} 
                  />
                ) : (
                  <BranchDeleteForm
                    branches={branches}
                    onDelete={handleDeleteBranch}
                    loading={branchesLoading || deleteLoading}
                  />
                )}
              </>
            ) : actionType === 'add' ? (
              <AddForm
                label={`New ${LABELS[manageType!].singular}`}
                placeholder={`e.g., New ${LABELS[manageType!].singular}`}
                onSubmit={getAddHandler(manageType!, {
                  handleAddCategory,
                  handleAddAffectedSystem,
                  handleAddIncidentCategory,
                  handleAddSeverity,
                  handleAddTicketStatus,
                  handleAddPriority,
                  handleAddIncidentStatus
                })}
                loading={addLoading}
              />
            ) : (
              <MultiDeleteForm
                label={`Select ${LABELS[manageType!].plural} to delete`}
                options={getOptionsForType(manageType!, {
                  categories,
                  affectedSystems,
                  incidentCategories,
                  severities,
                  ticketStatuses,
                  priorities,
                  incidentStatuses
                })}
                selectedItems={selectedItems}
                onToggleItem={toggleSelectItem}
                onToggleAll={toggleSelectAll}
                onDelete={() => setShowDeleteConfirmModal(true)}
                loading={deleteLoading}
                type={manageType!}
              />
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal - Styled like audit logs filter */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleteLoading && setShowDeleteConfirmModal(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-800">
                  You are about to delete <span className="font-bold">{selectedItems.length}</span> selected {selectedItems.length === 1 ? LABELS[manageType!]?.singular?.toLowerCase() : LABELS[manageType!]?.plural?.toLowerCase()}.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(false)}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMultiDelete}
                  disabled={deleteLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteLoading ? (
                    <>
                      <LoadingSpinner size="w-4 h-4" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Branches Modal */}
      <ViewBranchesModal
        isOpen={showViewBranchesModal}
        onClose={() => setShowViewBranchesModal(false)}
        branches={branches}
      />
    </>
  )
}

// Helper function to get options based on type
function getOptionsForType(type: ManageType, data: any): string[] {
  switch(type) {
    case 'category': return data.categories || [];
    case 'affected_system': return data.affectedSystems || [];
    case 'incident_category': return data.incidentCategories || [];
    case 'severity': return data.severities || [];
    case 'ticket_status': return data.ticketStatuses || [];
    case 'priority': return data.priorities || [];
    case 'incident_status': return data.incidentStatuses || [];
    default: return [];
  }
}

// Helper function to get the appropriate add handler
function getAddHandler(type: ManageType, handlers: any) {
  switch(type) {
    case 'category': return handlers.handleAddCategory;
    case 'affected_system': return handlers.handleAddAffectedSystem;
    case 'incident_category': return handlers.handleAddIncidentCategory;
    case 'severity': return handlers.handleAddSeverity;
    case 'ticket_status': return handlers.handleAddTicketStatus;
    case 'priority': return handlers.handleAddPriority;
    case 'incident_status': return handlers.handleAddIncidentStatus;
    default: return async () => {};
  }
}

function AddForm({
  label,
  placeholder,
  onSubmit,
  loading = false,
}: {
  label: string
  placeholder: string
  onSubmit: (value: string) => void
  loading?: boolean
}) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(value)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={loading}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!value.trim() || loading}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Adding...
          </>
        ) : (
          'Add'
        )}
      </button>
    </form>
  )
}

function BranchAddForm({
  onSubmit,
  loading,
}: {
  onSubmit: (acronym: string, name: string) => void | Promise<void>
  loading: boolean
}) {
  const [acronym, setAcronym] = useState('')
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const a = acronym.trim().toUpperCase()
    const n = name.trim()
    if (!a || !n) return
    await onSubmit(a, n)
    setAcronym('')
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Acronym</label>
        <input
          type="text"
          value={acronym}
          onChange={(e) => setAcronym(e.target.value)}
          placeholder="e.g., D10"
          maxLength={10}
          disabled={loading}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., D10 – New Branch"
          disabled={loading}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !acronym.trim() || !name.trim()}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Adding...
          </>
        ) : (
          'Add Branch'
        )}
      </button>
    </form>
  )
}

function BranchDeleteForm({
  branches,
  onDelete,
  loading,
}: {
  branches: Branch[]
  onDelete: (acronym: string) => void | Promise<void>
  loading: boolean
}) {
  const [selected, setSelected] = useState('')

  const handleDelete = async () => {
    if (!selected) return
    await onDelete(selected)
    setSelected('')
  }

  const realBranches = branches.filter((b) => b.acronym !== 'ALL')

  if (loading && realBranches.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-gray-500">
          <LoadingSpinner size="w-5 h-5" />
          <span>Loading branches...</span>
        </div>
      </div>
    )
  }
  
  if (realBranches.length === 0) {
    return <p className="text-sm text-gray-500">No branches to delete.</p>
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">Select branch to delete</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={loading}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Select...</option>
        {realBranches.map((b) => (
          <option key={b.acronym} value={b.acronym}>
            {b.acronym} – {b.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!selected || loading}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Deleting...
          </>
        ) : (
          'Delete Branch'
        )}
      </button>
    </div>
  )
}

function MultiDeleteForm({
  label,
  options,
  selectedItems,
  onToggleItem,
  onToggleAll,
  onDelete,
  loading,
  type,
}: {
  label: string
  options: string[]
  selectedItems: string[]
  onToggleItem: (item: string) => void
  onToggleAll: (options: string[]) => void
  onDelete: () => void
  loading: boolean
  type: ManageType
}) {
  if (options.length === 0) {
    return <p className="text-sm text-gray-500">No items to delete.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => onToggleAll(options)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          {selectedItems.length === options.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      
      {/* Selection list styled like audit logs filter */}
      <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-60 overflow-y-auto">
        {options.map((opt) => (
          <div
            key={opt}
            onClick={() => onToggleItem(opt)}
            className={`
              flex items-center gap-3 px-4 py-2.5 cursor-pointer
              hover:bg-blue-50/30 transition-colors
              ${selectedItems.includes(opt) ? 'bg-blue-50/50' : 'bg-white'}
            `}
          >
            <div className={`
              w-4 h-4 rounded border flex items-center justify-center
              transition-all duration-150
              ${selectedItems.includes(opt) 
                ? 'bg-blue-600 border-blue-600' 
                : 'border-gray-300 bg-white'
              }
            `}>
              {selectedItems.includes(opt) && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-900 flex-1">{opt}</span>
          </div>
        ))}
      </div>

      {selectedItems.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium text-gray-600">
            <span className="text-blue-600 font-bold">{selectedItems.length}</span> selected
          </span>
          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Deleting...
              </>
            ) : (
              'Delete Selected'
            )}
          </button>
        </div>
      )}
    </div>
  )
}