# STARKSON Accounts Quick Reference

## 🔐 Account Types

### 1. User (End User)
- **Default Role**: Yes (for new registrations)
- **Email Format**: `user@company.com`
- **Password**: Set during registration
- **Primary Use**: Submit IT support requests
- **Access Level**: Limited (own tickets only)

### 2. IT Support (IT Staff)
- **Default Role**: No (must be assigned by admin)
- **Email Format**: `itstaff@company.com`
- **Password**: Set by admin or user
- **Primary Use**: Manage and resolve tickets
- **Access Level**: Medium (assigned + unassigned tickets)

### 3. Security Officer (Security Personnel)
- **Default Role**: No (must be assigned by admin)
- **Email Format**: `security@company.com`
- **Password**: Set by admin or user
- **Primary Use**: Manage cybersecurity incidents
- **Access Level**: Medium-High (all incidents, read-only tickets)

### 4. Admin (System Administrator)
- **Default Role**: No (must be assigned by admin)
- **Email Format**: `admin@company.com`
- **Password**: Set by admin or user
- **Primary Use**: Full system administration
- **Access Level**: Full (everything)

---

## 📝 Account Creation Methods

### Method 1: User Registration
```
POST /api/auth/register
{
  "email": "user@company.com",
  "password": "password123",
  "name": "John Doe",
  "role": "user"  // Optional, defaults to "user"
}
```
**Result**: Account created with "user" role

### Method 2: Admin Creates Account
- Admin goes to Admin Panel → User Management
- Clicks "Create User"
- Fills form with any role
- Account created immediately

### Method 3: Admin Changes Role
- Admin goes to Admin Panel → User Management
- Finds existing user
- Changes role from dropdown
- Saves changes

---

## 🔑 Login Credentials Format

### Standard Format
- **Email**: Unique identifier (used as username)
- **Password**: Minimum requirements (check system settings)
- **Name**: Display name (shown in navigation)

### Example Accounts (for testing)

**User Account:**
```
Email: sarah.johnson@company.com
Password: Password123!
Name: Sarah Johnson
Role: user
```

**IT Support Account:**
```
Email: mike.chen@company.com
Password: Password123!
Name: Mike Chen
Role: it_support
```

**Security Officer Account:**
```
Email: alex.rodriguez@company.com
Password: Password123!
Name: Alex Rodriguez
Role: security_officer
```

**Admin Account:**
```
Email: jennifer.smith@company.com
Password: Password123!
Name: Jennifer Smith
Role: admin
```

---

## 🎯 What Each Account Can Do

### User Account
✅ Create tickets  
✅ View own tickets  
✅ Add public comments  
✅ View ticket status  
❌ See other users' tickets  
❌ See internal notes  
❌ Change ticket status  
❌ Access incidents  
❌ Access admin features  

### IT Support Account
✅ View assigned tickets  
✅ View unassigned tickets  
✅ Assign tickets  
✅ Update ticket status  
✅ Add internal notes  
✅ Convert tickets to incidents  
✅ Access IT Console  
❌ Create tickets  
❌ Access incidents (except conversion)  
❌ Access admin features  

### Security Officer Account
✅ View all incidents  
✅ Create incidents  
✅ Manage incidents  
✅ Add timeline entries  
✅ Document root cause  
✅ View tickets (read-only)  
❌ Create tickets  
❌ Manage tickets  
❌ Access IT Console  
❌ Access admin features  

### Admin Account
✅ Everything  
✅ User management  
✅ Role assignment  
✅ SLA configuration  
✅ Audit log access  
✅ System configuration  
✅ All tickets and incidents  
❌ Nothing restricted  

---

## 🔄 Account Status

### Active
- Account can login
- Full access based on role
- Default status for new accounts

### Inactive
- Account cannot login
- Set by admin
- Used for temporary suspensions

---

## 📊 Account Statistics

### Typical Organization Distribution
- **Users**: 80-90% of accounts
- **IT Support**: 5-10% of accounts
- **Security Officer**: 1-3% of accounts
- **Admin**: 1-2% of accounts

### Example (100 employees)
- 85 Users
- 10 IT Support
- 3 Security Officers
- 2 Admins

---

## 🛡️ Security Notes

1. **Passwords**: Stored as bcrypt hashes (never plain text)
2. **Roles**: Cannot be changed by users (admin only)
3. **Audit Trail**: All role changes are logged
4. **Session**: JWT tokens expire after 7 days (configurable)
5. **Access Control**: Enforced at both frontend and backend

---

## 🚨 Common Account Issues

### "I can't login"
- Check email and password
- Verify account is active (contact admin)
- Check if account exists

### "I can't see a page"
- Verify your role has access
- Contact admin to check role assignment
- Check navigation bar for available links

### "I need different permissions"
- Contact system administrator
- Admin can change your role
- Role change is logged in audit trail

### "I forgot my password"
- Contact system administrator
- Admin can reset password
- Password reset feature (if implemented)

---

## 📞 Account Management Contacts

- **Role Changes**: Contact System Administrator
- **Account Creation**: Contact System Administrator
- **Password Reset**: Contact System Administrator
- **Access Issues**: Contact System Administrator

---

For detailed walkthroughs, see [ACCOUNTS_AND_WALKTHROUGH.md](./ACCOUNTS_AND_WALKTHROUGH.md)
