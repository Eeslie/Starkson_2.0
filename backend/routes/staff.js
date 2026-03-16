const express = require('express')
const router = express.Router()
const { query } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get staff dashboard stats (IT Support Console) – same capabilities for admin and IT Staff; counts vary by role
router.get('/stats', authenticate, authorize('it_support', 'admin'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin'
    const userId = req.user.id

    let assignedTicketsCount = 0
    let pendingTicketsCount = 0
    let totalResolved = 0

    // Pending tickets: new, unassigned
    const { count: pendingCount } = await query('tickets', 'count', {
      filters: [
        { column: 'status', value: 'new' },
        { column: 'assigned_to', operator: 'is', value: null }
      ]
    })
    pendingTicketsCount = pendingCount || 0

    if (isAdmin) {
      // Admin: Assigned = tickets assigned to any staff + incidents assigned to security officer
      const { count: assignedTickets } = await query('tickets', 'count', {
        filters: [{ column: 'assigned_to', operator: 'is', value: null }]
      })
      const { count: assignedIncidents } = await query('incidents', 'count', {
        filters: [{ column: 'assigned_to', operator: 'is', value: null }]
      })
      assignedTicketsCount = (assignedTickets || 0) + (assignedIncidents || 0)

      // Admin: Total Resolved = all resolved/closed tickets + all closed incidents
      const { count: resolvedTickets } = await query('tickets', 'count', {
        filters: [{ column: 'status', operator: 'in', value: ['resolved', 'closed'] }]
      })
      const { count: resolvedIncidents } = await query('incidents', 'count', {
        filters: [{ column: 'status', value: 'closed' }]
      })
      totalResolved = (resolvedTickets || 0) + (resolvedIncidents || 0)
    } else {
      // IT Staff: Assigned = tickets assigned to current user, not resolved/closed
      const { count: assignedCount } = await query('tickets', 'count', {
        filters: [
          { column: 'assigned_to', value: userId },
          { column: 'status', operator: 'neq', value: 'resolved' },
          { column: 'status', operator: 'neq', value: 'closed' }
        ]
      })
      assignedTicketsCount = assignedCount || 0

      // IT Staff: Total Resolved = tickets assigned to current user with status resolved/closed
      const { count: resolvedCount } = await query('tickets', 'count', {
        filters: [
          { column: 'assigned_to', value: userId },
          { column: 'status', operator: 'in', value: ['resolved', 'closed'] }
        ]
      })
      totalResolved = resolvedCount || 0
    }

    res.json({
      assignedTickets: assignedTicketsCount,
      pendingTickets: pendingTicketsCount,
      resolvedToday: totalResolved,
      totalResolved,
      role: req.user.role
    })
  } catch (error) {
    console.error('Get staff stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

module.exports = router