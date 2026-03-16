const express = require('express')
const router = express.Router()
const { runQuery } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// audit_logs.created_at: set ONLY by the database (DEFAULT NOW() + trigger). Never send created_at on insert. Real-time.

// Philippine time (UTC+8): treat date-only YYYY-MM-DD as that day in Manila for filtering
function startOfDayPHT(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  return new Date(ymd + 'T00:00:00+08:00').toISOString()
}
function endOfDayPHT(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  return new Date(ymd + 'T23:59:59.999+08:00').toISOString()
}

// Export audit reports (must be before /:param routes)
const EXPORT_PAGE_SIZE = 1000

router.get('/export', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv', resourceType, action, search } = req.query

    const logs = []
    const searchTerm = search && String(search).trim() ? String(search).trim() : null

    // Build base SQL with join to users
    const conditions = []
    const params = []
    if (resourceType) {
      conditions.push('al.resource_type = ?')
      params.push(resourceType)
    }
    if (action) {
      conditions.push('al.action = ?')
      params.push(action)
    }
    const startISO = startOfDayPHT(startDate)
    const endISO = endOfDayPHT(endDate)
    if (startISO) {
      conditions.push('al.created_at >= ?')
      params.push(startISO)
    }
    if (endISO) {
      conditions.push('al.created_at <= ?')
      params.push(endISO)
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT 
        al.id, al.action, al.resource_type, al.resource_id, al.details, al.ip_address,
        al.created_at, al.user_id,
        u.fullname AS user_fullname,
        u.username AS user_username
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `
    const exportRows = await runQuery(sql, [...params, EXPORT_PAGE_SIZE])
    const page = exportRows || []
    const toAdd = searchTerm ? page.filter((l) => auditLogMatchesSearch(l, searchTerm)) : page
    logs.push(...toAdd)

    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename=audit-report.json')
      res.setHeader('Content-Type', 'application/json')
      return res.json(logs || [])
    }

    const csvRows = (logs || []).map(l => ({
      id: l.id,
      createdAt: l.created_at,
      action: l.action,
      resourceType: l.resource_type || '',
      resourceId: l.resource_id || '',
      userName: l.user_fullname || '',
      userUsername: l.user_username || '',
      details: typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || ''),
      ipAddress: l.ip_address || ''
    }))

    const headers = ['id', 'createdAt', 'action', 'resourceType', 'resourceId', 'userName', 'userUsername', 'details', 'ipAddress']
    const csv = [headers.join(',')].concat(
      csvRows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))
    ).join('\n')

    res.setHeader('Content-Disposition', 'attachment; filename=audit-report.csv')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.send('\uFEFF' + csv)
  } catch (error) {
    console.error('Export audit error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Helper: match search term against resource_id or details (ticket number, branch, etc.)
function auditLogMatchesSearch(log, searchTerm) {
  if (!searchTerm || !String(searchTerm).trim()) return true
  const s = String(searchTerm).trim().toLowerCase()
  if (log.resource_id && String(log.resource_id).toLowerCase().includes(s)) return true
  if (log.details != null) {
    const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)
    if (detailsStr.toLowerCase().includes(s)) return true
  }
  return false
}

// Get audit logs (admin only) - immutable activity logs, who/when/what
// Optional query: search (matches resource_id, ticket number, branch, etc. in details)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { limit = 200, offset = 0, resourceType, resourceId, action, startDate, endDate, search } = req.query
    const limitNum = Math.min(parseInt(limit, 10) || 200, 500)
    const offsetNum = Math.max(0, parseInt(offset, 10) || 0)

    const startISO = startOfDayPHT(startDate)
    const endISO = endOfDayPHT(endDate)
    const conditions = []
    const params = []
    if (resourceType) {
      conditions.push('al.resource_type = ?')
      params.push(resourceType)
    }
    if (resourceId) {
      conditions.push('al.resource_id = ?')
      params.push(resourceId)
    }
    if (action) {
      conditions.push('al.action = ?')
      params.push(action)
    }
    if (startISO) {
      conditions.push('al.created_at >= ?')
      params.push(startISO)
    }
    if (endISO) {
      conditions.push('al.created_at <= ?')
      params.push(endISO)
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const baseSql = `
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
    `

    let logs
    let total

    if (search && String(search).trim()) {
      const fetchLimit = 5000
      const sql = `
        SELECT 
          al.id, al.action, al.resource_type, al.resource_id, al.details, al.ip_address,
          al.user_agent, al.created_at, al.user_id,
          u.fullname AS user_fullname,
          u.username AS user_username
        ${baseSql}
        ORDER BY al.created_at DESC
        LIMIT ?
      `
      const rawLogs = await runQuery(sql, [...params, fetchLimit])
      const filtered = (rawLogs || []).filter((l) => auditLogMatchesSearch(l, search))
      total = filtered.length
      logs = filtered.slice(offsetNum, offsetNum + limitNum)
    } else {
      const sql = `
        SELECT 
          al.id, al.action, al.resource_type, al.resource_id, al.details, al.ip_address,
          al.user_agent, al.created_at, al.user_id,
          u.fullname AS user_fullname,
          u.username AS user_username
        ${baseSql}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `
      const rawLogs = await runQuery(sql, [...params, limitNum, offsetNum])

      const countSql = `SELECT COUNT(*) as count ${baseSql}`
      const countRows = await runQuery(countSql, params)
      const count = countRows[0]?.count || 0

      logs = rawLogs || []
      total = count ?? logs.length
    }

    const list = (logs || []).map(l => ({
      id: l.id,
      action: l.action,
      resourceType: l.resource_type,
      resourceId: l.resource_id,
      details: l.details,
      ipAddress: l.ip_address,
      userAgent: l.user_agent,
      createdAt: l.created_at,
      userName: l.user_fullname,
      userUsername: l.user_username,
      userId: l.user_id
    }))

    res.json({ logs: list, total })
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get audit logs for a specific resource (record history - who/when/what)
router.get('/resource/:resourceType/:resourceId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params

    const sql = `
      SELECT 
        al.id, al.action, al.details, al.created_at,
        u.fullname AS user_fullname,
        u.username AS user_username
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.resource_type = ?
        AND al.resource_id = ?
      ORDER BY al.created_at DESC
      LIMIT 100
    `
    const logs = await runQuery(sql, [resourceType, resourceId])

    res.json((logs || []).map(l => ({
      id: l.id,
      action: l.action,
      details: l.details,
      createdAt: l.created_at,
      userName: l.user_fullname,
      userUsername: l.user_username
    })))
  } catch (error) {
    console.error('Get resource audit error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
