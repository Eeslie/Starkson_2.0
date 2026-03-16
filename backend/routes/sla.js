const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

// Get all SLA rules (admin only; it_support can read for compliance)
router.get('/', authenticate, authorize('admin', 'it_support'), async (req, res) => {
  try {
    const { data: rules, error } = await supabase
      .from('sla_config')
      .select('*')
      .order('response_time_minutes', { ascending: true })

    if (error) throw error

    const order = { urgent: 0, high: 1, medium: 2, low: 3 }
    const sorted = (rules || []).sort((a, b) => (order[a.priority] ?? 4) - (order[b.priority] ?? 4))

    res.json(sorted.map(r => ({
      ...r,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      responseTimeMinutes: r.response_time_minutes,
      resolutionTimeHours: r.resolution_time_hours,
      isActive: r.is_active
    })))
  } catch (error) {
    console.error('Get SLA config error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Add new SLA rule (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { priority, responseTimeMinutes, resolutionTimeHours, isActive = true } = req.body

    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority. Use: low, medium, high, urgent' })
    }

    const response_time_minutes = parseInt(responseTimeMinutes, 10)
    const resolution_time_hours = parseInt(resolutionTimeHours, 10)
    if (isNaN(response_time_minutes) || response_time_minutes < 0 || isNaN(resolution_time_hours) || resolution_time_hours < 0) {
      return res.status(400).json({ message: 'Response time (minutes) and resolution time (hours) must be non-negative numbers' })
    }

    const { data: existing } = await supabase
      .from('sla_config')
      .select('id')
      .eq('priority', priority)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ message: `SLA rule for priority "${priority}" already exists. Use PUT to update.` })
    }

    const { data: created, error: insertError } = await supabase
      .from('sla_config')
      .insert({
        priority,
        response_time_minutes,
        resolution_time_hours,
        is_active: !!isActive
      })
      .select()
      .single()

    if (insertError) throw insertError

    await query('audit_logs', 'insert', {
      data: {
        action: 'CREATE_SLA',
        user_id: req.user.id,
        resource_type: 'sla_config',
        resource_id: created.id,
        details: { priority, response_time_minutes, resolution_time_hours }
      }
    })

    res.status(201).json({
      ...created,
      responseTimeMinutes: created.response_time_minutes,
      resolutionTimeHours: created.resolution_time_hours,
      isActive: created.is_active
    })
  } catch (error) {
    console.error('Create SLA error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update SLA rule by id or priority (admin only)
router.put('/:idOrPriority', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { idOrPriority } = req.params
    const { responseTimeMinutes, resolutionTimeHours, isActive } = req.body

    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrPriority)
    let row

    if (isUuid) {
      const { data, error } = await supabase.from('sla_config').select('*').eq('id', idOrPriority).single()
      if (error || !data) return res.status(404).json({ message: 'SLA rule not found' })
      row = data
    } else {
      if (!PRIORITIES.includes(idOrPriority)) {
        return res.status(400).json({ message: 'Invalid priority' })
      }
      const { data, error } = await supabase.from('sla_config').select('*').eq('priority', idOrPriority).single()
      if (error || !data) return res.status(404).json({ message: 'SLA rule not found' })
      row = data
    }

    const updateData = { updated_at: new Date().toISOString() }
    if (responseTimeMinutes !== undefined) {
      const n = parseInt(responseTimeMinutes, 10)
      if (isNaN(n) || n < 0) return res.status(400).json({ message: 'Invalid responseTimeMinutes' })
      updateData.response_time_minutes = n
    }
    if (resolutionTimeHours !== undefined) {
      const n = parseInt(resolutionTimeHours, 10)
      if (isNaN(n) || n < 0) return res.status(400).json({ message: 'Invalid resolutionTimeHours' })
      updateData.resolution_time_hours = n
    }
    if (isActive !== undefined) updateData.is_active = !!isActive

    const { data: updated, error: updateError } = await supabase
      .from('sla_config')
      .update(updateData)
      .eq('id', row.id)
      .select()
      .single()

    if (updateError) throw updateError

    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_SLA',
        user_id: req.user.id,
        resource_type: 'sla_config',
        resource_id: row.id,
        details: updateData
      }
    })

    res.json({
      ...updated,
      responseTimeMinutes: updated.response_time_minutes,
      resolutionTimeHours: updated.resolution_time_hours,
      isActive: updated.is_active
    })
  } catch (error) {
    console.error('Update SLA error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete SLA rule (admin only)
router.delete('/:idOrPriority', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { idOrPriority } = req.params
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrPriority)

    let idToDelete
    if (isUuid) {
      idToDelete = idOrPriority
    } else {
      if (!PRIORITIES.includes(idOrPriority)) {
        return res.status(400).json({ message: 'Invalid priority' })
      }
      const { data } = await supabase.from('sla_config').select('id').eq('priority', idOrPriority).single()
      if (!data) return res.status(404).json({ message: 'SLA rule not found' })
      idToDelete = data.id
    }

    const { error: deleteError } = await supabase.from('sla_config').delete().eq('id', idToDelete)
    if (deleteError) throw deleteError

    await query('audit_logs', 'insert', {
      data: {
        action: 'DELETE_SLA',
        user_id: req.user.id,
        resource_type: 'sla_config',
        resource_id: idToDelete,
        details: {}
      }
    })

    res.json({ message: 'SLA rule deleted' })
  } catch (error) {
    console.error('Delete SLA error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// SLA compliance / breach indicators (it_support, admin)
router.get('/compliance', authenticate, authorize('it_support', 'admin'), async (req, res) => {
  try {
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, priority, status, created_at, resolved_at, closed_at, sla_due')

    if (ticketsError) throw ticketsError

    const now = new Date()
    const byPriority = { low: { total: 0, breached: 0 }, medium: { total: 0, breached: 0 }, high: { total: 0, breached: 0 }, urgent: { total: 0, breached: 0 } }

    for (const t of tickets || []) {
      const p = t.priority || 'medium'
      if (!byPriority[p]) byPriority[p] = { total: 0, breached: 0 }
      byPriority[p].total++
      const isOpen = !['resolved', 'closed'].includes(t.status)
      const due = t.sla_due ? new Date(t.sla_due) : null
      if (isOpen && due && due < now) byPriority[p].breached++
    }

    res.json(byPriority)
  } catch (error) {
    console.error('SLA compliance error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
