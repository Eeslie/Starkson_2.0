/**
 * Script to create the first admin account
 * Run this after setting up the database
 * 
 * Usage: node scripts/create-admin.js
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { query } = require('../config/database')

async function createAdmin() {
  try {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const question = (prompt) => {
      return new Promise((resolve) => {
        readline.question(prompt, resolve)
      })
    }

    console.log('=== STARKSON Admin Account Creator ===\n')

    // Check if any admin exists
    const existingAdmins = await query('users', 'select', {
      filters: [{ column: 'role', value: 'admin' }]
    })

    if (existingAdmins.length > 0) {
      console.log('⚠️  Only one admin is allowed. An admin account already exists.')
      readline.close()
      process.exit(0)
    }

    const fullname = await question('Enter admin full name: ')
    const username = await question('Enter admin username: ')
    const password = await question('Enter admin password: ')

    if (!fullname || !username || !password) {
      console.log('❌ All fields are required!')
      readline.close()
      process.exit(1)
    }

    if (password.length < 6) {
      console.log('❌ Password must be at least 6 characters!')
      readline.close()
      process.exit(1)
    }

    const normalizedUsername = username.trim().toLowerCase()
    if (!normalizedUsername) {
      console.log('❌ Username cannot be empty!')
      readline.close()
      process.exit(1)
    }

    // Check if username already exists
    const existing = await query('users', 'select', {
      filters: [{ column: 'username', value: normalizedUsername }],
      single: true
    })

    if (existing) {
      console.log('❌ User with this username already exists!')
      readline.close()
      process.exit(1)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create admin user (only one admin; no branch assignment)
    const result = await query('users', 'insert', {
      data: {
        username: normalizedUsername,
        password: hashedPassword,
        fullname: fullname.trim(),
        role: 'admin',
        status: 'active',
        branch_acronyms: []
      }
    })

    console.log('\n✅ Admin account created successfully!')
    console.log(`   Full Name: ${fullname}`)
    console.log(`   Username: ${normalizedUsername}`)
    console.log(`   Role: admin`)
    console.log(`   User ID: ${result.id}`)
    console.log('\nYou can now login with these credentials.')

    readline.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating admin:', error.message)
    process.exit(1)
  }
}

createAdmin()
