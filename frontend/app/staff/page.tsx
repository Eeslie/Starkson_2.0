'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

export default function StaffDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    assignedTickets: 0,
    pendingTickets: 0,
    totalResolved: 0,
    role: '' as string,
  })

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }

    const fetchStats = async () => {
      try {
        const response = await api.get('/staff/stats')
        setStats(response.data)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()
    
    // Auto-refresh stats every 15 seconds for real-time updates
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [user, router, mounted])

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['it_support', 'admin']}>
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
    <ProtectedRoute allowedRoles={['it_support', 'admin']}>
      <div className="panel-page">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">IT Support Console</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="panel-card">
            <h3 className="panel-card-title">Assigned Tickets</h3>
            <p className="panel-card-value">{stats.assignedTickets}</p>
            {user?.role === 'admin' && (
              <p className="text-xs text-gray-500 mt-1">Tickets + incidents assigned to staff</p>
            )}
          </div>
          <div className="panel-card">
            <h3 className="panel-card-title">Pending Tickets</h3>
            <p className="panel-card-value">{stats.pendingTickets}</p>
          </div>
          <div className="panel-card">
            <h3 className="panel-card-title">
              {user?.role === 'admin' ? 'Total Resolved Tickets/Incidents' : 'Total Resolved Tickets'}
            </h3>
            <p className="panel-card-value">{stats.totalResolved}</p>
          </div>
        </div>
        <div className="panel-card">
          <h2 className="panel-section-title">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a href="/tickets" className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
              <h3 className="font-semibold text-gray-900">View All Tickets</h3>
              <p className="text-sm text-gray-500">Manage ticket queue</p>
            </a>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
