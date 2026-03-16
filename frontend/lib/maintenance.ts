// Maintenance data management - now using database API instead of localStorage
import api from './api'

// Default lists for ticket form dropdowns (used as fallback if API fails)
const AFFECTED_SYSTEMS_DEFAULT = [
  'Windows 11',
  'Viber',
  'Wi-Fi Network',
  'LAN',
  'Desktop',
  'Laptop',
  'Printer',
]

const CATEGORIES_DEFAULT = [
  'Hardware',
  'Software',
  'Network',
  'Peripheral',
]

const INCIDENT_CATEGORIES_DEFAULT = [
  'Phishing',
  'Malware',
  'Unauthorized Access',
  'Data Exposure',
  'Policy Violation',
  'System Compromise',
  'Other',
]

const SEVERITIES_DEFAULT = [
  'Low',
  'Medium',
  'High',
  'Critical',
]

const TICKET_STATUSES_DEFAULT = [
  'New',
  'Assigned',
  'In Progress',
  'Waiting for User',
  'Resolved',
  'Closed',
  'Converted to Incident',
]

const PRIORITIES_DEFAULT = [
  'Low',
  'Medium',
  'High',
  'Urgent',
]

const INCIDENT_STATUSES_DEFAULT = [
  'New',
  'Triaged',
  'Investigating',
  'Contained',
  'Recovered',
  'Closed',
]

export const INCIDENT_STATUSES_DEFAULTS = INCIDENT_STATUSES_DEFAULT
export const AFFECTED_SYSTEMS_DEFAULTS = AFFECTED_SYSTEMS_DEFAULT
export const CATEGORIES_DEFAULTS = CATEGORIES_DEFAULT
export const INCIDENT_CATEGORIES_DEFAULTS = INCIDENT_CATEGORIES_DEFAULT
export const SEVERITIES_DEFAULTS = SEVERITIES_DEFAULT
export const TICKET_STATUSES_DEFAULTS = TICKET_STATUSES_DEFAULT
export const PRIORITIES_DEFAULTS = PRIORITIES_DEFAULT

// Cache for maintenance data
let maintenanceCache: {
  affectedSystems?: string[]
  categories?: string[]
  priorities?: string[]
  incidentCategories?: string[]
  severities?: string[]
  ticketStatuses?: string[]
  incidentStatuses?: string[]
  lastFetched?: number
} = {}

const CACHE_DURATION = 10000 // 10 seconds cache - faster updates

// Fetch maintenance data from API
async function fetchFromAPI(type: string): Promise<string[]> {
  try {
    const response = await api.get(`/maintenance/${type}`)
    return response.data || []
  } catch (error) {
    console.error(`Error fetching ${type} from API:`, error)
    // Return defaults on error
    const defaultMap: Record<string, string[]> = {
      'affected_system': AFFECTED_SYSTEMS_DEFAULT,
      'category': CATEGORIES_DEFAULT,
      'priority': PRIORITIES_DEFAULT,
      'incident_category': INCIDENT_CATEGORIES_DEFAULT,
      'severity': SEVERITIES_DEFAULT,
      'ticket_status': TICKET_STATUSES_DEFAULT,
      'incident_status': INCIDENT_STATUSES_DEFAULT,
    }
    return defaultMap[type] || []
  }
}

