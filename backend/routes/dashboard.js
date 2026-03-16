const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Get dashboard stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    console.log('Dashboard stats requested by user:', req.user.id, 'role:', req.user.role)

    // Initialize counters
    let incidentsCount = 0
    let ticketsCount = 0
    let openTicketsCount = 0
    let resolvedTicketsCount = 0  // Added for admin resolved tickets
    let resolvedIncidentsCount = 0 // Added for admin resolved incidents
    let assignedIncidents = 0
    let openIncidents = 0
    let resolvedIncidents = 0
    let userTickets = 0
    let userOpenTickets = 0
    let userResolvedTickets = 0
    let userIncidents = 0
    let userOpenIncidents = 0
    let userResolvedIncidents = 0
    
    // For IT Support
    let itSupportTickets = 0
    let itSupportOpenTickets = 0
    let itSupportResolvedTickets = 0
    
    if (req.user.role === 'security_officer' || req.user.role === 'admin') {
      // Total incidents
      const { count: incCount, error: incidentsError } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
      if (!incidentsError) incidentsCount = incCount || 0
      console.log('Total incidents count:', incidentsCount)
      
      // For admin, also get ticket stats and resolved incidents
      if (req.user.role === 'admin') {
        // Get all tickets for admin
        const { data: allTickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('status')
        
        if (!ticketsError && allTickets) {
          ticketsCount = allTickets.length
          
          // OPEN TICKETS: Tickets that are not resolved, closed, or converted
          openTicketsCount = allTickets.filter(t => 
            !['closed', 'resolved', 'converted_to_incident'].includes(t.status)
          ).length
          
          // RESOLVED TICKETS: Tickets with resolved or closed status
          resolvedTicketsCount = allTickets.filter(t => 
            ['closed', 'resolved'].includes(t.status)
          ).length
          
          console.log('Admin tickets breakdown:', {
            total: ticketsCount,
            openTickets: openTicketsCount,
            resolvedTickets: resolvedTicketsCount
          })
        } else {
          console.error('Error fetching tickets for admin:', ticketsError)
        }
        
        // Get resolved incidents count for admin (recovered or closed)
        const { count: resolvedIncCount, error: resolvedIncError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .in('status', ['recovered', 'closed'])
        
        if (!resolvedIncError) {
          resolvedIncidentsCount = resolvedIncCount || 0
          console.log('Admin resolved incidents count:', resolvedIncidentsCount)
        } else {
          console.error('Error fetching resolved incidents for admin:', resolvedIncError)
        }
      }
      
      if (req.user.role === 'security_officer') {
        // ALL incidents assigned to current user
        const { count: assignedCount, error: assignedError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', req.user.id)
        if (!assignedError) assignedIncidents = assignedCount || 0
        console.log('Assigned incidents count (all):', assignedIncidents)
        
        // Open incidents assigned to current user
        const { count: openCount, error: openError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', req.user.id)
          .not('status', 'in', '("closed","recovered")')
        if (!openError) openIncidents = openCount || 0
        console.log('Open incidents assigned to user:', openIncidents)
        
        // RESOLVED incidents assigned to current user
        const { count: resolvedCount, error: resolvedError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', req.user.id)
          .in('status', ['recovered', 'closed'])
        if (!resolvedError) resolvedIncidents = resolvedCount || 0
        console.log('Resolved incidents assigned to user:', resolvedIncidents)
      }
    } else if (req.user.role === 'user') {
      console.log('Fetching user tickets and incidents for user:', req.user.id)
      
      // ============================================
      // TICKETS STATS
      // ============================================
      
      // Get ALL tickets created by this user (to analyze their statuses)
      const { data: allUserTickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, status')
        .eq('created_by', req.user.id)
      
      if (!ticketsError && allUserTickets) {
        // Count tickets by status
        userTickets = allUserTickets.length
        
        // MY TICKETS: Only show tickets that are NOT resolved/closed and NOT converted
        userOpenTickets = allUserTickets.filter(t => 
          !['converted_to_incident', 'closed', 'resolved'].includes(t.status)
        ).length
        
        // RESOLVED TICKETS: Only show tickets with resolved or closed status
        userResolvedTickets = allUserTickets.filter(t => 
          ['closed', 'resolved'].includes(t.status)
        ).length
        
        // Converted tickets (for incident lookup)
        const convertedTickets = allUserTickets.filter(t => 
          t.status === 'converted_to_incident'
        ).length
        
        console.log('User tickets breakdown:', {
          total: userTickets,
          myTickets: userOpenTickets,
          resolvedTickets: userResolvedTickets,
          converted: convertedTickets
        })
        
        // ============================================
        // INCIDENTS STATS - from converted tickets
        // ============================================
        
        // Get IDs of converted tickets to find incidents
        const convertedTicketIds = allUserTickets
          .filter(t => t.status === 'converted_to_incident')
          .map(t => t.id)
        
        if (convertedTicketIds.length > 0) {
          console.log('Converted ticket IDs:', convertedTicketIds)
          
          // Get incidents from these tickets
          const { data: incidents, error: incError } = await supabase
            .from('incidents')
            .select('id, status')
            .in('source_ticket_id', convertedTicketIds)
          
          if (!incError && incidents) {
            // Total incidents from converted tickets
            userIncidents = incidents.length
            
            // MY INCIDENTS: Only show incidents that are NOT resolved/closed (open incidents)
            userOpenIncidents = incidents.filter(inc => 
              !['recovered', 'closed'].includes(inc.status)
            ).length
            
            // RESOLVED INCIDENTS: Only show incidents with recovered or closed status
            userResolvedIncidents = incidents.filter(inc => 
              ['recovered', 'closed'].includes(inc.status)
            ).length
            
            console.log('User incidents breakdown:', {
              total: userIncidents,
              myIncidents: userOpenIncidents,
              resolvedIncidents: userResolvedIncidents,
              incidents: incidents
            })
          } else {
            console.error('Error fetching incidents:', incError)
          }
        }
      } else {
        console.error('Error fetching tickets:', ticketsError)
      }
    } else if (req.user.role === 'it_support') {
      console.log('Fetching IT Support stats for user:', req.user.id)
      
      // Get tickets assigned to this IT Support user OR unassigned tickets
      const { data: allSupportTickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, status')
        .or(`assigned_to.eq.${req.user.id},assigned_to.is.null`)
      
      if (!ticketsError && allSupportTickets) {
        // Count tickets by status
        itSupportTickets = allSupportTickets.length
        
        // OPEN TICKETS: Tickets that are open (not resolved/closed)
        itSupportOpenTickets = allSupportTickets.filter(t => 
          !['closed', 'resolved', 'converted_to_incident'].includes(t.status)
        ).length
        
        // RESOLVED TICKETS: Tickets with resolved or closed status
        itSupportResolvedTickets = allSupportTickets.filter(t => 
          ['closed', 'resolved'].includes(t.status)
        ).length
        
        console.log('IT Support tickets breakdown:', {
          total: itSupportTickets,
          open: itSupportOpenTickets,
          resolved: itSupportResolvedTickets
        })
      }
    }

    // ============================================
    // BUILD RESPONSE
    // ============================================
    
    // Base response
    const response = {
      tickets: 0,
      incidents: 0,
      openTickets: 0,
      resolvedTickets: 0,
      assignedIncidents: assignedIncidents || 0,
      openIncidents: openIncidents || 0,
      resolvedIncidents: resolvedIncidents || 0,
    }
    
    // Set stats based on user role
    if (req.user.role === 'admin') {
      // For admin - show all incidents and tickets
      response.tickets = ticketsCount || 0
      response.incidents = incidentsCount || 0
      response.openTickets = openTicketsCount || 0
      
      // RESOLVED & RECOVERED: Resolved tickets + resolved incidents
      response.resolvedTickets = (resolvedTicketsCount || 0) + (resolvedIncidentsCount || 0)
      
      console.log('Final admin stats:', {
        tickets: response.tickets,
        incidents: response.incidents,
        openTickets: response.openTickets,
        resolvedTickets: response.resolvedTickets,
        resolvedTicketsBreakdown: {
          fromTickets: resolvedTicketsCount,
          fromIncidents: resolvedIncidentsCount
        },
        assignedIncidents: response.assignedIncidents,
        openIncidents: response.openIncidents,
        resolvedIncidents: response.resolvedIncidents
      })
    } else if (req.user.role === 'security_officer') {
      // For security officer - keep incident-specific stats
      response.incidents = incidentsCount || 0
      response.assignedIncidents = assignedIncidents || 0
      response.openIncidents = openIncidents || 0
      response.resolvedIncidents = resolvedIncidents || 0
      
      // For security officer, resolvedTickets could show their resolved incidents
      // or you might want to keep it separate
      response.resolvedTickets = resolvedIncidents || 0
      
      console.log('Final security officer stats:', {
        totalIncidents: response.incidents,
        assignedIncidents: response.assignedIncidents,
        openIncidents: response.openIncidents,
        resolvedIncidents: response.resolvedIncidents,
        resolvedTickets: response.resolvedTickets
      })
    } else if (req.user.role === 'user') {
      // MY TICKETS: Only show tickets that are NOT resolved/closed and NOT converted
      response.tickets = userOpenTickets || 0
      
      // MY INCIDENTS: Only show incidents that are NOT resolved/closed (open incidents)
      response.incidents = userOpenIncidents || 0
      
      // OPEN TICKETS: Same as My Tickets (for consistency)
      response.openTickets = userOpenTickets || 0
      
      // RESOLVED & RECOVERED: Only resolved tickets + resolved incidents
      response.resolvedTickets = (userResolvedTickets || 0) + (userResolvedIncidents || 0)
      
      console.log('Final user stats:', {
        myTickets: response.tickets,
        myIncidents: response.incidents,
        openTickets: response.openTickets,
        resolvedAndRecovered: response.resolvedTickets,
        userOpenTickets,
        userResolvedTickets,
        userOpenIncidents,
        userResolvedIncidents
      })
    } else if (req.user.role === 'it_support') {
      // For IT Support
      response.tickets = itSupportTickets || 0
      response.openTickets = itSupportOpenTickets || 0
      response.resolvedTickets = itSupportResolvedTickets || 0
      // IT Support doesn't see incidents in their main cards
      response.incidents = 0
      
      console.log('Final IT Support stats:', {
        totalTickets: response.tickets,
        openTickets: response.openTickets,
        resolvedTickets: response.resolvedTickets
      })
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
    const { data: rows, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, resource_type, resource_id, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const list = (rows || []).map((n) => ({
      id: n.id,
      action: n.type,
      resourceType: n.resource_type,
      resourceId: n.resource_id,
      details: { title: n.title, message: n.message },
      createdAt: n.created_at,
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
      return res.status(403).json({ message: 'This endpoint is only for regular users' });
    }

    console.log('Debug: Checking incidents for user:', req.user.id);

    // Get all tickets created by this user
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, ticket_number, title, status, created_at')
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false });

    if (ticketsError) throw ticketsError;

    // Get all incidents with their source_ticket_id
    const { data: allIncidents, error: incidentsError } = await supabase
      .from('incidents')
      .select(`
        id,
        incident_number,
        title,
        status,
        source_ticket_id,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (incidentsError) throw incidentsError;

    // Filter incidents that belong to user's tickets using source_ticket_id
    const userTicketIds = tickets?.map(t => t.id) || [];
    const userIncidents = allIncidents?.filter(inc => 
      inc.source_ticket_id && userTicketIds.includes(inc.source_ticket_id)
    ) || [];

    // Calculate counts
    const myTickets = tickets?.filter(t => 
      !['converted_to_incident', 'closed', 'resolved'].includes(t.status)
    ).length || 0;
    
    const resolvedTickets = tickets?.filter(t => 
      ['closed', 'resolved'].includes(t.status)
    ).length || 0;
    
    const myIncidents = userIncidents.filter(inc => 
      !['recovered', 'closed'].includes(inc.status)
    ).length;
    
    const resolvedIncidents = userIncidents.filter(inc => 
      ['recovered', 'closed'].includes(inc.status)
    ).length;

    res.json({
      user: {
        id: req.user.id
      },
      tickets: {
        count: tickets?.length || 0,
        list: tickets,
        statusBreakdown: {
          myTickets, // Should match response.tickets
          resolvedTickets, // Should match resolved part of response.resolvedTickets
          converted_to_incident: tickets?.filter(t => t.status === 'converted_to_incident').length || 0
        }
      },
      incidents: {
        total: allIncidents?.length || 0,
        userIncidents: {
          count: userIncidents.length,
          list: userIncidents,
          myIncidents, // Should match response.incidents
          resolvedIncidents // Should match resolved part of response.resolvedTickets
        }
      },
      expectedResponse: {
        myTickets,
        myIncidents,
        openTickets: myTickets,
        resolvedAndRecovered: resolvedTickets + resolvedIncidents
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router