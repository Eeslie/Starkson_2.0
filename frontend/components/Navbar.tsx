'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getStoredUser, clearStoredAuth, hasRole } from '@/lib/auth'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

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

  // Show loading state during SSR/hydration
  if (!mounted) {
    return (
      <nav className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center"><img src="/STARKSON-LG.png" alt="STARKSON" className="h-8 w-auto object-contain" /></Link>
          <div className="w-20 h-8"></div>
        </div>
      </nav>
    )
  }

  if (!user) {
    return (
      <nav className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center"><img src="/STARKSON-LG.png" alt="STARKSON" className="h-8 w-auto object-contain" /></Link>
          <Link href="/login" className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">Login</Link>
        </div>
      </nav>
    )
  }

  // Format role name for display
  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <nav className="bg-gray-800 text-white p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
          <img src="/STARKSON-LG.png" alt="STARKSON" className="h-8 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-6">
          {/* Navigation Links - Role-based */}
          <Link 
            href="/dashboard" 
            className="hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
          >
            Dashboard
          </Link>
          
          {/* Tickets - User, IT Support, Admin */}
          {hasRole(user, 'user', 'it_support', 'admin') && (
            <Link 
              href="/tickets" 
              className="hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
            >
              Tickets
            </Link>
          )}
          
          {/* Incidents - Security Officer, Admin */}
          {hasRole(user, 'security_officer', 'admin') && (
            <Link 
              href="/incidents" 
              className="hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
            >
              Incidents
            </Link>
          )}
          
          {/* Admin Panel - Admin only */}
          {hasRole(user, 'admin') && (
            <Link 
              href="/admin" 
              className="hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
            >
              Admin
            </Link>
          )}
          
          {/* User Info and Actions */}
          <div className="flex items-center gap-4 pl-4 border-l border-gray-700">
            <div className="text-right">
              <span className="text-gray-200 text-sm font-medium block">{user.fullname}</span>
              <span className="text-gray-400 text-xs block">{formatRole(user.role)}</span>
            </div>
            <Link
              href="/profile"
              className="px-3 py-2 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200 font-medium flex items-center gap-2"
              title="View Profile"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
            <button 
              onClick={handleLogout} 
              className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-700 active:bg-red-800 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
              title="Logout from STARKSON"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
