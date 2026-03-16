import type { ReactNode } from 'react'

export interface ActivityItem {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  details: unknown
  createdAt: string
}

function getDetailsRef(item: ActivityItem): string {
  if (typeof item.details !== 'object' || !item.details) return ''
  const d = item.details as Record<string, unknown>
  if (item.resourceType === 'ticket' && (d.ticket_number ?? d.ticketNumber)) return String(d.ticket_number ?? d.ticketNumber)
  if (item.resourceType === 'incident' && (d.incident_number ?? d.incidentNumber)) return String(d.incident_number ?? d.incidentNumber)
  return ''
}

export function formatActionLabel(item: ActivityItem): { label: string; href: string | null } {
  const rid = item.resourceId
  const tid = rid ? (item.resourceType === 'ticket' ? `/tickets/${rid}` : item.resourceType === 'incident' ? `/incidents/${rid}` : null) : null
  const detailsRef = getDetailsRef(item)
  const ref = detailsRef || (tid ? `#${rid}` : rid ? String(rid) : '')
  switch (item.action) {
    case 'CREATE_TICKET':
      return { label: `Created ticket ${ref || ''}`.trim(), href: item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : null }
    case 'NEW_TICKET_CREATED':
      return { label: `New ticket created ${ref || ''}`.trim(), href: item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : null }
    case 'UPDATE_TICKET':
      return { label: `Updated ticket ${ref || ''}`.trim(), href: item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : null }
    case 'ADD_COMMENT':
    case 'USER_COMMENT':
    case 'STAFF_COMMENT':
    case 'TICKET_COMMENT': {
      const title = (item.details as Record<string, unknown>)?.title
      return { label: typeof title === 'string' ? title : `Comment on ticket ${ref || ''}`.trim(), href: item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : null }
    }
    case 'DELETE_TICKET':
      return { label: `Deleted ticket ${ref || ''}`.trim(), href: null }
    case 'CREATE_INCIDENT':
    case 'CONVERT_TICKET':
      return { label: `Created incident ${ref || ''}`.trim(), href: item.resourceType === 'incident' && rid ? `/incidents/${rid}` : null }
    case 'TICKET_CONVERTED_TO_INCIDENT':
      return { label: `Ticket converted to incident ${ref || ''}`.trim(), href: item.resourceType === 'incident' && rid ? `/incidents/${rid}` : item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : null }
    case 'NEW_INCIDENT_CREATED':
      return { label: `New incident created ${ref || ''}`.trim(), href: item.resourceType === 'incident' && rid ? `/incidents/${rid}` : null }
    case 'TICKET_ASSIGNED': {
      const title = (item.details as Record<string, unknown>)?.title
      return { label: typeof title === 'string' ? title : `Ticket assigned ${ref || ''}`.trim(), href: item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : null }
    }
    case 'TICKET_UPDATED': {
      const title = (item.details as Record<string, unknown>)?.title
      return { label: typeof title === 'string' ? title : `Ticket updated ${ref || ''}`.trim(), href: item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : null }
    }
    case 'INCIDENT_ASSIGNED': {
      const title = (item.details as Record<string, unknown>)?.title
      return { label: typeof title === 'string' ? title : `Incident assigned ${ref || ''}`.trim(), href: item.resourceType === 'incident' && rid ? `/incidents/${rid}` : null }
    }
    case 'INCIDENT_UPDATED': {
      const title = (item.details as Record<string, unknown>)?.title
      return { label: typeof title === 'string' ? title : `Incident updated ${ref || ''}`.trim(), href: item.resourceType === 'incident' && rid ? `/incidents/${rid}` : null }
    }
    case 'UPDATE_INCIDENT':
      return { label: `Updated incident ${ref || ''}`.trim(), href: item.resourceType === 'incident' && rid ? `/incidents/${rid}` : null }
    case 'ADD_TIMELINE_ENTRY':
    case 'INCIDENT_TIMELINE_UPDATE': {
      const title = (item.details as Record<string, unknown>)?.title
      return { label: typeof title === 'string' ? title : `Update on incident ${ref || ''}`.trim(), href: item.resourceType === 'incident' && rid ? `/incidents/${rid}` : null }
    }
    case 'UPLOAD_ATTACHMENT':
      return { label: `Uploaded attachment${ref ? ` (${item.resourceType})` : ''}`.trim(), href: item.resourceType === 'ticket' && rid ? `/tickets/${rid}` : item.resourceType === 'incident' && rid ? `/incidents/${rid}` : null }
    case 'DELETE_ATTACHMENT':
      return { label: 'Deleted attachment', href: null }
    case 'CREATE_SLA':
    case 'UPDATE_SLA':
    case 'DELETE_SLA':
      return { label: 'SLA configuration updated', href: null }
    case 'UPDATE_USER_ROLE':
    case 'UPDATE_USER_STATUS':
      return { label: 'User management action', href: null }
    case 'RESET_PASSWORD':
      return { label: 'Password reset', href: null }
    default:
      return { label: item.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), href: tid }
  }
}

const iconClass = 'w-4 h-4 flex-shrink-0'

export function getActionIcon(action: string, className: string = 'text-sky-600'): ReactNode {
  const c = `${iconClass} ${className}`.trim()
  if (action.includes('TICKET') && !action.includes('CONVERT')) {
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }
  if (action.includes('INCIDENT') || action === 'CONVERT_TICKET') {
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  }
  if (action.includes('COMMENT')) {
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
  }
  if (action.includes('ATTACHMENT')) {
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    )
  }
  return (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString()
}
