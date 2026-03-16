const express = require('express')
const router = express.Router()
const { query, runQuery } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Get dashboard stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    console.log('Dashboard stats requested by user:', req.user.id, 'role:', req.user.role)

    let incidentsCount = 0
    let ticketsCount = 0
    let openTicketsCount = 0
    let resolvedTicketsCount = 0
    let resolvedIncidentsCount = 0
    let assignedIncidents = 0
    let openIncidents = 0
    let resolvedIncidents = 0
    let userTickets = 0
    let userOpenTickets = 0
    let userResolvedTickets = 0
    let userIncidents = 0
    let userOpenIncidents = 0
    let userResolvedIncidents = 0

    let itSupportTickets = 0
    let itSupportOpenTickets = 0
    let itSupportResolvedTickets = 0

    const role = req.user.role
    const userId = req.user.id

    if (role === 'security_officer' || role === 'admin') {
      const { count: incCount } = await query('incidents', 'count', {})
      incidentsCount = incCount || 0
      console.log('Total incidents count:', incidentsCount)

      if (role === 'admin') {
        const allTickets = await query('tickets', 'select', { select: 'status' }) || []
        ticketsCount = allTickets.length

        openTicketsCount = allTickets.filter(t =>
          !['closed', 'resolved', 'converted_to_incident'].includes(t.status)
        ).length

        resolvedTicketsCount = allTickets.filter(t =>
          ['closed', 'resolved'].includes(t.status)
        ).length

        console.log('Admin tickets breakdown:', {
          total: ticketsCount,
          openTickets: openTicketsCount,
          resolvedTickets: resolvedTicketsCount
        })

        const { count: resolvedIncCount } = await query('incidents', 'count', {
          filters: [{ column: 'status', operator: 'in', value: ['recovered', 'closed'] }]
        })
        resolvedIncidentsCount = resolvedIncCount || 0
        console.log('Admin resolved incidents count:', resolvedIncidentsCount)
      }

      if (role === 'security_officer') {
        const { count: assignedCount } = await query('incidents', 'count', {
          filters: [{ column: 'assigned_to', value: userId }]
        })
        assignedIncidents = assignedCount || 0

        const { count: openCount } = await query('incidents', 'count', {
          filters: [
            { column: 'assigned_to', value: userId },
            { column: 'status', operator: 'neq', value: 'closed' },
            { column: 'status', operator: 'neq', value: 'recovered' }
          ]
        })
        openIncidents = openCount || 0

        const { count: resolvedCount } = await query('incidents', 'count', {
          filters: [
            { column: 'assigned_to', value: userId },
            { column: 'status', operator: 'in', value: ['recovered', 'closed'] }
          ]
        })
        resolvedIncidents = resolvedCount || 0
      }
    } else if (role === 'user') {
      console.log('Fetching user tickets and incidents for user:', userId)

      const allUserTickets = await query('tickets', 'select', {
        select: 'id, status',
        filters: [{ column: 'created_by', value: userId }]
      }) || []

      userTickets = allUserTickets.length
      userOpenTickets = allUserTickets.filter(t =>
        !['converted_to_incident', 'closed', 'resolved'].includes(t.status)
      ).length
      userResolvedTickets = allUserTickets.filter(t =>
        ['closed', 'resolved'].includes(t.status)
      ).length

      const convertedTicketIds = allUserTickets
        .filter(t => t.status === 'converted_to_incident')
        .map(t => t.id)

      if (convertedTicketIds.length > 0) {
        const incidents = await query('incidents', 'select', {
          select: 'id, status, source_ticket_id',
          filters: [{ column: 'source_ticket_id', operator: 'in', value: convertedTicketIds }]
        }) || []

        userIncidents = incidents.length
        userOpenIncidents = incidents.filter(inc =>
          !['recovered', 'closed'].includes(inc.status)
        ).length
        userResolvedIncidents = incidents.filter(inc =>
          ['recovered', 'closed'].includes(inc.status)
        ).length
      }
    } else if (role === 'it_support') {
      console.log('Fetching IT Support stats for user:', userId)

      const sql = `
        SELECT id, status
        FROM tickets
        WHERE assigned_to = ? OR assigned_to IS NULL
      `
      const allSupportTickets = await runQuery(sql, [userId]) || []

      itSupportTickets = allSupportTickets.length
      itSupportOpenTickets = allSupportTickets.filter(t =>
        !['closed', 'resolved', 'converted_to_incident'].includes(t.status)
      ).length
      itSupportResolvedTickets = allSupportTickets.filter(t =>
        ['closed', 'resolved'].includes(t.status)
      ).length
    }

    const response = {
      tickets: 0,
      incidents: 0,
      openTickets: 0,
      resolvedTickets: 0,
      assignedIncidents: assignedIncidents || 0,
      openIncidents: openIncidents || 0,
      resolvedIncidents: resolvedIncidents || 0
    }

    if (role === 'admin') {
      response.tickets = ticketsCount || 0
      response.incidents = incidentsCount || 0
      response.openTickets = openTicketsCount || 0
      response.resolvedTickets = (resolvedTicketsCount || 0) + (resolvedIncidentsCount || 0)
    } else if (role === 'security_officer') {
      response.incidents = incidentsCount || 0
      response.assignedIncidents = assignedIncidents || 0
      response.openIncidents = openIncidents || 0
      response.resolvedIncidents = resolvedIncidents || 0
      response.resolvedTickets = resolvedIncidents || 0
    } else if (role === 'user') {
      response.tickets = userOpenTickets || 0
      response.incidents = userOpenIncidents || 0
      response.openTickets = userOpenTickets || 0
      response.resolvedTickets = (userResolvedTickets || 0) + (userResolvedIncidents || 0)
    } else if (role === 'it_support') {
      response.tickets = itSupportTickets || 0
      response.openTickets = itSupportOpenTickets || 0
      response.resolvedTickets = itSupportResolvedTickets || 0
      response.incidents = 0
    }

    console.log('Dashboard stats response:', response)
    res.json(response)
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get recent activity from notifications table
router.get('/activity', authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 50)

    const rows = await query('notifications', 'select', {
      select: 'id, type, title, message, resource_type, resource_id, created_at',
      filters: [{ column: 'user_id', value: req.user.id }],
      orderBy: { column: 'created_at', ascending: false },
      limit
    })

    const list = (rows || []).map((n) => ({
      id: n.id,
      action: n.type,
      resourceType: n.resource_type,
      resourceId: n.resource_id,
      details: { title: n.title, message: n.message },
      createdAt: n.created_at
    }))

    res.json({ activity: list })
  } catch (error) {
    console.error('Get dashboard activity error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Debug endpoint to check user incidents with source_ticket_id
router.get('/debug/user-incidents', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'This endpoint is only for regular users' })
    }

    console.log('Debug: Checking incidents for user:', req.user.id)

    const tickets = await query('tickets', 'select', {
      select: 'id, ticket_number, title, status, created_at',
      filters: [{ column: 'created_by', value: req.user.id }],
      orderBy: { column: 'created_at', ascending: false }
    }) || []

    const allIncidents = await query('incidents', 'select', {
      select: 'id, incident_number, title, status, source_ticket_id, created_at',
      orderBy: { column: 'created_at', ascending: false }
    }) || []

    const userTicketIds = tickets.map(t => t.id)
    const userIncidents = allIncidents.filter(
      inc => inc.source_ticket_id && userTicketIds.includes(inc.source_ticket_id)
    )

    const myTickets = tickets.filter(t =>
      !['converted_to_incident', 'closed', 'resolved'].includes(t.status)
    ).length

    const resolvedTickets = tickets.filter(t =>
      ['closed', 'resolved'].includes(t.status)
    ).length

    const myIncidents = userIncidents.filter(inc =>
      !['recovered', 'closed'].includes(inc.status)
    ).length

    const resolvedIncidents = userIncidents.filter(inc =>
      ['recovered', 'closed'].includes(inc.status)
    ).length

    res.json({
      user: { id: req.user.id },
      tickets: {
        count: tickets.length,
        list: tickets,
        statusBreakdown: {
          myTickets,
          resolvedTickets,
          converted_to_incident: tickets.filter(t => t.status === 'converted_to_incident').length || 0
        }
      },
      incidents: {
        total: allIncidents.length,
        userIncidents: {
          count: userIncidents.length,
          list: userIncidents,
          myIncidents,
          resolvedIncidents
        }
      },
      expectedResponse: {
        myTickets,
        myIncidents,
        openTickets: myTickets,
        resolvedAndRecovered: resolvedTickets + resolvedIncidents
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router