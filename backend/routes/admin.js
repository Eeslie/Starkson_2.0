const express = require('express')
const router = express.Router()
const { query, runQuery } = require('../config/database')
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

function buildPdfBuffer(title, subtitle, headers, rows) {
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
function csvEscape(val) {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// Export users as CSV or PDF (admin only)
router.get('/export/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, branch_acronym, format } = req.query
    const isPdf = String(format || '').toLowerCase() === 'pdf'

    const filters = []
    if (role && ['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      filters.push({ column: 'role', value: role })
    }

    const users = await query('users', 'select', {
      select: 'username, fullname, role, status, branch_acronyms, created_at',
      filters: filters.length ? filters : undefined,
      orderBy: { column: 'fullname', ascending: true }
    })

    let list = users || []
    if (branch_acronym && String(branch_acronym).trim()) {
      const branch = String(branch_acronym).trim()
      list = list.filter((u) => {
        const arr = typeof u.branch_acronyms === 'string' && u.branch_acronyms.trim()
          ? u.branch_acronyms.split(',').map(a => a.trim())
          : []
        return arr.includes(branch) || arr.includes('ALL')
      })
    }

    const headers = ['Fullname', 'Username', 'Role', 'Branches', 'Status', 'Created At']
    const rows = list.map((u) => {
      const branches = typeof u.branch_acronyms === 'string' && u.branch_acronyms.trim()
        ? u.branch_acronyms.split(',').map(a => a.trim())
        : []
      const branchesLabel = branches.includes('ALL')
        ? 'All Branches'
        : branches.join(', ')
      return [
        String(u.fullname ?? ''),
        String(u.username ?? ''),
        String(u.role ?? ''),
        branchesLabel,
        String(u.status ?? 'active'),
        u.created_at ? new Date(u.created_at).toISOString() : ''
      ]
    })

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

// Export tickets as CSV or PDF (admin only)
router.get('/export/tickets', authenticate, authorize('admin'), async (req, res) => {
  try {
    const format = req.query.format
    const isPdf = String(format || '').toLowerCase() === 'pdf'

    const tickets = await query('tickets', 'select', {
      select: 'ticket_number, title, request_type, affected_system, status, priority, branch_acronym, created_at, resolved_at, sla_due, created_by, assigned_to',
      orderBy: { column: 'created_at', ascending: false }
    }) || []

    const userIds = [...new Set(tickets.flatMap(t => [t.created_by, t.assigned_to]).filter(Boolean))]
    let userMap = {}
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',')
      const sql = `SELECT id, fullname FROM users WHERE id IN (${placeholders})`
      const userRows = await runQuery(sql, userIds)
      userMap = (userRows || []).reduce((acc, u) => {
        acc[u.id] = u.fullname
        return acc
      }, {})
    }

    const headers = ['Ticket Number', 'Title', 'Request Type', 'Affected System', 'Status', 'Priority', 'Branch', 'Created At', 'Resolved At', 'SLA Due', 'Created By', 'Assigned To']
    const rows = tickets.map((t) => [
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

// Export incidents as CSV or PDF (admin only)
router.get('/export/incidents', authenticate, authorize('admin'), async (req, res) => {
  try {
    const format = req.query.format
    const isPdf = String(format || '').toLowerCase() === 'pdf'

    const incidents = await query('incidents', 'select', {
      select: 'incident_number, title, category, severity, status, branch_acronym, created_at, closed_at, created_by, assigned_to, source_ticket_id',
      orderBy: { column: 'created_at', ascending: false }
    }) || []

    const userIds = [...new Set(incidents.flatMap(i => [i.created_by, i.assigned_to]).filter(Boolean))]
    let userMap = {}
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',')
      const sql = `SELECT id, fullname FROM users WHERE id IN (${placeholders})`
      const userRows = await runQuery(sql, userIds)
      userMap = (userRows || []).reduce((acc, u) => {
        acc[u.id] = u.fullname
        return acc
      }, {})
    }

    const headers = ['Incident Number', 'Title', 'Category', 'Severity', 'Status', 'Branch', 'Created At', 'Closed At', 'Created By', 'Assigned To', 'Source Ticket ID']
    const rows = incidents.map((i) => [
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

// Admin panel stats (counts)
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { count: totalUsersCount } = await query('users', 'count', {})
    const { count: totalTicketsCount } = await query('tickets', 'count', {})
    const { count: totalIncidentsCount } = await query('incidents', 'count', {})

    res.json({
      totalUsers: totalUsersCount || 0,
      totalTickets: totalTicketsCount || 0,
      totalIncidents: totalIncidentsCount || 0,
      systemHealth: 'operational'
    })
  } catch (error) {
    console.error('Get admin stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Week bounds: Monday 00:00 UTC to next Monday 00:00 UTC
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

// Admin system metrics
router.get('/metrics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { start: weekStartISO, end: weekEndISO } = getWeekStartEnd(0)

    const ticketsThisWeekData = await query('tickets', 'select', {
      select: 'id, created_at',
      filters: [
        { column: 'created_at', operator: 'gte', value: weekStartISO },
        { column: 'created_at', operator: 'lt', value: weekEndISO }
      ]
    }) || []

    const countsByWeekday = [0, 0, 0, 0, 0, 0, 0]
    ticketsThisWeekData.forEach((t) => {
      if (!t.created_at) return
      const d = new Date(t.created_at)
      const idx = d.getUTCDay()
      if (!Number.isNaN(idx) && idx >= 0 && idx <= 6) countsByWeekday[idx] += 1
    })

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const ticketsThisWeek = weekdayLabels.map((label, idx) => ({
      label,
      count: countsByWeekday[idx] || 0
    }))

    const incidentsData = await query('incidents', 'select', {
      select: 'status'
    }) || []

    const incidentStatusMap = {}
    incidentsData.forEach((row) => {
      const status = row.status || 'unknown'
      incidentStatusMap[status] = (incidentStatusMap[status] || 0) + 1
    })
    const incidentStatus = Object.entries(incidentStatusMap).map(
      ([status, count]) => ({ status, count })
    )

    const openStatuses = ['new', 'assigned', 'in_progress', 'waiting_for_user']

    const { count: resolvedCount } = await query('tickets', 'count', {
      filters: [{ column: 'status', operator: 'in', value: ['resolved', 'closed'] }]
    })
    const { count: openCount } = await query('tickets', 'count', {
      filters: [{ column: 'status', operator: 'in', value: openStatuses }]
    })

    const slaTickets = await query('tickets', 'select', {
      select: 'id, sla_due, resolved_at',
      filters: [
        { column: 'sla_due', operator: 'is', value: null }, // will be overridden
      ]
    }) || []

    let withinSla = 0
    let breachedSla = 0
    slaTickets.forEach((t) => {
      if (!t.sla_due || !t.resolved_at) return
      const due = new Date(t.sla_due)
      const resolved = new Date(t.resolved_at)
      if (resolved <= due) withinSla += 1
      else breachedSla += 1
    })

    res.json({
      ticketsThisWeek,
      incidentStatus,
      resolvedVsOpen: {
        resolved: resolvedCount || 0,
        open: openCount || 0
      },
      sla: {
        within: withinSla,
        breached: breachedSla
      }
    })
  } catch (error) {
    console.error('Get admin metrics error:', error)
    res.status(500).json({ message: 'Server error', error: error.message || String(error) })
  }
})

module.exports = router