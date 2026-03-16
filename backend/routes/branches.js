const express = require('express')
const { supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

const router = express.Router()
const { BRANCHES } = require('../constants/branches')
const { invalidateCache } = require('../lib/branches')

// Get all branches (authenticated users)
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('acronym, name')
      .order('acronym')
    if (error) throw error
    if (!data || data.length === 0) {
      return res.json(BRANCHES.map((b) => ({ acronym: b.acronym, name: b.name })))
    }
    res.json(data)
  } catch (err) {
    console.error('Branches list error:', err)
    res.json(BRANCHES.map((b) => ({ acronym: b.acronym, name: b.name })))
  }
})

// Add branch (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { acronym, name } = req.body
    const a = String(acronym || '').trim().toUpperCase()
    const n = String(name || '').trim()
    if (!a || !n) {
      return res.status(400).json({ message: 'Acronym and name are required' })
    }
    if (a.length > 10) {
      return res.status(400).json({ message: 'Acronym must be 10 characters or less' })
    }
    const { data, error } = await supabase
      .from('branches')
      .insert({ acronym: a, name: n })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ message: 'A branch with this acronym already exists' })
      }
      throw error
    }
    invalidateCache()
    res.status(201).json(data)
  } catch (err) {
    console.error('Add branch error:', err)
    res.status(500).json({ message: 'Failed to add branch' })
  }
})

// Delete branch (admin only)
router.delete('/:acronym', authenticate, authorize('admin'), async (req, res) => {
  try {
    const acronym = String(req.params.acronym || '').trim().toUpperCase()
    if (!acronym) {
      return res.status(400).json({ message: 'Acronym is required' })
    }
    if (acronym === 'ALL') {
      return res.status(400).json({ message: 'Cannot delete the All Branches option' })
    }
    const { error } = await supabase.from('branches').delete().eq('acronym', acronym)
    if (error) throw error
    invalidateCache()
    res.json({ message: 'Branch deleted' })
  } catch (err) {
    console.error('Delete branch error:', err)
    res.status(500).json({ message: 'Failed to delete branch' })
  }
})

module.exports = router
