const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { getValidAcronyms } = require('../lib/branches')

/**
 * IMPORTANT CHANGE:
 * - Username normalization is now UPPERCASE (not lowercase).
 * - This means:
 *   - If admin creates "JulieAbaca", it will be stored as "JULIEABACA".
 *   - On login, any casing the user types will be converted to uppercase,
 *     so "julieabaca" or "JULIEABACA" both match the stored username.
 * - Displayed username will be uppercase, not small caps.
 */

// Register (admin only). Only one admin is allowed in the system.
router.post('/register', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, password, fullname, role = 'user', branchAcronyms = [] } = req.body

    const rawBranches = Array.isArray(branchAcronyms)
      ? branchAcronyms
      : typeof branchAcronyms === 'string'
        ? branchAcronyms.split(',').map(s => s.trim()).filter(Boolean)
        : []

    // Validate role
    if (!['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    // Only one admin allowed
    if (role === 'admin') {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')

      if (count >= 1) {
        return res.status(400).json({ message: 'Only one admin is allowed. An admin already exists.' })
      }
    }

    // Non-admin roles must have at least one branch
    const validAcronyms = await getValidAcronyms()
    const normalizedBranches = rawBranches
      .filter(a => typeof a === 'string' && a.trim() && validAcronyms.has(a.trim()))
      .map(a => a.trim())

    if (!['admin'].includes(role) && normalizedBranches.length === 0) {
      return res.status(400).json({ message: 'Please assign at least one branch for this role.' })
    }

    // Username normalization: UPPERCASE
    const normalizedUsername = typeof username === 'string' ? username.trim().toUpperCase() : ''
    if (!normalizedUsername) {
      return res.status(400).json({ message: 'Username is required' })
    }

    // Check if username exists
    const existing = await query('users', 'select', {
      filters: [{ column: 'username', value: normalizedUsername }],
      single: true
    })

    if (existing) {
      return res.status(400).json({ message: 'Username already taken' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user (admin has no branch_acronyms). Use Supabase directly so array column is stored.
    const branchAcronymsForDb = role === 'admin' ? [] : normalizedBranches
    const insertPayload = {
      username: normalizedUsername,
      password: hashedPassword,
      fullname: typeof fullname === 'string' ? fullname.trim() : '',
      role,
      status: 'active',
      branch_acronyms: branchAcronymsForDb
    }

    const { data: result, error: insertError } = await supabase
      .from('users')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError) {
      console.error('Register insert error:', insertError.message, insertError.details)
      return res.status(500).json({ message: insertError.message || 'Failed to create user' })
    }

    if (!result) {
      return res.status(500).json({ message: 'User created but could not read back record' })
    }

    let storedBranchAcronyms = Array.isArray(result.branch_acronyms) ? result.branch_acronyms : []
    if (branchAcronymsForDb.length > 0 && storedBranchAcronyms.length === 0) {
      const { data: updated, error: updateErr } = await supabase
        .from('users')
        .update({ branch_acronyms: branchAcronymsForDb })
        .eq('id', result.id)
        .select('branch_acronyms')
        .single()

      if (!updateErr && updated) {
        storedBranchAcronyms = Array.isArray(updated.branch_acronyms) ? updated.branch_acronyms : branchAcronymsForDb
      }
      if (storedBranchAcronyms.length === 0) {
        console.warn('Register: branch_acronyms could not be stored. Run migration_branches.sql and check RLS.')
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      userId: result.id,
      branchAcronyms: storedBranchAcronyms
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Login (fetch user with branch_acronyms from DB)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // Username normalization: UPPERCASE (accepts any casing input, stores/uses ALL CAPS)
    const normalizedUsername = typeof username === 'string' ? username.trim().toUpperCase() : ''

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', normalizedUsername)
      .maybeSingle()

    if (userError || !user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Verify password (case-sensitive as usual)
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    const branchAcronyms = Array.isArray(user.branch_acronyms) ? user.branch_acronyms : []
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username, // will be ALL CAPS
        fullname: user.fullname,
        role: user.role,
        branchAcronyms
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get current user (fresh from DB so branch_acronyms is always current)
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, fullname, role, branch_acronyms')
      .eq('id', req.user.id)
      .single()

    if (error || !user) return res.status(404).json({ message: 'User not found' })

    const branchAcronyms = Array.isArray(user.branch_acronyms) ? user.branch_acronyms : []
    res.json({
      id: user.id,
      username: user.username, // will be ALL CAPS
      fullname: user.fullname,
      role: user.role,
      branchAcronyms
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reset password
router.post('/reset-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }

    // Get user with password
    const user = await query('users', 'select', {
      filters: [{ column: 'id', value: req.user.id }],
      single: true
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await query('users', 'update', {
      filters: [{ column: 'id', value: req.user.id }],
      data: {
        password: hashedPassword,
        updated_at: new Date().toISOString()
      }
    })

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'RESET_PASSWORD',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.user.id,
        details: { message: 'User reset their password' }
      }
    })

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

module.exports = router
