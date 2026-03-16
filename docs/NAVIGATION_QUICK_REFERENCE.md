# STARKSON Navigation Quick Reference

## 🗺️ Navigation Map by Role

### 👤 USER
```
Login → Dashboard → Tickets → Create Ticket / View Ticket Details
```

**Available Pages:**
- ✅ `/dashboard` - Personal stats
- ✅ `/tickets` - My tickets list
- ✅ `/tickets/create` - Create new ticket
- ✅ `/tickets/[id]` - View my ticket details

**Navbar Items:**
- Dashboard
- Tickets
- [Your Name] (user)
- Logout

---

### 🛠️ IT SUPPORT
```
Login → Dashboard → Tickets / IT Console → Ticket Details → Convert to Incident
```

**Available Pages:**
- ✅ `/dashboard` - All tickets stats
- ✅ `/tickets` - Assigned & unassigned tickets
- ✅ `/staff` - IT Support console
- ✅ `/tickets/[id]` - Manage ticket (all tickets)

**Navbar Items:**
- Dashboard
- Tickets
- IT Console
- [Your Name] (it_support)
- Logout

---

### 🔒 SECURITY OFFICER
```
Login → Dashboard → Incidents → Incident Details → Timeline / Evidence
```

**Available Pages:**
- ✅ `/dashboard` - Tickets & incidents stats
- ✅ `/incidents` - All incidents list
- ✅ `/incidents/[id]` - Manage incident details
- ✅ `/tickets` - View tickets (read-only, for context)

**Navbar Items:**
- Dashboard
- Incidents
- [Your Name] (security_officer)
- Logout

---

### 👑 ADMIN
```
Login → Dashboard → Any Page → Admin Panel → User Management / SLA / Audit
```

**Available Pages:**
- ✅ `/dashboard` - System-wide stats
- ✅ `/tickets` - All tickets (full access)
- ✅ `/staff` - IT Support console
- ✅ `/incidents` - All incidents (full access)
- ✅ `/admin` - Admin panel
- ✅ `/admin/users` - User management
- ✅ `/admin/sla` - SLA configuration
- ✅ `/admin/audit` - Audit logs

**Navbar Items:**
- Dashboard
- Tickets
- IT Console
- Incidents
- Admin
- [Your Name] (admin)
- Logout

---

## 📊 Feature Access Matrix

| Page/Feature | User | IT Support | Security Officer | Admin |
|--------------|------|------------|------------------|-------|
| **Dashboard** | ✅ Own stats | ✅ All tickets | ✅ Tickets + Incidents | ✅ Everything |
| **Tickets List** | ✅ Own only | ✅ Assigned + Unassigned | ✅ All (read) | ✅ All (full) |
| **Create Ticket** | ✅ | ❌ | ❌ | ✅ |
| **Ticket Details** | ✅ Own only | ✅ All (edit) | ✅ All (read) | ✅ All (full) |
| **IT Console** | ❌ | ✅ | ❌ | ✅ |
| **Incidents List** | ❌ | ❌ | ✅ | ✅ |
| **Incident Details** | ❌ | ❌ | ✅ | ✅ |
| **Admin Panel** | ❌ | ❌ | ❌ | ✅ |
| **User Management** | ❌ | ❌ | ❌ | ✅ |
| **SLA Config** | ❌ | ❌ | ❌ | ✅ |
| **Audit Logs** | ❌ | ❌ | ❌ | ✅ |

---

## 🎯 Common Tasks by Role

### User Tasks
1. **Submit IT Support Request**
   - Go to Tickets → Create Ticket
   - Fill form → Submit

2. **Check Ticket Status**
   - Go to Tickets → Click ticket number
   - View status, comments, updates

3. **Add Comment to Ticket**
   - Open ticket details
   - Scroll to comments section
   - Type comment → Add Comment

---

### IT Support Tasks
1. **View New Tickets**
   - Go to IT Console
   - Check "Pending Tickets" count
   - Or go to Tickets → Filter by status

2. **Assign Ticket to Self**
   - Open ticket details
   - Update "Assigned To" field
   - Change status to "Assigned"

3. **Update Ticket Status**
   - Open ticket details
   - Use status dropdown
   - Select new status

4. **Add Internal Note**
   - Open ticket details
   - Scroll to comments
   - Check "Internal note" checkbox
   - Add comment

5. **Convert Ticket to Incident**
   - Open ticket details
   - Click "Convert to Incident" button
   - Fill incident details → Convert

---

### Security Officer Tasks
1. **View All Incidents**
   - Go to Incidents
   - Use filters (status, severity, category)

2. **Create New Incident**
   - Go to Incidents → Create Incident
   - Fill incident form → Submit

3. **Investigate Incident**
   - Open incident details
   - Add timeline entries
   - Upload evidence files
   - Update status as you progress

4. **Document Root Cause**
   - Open incident details
   - Click "Add Root Cause"
   - Enter analysis

5. **Close Incident**
   - Complete investigation
   - Add resolution summary
   - Change status to "Closed"

---

### Admin Tasks
1. **Manage Users**
   - Go to Admin → User Management
   - View all users
   - Change roles
   - Activate/deactivate

2. **Configure SLA**
   - Go to Admin → SLA Configuration
   - Set response/resolution times by priority

3. **View Audit Logs**
   - Go to Admin → Audit Logs
   - Filter by user, action, date
   - Export reports

4. **System Overview**
   - Go to Admin Panel
   - View system statistics
   - Monitor system health

---

## 🔐 Permission Levels

### Read-Only Access
- Security Officer viewing tickets (for context only)
- Users viewing own tickets (limited editing)

### Edit Access
- IT Support managing tickets
- Security Officer managing incidents
- Admin managing everything

### Full Access
- Admin only
- All features unlocked
- System configuration
- User management

---

## 🚨 Important Notes

1. **Ticket Conversion**
   - Only IT Support, Security Officer, and Admin can convert
   - Original ticket is preserved and linked
   - Cannot be undone

2. **Internal Notes**
   - Only visible to IT Support, Security Officer, and Admin
   - Users cannot see internal notes
   - Marked with 🔒 icon

3. **SLA Breaches**
   - Shown with ⚠️ indicator
   - Red text when deadline passed
   - Visible to IT Support and Admin

4. **Status Changes**
   - Users cannot change ticket status
   - IT Support can change ticket status
   - Security Officer can change incident status
   - Admin can change any status

---

## 📱 Mobile Navigation

On mobile devices:
- Navigation bar collapses to hamburger menu
- All features remain accessible
- Touch-optimized buttons
- Responsive tables and forms

---

## 🆘 Troubleshooting

**Can't see a page?**
- Check your role permissions
- Contact admin for role assignment

**Can't edit something?**
- Verify you have edit permissions for your role
- Some fields are read-only based on role

**Lost navigation?**
- Click the STARKSON logo to return to dashboard
- Use browser back button
- Check navbar for available links

---

For detailed information, see [NAVIGATION_GUIDE.md](./NAVIGATION_GUIDE.md)
