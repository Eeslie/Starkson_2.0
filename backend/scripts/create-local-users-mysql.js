const bcrypt = require('bcryptjs')
const { query } = require('../config/database')

async function main() {
  try {
    const password = 'Password123!' // shared for all 4 accounts
    const hashedPassword = await bcrypt.hash(password, 10)

    const users = [
      {
        username: 'ADMIN1',
        fullname: 'System Administrator',
        role: 'admin',
        branch_acronyms: ''
      },
      {
        username: 'ITSTAFF1',
        fullname: 'IT Support Staff',
        role: 'it_support',
        branch_acronyms: 'D01'
      },
      {
        username: 'SECOFF1',
        fullname: 'Security Officer',
        role: 'security_officer',
        branch_acronyms: 'D01'
      },
      {
        username: 'USER1',
        fullname: 'Regular User',
        role: 'user',
        branch_acronyms: 'D01'
      }
    ]

    for (const u of users) {
      const normalizedUsername = u.username.trim().toUpperCase()

      // delete any existing user with same username so we don't hit unique constraint
      await query('users', 'delete', {
        filters: [{ column: 'username', value: normalizedUsername }]
      })

      console.log(`Creating user ${normalizedUsername} (${u.role})`)

      await query('users', 'insert', {
        data: {
          username: normalizedUsername,
          password: hashedPassword,
          fullname: u.fullname,
          role: u.role,
          status: 'active',
          branch_acronyms: u.branch_acronyms
        }
      })
    }

    console.log('✅ Seed users created.')
    console.log('You can log in with e.g. ADMIN1 / Password123!')
  } catch (err) {
    console.error('❌ Error creating seed users:', err)
  } finally {
    process.exit(0)
  }
}

main()