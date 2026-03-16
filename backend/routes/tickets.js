const express = require('express')
const router = express.Router()
const { query, runQuery } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { getValidAcronyms } = require('../lib/branches')

// Helper: parse branch_acronyms from comma-separated string
const parseBranchAcronyms = (value) => {
  if (typeof value !== 'string' || !value.trim()) return []
  return value.split(',').map(a => a.trim()).filter(Boolean)
}

// Helper function to find IT Support user for ticket assignment
const findITSupportUser = async () => {
  try {
    const itUser = await query('users', 'select', {
      select: 'id',
      filters: [
        { column: 'role', value: 'it_support' },
        { column: 'status', value: 'active' }
      ],
      orderBy: { column: 'created_at', ascending: true },
      limit: 1,
      single: true
    })
    return itUser ? itUser.id : null
  } catch (error) {
    console.error('Error in findITSupportUser:', error)
    return null
  }
}

// Helper function to find Security Officer for incident assignment
const findSecurityOfficer = async () => {
  try {
    const row = await query('users', 'select', {
      select: 'id, fullname, username',
      filters: [
        { column: 'role', value: 'security_officer' },
        { column: 'status', value: 'active' }
      ],
      orderBy: { column: 'created_at', ascending: true },
      limit: 1,
      single: true
    })

    if (row) {
      console.log('✅ Found Security Officer for assignment:', {
        id: row.id,
        fullname: row.fullname,
        username: row.username
      })
      return row.id
    } else {
      console.warn('⚠️ No active Security Officer found for incident assignment')
      return null
    }
  } catch (error) {
    console.error('Error in findSecurityOfficer:', error)
    return null
  }
}

// Generate ticket number by branch: e.g. D01-000001
const generateTicketNumber = async (branchAcronym) => {
  const last = await query('tickets', 'select', {
    select: 'ticket_number',
    filters: [{ column: 'branch_acronym', value: branchAcronym }],
    orderBy: { column: 'created_at', ascending: false },
    limit: 1,
    single: true
  })
  let nextSeq = 1
  if (last && last.ticket_number) {
    const match = last.ticket_number.match(/^[A-Z0-9]+-(\d+)$/i)
    if (match) nextSeq = parseInt(match[1], 10) + 1
  }
  return `${branchAcronym}-${String(nextSeq).padStart(6, '0')}`
}

// Calculate SLA due date
const calculateSLADue = async (priority) => {
  const sla = await query('sla_config', 'select', {
    filters: [
      { column: 'priority', value: priority },
      { column: 'is_active', value: 1 }
    ],
    single: true
  })
  if (!sla) return null

  const dueDate = new Date()
  dueDate.setHours(dueDate.getHours() + sla.resolution_time_hours)
  return dueDate.toISOString()
}

// IMPORTANT: Place more specific routes BEFORE parameterized routes
// ================================================================

