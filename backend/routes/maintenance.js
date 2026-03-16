const express = require('express')
const router = express.Router()
const { supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get all maintenance data by type
router.get('/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params
    const validTypes = ['category', 'affected_system', 'priority', 'incident_category', 'severity', 'ticket_status', 'incident_status']
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid maintenance data type' })
    }

    const { data, error } = await supabase
      .from('maintenance_data')
      .select('value')
      .eq('type', type)
      .order('value', { ascending: true })

    if (error) throw error

    const values = (data || []).map(item => item.value)
    res.json(values)
  } catch (err) {
    console.error('Get maintenance data error:', err)
    // Check if table doesn't exist
    if (err.message && err.message.includes('does not exist')) {
      return res.status(500).json({ 
        message: 'Database table not found. Please run the migration: migration_maintenance_data.sql',
        error: err.message 
      })
    }
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// Get all maintenance data (all types)
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('maintenance_data')
      .select('type, value')
      .order('type', { ascending: true })
      .order('value', { ascending: true })

    if (error) throw error

    // Group by type
    const grouped = {}
    ;(data || []).forEach(item => {
      if (!grouped[item.type]) {
        grouped[item.type] = []
      }
      grouped[item.type].push(item.value)
    })

    res.json({
      categories: grouped.category || [],
      affectedSystems: grouped.affected_system || [],
      priorities: grouped.priority || [],
      incidentCategories: grouped.incident_category || [],
      severities: grouped.severity || [],
      ticketStatuses: grouped.ticket_status || [],
      incidentStatuses: grouped.incident_status || []
    })
  } catch (err) {
    console.error('Get all maintenance data error:', err)
    // Check if table doesn't exist
    if (err.message && err.message.includes('does not exist')) {
      return res.status(500).json({ 
        message: 'Database table not found. Please run the migration: migration_maintenance_data.sql',
        error: err.message 
      })
    }
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// Add maintenance data (admin only)
router.post('/:type', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type } = req.params
    const { value } = req.body
    const validTypes = ['category', 'affected_system', 'priority', 'incident_category', 'severity', 'ticket_status', 'incident_status']
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid maintenance data type' })
    }

    if (!value || typeof value !== 'string' || !value.trim()) {
      return res.status(400).json({ message: 'Value is required and must be a non-empty string' })
    }

    const trimmedValue = value.trim()

    // Check if already exists
    const { data: existing, error: checkError } = await supabase
      .from('maintenance_data')
      .select('id')
      .eq('type', type)
      .eq('value', trimmedValue)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
      throw checkError
    }

    if (existing) {
      return res.status(409).json({ message: `${type} "${trimmedValue}" already exists` })
    }

    // Insert new value
    const { data, error } = await supabase
      .from('maintenance_data')
      .insert({ type, value: trimmedValue })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({ message: `${type} "${trimmedValue}" added successfully`, data })
  } catch (err) {
    console.error('Add maintenance data error:', err)
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({ message: 'This value already exists' })
    }
    // Check if table doesn't exist
    if (err.message && err.message.includes('does not exist')) {
      return res.status(500).json({ 
        message: 'Database table not found. Please run the migration: migration_maintenance_data.sql',
        error: err.message 
      })
    }
    res.status(500).json({ 
      message: err.message || 'Server error', 
      error: err.message || 'Unknown error',
      code: err.code 
    })
  }
})

// Delete maintenance data (admin only)
router.delete('/:type/:value', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type, value } = req.params
    const validTypes = ['category', 'affected_system', 'priority', 'incident_category', 'severity', 'ticket_status', 'incident_status']
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid maintenance data type' })
    }

    // Decode the value (URL encoded)
    const decodedValue = decodeURIComponent(value)

    const { error } = await supabase
      .from('maintenance_data')
      .delete()
      .eq('type', type)
      .eq('value', decodedValue)

    if (error) throw error

    res.json({ message: `${type} "${decodedValue}" deleted successfully` })
  } catch (err) {
    console.error('Delete maintenance data error:', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router
