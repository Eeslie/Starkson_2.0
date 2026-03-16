# STARKSON Navigation Guide

## Overview
This guide explains how to navigate the STARKSON system based on your role. The system uses Role-Based Access Control (RBAC) to provide different views and capabilities to different user types.

## User Roles

1. **User** - End users who submit IT support tickets
2. **IT Support** - IT staff who manage and resolve tickets
3. **Security Officer** - Security personnel who manage cybersecurity incidents
4. **Admin** - System administrators with full access

---

## 🔐 Authentication

### Login Page (`/login`)
**Access**: All users (unauthenticated)

- Enter your email and password
- Click "Login" to authenticate
- You will be redirected to your role-specific dashboard after login

---

## 👤 USER ROLE

### Navigation Bar
- **STARKSON** (logo) - Returns to home
- **Dashboard** - Your personal dashboard
- **Tickets** - View and manage your tickets
- **Your Name (user)** - Display of current user
- **Logout** - Sign out of the system

### Dashboard (`/dashboard`)
**Access**: User

**What you see:**
- Total Tickets (your tickets only)
- Open Tickets (your open tickets)
- Resolved Tickets (your resolved tickets)

**Actions:**
- View statistics about your tickets
- Quick access to your ticket list

### Tickets (`/tickets`)
**Access**: User

**What you see:**
- List of all tickets you created
- Ticket number, type, title, status, priority
- SLA due dates with breach indicators

**Actions:**
- View your tickets in a table format
- Click on ticket number or title to view details
- Create new tickets (via "Create Ticket" button)

### Create Ticket (`/tickets/create`)
**Access**: User

**Form fields:**
- **Request Type*** (required)
  - Account & Password Issues
  - Software Installation
  - Hardware Problems
  - Network / Internet Issues
  - Access Requests
  - General IT Assistance
- **Title*** (required) - Brief description
- **Description*** (required) - Detailed information
- **Affected System** - Optional system/application name
- **Priority*** (required)
  - Low
  - Medium
  - High
  - Urgent
- **Category** - Optional category tag

**Actions:**
- Submit new IT support ticket
- Cancel and return to tickets list

### Ticket Details (`/tickets/[id]`)
**Access**: User (own tickets only)

**What you see:**
- Full ticket information
- Ticket number and status
- Description and details
- All public comments
- Attachments (if any)
- SLA due date

**Actions:**
- View ticket status and updates
- Add public comments
- View attachments
- See ticket history

**Restrictions:**
- Cannot see internal notes (staff-only)
- Cannot change ticket status
- Cannot convert tickets to incidents
- Can only update description of own tickets

---

## 🛠️ IT SUPPORT ROLE

### Navigation Bar
- **STARKSON** (logo) - Returns to home
- **Dashboard** - Personal dashboard
- **Tickets** - Manage all tickets
- **IT Console** - IT Support dashboard
- **Your Name (it_support)** - Display of current user
- **Logout** - Sign out

### Dashboard (`/dashboard`)
**Access**: IT Support

**What you see:**
- Total Tickets (all tickets)
- Open Tickets (all open tickets)
- Resolved Tickets (all resolved tickets)

### Tickets (`/tickets`)
**Access**: IT Support

**What you see:**
- All tickets assigned to you
- All unassigned tickets
- Ticket number, type, title, status, priority
- Assigned technician column
- SLA due dates with breach indicators

**Actions:**
- View assigned and unassigned tickets
- Click on tickets to view/edit details
- Cannot create new tickets (users only)

### IT Console (`/staff`)
**Access**: IT Support

**What you see:**
- **Assigned Tickets** - Tickets assigned to you
- **Pending Tickets** - Unassigned new tickets
- **Resolved Today** - Tickets you closed today

**Quick Actions:**
- View All Tickets - Go to tickets list
- Unassigned Tickets - Filter new tickets

**Purpose:**
- Central hub for IT support work
- Monitor workload and pending items

### Ticket Details (`/tickets/[id]`)
**Access**: IT Support (all tickets)

**What you see:**
- Full ticket information
- All comments (public and internal)
- Attachments
- Ticket assignment and status

**Actions:**
- **Update Status** - Change ticket status via dropdown
  - New → Assigned → In Progress → Waiting for User → Resolved → Closed
