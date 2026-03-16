'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import api from '@/lib/api'
import { getStoredUser, getStoredToken } from '@/lib/auth'

interface Notification {
  id: string
  type: 'ticket' | 'incident' | 'system' | 'other'
  title: string
  message: string | null
  resourceType: string | null
  resourceId: string | null
  link: string | null
  isRead: boolean
  createdAt: string
  ticket_id?: string | null
  ticketId?: string | null
  incident_id?: string | null
  incidentId?: string | null
  data?: {
    ticketId?: string
    ticket_id?: string
    incidentId?: string
    incident_id?: string
  }
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  markAllAsRead: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  forceRefresh: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Custom event for notification updates
const NOTIFICATION_UPDATE_EVENT = 'notification-update'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isFetchingRef = useRef(false)

  const fetchNotifications = useCallback(async (showLoading = true) => {
    const user = getStoredUser()
    const token = getStoredToken()
    if (!user || !token) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) return
    
    isFetchingRef.current = true
    if (showLoading) setLoading(true)
    
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get('/notifications?limit=100'),
        api.get('/notifications/unread-count')
      ])
      
      // Map the response to include all possible ID fields
      const mappedNotifications = (notifRes.data ?? []).map((item: any) => ({
        ...item,
        ticket_id: item.ticket_id || item.ticketId || null,
        ticketId: item.ticketId || item.ticket_id || null,
        incident_id: item.incident_id || item.incidentId || null,
        incidentId: item.incidentId || item.incident_id || null,
        data: item.data || {}
      }))
      
      setNotifications(mappedNotifications)
      setUnreadCount(countRes.data?.count ?? 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      setNotifications([])
      setUnreadCount(0)
    } finally {
      if (showLoading) setLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`)
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent(NOTIFICATION_UPDATE_EVENT))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all')
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent(NOTIFICATION_UPDATE_EVENT))
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const notificationToDelete = notifications.find(n => n.id === id)
      const wasUnread = notificationToDelete && !notificationToDelete.isRead
      
      await api.delete(`/notifications/${id}`)
      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent(NOTIFICATION_UPDATE_EVENT))
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }, [notifications])

  const forceRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  // Listen for visibility change to refresh when user comes back to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(false) // Fetch without showing loading state
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchNotifications])

  // Listen for custom notification updates
  useEffect(() => {
    const handleNotificationUpdate = () => {
      fetchNotifications(false) // Fetch without showing loading state
    }

    window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate)
    return () => window.removeEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate)
  }, [fetchNotifications])

  // Polling for new notifications
  useEffect(() => {
    // Initial fetch
    fetchNotifications()

    // Set up polling interval
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications(false) // Fetch without showing loading state
    }, 30000) // 30 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [refreshTrigger, fetchNotifications])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications: () => fetchNotifications(true),
      markAllAsRead,
      markAsRead,
      deleteNotification,
      forceRefresh
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}