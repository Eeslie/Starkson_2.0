const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get staff dashboard stats (IT Support Console) – same capabilities for admin and IT Staff; counts vary by role
router.get('/stats', authenticate, authorize('it_support', 'admin'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin'

    let assignedTicketsCount = 0
    let pendingTicketsCount = 0
    let totalResolved = 0

    // Pending tickets: new, unassigned (same for both roles – real-time queue)
    const { count: pendingCount, error: pendingError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')
      .is('assigned_to', null)
    if (pendingError) throw pendingError
    pendingTicketsCount = pendingCount || 0

    if (isAdmin) {
      // Admin: Assigned = tickets assigned to any staff + incidents assigned to security officer
      const { count: assignedTickets, error: e1 } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .not('assigned_to', 'is', null)
      if (e1) throw e1
      const { count: assignedIncidents, error: e2 } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .not('assigned_to', 'is', null)
      if (e2) throw e2
      assignedTicketsCount = (assignedTickets || 0) + (assignedIncidents || 0)

      // Admin: Total Resolved = all resolved/closed tickets + all closed incidents
      const { count: resolvedTickets, error: e3 } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['resolved', 'closed'])
      if (e3) throw e3
      const { count: resolvedIncidents, error: e4 } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'closed')
      if (e4) throw e4
      totalResolved = (resolvedTickets || 0) + (resolvedIncidents || 0)
    } else {
      // IT Staff: Assigned = tickets assigned to current user, not resolved/closed
      const { count: assignedCount, error: assignedError } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', req.user.id)
        .not('status', 'eq', 'resolved')
        .not('status', 'eq', 'closed')
      if (assignedError) throw assignedError
      assignedTicketsCount = assignedCount || 0

      // IT Staff: Total Resolved = tickets assigned to current user with status resolved/closed
      const { count: resolvedCount, error: resolvedError } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', req.user.id)
        .in('status', ['resolved', 'closed'])
      if (resolvedError) throw resolvedError
      totalResolved = resolvedCount || 0
    }

    res.json({
      assignedTickets: assignedTicketsCount,
      pendingTickets: pendingTicketsCount,
      resolvedToday: totalResolved, // keep for backward compat
      totalResolved,
      role: req.user.role,
    })
  } catch (error) {
    console.error('Get staff stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

module.exports = router
