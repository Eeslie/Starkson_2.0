const { query } = require('../config/database')
const dotenv = require('dotenv')

dotenv.config()

async function checkUsers() {
  try {
    console.log('🔍 Checking for IT Support users...\n')
    
    // Check IT Support users
    const itSupportUsers = await query('users', 'select', {
      select: 'id, fullname, username, role, status',
      filters: [{ column: 'role', value: 'it_support' }]
    })
    
    console.log(`📊 IT Support Users: ${itSupportUsers?.length || 0}`)
    if (itSupportUsers && itSupportUsers.length > 0) {
      console.log('\nActive IT Support Users:')
      itSupportUsers.forEach(user => {
        const statusIcon = user.status === 'active' ? '✅' : '❌'
        console.log(`  ${statusIcon} ${user.fullname} (${user.username}) - Status: ${user.status}`)
      })
    } else {
      console.log('⚠️  No IT Support users found!')
    }
    
    console.log('\n🔍 Checking for Security Officers...\n')
    
    // Check Security Officers
    const securityOfficers = await query('users', 'select', {
      select: 'id, fullname, username, role, status',
      filters: [{ column: 'role', value: 'security_officer' }]
    })
    
    console.log(`📊 Security Officers: ${securityOfficers?.length || 0}`)
    if (securityOfficers && securityOfficers.length > 0) {
      console.log('\nActive Security Officers:')
      securityOfficers.forEach(user => {
        const statusIcon = user.status === 'active' ? '✅' : '❌'
        console.log(`  ${statusIcon} ${user.fullname} (${user.username}) - Status: ${user.status}`)
      })
    } else {
      console.log('⚠️  No Security Officers found!')
    }
    
    console.log('\n📋 Summary:')
    const activeITSupport = itSupportUsers?.filter(u => u.status === 'active').length || 0
    const activeSecurityOfficers = securityOfficers?.filter(u => u.status === 'active').length || 0
    
    if (activeITSupport === 0) {
      console.error('❌ No active IT Support users found!')
      console.error('💡 Run: node backend/scripts/create-test-users.js to create test users')
    } else {
      console.log(`✅ ${activeITSupport} active IT Support user(s) found`)
    }
    
    if (activeSecurityOfficers === 0) {
      console.error('❌ No active Security Officers found!')
      console.error('💡 Run: node backend/scripts/create-test-users.js to create test users')
    } else {
      console.log(`✅ ${activeSecurityOfficers} active Security Officer(s) found`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
  process.exit(0)
}

checkUsers()
