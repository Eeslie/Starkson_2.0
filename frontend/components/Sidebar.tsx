'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { getStoredUser, clearStoredAuth, hasRole } from '@/lib/auth'
import api from '@/lib/api'
import { formatActionLabel, getActionIcon, timeAgo } from '@/lib/activity'
import { useNotifications } from '@/context/NotificationContext'
import type { ActivityItem } from '@/lib/activity'
import starkonPngLogo from '../../backend/config/Starkson-Logo.png'
import starkonSvgLogo from '../../backend/config/STARKSON LOGO.svg'

const ACTIVITY_POLL_MS = 15000

export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const [logoError, setLogoError] = useState(false)
  
  // Use the notification context
  const {
    notifications,
    unreadCount,
    loading: notifLoading,
    markAllAsRead,
    markAsRead,
    fetchNotifications,
    forceRefresh
  } = useNotifications()

  const [markingAll, setMarkingAll] = useState(false)

  // Only access localStorage on client side after mount
  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  // Update user state when pathname changes (after login/logout)
  useEffect(() => {
    if (mounted) {
      setUser(getStoredUser())
    }
  }, [pathname, mounted])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Fetch recent activity for notification bell (all roles see their own actions)
  const fetchActivity = async () => {
    try {
      const res = await api.get('/dashboard/activity?limit=15')
      setActivity(res.data?.activity ?? [])
    } catch {
      setActivity([])
    }
  }

  const handleMarkAsRead = async (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    try {
      await markAsRead(id)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true)
      await markAllAsRead()
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setMarkingAll(false)
    }
  }

  useEffect(() => {
    if (!mounted || !user) return
    
    // Initial fetch
    fetchActivity()
    
    // Set up polling intervals
    const activityInterval = setInterval(fetchActivity, ACTIVITY_POLL_MS)
    
    return () => {
      clearInterval(activityInterval)
    }
  }, [mounted, user])

  // Refetch when user navigates (e.g. after creating/updating a ticket)
  useEffect(() => {
    if (!mounted || !user) return
    fetchActivity()
  }, [pathname, mounted, user])

  // Refetch when user returns to the tab
  useEffect(() => {
    if (!mounted || !user) return
    const onFocus = () => {
      fetchActivity()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [mounted, user])

  // Close notification dropdown when clicking outside
  useEffect(() => {
    if (!notifOpen) return
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [notifOpen])

  const handleLogout = () => {
    // Clear authentication
    clearStoredAuth()
    // Clear user state
    setUser(null)
    // Redirect to login
    router.push('/login')
    // Force page reload to clear any cached data
    router.refresh()
  }

  // Format role name for display
  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Check if current path is active
  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/')
  }

  // Don't show sidebar on login/register pages - check this FIRST
  const hideSidebarPages = ['/login', '/register']
  if (hideSidebarPages.includes(pathname || '')) {
    return null
  }

  // Show loading state during SSR/hydration - but only if not on login/register
  if (!mounted) {
    return null // Don't show anything during SSR to avoid blocking login page
  }

  if (!user) {
    return null
  }

  // Get notification icon
  // Get notification icon
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'ticket':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'incident':
    case 'ADDED_INCIDENT_TIMELINE':  // Add this case
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    case 'system':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}
  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-md shadow-lg"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isMobileMenuOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - collapsible on desktop */}
      <aside
        className={`
          fixed left-0 top-0 h-screen bg-gray-800 text-white shadow-lg z-40
          transform transition-[transform,width] duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'lg:w-16' : 'lg:w-64'}
          w-64
        `}
      >
        <div className="flex flex-col h-full w-full">
          {/* Brand + Notification bell + collapse toggle */}
          <div className={`py-4 border-b border-gray-700 relative flex items-center gap-2 ${collapsed ? 'px-0 justify-center flex-col' : 'px-4 justify-between'}`} ref={notifRef}>
            <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'flex-1 min-w-0'} justify-center`}>
              <Link href="/dashboard" className={`block ${collapsed ? 'w-8 h-8' : 'w-32 h-10'}`} title="STARKSON">
                {!logoError ? (
                  collapsed ? (
                    /* SVG Logo for collapsed state */
                    <Image 
                      src={starkonSvgLogo}
                      alt="Starkson Logo"
                      width={32}
                      height={32}
                      className="object-contain"
                      onError={() => setLogoError(true)}
                      priority
                    />
                  ) : (
                    /* PNG Logo for expanded state */
                    <Image 
                      src={starkonPngLogo}
                      alt="Starkson Logo"
                      width={128}
                      height={40}
                      className="object-contain"
                      onError={() => setLogoError(true)}
                      priority
                    />
                  )
                ) : (
                  <span className={`font-bold text-white tracking-tight ${collapsed ? 'text-lg' : 'text-xl'}`}>
                    {collapsed ? 'S' : 'STARKSON'}
                  </span>
                )}
              </Link>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setNotifOpen((o) => !o)
              }}
              className="relative flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {/* Show badge with unread count - will update immediately when mark all as read is clicked */}
              {unreadCount >= 0 && (
                <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ${unreadCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-500'} text-white text-xs font-medium`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className={`absolute top-full mt-1 z-50 overflow-hidden flex flex-col max-h-[min(320px,60vh)] bg-gray-700 border border-gray-600 rounded-xl shadow-xl ${collapsed ? 'left-full ml-1 w-72' : 'left-0 right-0 mx-2'}`}>
                <div className="px-3 py-2 border-b border-gray-600 flex items-center justify-between flex-shrink-0">
                  <span className="text-sm font-semibold text-white">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-red-500 text-xs">
                        {unreadCount} unread
                      </span>
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      disabled={markingAll}
                      className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {markingAll ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-sky-400 border-t-transparent" />
                          Marking...
                        </>
                      ) : (
                        'Mark all read'
                      )}
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-400 border-t-transparent" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-400">No notifications</p>
                  ) : (
                    <ul className="py-1">
                      {notifications.slice(0, 10).map((notification) => {
                        const isUnread = !notification.isRead
                        return (
                          <li
                            key={notification.id}
                            className={`px-3 py-2 hover:bg-gray-600/50 border-l-2 ${isUnread ? 'border-sky-500 bg-gray-600/30' : 'border-transparent'}`}
                          >
                            <div
                              className="flex items-start gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault()
                                // Only mark as read if it's unread
                                if (isUnread) {
                                  handleMarkAsRead(notification.id, e)
                                }
                                // Navigate if there's a link
                                if (notification.link) {
                                  router.push(notification.link)
                                  setNotifOpen(false)
                                }
                              }}
                            >
                              <span className={`mt-0.5 flex-shrink-0 ${isUnread ? 'text-sky-400' : 'text-gray-400'}`}>
                                {getNotificationIcon(notification.type)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200">{notification.title}</p>
                                {notification.message && (
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notification.message}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-0.5">{timeAgo(notification.createdAt)}</p>
                              </div>
                              {isUnread && (
                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-sky-500 mt-1.5" />
                              )}
                            </div>
                            {isUnread && (
                              <div className="mt-2 flex justify-end">
                                <button
                                  onClick={(e) => handleMarkAsRead(notification.id, e)}
                                  className="text-xs text-sky-400 hover:text-sky-300 px-2 py-1 rounded hover:bg-gray-600/50 transition-colors"
                                >
                                  Mark as read
                                </button>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                <div className="px-3 py-2 border-t border-gray-600 flex-shrink-0">
                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-center text-sky-400 hover:text-sky-300 w-full block"
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
            <div className={`space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
              {/* Dashboard */}
              <Link
                href="/dashboard"
                title="Dashboard"
                className={`
                  flex items-center rounded-lg transition-colors
                  ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}
                  ${isActive('/dashboard')
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {!collapsed && <span className="font-medium">Dashboard</span>}
              </Link>

              {/* Tickets - User, IT Support, Admin */}
              {hasRole(user, 'user', 'it_support', 'admin') && (
                <Link
                  href="/tickets"
                  title="Tickets"
                  className={`
                    flex items-center rounded-lg transition-colors
                    ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}
                    ${isActive('/tickets')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {!collapsed && <span className="font-medium">Tickets</span>}
                </Link>
              )}

              {/* Incidents - Security Officer, Admin */}
              {hasRole(user, 'security_officer', 'admin') && (
                <Link
                  href="/incidents"
                  title="Incidents"
                  className={`
                    flex items-center rounded-lg transition-colors
                    ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}
                    ${isActive('/incidents')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {!collapsed && <span className="font-medium">Incidents</span>}
                </Link>
              )}

              {/* Admin Panel - Admin only */}
              {hasRole(user, 'admin') && (
                <Link
                  href="/admin"
                  title="Admin"
                  className={`
                    flex items-center rounded-lg transition-colors
                    ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}
                    ${isActive('/admin')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {!collapsed && <span className="font-medium">Admin</span>}
                </Link>
              )}

              {/* Collapse toggle - desktop only */}
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className={`hidden lg:flex items-center rounded-lg transition-colors text-gray-400 hover:bg-gray-700 hover:text-white mt-2 ${collapsed ? 'justify-center p-3 w-full' : 'gap-3 px-4 py-3 w-full'}`}
                  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <svg className={`w-5 h-5 flex-shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                  {!collapsed && <span className="font-medium">Collapse</span>}
                </button>
              )}
            </div>
          </nav>

          {/* User Info and Actions - Clickable user info */}
          <div className={`border-t border-gray-700 space-y-3 ${collapsed ? 'p-2' : 'p-4'}`}>
            {/* Clickable User Info - redirects to profile */}
            <Link
              href="/profile"
              className={`flex items-center rounded-lg transition-colors hover:bg-gray-700 ${collapsed ? 'justify-center p-2' : 'gap-3 px-4 py-3'}`}
              title={collapsed ? `${user.fullname} · ${formatRole(user.role)}` : undefined}
            >
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.fullname}</p>
                  <p className="text-xs text-gray-400 truncate">{formatRole(user.role)}</p>
                </div>
              )}
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Logout"
              className={`flex items-center rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors w-full font-medium ${collapsed ? 'justify-center p-2' : 'gap-3 px-4 py-2'}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}