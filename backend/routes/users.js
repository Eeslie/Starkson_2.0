const express = require('express')
const router = express.Router()
const { query } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { getValidAcronyms } = require('../lib/branches')

// Get security officers only (for convert-to-incident assignment; it_support and admin)
router.get('/security-officers', authenticate, authorize('it_support', 'security_officer', 'admin'), async (req, res) => {
  try {
    const users = await query('users', 'select', {
      select: 'id, fullname, username',
      filters: [
        { column: 'role', value: 'security_officer' },
        { column: 'status', value: 'active' }
      ],
      orderBy: { column: 'fullname', ascending: true }
    })
    res.json(users || [])
  } catch (error) {
    console.error('Get security officers error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// NEW ROUTE: Get admins only (for convert-to-incident assignment)
router.get('/admins', authenticate, authorize('it_support', 'security_officer', 'admin'), async (req, res) => {
  try {
    const users = await query('users', 'select', {
      select: 'id, fullname, username',
      filters: [
        { column: 'role', value: 'admin' },
        { column: 'status', value: 'active' }
      ],
      orderBy: { column: 'fullname', ascending: true }
    })
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
    const filters = []
    if (role && typeof role === 'string' && ['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      filters.push({ column: 'role', value: role })
    }

    const rawUsers = await query('users', 'select', {
      select: 'id, username, fullname, role, status, branch_acronyms, created_at, updated_at',
      filters: filters.length ? filters : undefined,
      orderBy: { column: 'created_at', ascending: false }
    })

    // Filter by branch in memory: show users whose branch_acronyms includes branch_acronym or 'ALL'
    let users = rawUsers || []
    if (branch_acronym && typeof branch_acronym === 'string' && branch_acronym.trim()) {
      const branch = branch_acronym.trim()
      users = users.filter((u) => {
        const arr = typeof u.branch_acronyms === 'string' && u.branch_acronyms.trim()
          ? u.branch_acronyms.split(',').map(a => a.trim())
          : []
        return arr.includes(branch) || arr.includes('ALL')
      })
    }

    res.json(users.map(u => ({
      ...u,
      branchAcronyms: typeof u.branch_acronyms === 'string' && u.branch_acronyms.trim()
        ? u.branch_acronyms.split(',').map(a => a.trim())
        : [],
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
    const user = await query('users', 'select', {
      select: 'id, username, fullname, role, status, branch_acronyms, created_at, updated_at',
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({
      ...user,
      branchAcronyms: typeof user.branch_acronyms === 'string' && user.branch_acronyms.trim()
        ? user.branch_acronyms.split(',').map(a => a.trim())
        : [],
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

    const existing = await query('users', 'select', {
      select: 'id, role',
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!existing) {
      return res.status(404).json({ message: 'User not found' })
    }

    await query('users', 'update', {
      data: { role, updated_at: new Date().toISOString() },
      filters: [{ column: 'id', value: req.params.id }]
    })

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

    const existing = await query('users', 'select', {
      select: 'id, role',
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!existing) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (existing.role === 'admin') {
      return res.status(400).json({ message: 'Admin users do not have branch assignments' })
    }

    await query('users', 'update', {
      data: { branch_acronyms: normalized.join(','), updated_at: new Date().toISOString() },
      filters: [{ column: 'id', value: req.params.id }]
    })

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

    await query('users', 'update', {
      data: { status, updated_at: new Date().toISOString() },
      filters: [{ column: 'id', value: req.params.id }]
    })

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

    const target = await query('users', 'select', {
      select: 'id, username, fullname, role',
      filters: [{ column: 'id', value: targetId }],
      single: true
    })

    if (!target) {
      return res.status(404).json({ message: 'User not found' })
    }

    await query('users', 'delete', {
      filters: [{ column: 'id', value: targetId }]
    })

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