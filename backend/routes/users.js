const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { getValidAcronyms } = require('../lib/branches')

// Get security officers only (for convert-to-incident assignment; it_support and admin)
router.get('/security-officers', authenticate, authorize('it_support', 'security_officer', 'admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, fullname, username')
      .eq('role', 'security_officer')
      .eq('status', 'active')
      .order('fullname', { ascending: true })
    if (error) throw error
    res.json(users || [])
  } catch (error) {
    console.error('Get security officers error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// NEW ROUTE: Get admins only (for convert-to-incident assignment)
router.get('/admins', authenticate, authorize('it_support', 'security_officer', 'admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, fullname, username')
      .eq('role', 'admin')
      .eq('status', 'active')
      .order('fullname', { ascending: true })
    if (error) throw error
    res.json(users || [])
  } catch (error) {
    console.error('Get admins error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get all users (admin only); optional filters: role, branch_acronym
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, branch_acronym } = req.query
    let query = supabase
      .from('users')
      .select('id, username, fullname, role, status, branch_acronyms, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (role && typeof role === 'string' && ['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      query = query.eq('role', role)
    }

    const { data: rawUsers, error } = await query
    if (error) throw error

    // Filter by branch in memory: show users whose branch_acronyms includes branch_acronym or 'ALL'
    let users = rawUsers || []
    if (branch_acronym && typeof branch_acronym === 'string' && branch_acronym.trim()) {
      const branch = branch_acronym.trim()
      users = users.filter((u) => {
        const arr = Array.isArray(u.branch_acronyms) ? u.branch_acronyms : []
        return arr.includes(branch) || arr.includes('ALL')
      })
    }

    res.json(users.map(u => ({
      ...u,
      branchAcronyms: Array.isArray(u.branch_acronyms) ? u.branch_acronyms : [],
      createdAt: u.created_at,
      updatedAt: u.updated_at
    })))
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single user (admin only)
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, fullname, role, status, branch_acronyms, created_at, updated_at')
      .eq('id', req.params.id)
      .single()

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({
      ...user,
      branchAcronyms: Array.isArray(user.branch_acronyms) ? user.branch_acronyms : [],
      createdAt: user.created_at,
      updatedAt: user.updated_at
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update user role (admin only)
router.put('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body

    if (!['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ message: 'User not found' })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_USER_ROLE',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.params.id,
        details: { previousRole: existing.role, newRole: role }
      }
    })

    res.json({ message: 'User role updated' })
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update user branches (admin only)
router.put('/:id/branches', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { branchAcronyms } = req.body
    const validAcronyms = await getValidAcronyms()
    const normalized = Array.isArray(branchAcronyms)
      ? branchAcronyms.filter(a => typeof a === 'string' && validAcronyms.has(a.trim()))
      : []

    const { data: existing } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (existing.role === 'admin') {
      return res.status(400).json({ message: 'Admin users do not have branch assignments' })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ branch_acronyms: normalized, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    res.json({ message: 'User branches updated' })
  } catch (error) {
    console.error('Update user branches error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update user status (admin only)
router.put('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_USER_STATUS',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.params.id,
        details: { status }
      }
    })

    res.json({ message: 'User status updated' })
  } catch (error) {
    console.error('Update user status error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const targetId = req.params.id

    if (targetId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' })
    }

    const { data: target, error: fetchError } = await supabase
      .from('users')
      .select('id, username, fullname, role')
      .eq('id', targetId)
      .single()

    if (fetchError || !target) {
      return res.status(404).json({ message: 'User not found' })
    }

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', targetId)

    if (deleteError) {
      console.error('Delete user error:', deleteError)
      return res.status(500).json({ message: deleteError.message || 'Failed to delete user' })
    }

    await query('audit_logs', 'insert', {
      data: {
        action: 'DELETE_USER',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: targetId,
        details: { deletedUsername: target.username, deletedFullname: target.fullname, deletedRole: target.role }
      }
    })

    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router