// Get ticket by formatted ticket number (e.g., D01-000004)
router.get('/number/:ticketNumber', authenticate, async (req, res) => {
  try {
    const { ticketNumber } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    console.log(`Fetching ticket by number: ${ticketNumber} for user: ${userId}, role: ${userRole}`)

    const ticket = await query('tickets', 'select', {
      filters: [{ column: 'ticket_number', value: ticketNumber }],
      single: true
    })

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    // Check if user has access to this ticket
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      if (ticket.created_by !== userId) {
        return res.status(403).json({ message: 'Access denied' })
      }
    }

    res.json(ticket)
  } catch (error) {
    console.error('Get ticket by number error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get attachments for a ticket - MOVED BEFORE /:id route
router.get('/attachments/:ticketId', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    // First check if the ticket exists
    const ticket = await query('tickets', 'select', {
      filters: [{ column: 'id', value: ticketId }],
      single: true
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Get attachments for this ticket
    const attachments = await query('attachments', 'select', {
      filters: [
        { column: 'record_type', value: 'ticket' },
        { column: 'record_id', value: ticketId }
      ],
      orderBy: { column: 'created_at', ascending: false }
    });

    console.log(`Found ${attachments?.length || 0} attachments for ticket ${ticketId}`);
    res.json(attachments || []);
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      sqlMessage: error.sqlMessage 
    });
  }
});

// Get all tickets
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, branch_acronym: queryBranch } = req.query
    const role = req.user.role
    const userId = req.user.id

    // Fetch current user's branch_acronyms if not admin
    let userBranchAcronyms = []
    if (role !== 'admin') {
      const userRow = await query('users', 'select', {
        select: 'branch_acronyms',
        filters: [{ column: 'id', value: userId }],
        single: true
      })
      userBranchAcronyms = parseBranchAcronyms(userRow?.branch_acronyms)
    }
    const hasAllBranches = userBranchAcronyms.includes('ALL')

    // Build WHERE conditions
    const conditions = []
    const params = []

    // Role-based access
    if (role === 'user') {
      conditions.push('t.created_by = ?')
      params.push(userId)
      if (!hasAllBranches && userBranchAcronyms.length > 0) {
        conditions.push('(t.branch_acronym IS NULL OR t.branch_acronym IN (?))')
        params.push(userBranchAcronyms)
      }
    } else if (role === 'it_support' || role === 'security_officer') {
      if (!hasAllBranches && userBranchAcronyms.length > 0) {
        conditions.push('(t.branch_acronym IS NULL OR t.branch_acronym IN (?))')
        params.push(userBranchAcronyms)
      }
    }
    // Admin or user with ALL branches: no branch filter

    // Query filters
    if (status) {
      conditions.push('t.status = ?')
      params.push(status)
    }
    if (priority) {
      conditions.push('t.priority = ?')
      params.push(priority)
    }
    if (queryBranch) {
      conditions.push('t.branch_acronym = ?')
      params.push(queryBranch)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT
        t.*,
        c.fullname AS created_by_fullname,
        c.username AS created_by_username,
        a.fullname AS assigned_to_fullname
      FROM tickets t
      LEFT JOIN users c ON c.id = t.created_by
      LEFT JOIN users a ON a.id = t.assigned_to
      ${whereClause}
      ORDER BY t.created_at DESC
    `
    let tickets = await runQuery(sql, params)
    tickets = tickets || []

    // IT Support: also include tickets they converted (incident created_by = them)
    if (role === 'it_support') {
      const incidentRows = await query('incidents', 'select', {
        select: 'source_ticket_id',
        filters: [{ column: 'created_by', value: userId }]
      })
      const myIncidents = (incidentRows || []).filter(i => i.source_ticket_id != null)
      const convertedTicketIds = myIncidents.map(i => i.source_ticket_id).filter(Boolean)
      const existingIds = new Set(tickets.map(t => t.id))
      const missingIds = convertedTicketIds.filter(id => !existingIds.has(id))

      if (missingIds.length > 0) {
        const placeholders = missingIds.map(() => '?').join(',')
        const extraSql = `
          SELECT
            t.*,
            c.fullname AS created_by_fullname,
            c.username AS created_by_username,
            a.fullname AS assigned_to_fullname
          FROM tickets t
          LEFT JOIN users c ON c.id = t.created_by
          LEFT JOIN users a ON a.id = t.assigned_to
          WHERE t.id IN (${placeholders})
          ORDER BY t.created_at DESC
        `
        const extraTickets = await runQuery(extraSql, missingIds)
        if (extraTickets && extraTickets.length > 0) {
          tickets = [...tickets, ...extraTickets].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          )
        }
      }
    }

    if (tickets.length === 0) {
      return res.json([])
    }

    console.log('📋 Fetched tickets:', tickets.length, 'tickets')

    const ticketsWithCounts = await Promise.all(
      tickets.map(async (ticket) => {
        const [commentCount, attachmentCount] = await Promise.all([
          query('ticket_comments', 'count', {
            filters: [{ column: 'ticket_id', value: ticket.id }]
          }),
          query('attachments', 'count', {
            filters: [
              { column: 'record_type', value: 'ticket' },
              { column: 'record_id', value: ticket.id }
            ]
          })
        ])

        let assignedToName = ticket.assigned_to_fullname || null
        let createdByName = ticket.created_by_fullname || 'Unknown'

        let convertedIncidentId = null
        let convertedIncidentNumber = null
        if (ticket.status === 'converted_to_incident') {
          const inc = await query('incidents', 'select', {
            select: 'id, incident_number',
            filters: [{ column: 'source_ticket_id', value: ticket.id }],
            single: true
          })
          if (inc) {
            convertedIncidentId = inc.id
            convertedIncidentNumber = inc.incident_number
          }
        }

        return {
          ...ticket,
          request_type: ticket.request_type,
          affected_system: ticket.affected_system,
          created_at: ticket.created_at,
          sla_due: ticket.sla_due,
          ticket_number: ticket.ticket_number,
          assigned_to: ticket.assigned_to,
          requestType: ticket.request_type,
          affectedSystem: ticket.affected_system,
          createdAt: ticket.created_at,
          slaDue: ticket.sla_due,
          ticketNumber: ticket.ticket_number,
          assignedTo: ticket.assigned_to,
          commentCount: commentCount.count || 0,
          attachmentCount: attachmentCount.count || 0,
          createdByName,
          assignedToName,
          convertedIncidentId,
          convertedIncidentNumber
        }
      })
    )

    res.json(ticketsWithCounts)
  } catch (error) {
    console.error('Get tickets error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single ticket with details - MOVED AFTER more specific routes
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticketId = req.params.id

    const sql = `
      SELECT
        t.*,
        c.fullname AS created_by_fullname,
        c.username AS created_by_username,
        a.fullname AS assigned_to_fullname,
        a.username AS assigned_to_username
      FROM tickets t
      LEFT JOIN users c ON c.id = t.created_by
      LEFT JOIN users a ON a.id = t.assigned_to
      WHERE t.id = ?
      LIMIT 1
    `
    const rows = await runQuery(sql, [ticketId])
    const ticket = rows[0]

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    // RBAC: Users can only access their own tickets and branches
    if (req.user.role === 'user') {
      if (ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      const userRow = await query('users', 'select', {
        select: 'branch_acronyms',
        filters: [{ column: 'id', value: req.user.id }],
        single: true
      })
      const userBranches = parseBranchAcronyms(userRow?.branch_acronyms)
      const hasAllBranches = userBranches.includes('ALL')
      if (!hasAllBranches && userBranches.length > 0 && ticket.branch_acronym && !userBranches.includes(ticket.branch_acronym)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    // Check if ticket has already been converted to an incident
    let existingIncident = await query('incidents', 'select', {
      select: 'id, incident_number, source_ticket_id',
      filters: [{ column: 'source_ticket_id', value: ticketId }],
      single: true
    })

    if (!existingIncident && ticket.ticket_number) {
      // Search incident timeline for entries mentioning this ticket number
      const tl = await query('incident_timeline', 'select', {
        select: 'incident_id, description',
        filters: [],
      })
      const foundEntry = (tl || []).find(
        e => typeof e.description === 'string' && e.description.includes(ticket.ticket_number)
      )
      if (foundEntry) {
        const inc = await query('incidents', 'select', {
          select: 'id, incident_number, source_ticket_id',
          filters: [{ column: 'id', value: foundEntry.incident_id }],
          single: true
        })
        if (inc) existingIncident = inc
      }
    }

    // Get comments with user info
    const commentsSql = `
      SELECT
        c.*,
        u.fullname AS user_fullname,
        u.username AS user_username
      FROM ticket_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `
    let comments = await runQuery(commentsSql, [ticketId])
    comments = comments || []

    if (req.user.role === 'user') {
      comments = comments.filter(c => !c.is_internal)
    }

    // Incident timeline if converted
    let incidentTimeline = []
    if (existingIncident) {
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
      incidentTimeline = await runQuery(tlSql, [existingIncident.id])
      incidentTimeline = incidentTimeline || []
    }

    // Get attachments
    const attachments = await query('attachments', 'select', {
      filters: [
        { column: 'record_type', value: 'ticket' },
        { column: 'record_id', value: ticketId }
      ]
    });

    res.json({
      ...ticket,
      request_type: ticket.request_type,
      affected_system: ticket.affected_system,
      created_at: ticket.created_at,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      sla_due: ticket.sla_due,
      requestType: ticket.request_type,
      affectedSystem: ticket.affected_system,
      createdAt: ticket.created_at,
      createdBy: ticket.created_by,
      assignedTo: ticket.assigned_to,
      slaDue: ticket.sla_due,
      createdByName: ticket.created_by_fullname || 'Unknown',
      createdByUsername: ticket.created_by_username,
      assignedToName: ticket.assigned_to_fullname || null,
      assignedToUsername: ticket.assigned_to_username || null,
      createdByEmail: ticket.created_by_username,
      assignedToEmail: ticket.assigned_to_username,
      isConverted: !!existingIncident,
      convertedIncidentId: existingIncident?.id || null,
      convertedIncidentNumber: existingIncident?.incident_number || null,
      comments: comments.map(c => ({
        ...c,
        createdAt: c.created_at,
        isInternal: c.is_internal,
        userId: c.user_id,
        userName: c.user_fullname || 'Unknown User',
        userUsername: c.user_username
      })),
      incidentTimeline: incidentTimeline.map(t => ({
        ...t,
        createdAt: t.created_at,
        isInternal: t.is_internal,
        userId: t.user_id,
        userName: t.user_fullname || 'Unknown User',
        userUsername: t.user_username
      })),
      attachments: attachments.map(a => ({
        id: a.id,
        recordType: a.record_type,
        recordId: a.record_id,
        filename: a.filename,
        originalName: a.original_name,
        mimeType: a.mime_type,
        size: a.size,
        filePath: a.file_path,
        uploadedBy: a.uploaded_by,
        createdAt: a.created_at
      }))
    })
  } catch (error) {
    console.error('Get ticket error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Create ticket (users only; admin can create for any branch)
router.post('/', authenticate, authorize('user', 'admin'), async (req, res) => {
  try {
    const { requestType, title, description, affectedSystem, priority, category, branchAcronym } = req.body

    if (!requestType || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const validAcronyms = await getValidAcronyms()
    if (!branchAcronym || !validAcronyms.has(branchAcronym) || branchAcronym === 'ALL') {
      return res.status(400).json({ message: 'Valid branch is required (ticket must be for a specific branch)' })
    }

    if (req.user.role === 'user') {
      const userRow = await query('users', 'select', {
        select: 'branch_acronyms',
        filters: [{ column: 'id', value: req.user.id }],
        single: true
      })
      const userBranches = parseBranchAcronyms(userRow?.branch_acronyms)
      const hasAllBranches = userBranches.includes('ALL')
      const canUseBranch = hasAllBranches || userBranches.includes(branchAcronym)
      if (userBranches.length > 0 && !canUseBranch) {
        return res.status(403).json({ message: 'You can only create tickets for your assigned branch(es)' })
      }
    }

    const ticketNumber = await generateTicketNumber(branchAcronym)
    const slaDue = await calculateSLADue(priority || 'medium')

    const assignedToId = await findITSupportUser()
    console.log('🔍 Assignment check:', { assignedToId, ticketNumber })

    // First, let's check what columns exist in the tickets table
    // You need to run: DESCRIBE tickets;
    
    const ticketData = {
      ticket_number: ticketNumber,
      branch_acronym: branchAcronym,
      request_type: requestType,
      title: title,
      description: description,
      affected_system: affectedSystem || null,
      priority: priority || 'medium',
      category: category || null,
      created_by: req.user.id,
      assigned_to: assignedToId,
      status: assignedToId ? 'assigned' : 'new',
      sla_due: slaDue,
      created_at: new Date(),
      updated_at: new Date()
    }

    console.log('💾 Attempting to insert ticket with data:', ticketData)

    const result = await query('tickets', 'insert', { data: ticketData })

    console.log('✅ Ticket created successfully:', {
      id: result.id,
      ticketNumber: result.ticket_number,
      assigned_to: result.assigned_to || 'NULL',
      status: result.status
    })

    // FIXED: Log audit - stringify the details object
    const auditPayload = {
      action: 'CREATE_TICKET',
      user_id: req.user.id,
      resource_type: 'ticket',
      resource_id: result.id,
      details: JSON.stringify({
        ticket_number: ticketNumber,
        title,
        request_type: requestType,
        priority,
        branch_acronym: branchAcronym,
        assigned_to: assignedToId
      })
    }
    await query('audit_logs', 'insert', { data: auditPayload })

    // Notification for assigned IT support
    if (assignedToId) {
      await query('notifications', 'insert', {
        data: {
          user_id: assignedToId,
          type: 'TICKET_ASSIGNED',
          title: 'New Ticket Assigned',
          message: `New ${requestType} ticket: ${title} has been assigned to you`,
          resource_type: 'ticket',
          resource_id: result.id
        }
      })
    }

    // Notify all IT Staff and Admin
    const itAndAdminUsers = await query('users', 'select', {
      select: 'id',
      filters: [
        { column: 'status', value: 'active' }
      ]
    })
    const notifyUsers = (itAndAdminUsers || []).filter(
      u => u.id !== req.user.id && u.id !== assignedToId
    )

    for (const u of notifyUsers) {
      await query('notifications', 'insert', {
        data: {
          user_id: u.id,
          type: 'NEW_TICKET_CREATED',
          title: 'New ticket created',
          message: `New ticket ${ticketNumber}: ${title}`,
          resource_type: 'ticket',
          resource_id: result.id
        }
      })
    }

    res.status(201).json({
      message: 'Ticket created',
      ticketId: result.id,
      ticketNumber,
      assignedTo: result.assigned_to || null,
      assigned: !!result.assigned_to,
      status: result.status
    })
  } catch (error) {
    console.error('Create ticket error:', error)
    
    // Provide more specific error message
    if (error.sqlMessage) {
      console.error('SQL Error:', error.sqlMessage);
      
      // Check for unknown column errors
      if (error.sqlMessage.includes('Unknown column')) {
        const match = error.sqlMessage.match(/Unknown column '([^']+)'/);
        const badColumn = match ? match[1] : 'unknown';
        return res.status(500).json({ 
          message: `Database column mismatch: '${badColumn}' does not exist in tickets table`,
          error: error.sqlMessage,
          suggestion: 'Please check your tickets table structure and update the column names in the code'
        });
      }
    }
    
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      sqlMessage: error.sqlMessage 
    })
  }
})

// Update ticket
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description, priority, status, assignedTo, affectedSystem } = req.body

    const ticket = await query('tickets', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    if (ticket.status === 'converted_to_incident') {
      return res.status(400).json({
        message: 'This ticket was converted to an incident and cannot be edited. View the linked incident for updates.'
      })
    }
    if (['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ message: 'Resolved or closed tickets cannot be edited.' })
    }

    if (req.user.role === 'user') {
      if (ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      if (description) {
        await query('tickets', 'update', {
          filters: [{ column: 'id', value: req.params.id }],
          data: { description, updated_at: new Date().toISOString() }
        })
      }
    } else {
      const updateData = {}
      if (title) updateData.title = title
      if (description) updateData.description = description
      if (priority) updateData.priority = priority
      if (status) {
        updateData.status = status
        if (status === 'resolved') updateData.resolved_at = new Date().toISOString()
        if (status === 'closed') updateData.closed_at = new Date().toISOString()
      }
      if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null
      if (affectedSystem) updateData.affected_system = affectedSystem
      updateData.updated_at = new Date().toISOString()

      if (status && priority) {
        const newSlaDue = await calculateSLADue(priority)
        if (newSlaDue) updateData.sla_due = newSlaDue
      }

      await query('tickets', 'update', {
        filters: [{ column: 'id', value: req.params.id }],
        data: updateData
      })

      if (assignedTo && assignedTo !== ticket.assigned_to) {
        await query('notifications', 'insert', {
          data: {
            user_id: assignedTo,
            type: 'TICKET_ASSIGNED',
            title: 'Ticket Assigned',
            message: `Ticket ${ticket.ticket_number} has been assigned to you`,
            resource_type: 'ticket',
            resource_id: req.params.id
          }
        })
      }
    }

    // FIXED: Stringify details
    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_TICKET',
        user_id: req.user.id,
        resource_type: 'ticket',
        resource_id: req.params.id,
        details: JSON.stringify(req.body)
      }
    })

    if (ticket.created_by && ticket.created_by !== req.user.id) {
      await query('notifications', 'insert', {
        data: {
          user_id: ticket.created_by,
          type: 'TICKET_UPDATED',
          title: 'Ticket updated',
          message: `Ticket ${ticket.ticket_number} was updated`,
          resource_type: 'ticket',
          resource_id: req.params.id
        }
      })
      
      // FIXED: Stringify details
      await query('audit_logs', 'insert', {
        data: {
          action: 'TICKET_UPDATED',
          user_id: ticket.created_by,
          resource_type: 'ticket',
          resource_id: req.params.id,
          details: JSON.stringify({ ticket_number: ticket.ticket_number })
        }
      })
    }

    res.json({ message: 'Ticket updated' })
  } catch (error) {
    console.error('Update ticket error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Add comment to ticket
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { comment, isInternal = false } = req.body

    const ticket = await query('tickets', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    if (req.user.role === 'user') {
      if (ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      if (isInternal) {
        return res.status(403).json({ message: 'Users cannot create internal comments' })
      }
    }

    const result = await query('ticket_comments', 'insert', {
      data: {
        ticket_id: req.params.id,
        user_id: req.user.id,
        comment,
        is_internal: isInternal
      }
    })

    const commenterRow = await query('users', 'select', {
      select: 'fullname, role',
      filters: [{ column: 'id', value: req.user.id }],
      single: true
    })
    const commenterName = commenterRow?.fullname || 'User'
    const commenterRole = commenterRow?.role || 'staff'

    const getRoleTitle = (role) => {
      switch (role) {
        case 'admin': return 'Admin'
        case 'security_officer': return 'Security Officer'
        case 'it_support': return 'IT Support'
        case 'user': return 'User'
        default: return 'Staff'
      }
    }

    const roleTitle = getRoleTitle(commenterRole)

    if (!isInternal) {
      const incident = await query('incidents', 'select', {
        filters: [{ column: 'source_ticket_id', value: req.params.id }],
        single: true
      })
      if (incident) {
        const actionType = commenterRole === 'user' ? 'USER_COMMENT' : 'STAFF_COMMENT'
        await query('incident_timeline', 'insert', {
          data: {
            incident_id: incident.id,
            user_id: req.user.id,
            action: actionType,
            description: `[Ticket Comment] ${comment}`,
            is_internal: 0
          }
        })
      }

      const isStaff = ['it_support', 'security_officer', 'admin'].includes(commenterRole)
      const commenterDisplay = isStaff ? `${commenterName} (${roleTitle})` : commenterName

      if (ticket.created_by && ticket.created_by !== req.user.id) {
        await query('notifications', 'insert', {
          data: {
            user_id: ticket.created_by,
            type: 'TICKET_COMMENT',
            title: isStaff ? `${roleTitle} commented on your ticket` : 'New comment on your ticket',
            message: `${commenterDisplay} commented on ticket ${ticket.ticket_number}`,
            resource_type: 'ticket',
            resource_id: ticket.id
          }
        })
      }

      if (
        ticket.assigned_to &&
        ticket.assigned_to !== req.user.id &&
        commenterRole === 'user'
      ) {
        await query('notifications', 'insert', {
          data: {
            user_id: ticket.assigned_to,
            type: 'TICKET_COMMENT',
            title: 'User commented on assigned ticket',
            message: `${commenterName} commented on ticket ${ticket.ticket_number}`,
            resource_type: 'ticket',
            resource_id: ticket.id
          }
        })
      }
    } else {
      console.log('🔒 Internal note added - no notifications sent to users')
    }

    // FIXED: Stringify details
    await query('audit_logs', 'insert', {
      data: {
        action: isInternal ? 'ADD_INTERNAL_NOTE' : 'ADD_COMMENT',
        user_id: req.user.id,
        resource_type: 'ticket',
        resource_id: req.params.id,
        details: JSON.stringify({ is_internal: isInternal })
      }
    })

    res.status(201).json({ message: 'Comment added', commentId: result.id })
  } catch (error) {
    console.error('Add comment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Convert ticket to incident
router.post('/:id/convert', authenticate, authorize('it_support', 'security_officer', 'admin'), async (req, res) => {
  try {
    const { category, severity, description, assignedTo: requestedAssignedTo } = req.body

    const ticket = await query('tickets', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    const existingIncident = await query('incidents', 'select', {
      filters: [{ column: 'source_ticket_id', value: req.params.id }],
      single: true
    })

    if (existingIncident) {
      return res.status(400).json({
        message: 'Ticket has already been converted to an incident',
        incidentId: existingIncident.id,
        incidentNumber: existingIncident.incident_number
      })
    }

    const validAcronyms = await getValidAcronyms()
    const branchAcronym = ticket.branch_acronym && validAcronyms.has(ticket.branch_acronym)
      ? ticket.branch_acronym
      : 'SPI'

    const last = await query('incidents', 'select', {
      select: 'incident_number',
      filters: [{ column: 'branch_acronym', value: branchAcronym }],
      orderBy: { column: 'created_at', ascending: false },
      limit: 1,
      single: true
    })
    let nextSeq = 1
    if (last && last.incident_number) {
      const match = last.incident_number.match(/^INC-[A-Z0-9]+-(\d+)$/i)
      if (match) nextSeq = parseInt(match[1], 10) + 1
    }
    const incidentNumber = `INC-${branchAcronym}-${String(nextSeq).padStart(6, '0')}`
    console.log('🔢 Generated incident number:', incidentNumber)

    let assignedToId = null
    let assignedUserRole = null
    let assignedUserName = null

    if (requestedAssignedTo) {
      const assignedUser = await query('users', 'select', {
        select: 'id, fullname, role, status',
        filters: [{ column: 'id', value: requestedAssignedTo }],
        single: true
      })
      if (assignedUser && assignedUser.status === 'active') {
        assignedToId = assignedUser.id
        assignedUserRole = assignedUser.role
        assignedUserName = assignedUser.fullname
      }
    }

    if (!assignedToId) {
      const secOfficer = await query('users', 'select', {
        select: 'id, fullname, role',
        filters: [
          { column: 'role', value: 'security_officer' },
          { column: 'status', value: 'active' }
        ],
        orderBy: { column: 'created_at', ascending: true },
        limit: 1,
        single: true
      })
      if (secOfficer) {
        assignedToId = secOfficer.id
        assignedUserRole = secOfficer.role
        assignedUserName = secOfficer.fullname
      }
    }

    console.log('🔍 Incident assignment check:', {
      assignedToId,
      assignedUserRole,
      assignedUserName,
      ticketNumber: ticket.ticket_number
    })

    const affectedAsset = ticket.affected_system != null && String(ticket.affected_system).trim() !== ''
      ? String(ticket.affected_system).trim()
      : null
    const ticketCreatorId = ticket.created_by || null

    const incidentData = {
      incident_number: incidentNumber,
      branch_acronym: branchAcronym,
      source_ticket_id: ticket.id,
      detection_method: 'it_found',
      category: category || 'other',
      title: ticket.title,
      description: description || ticket.description,
      severity: severity || 'medium',
      status: 'new',
      assigned_to: assignedToId,
      created_by: req.user.id,
      affected_asset: affectedAsset,
      affected_user_id: ticketCreatorId
    }

    console.log('💾 Inserting incident:', {
      ...incidentData,
      assigned_to: assignedToId || 'NULL',
      affected_asset: affectedAsset,
      affected_user_id: ticketCreatorId
    })

    const result = await query('incidents', 'insert', { data: incidentData })

    console.log('✅ Incident created:', {
      id: result.id,
      incidentNumber: result.incident_number,
      assigned_to: result.assigned_to || 'NULL',
      status: result.status
    })

    if (assignedToId && result.assigned_to !== assignedToId) {
      await query('incidents', 'update', {
        data: { assigned_to: assignedToId },
        filters: [{ column: 'id', value: result.id }]
      })
      result.assigned_to = assignedToId
    }

    if (assignedToId) {
      const roleTitle = assignedUserRole === 'admin' ? 'Admin' : 'Security Officer'
      await query('notifications', 'insert', {
        data: {
          user_id: assignedToId,
          type: 'INCIDENT_ASSIGNED',
          title: 'New Incident Assigned',
          message: `Incident ${incidentNumber} converted from ticket ${ticket.ticket_number} has been assigned to you`,
          resource_type: 'incident',
          resource_id: result.id
        }
      })
      console.log(`✅ Notification sent to assigned ${roleTitle}:`, assignedToId)
    }

    const ticketComments = await query('ticket_comments', 'select', {
      filters: [{ column: 'ticket_id', value: req.params.id }]
    })
    if (ticketComments && ticketComments.length > 0) {
      for (const comment of ticketComments) {
        const commentUser = await query('users', 'select', {
          select: 'fullname, role',
          filters: [{ column: 'id', value: comment.user_id }],
          single: true
        })
        await query('incident_timeline', 'insert', {
          data: {
            incident_id: result.id,
            user_id: comment.user_id,
            action: commentUser?.role === 'user' ? 'USER_COMMENT' : 'STAFF_COMMENT',
            description: `[From Ticket] ${comment.comment}`,
            is_internal: 0
          }
        })
      }
      console.log(`📋 Copied ${ticketComments.length} ticket comments to incident timeline`)
    }

    await query('tickets', 'update', {
      data: { status: 'converted_to_incident', updated_at: new Date().toISOString() },
      filters: [{ column: 'id', value: ticket.id }]
    })
    console.log('✅ Ticket kept with status converted_to_incident:', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number
    })

    if (ticket.created_by) {
      await query('notifications', 'insert', {
        data: {
          user_id: ticket.created_by,
          type: 'TICKET_CONVERTED_TO_INCIDENT',
          title: 'Ticket converted to incident',
          message: `Your ticket ${ticket.ticket_number} was converted to incident ${incidentNumber}.`,
          resource_type: 'incident',
          resource_id: result.id
        }
      })
      
      // FIXED: Stringify details
      await query('audit_logs', 'insert', {
        data: {
          action: 'TICKET_CONVERTED_TO_INCIDENT',
          user_id: ticket.created_by,
          resource_type: 'ticket',
          resource_id: ticket.id,
          details: JSON.stringify({
            ticket_number: ticket.ticket_number,
            incident_number: incidentNumber,
            incident_id: result.id
          })
        }
      })
    }

    await query('incident_timeline', 'insert', {
      data: {
        incident_id: result.id,
        user_id: req.user.id,
        action: 'CREATED_FROM_TICKET',
        description: `Incident created from ticket ${ticket.ticket_number}`,
        is_internal: 0
      }
    })

    if (assignedToId && assignedUserName) {
      const roleDisplay = assignedUserRole === 'admin' ? 'Admin' : 'Security Officer'
      await query('incident_timeline', 'insert', {
        data: {
          incident_id: result.id,
          user_id: req.user.id,
          action: 'INCIDENT_ASSIGNED',
          description: `Incident assigned to ${roleDisplay}: ${assignedUserName}`,
          is_internal: 0
        }
      })
    }

    // FIXED: Stringify details
    await query('audit_logs', 'insert', {
      data: {
        action: 'CONVERT_TICKET',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: result.id,
        details: JSON.stringify({ source_ticket_id: ticket.id })
      }
    })

    res.json({ message: 'Ticket converted to incident', incidentId: result.id, incidentNumber })
  } catch (error) {
    console.error('Convert ticket error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete ticket
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await query('tickets', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    if (['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ message: 'Cannot delete resolved or closed tickets' })
    }

    const existingIncident = await query('incidents', 'select', {
      filters: [{ column: 'source_ticket_id', value: req.params.id }],
      single: true
    })

    if (existingIncident) {
      return res.status(400).json({ message: 'Cannot delete tickets that have been converted to incidents' })
    }

    if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const attachments = await query('attachments', 'select', {
      filters: [
        { column: 'record_type', value: 'ticket' },
        { column: 'record_id', value: req.params.id }
      ]
    })

    const fs = require('fs')
    const path = require('path')
    for (const att of attachments) {
      const filePath = path.join(__dirname, '../', att.file_path)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
        } catch (err) {
          console.error('Error deleting attachment file:', err)
        }
      }
    }

    if (attachments.length > 0) {
      await query('attachments', 'delete', {
        filters: [
          { column: 'record_type', value: 'ticket' },
          { column: 'record_id', value: req.params.id }
        ]
      })
    }

    await query('ticket_comments', 'delete', {
      filters: [{ column: 'ticket_id', value: req.params.id }]
    })

    await query('tickets', 'delete', {
      filters: [{ column: 'id', value: req.params.id }]
    })

    // FIXED: Stringify details
    await query('audit_logs', 'insert', {
      data: {
        action: 'DELETE_TICKET',
        user_id: req.user.id,
        resource_type: 'ticket',
        resource_id: req.params.id,
        details: JSON.stringify({ ticket_number: ticket.ticket_number })
      }
    })

    res.json({ message: 'Ticket deleted successfully' })
  } catch (error) {
    console.error('Delete ticket error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get comments for a ticket
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const ticket = await query('tickets', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    const sql = `
      SELECT
        c.*,
        u.fullname AS user_fullname,
        u.username AS user_username
      FROM ticket_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `
    let comments = await runQuery(sql, [req.params.id])
    comments = comments || []

    if (req.user.role === 'user') {
      comments = comments.filter(c => !c.is_internal)
    }

    const formatted = comments.map(c => ({
      id: c.id,
      comment: c.comment,
      isInternal: c.is_internal,
      createdAt: c.created_at,
      userId: c.user_id,
      userName: c.user_fullname || 'Unknown User',
      userUsername: c.user_username
    }))

    res.json(formatted)
  } catch (error) {
    console.error('Get comments error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Ticket status (lightweight polling)
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const ticket = await query('tickets', 'select', {
      select: 'status',
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    res.json({ status: ticket.status })
  } catch (error) {
    console.error('Get status error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router