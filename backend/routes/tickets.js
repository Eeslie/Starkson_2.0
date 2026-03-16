const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { getValidAcronyms } = require('../lib/branches')

// Helper function to find IT Support user for ticket assignment
const findITSupportUser = async () => {
  try {
    const { data: itSupportUsers, error: itError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'it_support')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
    
    if (itError) {
      console.error('Error finding IT Support user:', itError)
      return null
    }
    
    return itSupportUsers && itSupportUsers.length > 0 ? itSupportUsers[0].id : null
  } catch (error) {
    console.error('Error in findITSupportUser:', error)
    return null
  }
}

// Helper function to find Security Officer for incident assignment
const findSecurityOfficer = async () => {
  try {
    const { data: securityOfficers, error: secError } = await supabase
      .from('users')
      .select('id, fullname, username')
      .eq('role', 'security_officer')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
    
    if (secError) {
      console.error('Error finding Security Officer:', secError)
      return null
    }
    
    if (securityOfficers && securityOfficers.length > 0) {
      console.log('✅ Found Security Officer for assignment:', {
        id: securityOfficers[0].id,
        fullname: securityOfficers[0].fullname,
        username: securityOfficers[0].username
      })
      return securityOfficers[0].id
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
  const { data: lastTickets, error } = await supabase
    .from('tickets')
    .select('ticket_number')
    .eq('branch_acronym', branchAcronym)
    .order('created_at', { ascending: false })
    .limit(1)
  let nextSeq = 1
  if (!error && lastTickets && lastTickets.length > 0) {
    const match = (lastTickets[0].ticket_number || '').match(/^[A-Z0-9]+-(\d+)$/i)
    if (match) nextSeq = parseInt(match[1], 10) + 1
  }
  return `${branchAcronym}-${String(nextSeq).padStart(6, '0')}`
}

// Calculate SLA due date
const calculateSLADue = async (priority) => {
  const sla = await query('sla_config', 'select', {
    filters: [
      { column: 'priority', value: priority },
      { column: 'is_active', value: true }
    ],
    single: true
  })
  if (!sla) return null
  
  const dueDate = new Date()
  dueDate.setHours(dueDate.getHours() + sla.resolution_time_hours)
  return dueDate.toISOString()
}

// Get ticket by formatted ticket number (e.g., D01-000004)
router.get('/number/:ticketNumber', authenticate, async (req, res) => {
  console.log('========== TICKET NUMBER ROUTE HIT ==========');
  console.log('Params:', req.params);
  console.log('Ticket number:', req.params.ticketNumber);
  console.log('User:', req.user);
  
  try {
    const { ticketNumber } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    console.log(`Fetching ticket by number: ${ticketNumber} for user: ${userId}, role: ${userRole}`)

    // Get direct Supabase client
    const { supabase } = require('../config/database')
    
    // First, let's check if the ticket exists at all
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .maybeSingle() // Use maybeSingle instead of single to avoid errors
    
    console.log('Query result:', { ticket, error: ticketError });
    
    if (ticketError) {
      console.error('Database error:', ticketError)
      return res.status(500).json({ message: 'Database error', error: ticketError })
    }
    
    if (!ticket) {
      console.log(`Ticket not found with number: ${ticketNumber}`)
      return res.status(404).json({ message: 'Ticket not found' })
    }
    
    console.log('Found ticket:', ticket);
    
    // Check if user has access to this ticket
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      if (ticket.created_by !== userId) {
        console.log(`Access denied: user ${userId} tried to access ticket ${ticketNumber} created by ${ticket.created_by}`)
        return res.status(403).json({ message: 'Access denied' })
      }
    }
    
    res.json(ticket)
  } catch (error) {
    console.error('Get ticket by number error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get all tickets
router.get('/', authenticate, async (req, res) => {
  try {
    let selectQuery = `
      *,
      created_by_user:users!tickets_created_by_fkey(id, fullname, username),
      assigned_to_user:users!tickets_assigned_to_fkey(id, fullname)
    `

    // Fetch current user's branch_acronyms for filtering (user/it_support/security_officer see by branch)
    let userBranchAcronyms = []
    if (!['admin'].includes(req.user.role)) {
      const { data: userRow } = await supabase
        .from('users')
        .select('branch_acronyms')
        .eq('id', req.user.id)
        .single()
      userBranchAcronyms = Array.isArray(userRow?.branch_acronyms) ? userRow.branch_acronyms : []
    }

    // Use Supabase directly for better foreign key relationship handling
    let ticketsQuery = supabase
      .from('tickets')
      .select(selectQuery)
      .order('created_at', { ascending: false })

    const hasAllBranches = userBranchAcronyms.includes('ALL')
    // PostgREST .in() requires double-quoted string values: branch_acronym.in.("D01","D02")
    const branchFilter = userBranchAcronyms.length > 0
      ? `branch_acronym.in.("${userBranchAcronyms.join('","')}"),branch_acronym.is.null`
      : null
    const { status, priority, branch_acronym: queryBranch } = req.query
    if (status) ticketsQuery = ticketsQuery.eq('status', status)
    if (priority) ticketsQuery = ticketsQuery.eq('priority', priority)
    if (queryBranch) ticketsQuery = ticketsQuery.eq('branch_acronym', queryBranch)
    if (req.user.role === 'user') {
      ticketsQuery = ticketsQuery.eq('created_by', req.user.id)
      if (!hasAllBranches && branchFilter) {
        ticketsQuery = ticketsQuery.or(branchFilter)
      }
    } else if (req.user.role === 'it_support') {
      // IT Support sees all tickets (in their branch(s)) so past tickets show in the list
      if (!hasAllBranches && branchFilter) {
        ticketsQuery = ticketsQuery.or(branchFilter)
      }
    } else if (req.user.role === 'security_officer' && !hasAllBranches && branchFilter) {
      ticketsQuery = ticketsQuery.or(branchFilter)
    }
    // Admin or user with ALL branches: no branch filter

    let { data: tickets, error: ticketsError } = await ticketsQuery

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError)
      throw ticketsError
    }
    tickets = tickets || []

    // IT Support: also include tickets they converted (incident created_by = them), so the ticket always shows in their list
    if (req.user.role === 'it_support') {
      const { data: myIncidents } = await supabase
        .from('incidents')
        .select('source_ticket_id')
        .eq('created_by', req.user.id)
        .not('source_ticket_id', 'is', null)
      const convertedTicketIds = (myIncidents || []).map((i) => i.source_ticket_id).filter(Boolean)
      const existingIds = new Set((tickets || []).map((t) => t.id))
      const missingIds = convertedTicketIds.filter((id) => !existingIds.has(id))
      if (missingIds.length > 0) {
        const { data: extraTickets, error: extraErr } = await supabase
          .from('tickets')
          .select(selectQuery)
          .in('id', missingIds)
          .order('created_at', { ascending: false })
        if (!extraErr && extraTickets && extraTickets.length > 0) {
          tickets = [...tickets, ...extraTickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        }
      }
    }

    if (tickets.length === 0) {
      return res.json([])
    }
    
    console.log('📋 Fetched tickets:', tickets.length, 'tickets')
    // Log first ticket to see structure
    if (tickets.length > 0) {
      console.log('🔍 Sample ticket:', {
        id: tickets[0].id,
        ticket_number: tickets[0].ticket_number,
        assigned_to: tickets[0].assigned_to,
        assigned_to_user: tickets[0].assigned_to_user
      })
    }

    // Get comment and attachment counts and fetch assigned user names if not included
    const ticketsWithCounts = await Promise.all(tickets.map(async (ticket) => {
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
      
      // If assigned_to_user is not populated, fetch it manually
      let assignedToName = ticket.assigned_to_user?.fullname || null
      if (ticket.assigned_to && !assignedToName) {
        const { data: assignedUser } = await supabase
          .from('users')
          .select('fullname')
          .eq('id', ticket.assigned_to)
          .single()
        assignedToName = assignedUser?.fullname || null
        console.log(`🔍 Manually fetched assigned user for ${ticket.ticket_number}:`, assignedToName)
      }
      
      // If created_by_user is not populated, fetch it manually
      let createdByName = ticket.created_by_user?.fullname || 'Unknown'
      if (ticket.created_by && !ticket.created_by_user?.fullname) {
        const { data: createdByUser } = await supabase
          .from('users')
          .select('fullname')
          .eq('id', ticket.created_by)
          .single()
        createdByName = createdByUser?.fullname || 'Unknown'
      }

      // If ticket was converted to incident, include link to incident
      let convertedIncidentId = null
      let convertedIncidentNumber = null
      if (ticket.status === 'converted_to_incident') {
        const { data: inc } = await supabase
          .from('incidents')
          .select('id, incident_number')
          .eq('source_ticket_id', ticket.id)
          .single()
        if (inc) {
          convertedIncidentId = inc.id
          convertedIncidentNumber = inc.incident_number
        }
      }
      
      return {
        ...ticket,
        // Snake case (from DB)
        request_type: ticket.request_type,
        affected_system: ticket.affected_system,
        created_at: ticket.created_at,
        sla_due: ticket.sla_due,
        ticket_number: ticket.ticket_number,
        assigned_to: ticket.assigned_to,
        // Camel case (for frontend compatibility)
        requestType: ticket.request_type,
        affectedSystem: ticket.affected_system,
        createdAt: ticket.created_at,
        slaDue: ticket.sla_due,
        ticketNumber: ticket.ticket_number,
        assignedTo: ticket.assigned_to,
        // Counts and names
        commentCount: commentCount.count || 0,
        attachmentCount: attachmentCount.count || 0,
        createdByName: createdByName,
        assignedToName: assignedToName,
        convertedIncidentId,
        convertedIncidentNumber
      }
    }))

    res.json(ticketsWithCounts)
  } catch (error) {
    console.error('Get tickets error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single ticket with details
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Use Supabase directly to ensure proper foreign key relationships
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        created_by_user:users!tickets_created_by_fkey(id, fullname, username),
        assigned_to_user:users!tickets_assigned_to_fkey(id, fullname, username)
      `)
      .eq('id', req.params.id)
      .single()

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError)
      return res.status(404).json({ message: 'Ticket not found' })
    }
    
    // Fallback: If assigned_to_user is not populated, fetch it manually
    let assignedToName = ticket.assigned_to_user?.fullname || null
    if (ticket.assigned_to && !assignedToName) {
      const { data: assignedUser } = await supabase
        .from('users')
        .select('fullname')
        .eq('id', ticket.assigned_to)
        .single()
      assignedToName = assignedUser?.fullname || null
      console.log(`🔍 Manually fetched assigned user for ticket ${ticket.ticket_number}:`, assignedToName)
    }

    // RBAC: Users can only access their own tickets and only for their assigned branches (or ALL)
    if (req.user.role === 'user') {
      if (ticket.created_by !== req.user.id) return res.status(403).json({ message: 'Forbidden' })
      const { data: userRow } = await supabase.from('users').select('branch_acronyms').eq('id', req.user.id).single()
      const userBranches = Array.isArray(userRow?.branch_acronyms) ? userRow.branch_acronyms : []
      const hasAllBranches = userBranches.includes('ALL')
      if (!hasAllBranches && userBranches.length > 0 && ticket.branch_acronym && !userBranches.includes(ticket.branch_acronym)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    // Check if ticket has already been converted to an incident (must be done first)
    // Note: If ticket was deleted after conversion, source_ticket_id might be NULL
    // So we need to check by ticket number in the incident timeline or description
    let existingIncident = null
    let incidentError = null
    
    // Approach 1: Direct UUID match (works if ticket still exists)
    let { data: incidentByUuid, error: uuidError } = await supabase
      .from('incidents')
      .select('id, incident_number, source_ticket_id')
      .eq('source_ticket_id', req.params.id)
      .maybeSingle()
    
    if (incidentByUuid) {
      existingIncident = incidentByUuid
      console.log('✅ Found incident by source_ticket_id:', existingIncident.incident_number)
    } else if (uuidError) {
      incidentError = uuidError
    }
    
    // Approach 2: If not found and ticket exists, try to find by ticket number
    // Look for incidents where the timeline mentions this ticket number
    if (!existingIncident && ticket.ticket_number) {
      console.log('🔍 Searching for incident by ticket number:', ticket.ticket_number)
      
      // Search incident timeline for entries mentioning this ticket number
      const { data: timelineEntries, error: timelineSearchError } = await supabase
        .from('incident_timeline')
        .select('incident_id')
        .ilike('description', `%${ticket.ticket_number}%`)
        .limit(1)
      
      if (!timelineSearchError && timelineEntries && timelineEntries.length > 0) {
        const incidentId = timelineEntries[0].incident_id
        const { data: foundIncident, error: fetchError } = await supabase
          .from('incidents')
          .select('id, incident_number, source_ticket_id')
          .eq('id', incidentId)
          .maybeSingle()
        
        if (foundIncident && !fetchError) {
          existingIncident = foundIncident
          console.log('✅ Found incident via timeline search:', existingIncident.incident_number)
        }
      }
    }
    
    if (incidentError) {
      console.error('Error checking for existing incident:', incidentError)
    }
    
    console.log('📋 Ticket lookup:', {
      ticketId: req.params.id,
      ticketNumber: ticket.ticket_number,
      foundIncident: existingIncident ? existingIncident.incident_number : 'NO'
    })
    
    // Get comments (users see non-internal, staff see all)
    // Get comments with user information
    const { data: commentsData, error: commentsError } = await supabase
      .from('ticket_comments')
      .select(`
        *,
        user:users(id, fullname, username)
      `)
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true })
    
    if (commentsError) {
      console.error('Error fetching comments:', commentsError)
    }
    
    let filteredComments = commentsData || []
    
    // Filter internal comments for regular users
    if (req.user.role === 'user') {
      filteredComments = filteredComments.filter(c => !c.is_internal)
    }
    
    // Check if ticket has been converted to incident - fetch incident timeline for all users
    // This shows Security Officer comments and investigation updates
    let incidentTimeline = []
    if (existingIncident) {
      console.log('📊 Fetching incident timeline for incident:', existingIncident.id, 'User role:', req.user.role)
      
      // Fetch incident timeline entries - users see non-internal, staff see all
      let incidentTimelineQuery = supabase
        .from('incident_timeline')
        .select(`
          *,
          user:users(id, fullname, username)
        `)
        .eq('incident_id', existingIncident.id)
        .order('created_at', { ascending: true })
      // NOTE:
      // We previously filtered out internal entries for end users (is_internal = false),
      // but the product requirement is that Security Officer investigation updates
      // should be visible to the end user on the ticket page. Many existing timeline
      // entries were created as internal, so filtering hides everything.
      //
      // To keep behaviour intuitive, we now return ALL timeline entries here
      // regardless of is_internal. Security Officers can still use the incident
      // page for any staff-only context if needed.
      
      const { data: incidentTimelineData, error: incidentTimelineError } = await incidentTimelineQuery
      
      if (incidentTimelineError) {
        console.error('❌ Error fetching incident timeline:', incidentTimelineError)
      } else {
        incidentTimeline = incidentTimelineData || []
        console.log(`✅ Fetched ${incidentTimeline.length} incident timeline entries (filtered for role: ${req.user.role})`)
        if (incidentTimeline.length > 0) {
          console.log('📝 Sample timeline entry:', {
            action: incidentTimeline[0].action,
            description: incidentTimeline[0].description?.substring(0, 50),
            is_internal: incidentTimeline[0].is_internal,
            userName: incidentTimeline[0].user?.fullname
          })
        }
      }
    } else {
      console.log('⚠️ No incident found for ticket, skipping timeline fetch')
    }

    // Get attachments
    const attachments = await query('attachments', 'select', {
      filters: [
        { column: 'record_type', value: 'ticket' },
        { column: 'record_id', value: req.params.id }
      ]
    })

    // Format response with both snake_case and camelCase for compatibility
    res.json({
      ...ticket,
      // Snake case (from DB)
      request_type: ticket.request_type,
      affected_system: ticket.affected_system,
      created_at: ticket.created_at,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      sla_due: ticket.sla_due,
      // Camel case (for frontend)
      requestType: ticket.request_type,
      affectedSystem: ticket.affected_system,
      createdAt: ticket.created_at,
      createdBy: ticket.created_by,
      assignedTo: ticket.assigned_to,
      slaDue: ticket.sla_due,
      // User names
      createdByName: ticket.created_by_user?.fullname || 'Unknown',
      createdByUsername: ticket.created_by_user?.username,
      assignedToName: assignedToName || ticket.assigned_to_user?.fullname || null,
      assignedToUsername: ticket.assigned_to_user?.username,
      // Backward-compat keys (username replaces old email)
      createdByEmail: ticket.created_by_user?.username,
      assignedToEmail: ticket.assigned_to_user?.username,
      // Conversion status
      isConverted: !!existingIncident,
      convertedIncidentId: existingIncident?.id || null,
      convertedIncidentNumber: existingIncident?.incident_number || null,
      // Comments with formatted dates
      comments: filteredComments.map(c => ({
        ...c,
        createdAt: c.created_at,
        isInternal: c.is_internal,
        userId: c.user_id,
        userName: c.user?.fullname || 'Unknown User',
        userUsername: c.user?.username
      })),
      // Incident timeline (for users when ticket is converted)
      incidentTimeline: incidentTimeline.map(t => ({
        ...t,
        createdAt: t.created_at,
        isInternal: t.is_internal,
        userId: t.user_id,
        userName: t.user?.fullname || 'Unknown User',
        userUsername: t.user?.username
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
        createdAt: a.created_at,
        // Also include snake_case for compatibility
        record_type: a.record_type,
        record_id: a.record_id,
        original_name: a.original_name,
        mime_type: a.mime_type,
        file_path: a.file_path,
        uploaded_by: a.uploaded_by,
        created_at: a.created_at
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
      const { data: userRow } = await supabase
        .from('users')
        .select('branch_acronyms')
        .eq('id', req.user.id)
        .single()
      const userBranches = Array.isArray(userRow?.branch_acronyms) ? userRow.branch_acronyms : []
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

    const ticketData = {
      ticket_number: ticketNumber,
      branch_acronym: branchAcronym,
      request_type: requestType,
      title,
      description,
      affected_system: affectedSystem || null,
      priority: priority || 'medium',
      category: category || null,
      created_by: req.user.id,
      assigned_to: assignedToId,
      status: assignedToId ? 'assigned' : 'new',
      sla_due: slaDue
    }

    console.log('💾 Inserting ticket:', { ...ticketData, assigned_to: assignedToId || 'NULL' })

    // Use Supabase directly to ensure assignment is saved correctly
    const { data: insertedTicket, error: insertError } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ Error inserting ticket:', insertError)
      throw insertError
    }
    
    const result = insertedTicket
    
    console.log('✅ Ticket created:', { 
      id: result.id, 
      ticketNumber: result.ticket_number,
      assigned_to: result.assigned_to || 'NULL',
      status: result.status 
    })
    
    // Verify assignment was actually saved
    if (assignedToId && result.assigned_to !== assignedToId) {
      console.error('⚠️ Assignment mismatch! Expected:', assignedToId, 'Got:', result.assigned_to)
      // Try to fix it
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ assigned_to: assignedToId, status: 'assigned' })
        .eq('id', result.id)
      
      if (updateError) {
        console.error('❌ Failed to fix assignment:', updateError)
      } else {
        console.log('✅ Assignment fixed!')
        result.assigned_to = assignedToId
        result.status = 'assigned'
      }
    }

    // Log audit (created tickets must appear in audit logs). Do NOT set created_at — DB sets it via DEFAULT NOW() + trigger (real-time).
    const auditPayload = {
      action: 'CREATE_TICKET',
      user_id: req.user.id,
      resource_type: 'ticket',
      resource_id: result.id,
      details: {
        ticket_number: ticketNumber,
        title,
        request_type: requestType,
        priority,
        branch_acronym: branchAcronym,
        assigned_to: assignedToId
      }
    }
    try {
      await query('audit_logs', 'insert', { data: auditPayload })
    } catch (auditErr) {
      console.error('Audit log CREATE_TICKET failed:', auditErr?.message || auditErr)
      try {
        const { error: directErr } = await supabase.from('audit_logs').insert(auditPayload)
        if (directErr) console.error('Audit fallback insert failed:', directErr.message)
      } catch (e2) {
        console.error('Audit fallback also failed:', e2?.message || e2)
      }
    }

    // Create notification for assigned IT support staff
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
      
      // Assignment info is already shown in the ticket's assigned_to field
      // No need for separate timeline entry since we're using incident_timeline only
    }

    // Notify all IT Staff and Admin (notifications only — audit log has one entry: CREATE_TICKET above)
    const { data: itAndAdminUsers, error: roleError } = await supabase
      .from('users')
      .select('id')
      .in('role', ['it_support', 'admin'])
      .eq('status', 'active')
    if (!roleError && itAndAdminUsers && itAndAdminUsers.length > 0) {
      const creatorId = req.user.id
      for (const u of itAndAdminUsers) {
        if (u.id === creatorId) continue
        // Notification only; do not write NEW_TICKET_CREATED to audit (one ticket = one audit entry)
        if (u.id !== assignedToId) {
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
      }
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
    res.status(500).json({ message: 'Server error' })
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
      return res.status(400).json({ message: 'This ticket was converted to an incident and cannot be edited. View the linked incident for updates.' })
    }
    if (['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ message: 'Resolved or closed tickets cannot be edited.' })
    }

    // RBAC: Users can only update their own tickets (limited fields)
    if (req.user.role === 'user') {
      if (ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      // Users can only update description
      if (description) {
        await query('tickets', 'update', {
          filters: [{ column: 'id', value: req.params.id }],
          data: { description, updated_at: new Date().toISOString() }
        })
      }
    } else {
      // IT Support, Security Officer, Admin can update all fields
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

      // Create notification if assigned
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
        
        // Assignment info is already shown in the ticket's assigned_to field
        // No need for separate timeline entry since we're using incident_timeline only
      }
    }

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_TICKET',
        user_id: req.user.id,
        resource_type: 'ticket',
        resource_id: req.params.id,
        details: req.body
      }
    })

    // Notify ticket creator when someone else updates the ticket (so it appears in their notifications/recent activity)
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
      await query('audit_logs', 'insert', {
        data: {
          action: 'TICKET_UPDATED',
          user_id: ticket.created_by,
          resource_type: 'ticket',
          resource_id: req.params.id,
          details: { ticket_number: ticket.ticket_number }
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

    // RBAC: Users can only add non-internal comments to their own tickets
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

    // Get the commenter's role and name for proper display in notifications
    const { data: commenterData } = await supabase
      .from('users')
      .select('fullname, role')
      .eq('id', req.user.id)
      .single()

    const commenterName = commenterData?.fullname || 'User'
    const commenterRole = commenterData?.role || 'staff'

    // Format the role for display
    const getRoleTitle = (role) => {
      switch (role) {
        case 'admin':
          return 'Admin'
        case 'security_officer':
          return 'Security Officer'
        case 'it_support':
          return 'IT Support'
        case 'user':
          return 'User'
        default:
          return 'Staff'
      }
    }

    const roleTitle = getRoleTitle(commenterRole)

    // If this ticket is already converted to an incident, mirror PUBLIC comments into incident timeline
    // so Security Officers can see user comments inside the incident.
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
            is_internal: false
          }
        })
      }
    }

    // Log audit with different action for internal notes
    await query('audit_logs', 'insert', {
      data: {
        action: isInternal ? 'ADD_INTERNAL_NOTE' : 'ADD_COMMENT',
        user_id: req.user.id,
        resource_type: 'ticket',
        resource_id: req.params.id,
        details: { is_internal: isInternal }
      }
    })

    // ONLY SEND NOTIFICATIONS FOR PUBLIC COMMENTS (isInternal = false)
    if (!isInternal) {
      const isStaff = ['it_support', 'security_officer', 'admin'].includes(commenterRole)
      
      // Determine the commenter display name with role
      const commenterDisplay = isStaff ? `${commenterName} (${roleTitle})` : commenterName
      
      // Notify ticket creator if commenter is not the creator
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
      
      // Notify assigned staff if commenter is a user
      if (ticket.assigned_to && 
          ticket.assigned_to !== req.user.id && 
          commenterRole === 'user') {
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
      console.log('🔒 Internal note added - no notifications sent to users');
    }

    res.status(201).json({ message: 'Comment added', commentId: result.id })
  } catch (error) {
    console.error('Add comment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})
// Convert ticket to incident
// Convert ticket to incident
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

    // Check if ticket has already been converted
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
    const { data: lastIncidents, error: countErr } = await supabase
      .from('incidents')
      .select('incident_number')
      .eq('branch_acronym', branchAcronym)
      .order('created_at', { ascending: false })
      .limit(1)
    let nextSeq = 1
    if (!countErr && lastIncidents && lastIncidents.length > 0) {
      const match = (lastIncidents[0].incident_number || '').match(/^INC-[A-Z0-9]+-(\d+)$/i)
      if (match) nextSeq = parseInt(match[1], 10) + 1
    }
    const incidentNumber = `INC-${branchAcronym}-${String(nextSeq).padStart(6, '0')}`
    console.log('🔢 Generated incident number:', incidentNumber)

    // Assign incident to the selected user (could be admin or security officer)
    let assignedToId = null
    let assignedUserRole = null
    let assignedUserName = null
    
    if (requestedAssignedTo) {
      // Get the user details including role
      const { data: assignedUser, error: userError } = await supabase
        .from('users')
        .select('id, fullname, role')
        .eq('id', requestedAssignedTo)
        .eq('status', 'active')
        .single()
      
      if (userError) {
        console.error('Error fetching assigned user:', userError)
      } else if (assignedUser) {
        assignedToId = assignedUser.id
        assignedUserRole = assignedUser.role
        assignedUserName = assignedUser.fullname
        console.log('✅ Assigned to user:', { id: assignedToId, role: assignedUserRole, name: assignedUserName })
      }
    }
    
    // If no user was selected or user not found, fallback to finding a security officer
    if (!assignedToId) {
      assignedToId = await findSecurityOfficer()
      if (assignedToId) {
        // Get the found security officer's details
        const { data: secOfficer } = await supabase
          .from('users')
          .select('fullname, role')
          .eq('id', assignedToId)
          .single()
        if (secOfficer) {
          assignedUserRole = secOfficer.role
          assignedUserName = secOfficer.fullname
        }
      }
    }
    
    console.log('🔍 Incident assignment check:', { 
      assignedToId, 
      assignedUserRole,
      assignedUserName,
      ticketNumber: ticket.ticket_number 
    })

    // From database: Affected Asset = ticket.affected_system; Affected User = link to ticket creator by id
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

    console.log('💾 Inserting incident:', { ...incidentData, assigned_to: assignedToId || 'NULL', affected_asset: affectedAsset, affected_user_id: ticketCreatorId })

    // Use Supabase directly to ensure assignment is saved correctly
    const { data: insertedIncident, error: insertError } = await supabase
      .from('incidents')
      .insert(incidentData)
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ Error inserting incident:', insertError)
      // Handle duplicate key error - retry with next number
      if (insertError.code === '23505' && insertError.details?.includes('incident_number')) {
        console.log('⚠️ Duplicate incident number detected, retrying with next number...')
        // Retry with incremented number
        const retryNumber = nextSeq + 1
        const retryIncidentNumber = `INC-${branchAcronym}-${String(retryNumber).padStart(6, '0')}`
        incidentData.incident_number = retryIncidentNumber
        
        const { data: retryIncident, error: retryError } = await supabase
          .from('incidents')
          .insert(incidentData)
          .select()
          .single()
        
        if (retryError) {
          console.error('❌ Retry also failed:', retryError)
          return res.status(500).json({ 
            message: 'Failed to create incident. Please try again.',
            error: retryError.message 
          })
        }
        
        const result = retryIncident
        console.log('✅ Incident created (retry):', { 
          id: result.id, 
          incidentNumber: result.incident_number,
          assigned_to: result.assigned_to || 'NULL',
          status: result.status 
        })
        
        const finalIncidentNumber = retryIncidentNumber
        
        // Create notification ONLY for the assigned user
        if (assignedToId) {
          // Get role title for notification
          const roleTitle = assignedUserRole === 'admin' ? 'Admin' : 'Security Officer'
          
          await query('notifications', 'insert', {
            data: {
              user_id: assignedToId,
              type: 'INCIDENT_ASSIGNED',
              title: 'New Incident Assigned',
              message: `Incident ${finalIncidentNumber} converted from ticket ${ticket.ticket_number} has been assigned to you`,
              resource_type: 'incident',
              resource_id: result.id
            }
          })
          
          console.log(`✅ Notification sent to assigned ${roleTitle}:`, assignedToId)
        }

        // Copy ticket comments to incident timeline
        const retryTicketComments = await query('ticket_comments', 'select', {
          filters: [{ column: 'ticket_id', value: req.params.id }]
        })
        if (retryTicketComments && retryTicketComments.length > 0) {
          for (const comment of retryTicketComments) {
            const { data: commentUser } = await supabase
              .from('users')
              .select('fullname, role')
              .eq('id', comment.user_id)
              .single()
            await query('incident_timeline', 'insert', {
              data: {
                incident_id: result.id,
                user_id: comment.user_id,
                action: commentUser?.role === 'user' ? 'USER_COMMENT' : 'STAFF_COMMENT',
                description: `[From Ticket] ${comment.comment}`,
                is_internal: false
              }
            })
          }
          console.log(`📋 Copied ${retryTicketComments.length} ticket comments to incident timeline (retry)`)
        }

        // Keep ticket: set status to converted_to_incident
        const { error: updateTicketErr } = await supabase
          .from('tickets')
          .update({ status: 'converted_to_incident', updated_at: new Date().toISOString() })
          .eq('id', ticket.id)
        if (updateTicketErr) {
          console.error('Ticket status update failed (retry path):', updateTicketErr)
          return res.status(500).json({
            message: 'Incident was created but ticket status could not be updated. Please run the database migration to add status "converted_to_incident".',
            incidentId: result.id,
            incidentNumber: finalIncidentNumber
          })
        }
        console.log('✅ Ticket kept with status converted_to_incident (retry):', { ticketId: ticket.id, ticketNumber: ticket.ticket_number })

        // Notify ticket creator
        if (ticket.created_by) {
          await query('notifications', 'insert', {
            data: {
              user_id: ticket.created_by,
              type: 'TICKET_CONVERTED_TO_INCIDENT',
              title: 'Ticket converted to incident',
              message: `Your ticket ${ticket.ticket_number} was converted to incident ${finalIncidentNumber}.`,
              resource_type: 'incident',
              resource_id: result.id
            }
          })
          await query('audit_logs', 'insert', {
            data: {
              action: 'TICKET_CONVERTED_TO_INCIDENT',
              user_id: ticket.created_by,
              resource_type: 'ticket',
              resource_id: ticket.id,
              details: { ticket_number: ticket.ticket_number, incident_number: finalIncidentNumber, incident_id: result.id }
            }
          })
        }

        // Add timeline entry for conversion
        await query('incident_timeline', 'insert', {
          data: {
            incident_id: result.id,
            user_id: req.user.id,
            action: 'CREATED_FROM_TICKET',
            description: `Incident created from ticket ${ticket.ticket_number}`,
            is_internal: false
          }
        })
        
        // Add timeline entry for assignment with correct role
        if (assignedToId && assignedUserName) {
          const roleDisplay = assignedUserRole === 'admin' ? 'Admin' : 'Security Officer'
          
          await query('incident_timeline', 'insert', {
            data: {
              incident_id: result.id,
              user_id: req.user.id,
              action: 'INCIDENT_ASSIGNED',
              description: `Incident assigned to ${roleDisplay}: ${assignedUserName}`,
              is_internal: false
            }
          })
        }

        // Log audit
        await query('audit_logs', 'insert', {
          data: {
            action: 'CONVERT_TICKET',
            user_id: req.user.id,
            resource_type: 'incident',
            resource_id: result.id,
            details: { source_ticket_id: ticket.id }
          }
        })

        return res.json({ message: 'Ticket converted to incident', incidentId: result.id, incidentNumber: finalIncidentNumber })
      }
      throw insertError
    }
    
    const result = insertedIncident
    
    console.log('✅ Incident created:', { 
      id: result.id, 
      incidentNumber: result.incident_number,
      assigned_to: result.assigned_to || 'NULL',
      status: result.status 
    })
    
    // Verify assignment was actually saved
    if (assignedToId && result.assigned_to !== assignedToId) {
      console.error('⚠️ Assignment mismatch! Expected:', assignedToId, 'Got:', result.assigned_to)
      // Try to fix it
      const { error: updateError } = await supabase
        .from('incidents')
        .update({ assigned_to: assignedToId })
        .eq('id', result.id)
      
      if (updateError) {
        console.error('❌ Failed to fix incident assignment:', updateError)
      } else {
        console.log('✅ Incident assignment fixed!')
        result.assigned_to = assignedToId
      }
    }

    // Create notification ONLY for the assigned user (whether admin or security officer)
    if (assignedToId) {
      // Get role title for notification
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
      
      // DO NOT notify other admins or security officers - only the assigned user gets notified
      // This prevents security officers from getting notifications when an admin is assigned
    }

    // Copy ticket comments to incident timeline
    const ticketComments = await query('ticket_comments', 'select', {
      filters: [{ column: 'ticket_id', value: req.params.id }]
    })
    if (ticketComments && ticketComments.length > 0) {
      for (const comment of ticketComments) {
        const { data: commentUser } = await supabase
          .from('users')
          .select('fullname, role')
          .eq('id', comment.user_id)
          .single()
        await query('incident_timeline', 'insert', {
          data: {
            incident_id: result.id,
            user_id: comment.user_id,
            action: commentUser?.role === 'user' ? 'USER_COMMENT' : 'STAFF_COMMENT',
            description: `[From Ticket] ${comment.comment}`,
            is_internal: false
          }
        })
      }
      console.log(`📋 Copied ${ticketComments.length} ticket comments to incident timeline`)
    }

    // Keep ticket: set status to converted_to_incident
    const { error: updateTicketError } = await supabase
      .from('tickets')
      .update({ status: 'converted_to_incident', updated_at: new Date().toISOString() })
      .eq('id', ticket.id)
    if (updateTicketError) {
      console.error('Ticket status update failed:', updateTicketError)
      return res.status(500).json({
        message: 'Incident was created but ticket status could not be updated. Please run the database migration to add status "converted_to_incident".',
        incidentId: result.id,
        incidentNumber
      })
    }
    console.log('✅ Ticket kept with status converted_to_incident:', { ticketId: ticket.id, ticketNumber: ticket.ticket_number })

    // Notify ticket creator
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
      await query('audit_logs', 'insert', {
        data: {
          action: 'TICKET_CONVERTED_TO_INCIDENT',
          user_id: ticket.created_by,
          resource_type: 'ticket',
          resource_id: ticket.id,
          details: { ticket_number: ticket.ticket_number, incident_number: incidentNumber, incident_id: result.id }
        }
      })
    }

    // Add timeline entry for conversion
    await query('incident_timeline', 'insert', {
      data: {
        incident_id: result.id,
        user_id: req.user.id,
        action: 'CREATED_FROM_TICKET',
        description: `Incident created from ticket ${ticket.ticket_number}`,
        is_internal: false
      }
    })
    
    // Add timeline entry for assignment with correct role
    if (assignedToId && assignedUserName) {
      const roleDisplay = assignedUserRole === 'admin' ? 'Admin' : 'Security Officer'
      
      await query('incident_timeline', 'insert', {
        data: {
          incident_id: result.id,
          user_id: req.user.id,
          action: 'INCIDENT_ASSIGNED',
          description: `Incident assigned to ${roleDisplay}: ${assignedUserName}`,
          is_internal: false
        }
      })
    }

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'CONVERT_TICKET',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: result.id,
        details: { source_ticket_id: ticket.id }
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

    // Check if ticket is resolved or closed
    if (['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ message: 'Cannot delete resolved or closed tickets' })
    }

    // Check if ticket has been converted to an incident
    const existingIncident = await query('incidents', 'select', {
      filters: [{ column: 'source_ticket_id', value: req.params.id }],
      single: true
    })

    if (existingIncident) {
      return res.status(400).json({ message: 'Cannot delete tickets that have been converted to incidents' })
    }

    // RBAC: Users can only delete their own tickets, IT Support and Admin can delete any
    if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Delete associated attachments
    const attachments = await query('attachments', 'select', {
      filters: [
        { column: 'record_type', value: 'ticket' },
        { column: 'record_id', value: req.params.id }
      ]
    })

    // Delete attachment files from filesystem
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

    // Delete attachments from database
    if (attachments.length > 0) {
      await query('attachments', 'delete', {
        filters: [
          { column: 'record_type', value: 'ticket' },
          { column: 'record_id', value: req.params.id }
        ]
      })
    }

    // Delete comments
    await query('ticket_comments', 'delete', {
      filters: [{ column: 'ticket_id', value: req.params.id }]
    })

    // Delete ticket
    await query('tickets', 'delete', {
      filters: [{ column: 'id', value: req.params.id }]
    })

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'DELETE_TICKET',
        user_id: req.user.id,
        resource_type: 'ticket',
        resource_id: req.params.id,
        details: { ticket_number: ticket.ticket_number }
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
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Get comments with user information
    const { data: commentsData, error: commentsError } = await supabase
      .from('ticket_comments')
      .select(`
        *,
        user:users(id, fullname, username)
      `)
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return res.status(500).json({ message: 'Server error' });
    }

    let filteredComments = commentsData || [];

    // Filter internal comments for regular users
    if (req.user.role === 'user') {
      filteredComments = filteredComments.filter(c => !c.is_internal);
    }

    // Format comments for frontend
    const formattedComments = filteredComments.map(c => ({
      id: c.id,
      comment: c.comment,
      isInternal: c.is_internal,
      createdAt: c.created_at,
      userId: c.user_id,
      userName: c.user?.fullname || 'Unknown User',
      userUsername: c.user?.username
    }));

    res.json(formattedComments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Add to your tickets route file
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', req.params.id)
      .single()

    if (error || !ticket) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    res.json({ status: ticket.status })
  } catch (error) {
    console.error('Get status error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})
// Add to your attachments route file
router.get('/ticket/:ticketId', authenticate, async (req, res) => {
  try {
    const { data: attachments, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('record_type', 'ticket')
      .eq('record_id', req.params.ticketId)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(attachments || [])
  } catch (error) {
    console.error('Get attachments error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})


module.exports = router