- **Assign Ticket** - Assign to yourself or other IT staff
- **Add Comments** - Public or internal notes
- **Convert to Incident** - Convert security-related tickets to incidents
- **View SLA** - Monitor SLA compliance
- **Update All Fields** - Modify title, description, priority, etc.

**Special Features:**
- Can see internal notes (marked with 🔒)
- Can create internal notes (not visible to users)
- Can convert tickets to security incidents

---

## 🔒 SECURITY OFFICER ROLE

### Navigation Bar
- **STARKSON** (logo) - Returns to home
- **Dashboard** - Personal dashboard
- **Incidents** - Manage cybersecurity incidents
- **Your Name (security_officer)** - Display of current user
- **Logout** - Sign out

### Dashboard (`/dashboard`)
**Access**: Security Officer

**What you see:**
- Total Tickets (all tickets)
- **Incidents** (all incidents)
- Open Tickets (all open tickets)
- Resolved Tickets (all resolved tickets)

### Incidents (`/incidents`)
**Access**: Security Officer

**What you see:**
- List of all cybersecurity incidents
- Incident number, category, title, severity, status
- Source ticket (if converted from ticket)
- Creation date

**Filters:**
- **Status**: New, Triaged, Investigating, Contained, Recovered, Closed
- **Severity**: Low, Medium, High, Critical
- **Category**: Phishing, Malware, Unauthorized Access, Data Exposure, Policy Violation, System Compromise

**Actions:**
- View all incidents
- Filter by status, severity, or category
- Click on incident to view details
- Create new incidents (via "Create Incident" button)

### Incident Details (`/incidents/[id]`)
**Access**: Security Officer

**What you see:**
- Full incident information
- Incident timeline (all entries)
- Evidence attachments
- Impact assessment (CIA)
- Root cause analysis
- Resolution summary

**Actions:**
- **Update Status** - Change incident status
  - New → Triaged → Investigating → Contained → Recovered → Closed
- **Add Timeline Entries** - Document investigation steps
- **Update Root Cause** - Document root cause analysis
- **Update Resolution** - Document resolution summary
- **Assign Incident** - Assign to security team members
- **Upload Evidence** - Attach files and screenshots
- **View Source Ticket** - If converted from ticket

**Status Workflow:**
- **New**: Initial incident creation
- **Triaged**: Initial assessment completed
- **Investigating**: Active investigation
- **Contained**: Threat neutralized
- **Recovered**: Systems restored
- **Closed**: Fully resolved and documented

---

## 👑 ADMIN ROLE

### Navigation Bar
- **STARKSON** (logo) - Returns to home
- **Dashboard** - System dashboard
- **Tickets** - Manage all tickets
- **IT Console** - IT Support dashboard
- **Incidents** - Manage all incidents
- **Admin** - Admin panel
- **Your Name (admin)** - Display of current user
- **Logout** - Sign out

### Dashboard (`/dashboard`)
**Access**: Admin

**What you see:**
- Total Tickets (all tickets)
- Incidents (all incidents)
- Open Tickets (all open tickets)
- Resolved Tickets (all resolved tickets)

### Tickets (`/tickets`)
**Access**: Admin

**What you see:**
- All tickets in the system
- Full access to view and manage any ticket

**Actions:**
- View all tickets
- Manage any ticket
- Create tickets (if needed)
- Full editing capabilities

### IT Console (`/staff`)
**Access**: Admin

**What you see:**
- IT Support statistics
- Assigned tickets
- Pending tickets
- Resolved today

### Incidents (`/incidents`)
**Access**: Admin

**What you see:**
- All incidents in the system
- Full access to view and manage any incident

**Actions:**
- View all incidents
- Manage any incident
- Create incidents
- Full editing capabilities

### Admin Panel (`/admin`)
**Access**: Admin only

**What you see:**
- **Total Users** - All system users
- **Total Tickets** - All tickets
- **Total Incidents** - All incidents
- **System Health** - System status

**Administration Sections:**
- **User Management** (`/admin/users`)
  - View all users
  - Manage user roles
  - Activate/deactivate users
  - Edit user information

- **SLA Configuration** (`/admin/sla`)
  - Configure response times by priority
  - Set resolution time targets
  - Update SLA rules

