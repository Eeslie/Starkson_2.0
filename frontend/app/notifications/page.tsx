'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'
import { useNotifications } from '@/context/NotificationContext'
import api from '@/lib/api'

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  
  // Use the notification context
  const {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    markAsRead,
    deleteNotification
  } = useNotifications()

  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  useEffect(() => {
    if (!mounted || !user) return
    if (!user) {
      router.push('/login')
      return
    }
  }, [mounted, user, router])

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return
    
    setMarkingAll(true)
    try {
      await markAllAsRead()
      // No need to update local state or reload - context handles it
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    } finally {
      setMarkingAll(false)
    }
  }

  const handleDeleteNotification = async (id: string) => {
    if (deletingId === id) return // Prevent multiple clicks
    
    setDeletingId(id)
    setShowDeleteConfirm(null) // Close confirmation dialog
    
    try {
      await deleteNotification(id)
      // No need to update local state - context will handle it
    } catch (error) {
      console.error('Error deleting notification:', error)
      alert('Failed to delete notification. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(id)
  }

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    handleDeleteNotification(id)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(null)
  }

  // Helper function to check if a string is a UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  // Function to fetch ticket by formatted number
  const fetchTicketByNumber = async (ticketNumber: string) => {
    try {
      const response = await api.get(`/tickets/number/${ticketNumber}`)
      return response.data
    } catch (error) {
      console.error('Error fetching ticket by number:', error)
      return null
    }
  }

  // Function to fetch incident by formatted number
  const fetchIncidentByNumber = async (incidentNumber: string) => {
    try {
      const response = await api.get(`/incidents/number/${incidentNumber}`)
      return response.data
    } catch (error) {
      console.error('Error fetching incident by number:', error)
      return null
    }
  }

  const handleNotificationClick = async (notification: any) => {
    console.log('Full notification object:', JSON.stringify(notification, null, 2))
    console.log('Available properties:', Object.keys(notification))
    
    // Mark as read if unread
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }
    
    // Get user role
    const user = getStoredUser()
    console.log('User role:', user?.role)
    
    // Try to find any ID that might be a ticket ID or incident ID
    const possibleTicketIds = []
    const possibleIncidentIds = []
    const possibleTicketNumbers = [] // For formatted ticket numbers like D01-000004
    const possibleIncidentNumbers = [] // For formatted incident numbers like INC-D01-000003
    
    // Check all possible places where ticket ID might be stored
    if (notification.ticket_id) possibleTicketIds.push({ source: 'ticket_id', value: notification.ticket_id })
    if (notification.ticketId) possibleTicketIds.push({ source: 'ticketId', value: notification.ticketId })
    if (notification.resourceId && notification.resourceType === 'ticket') {
      possibleTicketIds.push({ source: 'resourceId', value: notification.resourceId })
    }
    if (notification.data?.ticketId) possibleTicketIds.push({ source: 'data.ticketId', value: notification.data.ticketId })
    if (notification.data?.ticket_id) possibleTicketIds.push({ source: 'data.ticket_id', value: notification.data.ticket_id })
    
    // Check for incident IDs
    if (notification.incident_id) possibleIncidentIds.push({ source: 'incident_id', value: notification.incident_id })
    if (notification.incidentId) possibleIncidentIds.push({ source: 'incidentId', value: notification.incidentId })
    if (notification.resourceId && notification.resourceType === 'incident') {
      possibleIncidentIds.push({ source: 'resourceId', value: notification.resourceId })
    }
    if (notification.data?.incidentId) possibleIncidentIds.push({ source: 'data.incidentId', value: notification.data.incidentId })
    if (notification.data?.incident_id) possibleIncidentIds.push({ source: 'data.incident_id', value: notification.data.incident_id })
    
    // Also try to extract IDs from the message
    if (notification.message) {
      // Look for incident ID pattern (INC-XXXXX)
      const incidentMatch = notification.message.match(/(INC-[A-Z0-9-]+)/)
      if (incidentMatch) {
        if (isUUID(incidentMatch[1])) {
          possibleIncidentIds.push({ source: 'message_extract_incident_uuid', value: incidentMatch[1] })
        } else {
          possibleIncidentNumbers.push({ source: 'message_extract_incident_number', value: incidentMatch[1] })
        }
      }
      
      // Look for ticket ID pattern (D01-XXXXX)
      const ticketMatch = notification.message.match(/(D01-[A-Z0-9-]+)/)
      if (ticketMatch) {
        if (isUUID(ticketMatch[1])) {
          possibleTicketIds.push({ source: 'message_extract_ticket_uuid', value: ticketMatch[1] })
        } else {
          possibleTicketNumbers.push({ source: 'message_extract_ticket_number', value: ticketMatch[1] })
        }
      }
    }
    
    console.log('Possible ticket IDs found:', possibleTicketIds)
    console.log('Possible ticket numbers found:', possibleTicketNumbers)
    console.log('Possible incident IDs found:', possibleIncidentIds)
    console.log('Possible incident numbers found:', possibleIncidentNumbers)
    
    // For regular users, prioritize redirecting to tickets (which they have access to)
    if (user?.role === 'user') {
      // First try to find a ticket UUID
      if (possibleTicketIds.length > 0) {
        const ticketId = possibleTicketIds[0].value
        // Check if it's a UUID format
        if (isUUID(ticketId)) {
          console.log(`User: Redirecting to ticket ${ticketId} from source: ${possibleTicketIds[0].source}`)
          router.push(`/tickets/${ticketId}`)
          return
        }
      }
      
      // If we have a ticket number, fetch the UUID
      if (possibleTicketNumbers.length > 0) {
        const ticketNumber = possibleTicketNumbers[0].value
        console.log(`User: Fetching ticket by number: ${ticketNumber}`)
        
        try {
          const ticket = await fetchTicketByNumber(ticketNumber)
          if (ticket && ticket.id) {
            console.log(`User: Found ticket UUID: ${ticket.id} for number: ${ticketNumber}`)
            router.push(`/tickets/${ticket.id}`)
            return
          }
        } catch (error) {
          console.error('Failed to fetch ticket by number:', error)
        }
      }
      
      // For ticket conversion, try to get the original ticket
      if (notification.title?.toLowerCase().includes('ticket converted to incident') ||
          notification.message?.toLowerCase().includes('ticket was converted to incident')) {
        
        // Try to extract the original ticket number from the message
        const ticketMatch = notification.message?.match(/(D01-[A-Z0-9-]+)/)
        if (ticketMatch) {
          const ticketNumber = ticketMatch[1]
          console.log(`User: Ticket conversion - fetching original ticket: ${ticketNumber}`)
          
          try {
            const ticket = await fetchTicketByNumber(ticketNumber)
            if (ticket && ticket.id) {
              console.log(`User: Redirecting to original ticket UUID: ${ticket.id}`)
              router.push(`/tickets/${ticket.id}`)
              return
            }
          } catch (error) {
            console.error('Failed to fetch original ticket:', error)
          }
        }
      }
      
      // If we only have incident ID/number, try to get the related ticket
      if (possibleIncidentIds.length > 0 || possibleIncidentNumbers.length > 0) {
        const incidentNumber = possibleIncidentNumbers[0]?.value || 
                              (possibleIncidentIds[0]?.value && !isUUID(possibleIncidentIds[0].value) ? possibleIncidentIds[0].value : null)
        
        if (incidentNumber) {
          console.log(`User: Fetching incident by number: ${incidentNumber}`)
          try {
            const incident = await fetchIncidentByNumber(incidentNumber)
            if (incident && incident.ticket_id) {
              console.log(`User: Found related ticket UUID: ${incident.ticket_id}`)
              router.push(`/tickets/${incident.ticket_id}`)
              return
            }
          } catch (error) {
            console.error('Failed to fetch incident:', error)
          }
        }
        
        console.log('User does not have access to incidents')
        alert('You do not have permission to view incident details. Please contact an administrator if you need access.')
        return
      }
    } else {
      // For admins and other roles, prioritize incident IDs for incident-related notifications
      if (notification.type === 'incident' || 
          notification.type === 'ADDED_INCIDENT_TIMELINE' || 
          notification.type === 'INCIDENT_TIMELINE_UPDATE' ||
          notification.message?.toLowerCase().includes('incident')) {
        
        // Check for incident UUID first
        if (possibleIncidentIds.length > 0) {
          const incidentId = possibleIncidentIds[0].value
          if (isUUID(incidentId)) {
            console.log(`Admin: Redirecting to incident ${incidentId} from source: ${possibleIncidentIds[0].source}`)
            router.push(`/incidents/${incidentId}`)
            return
          }
        }
        
        // Try incident number
        if (possibleIncidentNumbers.length > 0) {
          const incidentNumber = possibleIncidentNumbers[0].value
          console.log(`Admin: Fetching incident by number: ${incidentNumber}`)
          try {
            const incident = await fetchIncidentByNumber(incidentNumber)
            if (incident && incident.id) {
              console.log(`Admin: Redirecting to incident UUID: ${incident.id}`)
              router.push(`/incidents/${incident.id}`)
              return
            }
          } catch (error) {
            console.error('Failed to fetch incident by number:', error)
          }
        }
      }
      
      // Otherwise try ticket IDs
      if (possibleTicketIds.length > 0) {
        const ticketId = possibleTicketIds[0].value
        if (isUUID(ticketId)) {
          console.log(`Admin: Redirecting to ticket ${ticketId} from source: ${possibleTicketIds[0].source}`)
          router.push(`/tickets/${ticketId}`)
          return
        }
      }
      
      // Try ticket numbers
      if (possibleTicketNumbers.length > 0) {
        const ticketNumber = possibleTicketNumbers[0].value
        console.log(`Admin: Fetching ticket by number: ${ticketNumber}`)
        
        try {
          const ticket = await fetchTicketByNumber(ticketNumber)
          if (ticket && ticket.id) {
            console.log(`Admin: Found ticket UUID: ${ticket.id} for number: ${ticketNumber}`)
            router.push(`/tickets/${ticket.id}`)
            return
          }
        } catch (error) {
          console.error('Failed to fetch ticket by number:', error)
        }
      }
      
      // If no ticket ID but we have incident ID
      if (possibleIncidentIds.length > 0) {
        const incidentId = possibleIncidentIds[0].value
        if (isUUID(incidentId)) {
          console.log(`Admin: Redirecting to incident ${incidentId} from source: ${possibleIncidentIds[0].source}`)
          router.push(`/incidents/${incidentId}`)
          return
        }
      }
      
      // Try incident numbers as last resort
      if (possibleIncidentNumbers.length > 0) {
        const incidentNumber = possibleIncidentNumbers[0].value
        console.log(`Admin: Fetching incident by number: ${incidentNumber}`)
        try {
          const incident = await fetchIncidentByNumber(incidentNumber)
          if (incident && incident.id) {
            console.log(`Admin: Redirecting to incident UUID: ${incident.id}`)
            router.push(`/incidents/${incident.id}`)
            return
          }
        } catch (error) {
          console.error('Failed to fetch incident by number:', error)
        }
      }
    }
    
    console.log('No ticket or incident ID found in notification')
    alert('Could not find ticket or incident information for this notification')
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'incident':
      case 'ADDED_INCIDENT_TIMELINE':
      case 'INCIDENT_TIMELINE_UPDATE':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'system':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'ticket':
        return 'bg-blue-50 text-blue-600'
      case 'incident':
      case 'ADDED_INCIDENT_TIMELINE':
      case 'INCIDENT_TIMELINE_UPDATE':
        return 'bg-red-50 text-red-600'
      case 'system':
        return 'bg-purple-50 text-purple-600'
      default:
        return 'bg-gray-50 text-gray-600'
    }
  }

  // Helper function to format time ago
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute>
        <div className="panel-page flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="panel-page">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'
              }
            </p>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {markingAll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Marking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark all as read
                </>
              )}
            </button>
          )}
        </div>

        <div className="panel-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-600 border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-sm text-gray-500">You are all caught up! Check back later for updates.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const isUnread = !notification.isRead
                return (
                  <div 
                    key={notification.id} 
                    className={`py-4 px-1 hover:bg-gray-50 transition-colors relative ${isUnread ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => handleNotificationClick(notification)}
                            className="flex-1 text-left focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg -ml-1 pl-1"
                          >
                            <h3 className="text-sm font-medium text-gray-900 mb-1 hover:text-sky-600 transition-colors">
                              {notification.title}
                            </h3>
                            {notification.message && (
                              <p className="text-sm text-gray-600 mb-1">
                                {notification.message}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              {timeAgo(notification.createdAt)}
                            </p>
                          </button>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isUnread && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  markAsRead(notification.id)
                                }}
                                className="text-xs text-sky-600 hover:text-sky-700 font-medium px-2 py-1 rounded hover:bg-sky-50 transition-colors"
                                title="Mark as read"
                              >
                                Mark read
                              </button>
                            )}
                            
                            {showDeleteConfirm === notification.id ? (
                              <div className="absolute right-4 top-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 w-48">
                                <p className="text-sm font-medium text-gray-900 mb-2">
                                  Delete this notification?
                                </p>
                                <p className="text-xs text-gray-500 mb-3">
                                  This action cannot be undone.
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => confirmDelete(notification.id, e)}
                                    disabled={deletingId === notification.id}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                  >
                                    {deletingId === notification.id ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                                        Deleting...
                                      </>
                                    ) : (
                                      'Delete'
                                    )}
                                  </button>
                                  <button
                                    onClick={cancelDelete}
                                    disabled={deletingId === notification.id}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            
                            <button
                              onClick={(e) => handleDeleteClick(notification.id, e)}
                              disabled={deletingId === notification.id}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed relative"
                              title="Delete notification"
                            >
                              {deletingId === notification.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {/* Show View Details button if there's a ticket_id, incident_id, or resource info */}
                        {/* But hide it for generic "Incident linked to your ticket was updated" messages */}
                        {(notification.ticket_id || 
                          notification.incident_id || 
                          notification.ticketId || 
                          notification.incidentId ||
                          notification.resourceId ||
                          (notification.resourceType && notification.resourceId)) && 
                          // Don't show for generic incident update messages without specific details
                          !(notification.title === 'Incident updated' && 
                            notification.message === 'Incident linked to your ticket was updated') && (
                          <div className="mt-3">
                            <button
                              onClick={() => handleNotificationClick(notification)}
                              className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 rounded px-2 py-1"
                            >
                              View details
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && !loading && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}