const express = require('express')
const router = express.Router()
const { query, runQuery } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { getValidAcronyms } = require('../lib/branches')

// Generate incident number by branch: INC-D01-000001
const generateIncidentNumber = async (branchAcronym) => {
  const last = await query('incidents', 'select', {
    select: 'incident_number',
    filters: [{ column: 'branch_acronym', value: branchAcronym }],
    orderBy: { column: 'created_at', ascending: false },
    limit: 1,
    single: true
  })
  let nextSeq = 1
  if (last && last.incident_number) {
    const match = (last.incident_number || '').match(/^INC-[A-Z0-9]+-(\d+)$/i)
    if (match) nextSeq = parseInt(match[1], 10) + 1
  }
  return `INC-${branchAcronym}-${String(nextSeq).padStart(6, '0')}`
}

// Get all incidents (Security Officer and Admin only)
router.get('/', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const { status, severity, category, branch_acronym } = req.query
    const role = req.user.role
    const userId = req.user.id

    const conditions = []
    const params = []

    if (role === 'security_officer') {
      conditions.push('i.assigned_to = ?')
      params.push(userId)
    }
    if (status) {
      conditions.push('i.status = ?')
      params.push(status)
    }
    if (severity) {
      conditions.push('i.severity = ?')
      params.push(severity)
    }
    if (category) {
      conditions.push('i.category = ?')
      params.push(category)
    }
    if (branch_acronym) {
      conditions.push('i.branch_acronym = ?')
      params.push(branch_acronym)
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT
        i.*,
        cu.fullname AS created_by_fullname,
        au.fullname AS assigned_to_fullname,
        t.ticket_number AS source_ticket_number,
        t.affected_system AS source_ticket_affected_system,
        t.created_by AS source_ticket_created_by,
        u2.fullname AS affected_user_fullname
      FROM incidents i
      LEFT JOIN users cu ON cu.id = i.created_by
      LEFT JOIN users au ON au.id = i.assigned_to
      LEFT JOIN tickets t ON t.id = i.source_ticket_id
      LEFT JOIN users u2 ON u2.id = i.affected_user_id
      ${whereClause}
      ORDER BY i.created_at DESC
    `
    const incidents = await runQuery(sql, params)

    const incidentsWithCounts = await Promise.all(
      (incidents || []).map(async (incident) => {
        const [timelineCount, attachmentCount] = await Promise.all([
          query('incident_timeline', 'count', {
            filters: [{ column: 'incident_id', value: incident.id }]
          }),
          query('attachments', 'count', {
            filters: [
              { column: 'record_type', value: 'incident' },
              { column: 'record_id', value: incident.id }
            ]
          })
        ])

        const affectedUser = incident.affected_user_fullname || null
        const affectedAsset = incident.affected_asset || incident.source_ticket_affected_system || null

        return {
          ...incident,
          incident_number: incident.incident_number,
          created_at: incident.created_at,
          incidentNumber: incident.incident_number,
          createdAt: incident.created_at,
          timelineCount: timelineCount.count || 0,
          attachmentCount: attachmentCount.count || 0,
          createdByName: incident.created_by_fullname,
          assignedToName: incident.assigned_to_fullname,
          sourceTicketNumber: incident.source_ticket_number || null,
          sourceTicketId: incident.source_ticket_id || null,
          affectedAsset: affectedAsset,
          affectedUser: affectedUser
        }
      })
    )

    res.json(incidentsWithCounts)
  } catch (error) {
    console.error('Get incidents error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get incident timeline only (lighter weight for polling)
router.get('/:id/timeline', authenticate, async (req, res) => {
  try {
    const { id } = req.params

    // Check incident
    const incident = await query('incidents', 'select', {
      select: 'assigned_to, source_ticket_id, status',
      filters: [{ column: 'id', value: id }],
      single: true
    })
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    // RBAC
    if (req.user.role === 'user') {
      const ticket = await query('tickets', 'select', {
        select: 'created_by',
        filters: [{ column: 'id', value: incident.source_ticket_id }],
        single: true
      })
      if (!ticket || ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (req.user.role === 'security_officer') {
      if (incident.assigned_to && incident.assigned_to !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (!['admin', 'it_support'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Timeline
    const baseSql = `
      SELECT
        it.*,
        u.fullname AS user_fullname,
        u.username AS user_username
      FROM incident_timeline it
      LEFT JOIN users u ON u.id = it.user_id
      WHERE it.incident_id = ?
    `
    const params = [id]
    let sql = baseSql + ' ORDER BY it.created_at ASC'
    let rows = await runQuery(sql, params)
    rows = rows || []

    if (req.user.role === 'user') {
      rows = rows.filter(r => !r.is_internal)
    }

    const formatted = rows.map(entry => ({
      id: entry.id,
      action: entry.action,
      description: entry.description,
      userName: entry.user_fullname || 'Unknown User',
      createdAt: entry.created_at,
      isInternal: entry.is_internal
    }))

    res.json(formatted)
  } catch (error) {
    console.error('Get timeline error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get incident status only (lighter weight for polling)
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params

    const incident = await query('incidents', 'select', {
      select: 'status, assigned_to, source_ticket_id',
      filters: [{ column: 'id', value: id }],
      single: true
    })
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    if (req.user.role === 'user') {
      const ticket = await query('tickets', 'select', {
        select: 'created_by',
        filters: [{ column: 'id', value: incident.source_ticket_id }],
        single: true
      })
      if (!ticket || ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (req.user.role === 'security_officer') {
      if (incident.assigned_to && incident.assigned_to !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (!['admin', 'it_support'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    res.json({ status: incident.status })
  } catch (error) {
    console.error('Get status error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get incident investigation data only (lighter weight for polling)
router.get('/:id/investigation', authenticate, async (req, res) => {
  try {
    const { id } = req.params

    const incident = await query('incidents', 'select', {
      select: 'root_cause, resolution_summary, assigned_to, source_ticket_id',
      filters: [{ column: 'id', value: id }],
      single: true
    })
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    if (req.user.role === 'user') {
      const ticket = await query('tickets', 'select', {
        select: 'created_by',
        filters: [{ column: 'id', value: incident.source_ticket_id }],
        single: true
      })
      if (!ticket || ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (req.user.role === 'security_officer') {
      if (incident.assigned_to && incident.assigned_to !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (!['admin', 'it_support'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    res.json({
      rootCause: incident.root_cause,
      resolutionSummary: incident.resolution_summary
    })
  } catch (error) {
    console.error('Get investigation error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single incident with details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id

    const sql = `
      SELECT
        i.*,
        cu.fullname AS created_by_fullname,
        cu.username AS created_by_username,
        au.fullname AS assigned_to_fullname,
        au.username AS assigned_to_username,
        t.ticket_number AS source_ticket_number,
        t.created_by AS source_ticket_created_by,
        t.assigned_to AS source_ticket_assigned_to,
        t.affected_system AS source_ticket_affected_system
      FROM incidents i
      LEFT JOIN users cu ON cu.id = i.created_by
      LEFT JOIN users au ON au.id = i.assigned_to
      LEFT JOIN tickets t ON t.id = i.source_ticket_id
      WHERE i.id = ?
      LIMIT 1
    `
    const rows = await runQuery(sql, [id])
    const incident = rows[0]

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    if (req.user.role === 'security_officer') {
      if (incident.assigned_to !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (req.user.role === 'it_support') {
      if (!incident.source_ticket_id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (req.user.role === 'user') {
      return res.status(403).json({ message: 'Forbidden' })
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const tlSql = `
      SELECT
        it.*,
        u.fullname AS user_fullname,
        u.username AS user_username
      FROM incident_timeline it
      LEFT JOIN users u ON u.id = it.user_id
      WHERE it.incident_id = ?
      ORDER BY it.created_at ASC
    `
    let timeline = await runQuery(tlSql, [id])
    timeline = timeline || []

    const attachments = await query('attachments', 'select', {
      filters: [
        { column: 'record_type', value: 'incident' },
        { column: 'record_id', value: id }
      ]
    })

    let affectedUser = null
    let affectedUserId = incident.affected_user_id || null
    if (affectedUserId) {
      const row = await query('users', 'select', {
        select: 'id, fullname, username',
        filters: [{ column: 'id', value: affectedUserId }],
        single: true
      })
      if (row) {
        affectedUser = row.fullname || null
        affectedUserId = row.id
      }
    }
    if (!affectedUser && incident.affected_user != null && String(incident.affected_user).trim() !== '') {
      affectedUser = incident.affected_user
    }
    if (!affectedUser && incident.source_ticket_created_by) {
      const row = await query('users', 'select', {
        select: 'id, fullname',
        filters: [{ column: 'id', value: incident.source_ticket_created_by }],
        single: true
      })
      if (row) {
        affectedUser = row.fullname || null
        affectedUserId = row.id
      }
    }

    const affectedAsset = incident.affected_asset != null && incident.affected_asset !== ''
      ? incident.affected_asset
      : (incident.source_ticket_affected_system || null)

    const impactConfidentiality = incident.impact_confidentiality || 'none'
    const impactIntegrity = incident.impact_integrity || 'none'
    const impactAvailability = incident.impact_availability || 'none'

    res.json({
      ...incident,
      incident_number: incident.incident_number,
      created_at: incident.created_at,
      incidentNumber: incident.incident_number,
      createdAt: incident.created_at,
      createdByName: incident.created_by_fullname,
      createdByUsername: incident.created_by_username,
      assignedToName: incident.assigned_to_fullname,
      assignedToUsername: incident.assigned_to_username,
      sourceTicketNumber: incident.source_ticket_number || null,
      sourceTicketId: incident.source_ticket_id || null,
      affectedAsset: affectedAsset || null,
      affectedUser: affectedUser || null,
      affectedUserId: affectedUserId || null,
      rootCause: incident.root_cause || null,
      resolutionSummary: incident.resolution_summary || null,
      impactConfidentiality,
      impactIntegrity,
      impactAvailability,
      timeline: timeline.map(t => ({
        ...t,
        userName: t.user_fullname || 'Unknown User',
        userUsername: t.user_username,
        createdAt: t.created_at,
        isInternal: t.is_internal
      })),
      attachments: attachments.map(a => ({
        ...a,
        createdAt: a.created_at,
        originalName: a.original_name
      }))
    })
  } catch (error) {
    console.error('Get incident error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Create incident (Security Officer and Admin only)
router.post('/', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const {
      detectionMethod,
      category,
      title,
      description,
      severity,
      impactConfidentiality,
      impactIntegrity,
      impactAvailability,
      affectedAsset,
      affectedUser,
      sourceTicketId,
      branchAcronym
    } = req.body

    if (!category || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const validAcronyms = await getValidAcronyms()
    const branch = branchAcronym && validAcronyms.has(branchAcronym) ? branchAcronym : 'SPI'
    const incidentNumber = await generateIncidentNumber(branch)

    const result = await query('incidents', 'insert', {
      data: {
        incident_number: incidentNumber,
        branch_acronym: branch,
        source_ticket_id: sourceTicketId || null,
        detection_method: detectionMethod || 'user_reported',
        category,
        title,
        description,
        severity: severity || 'medium',
        impact_confidentiality: impactConfidentiality || 'none',
        impact_integrity: impactIntegrity || 'none',
        impact_availability: impactAvailability || 'none',
        affected_asset: affectedAsset || null,
        affected_user: affectedUser || null,
        created_by: req.user.id,
        status: 'new'
      }
    })

    await query('incident_timeline', 'insert', {
      data: {
        incident_id: result.id,
        user_id: req.user.id,
        action: 'INCIDENT_CREATED',
        description: 'Incident created'
      }
    })

    await query('audit_logs', 'insert', {
      data: {
        action: 'CREATE_INCIDENT',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: result.id,
        details: { incident_number: incidentNumber, category, severity }
      }
    })

    const secAndAdminUsers = await query('users', 'select', {
      select: 'id, role, status',
      filters: [{ column: 'status', value: 'active' }]
    })
    if (secAndAdminUsers && secAndAdminUsers.length > 0) {
      const creatorId = req.user.id
      for (const u of secAndAdminUsers) {
        if (!['security_officer', 'admin'].includes(u.role)) continue
        if (u.id === creatorId) continue
        await query('notifications', 'insert', {
          data: {
            user_id: u.id,
            type: 'NEW_INCIDENT_CREATED',
            title: 'New incident created',
            message: `New incident ${incidentNumber}: ${title}`,
            resource_type: 'incident',
            resource_id: result.id
          }
        })
      }
    }

    res.status(201).json({ message: 'Incident created', incidentId: result.id, incidentNumber })
  } catch (error) {
    console.error('Create incident error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update incident
router.put('/:id', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      severity,
      status,
      assignedTo,
      impactConfidentiality,
      impactIntegrity,
      impactAvailability,
      affectedAsset,
      affectedUser,
      affectedUserId,
      rootCause,
      resolutionSummary
    } = req.body

    const incident = await query('incidents', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    if (incident.status === 'closed') {
      return res.status(400).json({ message: 'Closed incidents cannot be edited.' })
    }

    const updateData = {}
    if (title) updateData.title = title
    if (description) updateData.description = description
    if (severity) updateData.severity = severity
    if (status) {
      updateData.status = status
      if (status === 'triaged' && !incident.triaged_at) updateData.triaged_at = new Date().toISOString()
      if (status === 'contained' && !incident.contained_at) updateData.contained_at = new Date().toISOString()
      if (status === 'recovered' && !incident.recovered_at) updateData.recovered_at = new Date().toISOString()
      if (status === 'closed' && !incident.closed_at) updateData.closed_at = new Date().toISOString()
    }
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null
    if (impactConfidentiality) updateData.impact_confidentiality = impactConfidentiality
    if (impactIntegrity) updateData.impact_integrity = impactIntegrity
    if (impactAvailability) updateData.impact_availability = impactAvailability
    if (affectedAsset !== undefined) updateData.affected_asset = affectedAsset || null
    if (affectedUser !== undefined) updateData.affected_user = affectedUser || null
    if (affectedUserId !== undefined) updateData.affected_user_id = affectedUserId || null
    if (rootCause !== undefined) updateData.root_cause = rootCause || null
    if (resolutionSummary !== undefined) updateData.resolution_summary = resolutionSummary || null
    updateData.updated_at = new Date().toISOString()

    await query('incidents', 'update', {
      filters: [{ column: 'id', value: req.params.id }],
      data: updateData
    })

    if (status && status !== incident.status) {
      const isInvestigationStatus = ['triaged', 'investigating', 'contained', 'recovered', 'closed'].includes(status)
      await query('incident_timeline', 'insert', {
        data: {
          incident_id: req.params.id,
          user_id: req.user.id,
          action: 'STATUS_CHANGED',
          description: `Status changed from ${incident.status} to ${status}`,
          is_internal: !isInvestigationStatus
        }
      })
    }

    if (assignedTo !== undefined && assignedTo !== incident.assigned_to) {
      const assignedUser = await query('users', 'select', {
        select: 'fullname, role',
        filters: [{ column: 'id', value: assignedTo }],
        single: true
      })

      await query('incident_timeline', 'insert', {
        data: {
          incident_id: req.params.id,
          user_id: req.user.id,
          action: 'INCIDENT_ASSIGNED',
          description: `Incident assigned to ${assignedUser?.fullname || 'Security Officer'} (${assignedUser?.role || 'security_officer'})`,
          is_internal: 0
        }
      })

      const incNumber = incident.incident_number || ''
      if (assignedTo) {
        await query('notifications', 'insert', {
          data: {
            user_id: assignedTo,
            type: 'INCIDENT_ASSIGNED',
            title: 'Incident Assigned to You',
            message: `Incident ${incNumber} has been assigned to you`,
            resource_type: 'incident',
            resource_id: req.params.id
          }
        })
      }

      const adminUsers = await query('users', 'select', {
        select: 'id',
        filters: [
          { column: 'role', value: 'admin' },
          { column: 'status', value: 'active' }
        ]
      })
      if (adminUsers && adminUsers.length > 0) {
        for (const adm of adminUsers) {
          if (adm.id !== req.user.id) {
            await query('notifications', 'insert', {
              data: {
                user_id: adm.id,
                type: 'INCIDENT_ASSIGNED',
                title: 'Incident Assigned',
                message: `Incident ${incNumber} was assigned to ${assignedUser?.fullname || 'Security Officer'}`,
                resource_type: 'incident',
                resource_id: req.params.id
              }
            })
          }
        }
      }
    }

    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_INCIDENT',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: req.params.id,
        details: req.body
      }
    })

    if (incident.source_ticket_id) {
      const sourceTicket = await query('tickets', 'select', {
        select: 'created_by',
        filters: [{ column: 'id', value: incident.source_ticket_id }],
        single: true
      })
      if (sourceTicket?.created_by && sourceTicket.created_by !== req.user.id) {
        await query('notifications', 'insert', {
          data: {
            user_id: sourceTicket.created_by,
            type: 'INCIDENT_UPDATED',
            title: 'Incident updated',
            message: 'Incident linked to your ticket was updated',
            resource_type: 'incident',
            resource_id: req.params.id
          }
        })
        await query('audit_logs', 'insert', {
          data: {
            action: 'INCIDENT_UPDATED',
            user_id: sourceTicket.created_by,
            resource_type: 'incident',
            resource_id: req.params.id,
            details: { incident_id: req.params.id }
          }
        })
      }
    }

    res.json({ message: 'Incident updated' })
  } catch (error) {
    console.error('Update incident error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Add timeline entry
router.post('/:id/timeline', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const { action, description, isInternal = false } = req.body

    if (!action || !description) {
      return res.status(400).json({ message: 'Action and description are required' })
    }

    const incident = await query('incidents', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    const result = await query('incident_timeline', 'insert', {
      data: {
        incident_id: req.params.id,
        user_id: req.user.id,
        action,
        description,
        is_internal: isInternal,
        created_at: new Date().toISOString()
      }
    })

    await query('audit_logs', 'insert', {
      data: {
        action: 'ADD_TIMELINE_ENTRY',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: req.params.id,
        details: { action, description, is_internal: isInternal }
      }
    })

    const userRow = await query('users', 'select', {
      select: 'fullname, role',
      filters: [{ column: 'id', value: req.user.id }],
      single: true
    })
    const userName = userRow?.fullname || 'User'
    const userRole = userRow?.role || 'staff'

    const getRoleTitle = (role) => {
      switch (role) {
        case 'admin': return 'Admin'
        case 'security_officer': return 'Security Officer'
        case 'it_support': return 'IT Support'
        default: return 'Staff'
      }
    }

    const roleTitle = getRoleTitle(userRole)

    if (incident.source_ticket_id) {
      const sourceTicket = await query('tickets', 'select', {
        select: 'created_by, ticket_number, title',
        filters: [{ column: 'id', value: incident.source_ticket_id }],
        single: true
      })

      if (sourceTicket) {
        if (sourceTicket.created_by !== req.user.id) {
          const incidentNumber = incident.incident_number || `INC-${incident.id}`

          const notificationData = {
            user_id: sourceTicket.created_by,
            type: 'ADDED_INCIDENT_TIMELINE',
            title: 'Incident updated',
            message: `${userName} (${roleTitle}) added a timeline entry to incident ${incidentNumber}: "${action}"`,
            resource_type: 'incident',
            resource_id: req.params.id,
            ticket_id: incident.source_ticket_id,
            is_read: 0,
            created_at: new Date().toISOString()
          }

          await query('notifications', 'insert', { data: notificationData })
        }
      }
    }

    res.status(201).json({
      message: 'Timeline entry added',
      entryId: result.id,
      notification_sent: !!incident.source_ticket_id
    })
  } catch (error) {
    console.error('Add timeline entry error:', error)
    res.status(500).json({ message: 'Server error: ' + error.message })
  }
})

// Get incident by formatted incident number (e.g., INC-D01-000003)
router.get('/number/:incidentNumber', authenticate, async (req, res) => {
  try {
    const { incidentNumber } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    console.log(`Fetching incident by number: ${incidentNumber} for user: ${userId}, role: ${userRole}`)

    const sql = `
      SELECT
        i.*,
        t.*
      FROM incidents i
      LEFT JOIN tickets t ON t.id = i.source_ticket_id
      WHERE i.incident_number = ?
      LIMIT 1
    `
    const rows = await runQuery(sql, [incidentNumber])
    const data = rows[0]

    if (!data) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      if (data.created_by && data.created_by !== userId) {
        return res.status(403).json({ message: 'Access denied' })
      }
    }

    res.json(data)
  } catch (error) {
    console.error('Get incident by number error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router