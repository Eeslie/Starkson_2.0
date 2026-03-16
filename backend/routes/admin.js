const express = require('express')
const router = express.Router()
const { supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// PDF export (admin only): uses jspdf + jspdf-autotable
let jsPDF
let autoTableFn
try {
  const jspdfModule = require('jspdf')
  jsPDF = jspdfModule.jsPDF || jspdfModule.default || jspdfModule
  const autoTableModule = require('jspdf-autotable')
  autoTableFn = autoTableModule.default || autoTableModule.autoTable
} catch (e) {
  console.warn('PDF export disabled: jspdf not available', e.message)
}

function buildPdfBuffer (title, subtitle, headers, rows) {
  if (!jsPDF || !autoTableFn) throw new Error('PDF library not available')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFontSize(14)
  doc.text(title, 14, 12)
  doc.setFontSize(9)
  doc.text(subtitle, 14, 18)
  autoTableFn(doc, {
    head: [headers],
    body: rows,
    startY: 22,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [66, 66, 66] },
    margin: { left: 14, right: 14 }
  })
  const buf = doc.output('arraybuffer')
  return Buffer.from(buf)
}

// Helper: escape CSV cell
function csvEscape (val) {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// Export users as CSV or PDF (admin only); optional query: role, branch_acronym, format=csv|pdf
router.get('/export/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, branch_acronym, format } = req.query
    const isPdf = String(format || '').toLowerCase() === 'pdf'
    let query = supabase
      .from('users')
      .select('username, fullname, role, status, branch_acronyms, created_at')
      .order('fullname', { ascending: true })
    if (role && ['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      query = query.eq('role', role)
    }
    const { data: rawUsers, error } = await query
    if (error) throw error
    let users = rawUsers || []
    if (branch_acronym && String(branch_acronym).trim()) {
      const branch = String(branch_acronym).trim()
      users = users.filter((u) => {
        const arr = Array.isArray(u.branch_acronyms) ? u.branch_acronyms : []
        return arr.includes(branch) || arr.includes('ALL')
      })
    }
    const headers = ['Fullname', 'Username', 'Role', 'Branches', 'Status', 'Created At']
    const rows = users.map((u) => [
      String(u.fullname ?? ''),
      String(u.username ?? ''),
      String(u.role ?? ''),
      Array.isArray(u.branch_acronyms) ? (u.branch_acronyms.includes('ALL') ? 'All Branches' : u.branch_acronyms.join(', ')) : '',
      String(u.status ?? 'active'),
      u.created_at ? new Date(u.created_at).toISOString() : ''
    ])
    if (isPdf) {
      if (!jsPDF) {
        return res.status(503).json({ message: 'PDF export is not available. Ensure jspdf and jspdf-autotable are installed.' })
      }
      const dateStr = new Date().toISOString().slice(0, 10)
      const subtitle = `Generated: ${new Date().toISOString()} | Total: ${rows.length}`
      const pdfBuffer = buildPdfBuffer('User Management Export', subtitle, headers, rows)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="users-export-${dateStr}.pdf"`)
      return res.send(pdfBuffer)
    }
    const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="users-export-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (err) {
    console.error('Export users error:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// Export all tickets as CSV or PDF (admin only); optional query: format=csv|pdf
router.get('/export/tickets', authenticate, authorize('admin'), async (req, res) => {
  try {
    const format = req.query.format
    const isPdf = String(format || '').toLowerCase() === 'pdf'
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('ticket_number, title, request_type, affected_system, status, priority, branch_acronym, created_at, resolved_at, sla_due, created_by, assigned_to')
      .order('created_at', { ascending: false })
    if (error) throw error
    const list = tickets || []
    const userIds = [...new Set(list.flatMap((t) => [t.created_by, t.assigned_to]).filter(Boolean))]
    let userMap = {}
    if (userIds.length > 0) {
      const { data: userRows } = await supabase.from('users').select('id, fullname').in('id', userIds)
      userMap = (userRows || []).reduce((acc, u) => { acc[u.id] = u.fullname; return acc }, {})
    }
    const headers = ['Ticket Number', 'Title', 'Request Type', 'Affected System', 'Status', 'Priority', 'Branch', 'Created At', 'Resolved At', 'SLA Due', 'Created By', 'Assigned To']
    const rows = list.map((t) => [
      String(t.ticket_number ?? ''),
      String(t.title ?? ''),
      String(t.request_type ?? ''),
      String(t.affected_system ?? ''),
      String(t.status ?? ''),
      String(t.priority ?? ''),
      String(t.branch_acronym ?? ''),
      t.created_at ? new Date(t.created_at).toISOString() : '',
      t.resolved_at ? new Date(t.resolved_at).toISOString() : '',
      t.sla_due ? new Date(t.sla_due).toISOString() : '',
      String(userMap[t.created_by] || t.created_by || ''),
      String(userMap[t.assigned_to] || t.assigned_to || '')
    ])
    if (isPdf) {
      if (!jsPDF) {
        return res.status(503).json({ message: 'PDF export is not available. Ensure jspdf and jspdf-autotable are installed.' })
      }
      const dateStr = new Date().toISOString().slice(0, 10)
      const subtitle = `Generated: ${new Date().toISOString()} | Total: ${rows.length}`
      const pdfBuffer = buildPdfBuffer('Tickets Export', subtitle, headers, rows)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="tickets-export-${dateStr}.pdf"`)
      return res.send(pdfBuffer)
    }
    const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="tickets-export-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (err) {
    console.error('Export tickets error:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// Export all incidents as CSV or PDF (admin only); optional query: format=csv|pdf
router.get('/export/incidents', authenticate, authorize('admin'), async (req, res) => {
  try {
    const format = req.query.format
    const isPdf = String(format || '').toLowerCase() === 'pdf'
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('incident_number, title, category, severity, status, branch_acronym, created_at, closed_at, created_by, assigned_to, source_ticket_id')
      .order('created_at', { ascending: false })
    if (error) throw error
    const list = incidents || []
    const userIds = [...new Set(list.flatMap((i) => [i.created_by, i.assigned_to]).filter(Boolean))]
    let userMap = {}
    if (userIds.length > 0) {
      const { data: userRows } = await supabase.from('users').select('id, fullname').in('id', userIds)
      userMap = (userRows || []).reduce((acc, u) => { acc[u.id] = u.fullname; return acc }, {})
    }
    const headers = ['Incident Number', 'Title', 'Category', 'Severity', 'Status', 'Branch', 'Created At', 'Closed At', 'Created By', 'Assigned To', 'Source Ticket ID']
    const rows = list.map((i) => [
      String(i.incident_number ?? ''),
      String(i.title ?? ''),
      String(i.category ?? ''),
      String(i.severity ?? ''),
      String(i.status ?? ''),
      String(i.branch_acronym ?? ''),
      i.created_at ? new Date(i.created_at).toISOString() : '',
      i.closed_at ? new Date(i.closed_at).toISOString() : '',
      String(userMap[i.created_by] || i.created_by || ''),
      String(userMap[i.assigned_to] || i.assigned_to || ''),
      String(i.source_ticket_id ?? '')
    ])
    if (isPdf) {
      if (!jsPDF) {
        return res.status(503).json({ message: 'PDF export is not available. Ensure jspdf and jspdf-autotable are installed.' })
      }
      const dateStr = new Date().toISOString().slice(0, 10)
      const subtitle = `Generated: ${new Date().toISOString()} | Total: ${rows.length}`
      const pdfBuffer = buildPdfBuffer('Incidents Export', subtitle, headers, rows)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="incidents-export-${dateStr}.pdf"`)
      return res.send(pdfBuffer)
    }
    const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="incidents-export-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (err) {
    console.error('Export incidents error:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// Get admin panel stats (high-level counts)
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Count all users (all records, no limit)
    const { count: totalUsersCount, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (usersError) {
      console.error('Total users count error:', usersError)
      throw usersError
    }

    // Count all tickets (all records, no limit)
    const { count: totalTicketsCount, error: ticketsError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })

    if (ticketsError) {
      console.error('Total tickets count error:', ticketsError)
      throw ticketsError
    }

    // Count all incidents (all records, no limit)
    const { count: totalIncidentsCount, error: incidentsError } = await supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })

    if (incidentsError) {
      console.error('Total incidents count error:', incidentsError)
      throw incidentsError
    }

    res.json({
      totalUsers: totalUsersCount || 0,
      totalTickets: totalTicketsCount || 0,
      totalIncidents: totalIncidentsCount || 0,
      systemHealth: 'operational',
    })
  } catch (error) {
    console.error('Get admin stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Week bounds: Monday 00:00 UTC to next Monday 00:00 UTC (bar resets each week)
function getWeekStartEnd(weeksAgo = 0) {
  const now = new Date()
  const day = now.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + mondayOffset - 7 * weeksAgo,
    0, 0, 0, 0
  ))
  const nextMonday = new Date(thisMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start: thisMonday.toISOString(), end: nextMonday.toISOString() }
}

// Get admin system metrics for charts
router.get('/metrics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { start: weekStartISO, end: weekEndISO } = getWeekStartEnd(0)

    // Tickets this week only (bar resets when week changes)
    const { data: ticketsThisWeekData, error: ticketsWeekError } = await supabase
      .from('tickets')
      .select('id, created_at')
      .gte('created_at', weekStartISO)
      .lt('created_at', weekEndISO)

    if (ticketsWeekError) {
      console.error('Tickets by weekday error:', ticketsWeekError)
      throw ticketsWeekError
    }

    const countsByWeekday = [0, 0, 0, 0, 0, 0, 0]
    ;(ticketsThisWeekData || []).forEach((t) => {
      if (!t.created_at) return
      const d = new Date(t.created_at)
      const idx = d.getUTCDay()
      if (!Number.isNaN(idx) && idx >= 0 && idx <= 6) countsByWeekday[idx] += 1
    })

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const ticketsThisWeek = weekdayLabels.map((label, idx) => ({
      label,
      count: countsByWeekday[idx] || 0,
    }))

    // Incidents by status
    const { data: incidentsData, error: incidentsError } = await supabase
      .from('incidents')
      .select('status')

    if (incidentsError) {
      console.error('Incidents by status error:', incidentsError)
      throw incidentsError
    }

    const incidentStatusMap = {}
    ;(incidentsData || []).forEach((row) => {
      const status = row.status || 'unknown'
      incidentStatusMap[status] = (incidentStatusMap[status] || 0) + 1
    })

    const incidentStatus = Object.entries(incidentStatusMap).map(
      ([status, count]) => ({ status, count })
    )

    // Resolved vs open (tickets)
    const openStatuses = ['new', 'assigned', 'in_progress', 'waiting_for_user']

    const { count: resolvedCount, error: resolvedError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['resolved', 'closed'])

    if (resolvedError) {
      console.error('Resolved tickets count error:', resolvedError)
      throw resolvedError
    }

    const { count: openCount, error: openError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', openStatuses)

    if (openError) {
      console.error('Open tickets count error:', openError)
      throw openError
    }

    // SLA performance (within vs breached)
    const { data: slaTickets, error: slaError } = await supabase
      .from('tickets')
      .select('id, sla_due, resolved_at')
      .not('sla_due', 'is', null)
      .not('resolved_at', 'is', null)

    if (slaError) {
      console.error('SLA performance error:', slaError)
      throw slaError
    }

    let withinSla = 0
    let breachedSla = 0
    ;(slaTickets || []).forEach((t) => {
      const due = t.sla_due ? new Date(t.sla_due) : null
      const resolved = t.resolved_at ? new Date(t.resolved_at) : null
      if (!due || !resolved) return
      if (resolved <= due) withinSla += 1
      else breachedSla += 1
    })

    res.json({
      ticketsThisWeek,
      incidentStatus,
      resolvedVsOpen: {
        resolved: resolvedCount || 0,
        open: openCount || 0,
      },
      sla: {
        within: withinSla,
        breached: breachedSla,
      },
    })
  } catch (error) {
    console.error('Get admin metrics error:', error)
    res
      .status(500)
      .json({ message: 'Server error', error: error.message || String(error) })
  }
})

module.exports = router