// Fetch all maintenance data from API
export async function fetchMaintenanceData(): Promise<{
  affectedSystems: string[]
  categories: string[]
  priorities: string[]
  incidentCategories: string[]
  severities: string[]
  ticketStatuses: string[]
  incidentStatuses: string[]
}> {
  const now = Date.now()
  
  // Return cached data if still valid (and lastFetched is not 0, which means cache was cleared)
  if (maintenanceCache.lastFetched && maintenanceCache.lastFetched > 0 && (now - maintenanceCache.lastFetched) < CACHE_DURATION) {
    return {
      affectedSystems: maintenanceCache.affectedSystems || AFFECTED_SYSTEMS_DEFAULT,
      categories: maintenanceCache.categories || CATEGORIES_DEFAULT,
      priorities: maintenanceCache.priorities || PRIORITIES_DEFAULT,
      incidentCategories: maintenanceCache.incidentCategories || INCIDENT_CATEGORIES_DEFAULT,
      severities: maintenanceCache.severities || SEVERITIES_DEFAULT,
      ticketStatuses: maintenanceCache.ticketStatuses || TICKET_STATUSES_DEFAULT,
      incidentStatuses: maintenanceCache.incidentStatuses || INCIDENT_STATUSES_DEFAULT,
    }
  }

  try {
    const response = await api.get('/maintenance')
    const data = response.data || {}
    
    maintenanceCache = {
      affectedSystems: data.affectedSystems || AFFECTED_SYSTEMS_DEFAULT,
      categories: data.categories || CATEGORIES_DEFAULT,
      priorities: data.priorities || PRIORITIES_DEFAULT,
      incidentCategories: data.incidentCategories || INCIDENT_CATEGORIES_DEFAULT,
      severities: data.severities || SEVERITIES_DEFAULT,
      ticketStatuses: data.ticketStatuses || TICKET_STATUSES_DEFAULT,
      incidentStatuses: data.incidentStatuses || INCIDENT_STATUSES_DEFAULT,
      lastFetched: now,
    }

    return {
      affectedSystems: maintenanceCache.affectedSystems || AFFECTED_SYSTEMS_DEFAULT,
      categories: maintenanceCache.categories || CATEGORIES_DEFAULT,
      priorities: maintenanceCache.priorities || PRIORITIES_DEFAULT,
      incidentCategories: maintenanceCache.incidentCategories || INCIDENT_CATEGORIES_DEFAULT,
      severities: maintenanceCache.severities || SEVERITIES_DEFAULT,
      ticketStatuses: maintenanceCache.ticketStatuses || TICKET_STATUSES_DEFAULT,
      incidentStatuses: maintenanceCache.incidentStatuses || INCIDENT_STATUSES_DEFAULT,
    }
  } catch (error) {
    console.error('Error fetching maintenance data from API:', error)
    // Return defaults on error
    return {
      affectedSystems: AFFECTED_SYSTEMS_DEFAULT,
      categories: CATEGORIES_DEFAULT,
      priorities: PRIORITIES_DEFAULT,
      incidentCategories: INCIDENT_CATEGORIES_DEFAULT,
      severities: SEVERITIES_DEFAULT,
      ticketStatuses: TICKET_STATUSES_DEFAULT,
      incidentStatuses: INCIDENT_STATUSES_DEFAULT,
    }
  }
}

// Clear cache (call after adding/deleting items)
export function clearMaintenanceCache(): void {
  // Reset cache and set lastFetched to 0 to force immediate refresh on next fetch
  maintenanceCache = {}
  maintenanceCache.lastFetched = 0
}

// Get affected systems
export async function getAffectedSystems(): Promise<string[]> {
  const data = await fetchMaintenanceData()
  return data.affectedSystems
}

// Get categories
export async function getCategories(): Promise<string[]> {
  const data = await fetchMaintenanceData()
  return data.categories
}

// Get priorities
export async function getPriorities(): Promise<string[]> {
  const data = await fetchMaintenanceData()
  return data.priorities
}

// Get incident categories
export async function getIncidentCategories(): Promise<string[]> {
  const data = await fetchMaintenanceData()
  return data.incidentCategories
}

// Get severities
export async function getSeverities(): Promise<string[]> {
  const data = await fetchMaintenanceData()
  return data.severities
}

// Get ticket statuses
export async function getTicketStatuses(): Promise<string[]> {
  const data = await fetchMaintenanceData()
  return data.ticketStatuses
}

// Get incident statuses
export async function getIncidentStatuses(): Promise<string[]> {
  const data = await fetchMaintenanceData()
  return data.incidentStatuses
}

// Add maintenance data item (admin only)
export async function addMaintenanceItem(type: string, value: string): Promise<void> {
  try {
    await api.post(`/maintenance/${type}`, { value })
    clearMaintenanceCache() // Clear cache after adding
  } catch (error: any) {
    console.error(`Error adding ${type}:`, error)
    throw error
  }
}

// Delete maintenance data item (admin only)
export async function deleteMaintenanceItem(type: string, value: string): Promise<void> {
  try {
    const encodedValue = encodeURIComponent(value)
    await api.delete(`/maintenance/${type}/${encodedValue}`)
    clearMaintenanceCache() // Clear cache after deleting
  } catch (error: any) {
    console.error(`Error deleting ${type}:`, error)
    throw error
  }
}

// Legacy functions for backward compatibility (now async)
// These are kept for components that haven't been updated yet
export function setAffectedSystems(list: string[]): void {
  console.warn('setAffectedSystems is deprecated. Use addMaintenanceItem instead.')
}

export function setCategories(list: string[]): void {
  console.warn('setCategories is deprecated. Use addMaintenanceItem instead.')
}

export function setPriorities(list: string[]): void {
  console.warn('setPriorities is deprecated. Use addMaintenanceItem instead.')
}

export function setIncidentCategories(list: string[]): void {
  console.warn('setIncidentCategories is deprecated. Use addMaintenanceItem instead.')
}

export function setSeverities(list: string[]): void {
  console.warn('setSeverities is deprecated. Use addMaintenanceItem instead.')
}

export function setTicketStatuses(list: string[]): void {
  console.warn('setTicketStatuses is deprecated. Use addMaintenanceItem instead.')
}

export function setIncidentStatuses(list: string[]): void {
  console.warn('setIncidentStatuses is deprecated. Use addMaintenanceItem instead.')
}

// Initialize defaults - no longer needed but kept for compatibility
export function initializeDefaults(): void {
  // No-op: defaults are now in the database
}
