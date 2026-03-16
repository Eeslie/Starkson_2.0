'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredToken, getStoredUser } from '@/lib/auth'
import loginBg from '../login/login-page.jpg'

// Registration is admin-only and done from Admin → User Management → Create an account.
export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    const token = getStoredToken()
    const user = getStoredUser()
    if (!token) {
      router.replace('/login')
      return
    }
    if (user?.role === 'admin') {
      router.replace('/admin/users/create')
    } else {
      router.replace('/dashboard')
    }
  }, [router])

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 relative bg-cover bg-center"
      style={{ backgroundImage: `url(${loginBg.src})` }}
    >
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 md:p-10 text-center">
          <Link href="/" className="text-3xl font-bold text-gray-900 tracking-tight">
            STARKSON
          </Link>
          <p className="mt-6 text-gray-600">
            Account creation is only available to administrators from User Management.
          </p>
          <p className="mt-4">
            <Link href="/login" className="font-medium text-sky-600 hover:text-sky-700">
              Go to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