- **Audit Logs** (`/admin/audit`)
  - View all system activity
  - Filter by user, action, resource
  - Export audit reports
  - Immutable activity history

**Actions:**
- Full system administration
- User role management
- System configuration
- Audit log access
- Generate reports

---

## 🔄 Common Navigation Patterns

### For All Roles

1. **Home/Logo Click**
   - Returns to main dashboard

2. **Dashboard**
   - Role-specific statistics and overview
   - Quick access to key metrics

3. **Logout**
   - Clears session
   - Returns to login page

### Ticket Workflow (User & IT Support)

1. **Create Ticket** (User)
   - Fill out ticket form
   - Submit for IT review

2. **View Ticket** (User)
   - Check status updates
   - Add comments
   - View responses

3. **Manage Ticket** (IT Support)
   - Assign to technician
   - Update status
   - Add internal notes
   - Convert to incident if needed

### Incident Workflow (Security Officer)

1. **Create Incident**
   - Manual creation or from ticket conversion
   - Set category and severity

2. **Investigate**
   - Add timeline entries
   - Upload evidence
   - Document findings

3. **Resolve**
   - Document root cause
   - Write resolution summary
   - Close incident

---

## 🚫 Access Restrictions Summary

### User
- ❌ Cannot see other users' tickets
- ❌ Cannot see internal notes
- ❌ Cannot change ticket status
- ❌ Cannot access incidents
- ❌ Cannot access admin panel
- ✅ Can create tickets
- ✅ Can view own tickets
- ✅ Can add public comments

### IT Support
- ❌ Cannot access incidents (except conversion)
- ❌ Cannot access admin panel
- ✅ Can view assigned/unassigned tickets
- ✅ Can manage tickets
- ✅ Can convert tickets to incidents
- ✅ Can see internal notes

### Security Officer
- ❌ Cannot create tickets
- ❌ Cannot access IT Console
- ❌ Cannot access admin panel
- ✅ Can view all incidents
- ✅ Can manage incidents
- ✅ Can view all tickets (read-only for context)

### Admin
- ✅ Full access to all features
- ✅ User management
- ✅ System configuration
- ✅ Audit logs
- ✅ All tickets and incidents

---

## 📱 Responsive Design

The system is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile devices

Navigation adapts to screen size with:
- Collapsible menus on mobile
- Touch-friendly buttons
- Responsive tables and cards

---

## 🔍 Quick Reference

### URL Structure
- `/login` - Login page
- `/dashboard` - Role-specific dashboard
- `/tickets` - Ticket list
- `/tickets/create` - Create new ticket
- `/tickets/[id]` - Ticket details
- `/staff` - IT Support console
- `/incidents` - Incident list
- `/incidents/[id]` - Incident details
- `/admin` - Admin panel

### Keyboard Shortcuts
- None currently implemented (future enhancement)

### Help & Support
- Contact your system administrator for role changes
- Refer to this guide for navigation help
- Check system documentation for feature details

---

## 🎯 Role Comparison Table

| Feature | User | IT Support | Security Officer | Admin |
|---------|------|------------|------------------|-------|
| Create Tickets | ✅ | ❌ | ❌ | ✅ |
| View Own Tickets | ✅ | ✅ | ✅ | ✅ |
| View All Tickets | ❌ | ✅* | ✅ | ✅ |
| Manage Tickets | ❌ | ✅ | ❌ | ✅ |
| Convert to Incident | ❌ | ✅ | ✅ | ✅ |
| View Incidents | ❌ | ❌ | ✅ | ✅ |
| Manage Incidents | ❌ | ❌ | ✅ | ✅ |
| Internal Notes | ❌ | ✅ | ✅ | ✅ |
| User Management | ❌ | ❌ | ❌ | ✅ |
| SLA Configuration | ❌ | ❌ | ❌ | ✅ |
| Audit Logs | ❌ | ❌ | ❌ | ✅ |

*IT Support sees assigned and unassigned tickets only

---

## 📝 Notes

- All timestamps are displayed in your local timezone
- SLA breach indicators show ⚠️ when deadline is passed
- Internal notes are marked with 🔒 icon
- Status badges are color-coded for quick identification
- File attachments have size limits (check system settings)

For additional help, contact your system administrator.
