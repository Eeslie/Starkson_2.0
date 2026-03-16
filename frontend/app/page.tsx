'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredToken } from '@/lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login if not authenticated, otherwise to dashboard
    const token = getStoredToken()
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
