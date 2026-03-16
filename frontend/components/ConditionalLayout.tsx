'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

// Routes that should not show the sidebar
const NO_SIDEBAR_ROUTES = ['/login', '/register']

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if current route should not have sidebar
  const currentPath = pathname || ''
  const isNoSidebarRoute = NO_SIDEBAR_ROUTES.includes(currentPath)
  
  // Only show sidebar if:
  // 1. Component is mounted (client-side)
  // 2. Not on a no-sidebar route
  const showSidebar = mounted && !isNoSidebarRoute

  // Main content margin: 16rem when expanded, 4rem when collapsed; transition for smooth resize
  const mainMarginClass = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'

  // Always render children immediately - don't block them
  // Only conditionally add sidebar wrapper
  if (showSidebar) {
    return (
      <>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
        <div className={`min-h-screen transition-[margin] duration-300 ease-in-out ${mainMarginClass}`}>
          {children}
        </div>
      </>
    )
  }

  // No sidebar for login/register pages or during SSR
  // Render children directly without any wrapper that might interfere
  return <>{children}</>
}
