/**
 * Script to create test users for all roles
 * Run this to create sample accounts for testing
 * 
 * Usage: node scripts/create-test-users.js
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { query } = require('../config/database')

const testUsers = [
  {
    fullname: 'Sarah Johnson',
    username: 'sarah.johnson',
    password: 'Password123!',
    role: 'user'
  },
  {
    fullname: 'Mike Chen',
    username: 'mike.chen',
    password: 'Password123!',
    role: 'it_support'
  },
  {
    fullname: 'Alex Rodriguez',
    username: 'alex.rodriguez',
    password: 'Password123!',
    role: 'security_officer'
  },
  {
    fullname: 'Jennifer Smith',
    username: 'jennifer.smith',
    password: 'Password123!',
    role: 'admin'
  }
]

async function createTestUsers() {
  try {
    console.log('=== STARKSON Test Users Creator ===\n')

    for (const user of testUsers) {
      const normalizedUsername = user.username.trim().toLowerCase()
      // Check if user exists
      const existing = await query('users', 'select', {
        filters: [{ column: 'username', value: normalizedUsername }],
        single: true
      })

      if (existing) {
        console.log(`⏭️  User ${normalizedUsername} already exists, skipping...`)
        continue
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10)

      // Create user
      const result = await query('users', 'insert', {
        data: {
          username: normalizedUsername,
          password: hashedPassword,
          fullname: user.fullname.trim(),
          role: user.role,
          status: 'active'
        }
      })

      console.log(`✅ Created ${user.role}: ${user.fullname} (${normalizedUsername})`)
    }

    console.log('\n✅ All test users created successfully!')
    console.log('\nTest Accounts:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    testUsers.forEach(user => {
      console.log(`\n${user.role.toUpperCase()}`)
      console.log(`  Username: ${user.username}`)
      console.log(`  Password: ${user.password}`)
      console.log(`  Full Name: ${user.fullname}`)
    })
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\nYou can now login with any of these accounts.')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating test users:', error.message)
    process.exit(1)
  }
}

createTestUsers()
