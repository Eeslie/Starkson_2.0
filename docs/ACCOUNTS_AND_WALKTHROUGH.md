# STARKSON Accounts & Step-by-Step Walkthroughs

## 📋 Account Types Overview

STARKSON has **4 user roles** (RBAC - Role-Based Access Control):

### 1. **User** (End User)
- **Default role** for new registrations
- **Purpose**: Submit IT support requests
- **Access**: Own tickets only
- **Can**: Create tickets, view own tickets, add public comments
- **Cannot**: See other users' tickets, see internal notes, change ticket status

### 2. **IT Support** (IT Staff)
- **Purpose**: Manage and resolve IT support tickets
- **Access**: Assigned tickets + unassigned tickets
- **Can**: Manage tickets, assign tickets, add internal notes, convert tickets to incidents
- **Cannot**: Create tickets, access incidents (except conversion), access admin panel

### 3. **Security Officer** (Security Personnel)
- **Purpose**: Manage cybersecurity incidents
- **Access**: All incidents, all tickets (read-only for context)
- **Can**: Manage incidents, create incidents, view tickets for context
- **Cannot**: Create tickets, manage tickets, access IT Console, access admin panel

### 4. **Admin** (System Administrator)
- **Purpose**: Full system administration
- **Access**: Everything
- **Can**: All features, user management, SLA configuration, audit logs
- **Cannot**: Nothing (full access)

---

## 🔐 Account Creation

### How Accounts Are Created

1. **Registration** (Default: User role)
   - Users can register via `/api/auth/register`
   - Default role is `user`
   - Requires: email, password, name

2. **Admin Creation** (Admin only)
   - Admins can create accounts via User Management
   - Can assign any role during creation

3. **Role Assignment** (Admin only)
   - Admins can change user roles via Admin Panel → User Management

### Account Information
- **Email**: Unique identifier (login username)
- **Password**: Hashed with bcrypt
- **Name**: Display name
- **Role**: One of the 4 roles above
- **Status**: Active or Inactive

---

## 📖 Step-by-Step Walkthrough Scenarios

---

## 👤 SCENARIO 1: USER ROLE - Submitting an IT Support Ticket

### Character: Sarah Johnson
**Role**: User (End User)  
**Situation**: Sarah needs help installing Microsoft Office on her laptop

### Step-by-Step Walkthrough

#### Step 1: Access the System
1. Open web browser
2. Navigate to `http://localhost:3000` (or your STARKSON URL)
3. You see the login page

#### Step 2: Login
1. Enter email: `sarah.johnson@company.com`
2. Enter password: `********`
3. Click **"Login"** button
4. System redirects to Dashboard

#### Step 3: View Dashboard
**What Sarah sees:**
- **Total Tickets**: 3 (her previous tickets)
- **Open Tickets**: 1 (one still open)
- **Resolved**: 2 (two resolved)

**Navigation bar shows:**
- STARKSON (logo)
- Dashboard
- Tickets
- Sarah Johnson (user)
- Logout

#### Step 4: Create New Ticket
1. Click **"Tickets"** in navigation bar
2. See list of her existing tickets
3. Click **"Create Ticket"** button (top right)

#### Step 5: Fill Ticket Form
**Form appears with fields:**

1. **Request Type*** (dropdown)
   - Select: **"Software Installation"**

2. **Title*** (text field)
   - Enter: `"Need Microsoft Office installed on laptop"`

3. **Description*** (textarea)
   - Enter: 
     ```
     I need Microsoft Office 365 installed on my Dell laptop. 
     My laptop model is Dell Latitude 5520.
     I have the license key ready.
     Please install Word, Excel, and PowerPoint.
     ```

4. **Affected System** (text field)
   - Enter: `"Dell Latitude 5520 - Windows 11"`

5. **Priority*** (dropdown)
   - Select: **"Medium"**

6. **Category** (text field, optional)
   - Enter: `"Software Request"`

#### Step 6: Submit Ticket
1. Review all information
2. Click **"Create Ticket"** button
3. System creates ticket and redirects to ticket details page

#### Step 7: View Created Ticket
**What Sarah sees:**
- **Ticket Number**: TKT-2024-000123 (auto-generated)
- **Status**: New (badge shows "new")
- **Priority**: Medium
- **Request Type**: Software Installation
- **Description**: Her full description
- **SLA Due**: Date/time calculated based on priority

**Actions available:**
- ✅ View ticket details
- ✅ Add comment (public)
- ❌ Cannot change status
- ❌ Cannot see internal notes (if any)

#### Step 8: Add Comment (Optional)
1. Scroll to "Comments" section
2. Type in comment box: `"I'm available for installation tomorrow morning"`
3. Click **"Add Comment"**
4. Comment appears in the list

#### Step 9: Check Ticket Status Later
1. Navigate to **Tickets** page
2. See ticket in list with status "Assigned" (IT Support picked it up)
3. Click on ticket number to view updates
4. See IT Support's comment: `"I'll install Office tomorrow at 10 AM"`
5. Ticket status changed to "In Progress"

#### Step 10: Ticket Resolution
1. Later, check ticket again
2. Status shows "Resolved"
3. IT Support comment: `"Office installed successfully. Please test and confirm."`
4. After testing, ticket status changes to "Closed"
5. Sarah can view closed ticket for reference

---

## 🛠️ SCENARIO 2: IT SUPPORT ROLE - Managing Tickets

### Character: Mike Chen
**Role**: IT Support  
**Situation**: Mike needs to manage his ticket queue and resolve user issues

### Step-by-Step Walkthrough

#### Step 1: Login
1. Navigate to STARKSON
2. Login with: `mike.chen@company.com` / `********`
3. Redirected to Dashboard

#### Step 2: View IT Console
1. Click **"IT Console"** in navigation bar
2. **What Mike sees:**
   - **Assigned Tickets**: 5 (tickets assigned to him)
   - **Pending Tickets**: 3 (unassigned new tickets)
   - **Resolved Today**: 2 (tickets he closed today)

#### Step 3: View Unassigned Tickets
1. Click **"Unassigned Tickets"** quick action
2. Or go to **Tickets** page
3. See list of tickets with status "new" and no assigned technician

#### Step 4: Assign Ticket to Self
1. Click on a ticket: **"TKT-2024-000123 - Need Microsoft Office installed"**
2. Ticket details page opens
3. In "Details" sidebar, see:
   - Status: **New**
   - Assigned To: **Unassigned**
   - Priority: **Medium**
   - Created By: **Sarah Johnson**

4. Click status dropdown
5. Select **"Assigned"**
6. System automatically assigns ticket to Mike
7. Status updates to "Assigned"
8. Assigned To shows "Mike Chen"

#### Step 5: Add Internal Note
1. Scroll to "Comments" section
2. Type: `"User has license key ready. Laptop is Dell Latitude 5520. Schedule installation for tomorrow."`
3. Check **"Internal note (not visible to user)"** checkbox
4. Click **"Add Comment"**
5. Comment appears with 🔒 icon (internal note)

#### Step 6: Update Ticket Status
1. After reviewing, change status to **"In Progress"**
2. Status updates immediately
3. User (Sarah) can see status change but not internal note

#### Step 7: Communicate with User
1. Add public comment: `"I'll install Office tomorrow at 10 AM. Please have your laptop ready."`
2. User receives notification
3. User can see this comment

#### Step 8: Complete Work
1. After installation, add comment: `"Office installed successfully. Please test and confirm."`
2. Change status to **"Resolved"**
3. Wait for user confirmation

#### Step 9: Close Ticket
1. User confirms everything works
2. Change status to **"Closed"**
3. Ticket is now closed
4. Appears in "Resolved Today" count

#### Step 10: Convert Ticket to Incident (Security Issue)
**Scenario**: User reports suspicious email

1. User creates ticket: "Received suspicious email asking for password"
2. Mike opens ticket details
3. Recognizes this is a security issue
4. Clicks **"Convert to Incident"** button (red button, top right)
5. Modal appears:
   - **Incident Category**: Select "Phishing"
   - **Severity**: Select "High"
   - **Description**: "User received phishing email attempting credential theft"
6. Click **"Convert"**
7. System creates incident
8. Original ticket status changes to "Closed"
9. Incident is created and linked to ticket
10. Security Officer is notified

---

## 🔒 SCENARIO 3: SECURITY OFFICER ROLE - Managing Cybersecurity Incidents

### Character: Alex Rodriguez
**Role**: Security Officer  
**Situation**: Alex needs to investigate and manage a security incident

### Step-by-Step Walkthrough

#### Step 1: Login
1. Navigate to STARKSON
2. Login with: `alex.rodriguez@company.com` / `********`
3. Redirected to Dashboard

#### Step 2: View Dashboard
**What Alex sees:**
- **Total Tickets**: 45 (all tickets for context)
- **Incidents**: 3 (active incidents)
- **Open Tickets**: 12
- **Resolved Tickets**: 33

#### Step 3: View Incidents
1. Click **"Incidents"** in navigation bar
2. See list of all cybersecurity incidents
3. **What Alex sees:**
   - Incident numbers (INC-2024-000001, etc.)
   - Categories (Phishing, Malware, etc.)
   - Severity badges (Low, Medium, High, Critical)
   - Status (New, Triaged, Investigating, etc.)

#### Step 4: Filter Incidents
1. Use filters at top:
   - **Status**: Select "New"
   - **Severity**: Select "High"
   - **Category**: Select "Phishing"
2. List filters to show only matching incidents

#### Step 5: Open Incident
1. Click on incident: **"INC-2024-000005 - Phishing Email Campaign"**
2. Incident details page opens

#### Step 6: Review Incident Information
**What Alex sees:**
- **Incident Number**: INC-2024-000005
- **Category**: Phishing
- **Severity**: High
- **Status**: New
- **Source Ticket**: TKT-2024-000123 (linked ticket)
- **Description**: Full incident description
- **Impact (CIA)**: Confidentiality: Medium, Integrity: Low, Availability: None

#### Step 7: Triage Incident
1. Review all information
2. Change status dropdown to **"Triaged"**
3. Status updates
4. System records triaged timestamp

#### Step 8: Add Timeline Entry
1. Scroll to "Timeline" section
2. Fill timeline form:
   - **Action**: `"Investigation started"`
   - **Description**: `"Initial analysis shows phishing email from external domain. Email headers analyzed."`
3. Click **"Add Timeline Entry"**
4. Entry appears in timeline

#### Step 9: Upload Evidence
1. Scroll to "Evidence Attachments" section
2. Click upload button (if implemented)
3. Upload screenshot of phishing email
4. Upload email headers file
5. Attachments appear in list

#### Step 10: Continue Investigation
1. Add more timeline entries:
   - Action: `"Email analysis complete"`
   - Description: `"Confirmed phishing attempt. Email contains malicious link. No credentials compromised."`
2. Update status to **"Investigating"**

#### Step 11: Contain Threat
1. After confirming threat is contained:
2. Change status to **"Contained"**
3. Add timeline entry: `"Threat contained. Email blocked. Users notified."`
4. System records contained timestamp

#### Step 12: Document Root Cause
1. Scroll to "Investigation" section
2. Click **"Add Root Cause"** button
3. Enter:
   ```
   Phishing email bypassed spam filter due to legitimate-looking sender domain.
   User correctly identified and reported email without clicking links.
   Email filtering rules updated to catch similar patterns.
   ```
4. Root cause is saved

#### Step 13: Document Resolution
1. Click **"Add Resolution"** button
2. Enter:
   ```
   Incident resolved. No data breach occurred. User training completed.
   Email filtering enhanced. Security awareness reminder sent to all staff.
   ```
3. Change status to **"Closed"**
4. System records closed timestamp

#### Step 14: View Source Ticket (Context)
1. Click on source ticket number: **TKT-2024-000123**
2. View original ticket for context
3. Can see user's original report
4. Read-only access (cannot edit ticket)

#### Step 15: Create New Incident (Manual)
**Scenario**: Security Officer discovers security issue directly

1. Go to **Incidents** page
2. Click **"Create Incident"** button
3. Fill incident form:
   - **Detection Method**: "it_found"
   - **Category**: "Unauthorized Access"
   - **Title**: "Suspicious login attempts detected"
   - **Description**: "Multiple failed login attempts from unknown IP addresses"
   - **Severity**: "High"
   - **Impact Confidentiality**: "High"
   - **Impact Integrity**: "Medium"
   - **Impact Availability**: "Low"
   - **Affected Asset**: "User authentication system"
4. Click **"Create Incident"**
5. Incident is created with status "New"
6. Follow same workflow to investigate and resolve

---

## 👑 SCENARIO 4: ADMIN ROLE - System Administration

### Character: Jennifer Smith
**Role**: Admin  
**Situation**: Jennifer needs to manage users, configure SLA, and review audit logs

### Step-by-Step Walkthrough

#### Step 1: Login
1. Navigate to STARKSON
2. Login with: `jennifer.smith@company.com` / `********`
3. Redirected to Dashboard

#### Step 2: View Admin Panel
1. Click **"Admin"** in navigation bar
2. **What Jennifer sees:**
   - **Total Users**: 150
   - **Total Tickets**: 1,234
   - **Total Incidents**: 45
   - **System Health**: operational

#### Step 3: User Management
1. Click **"User Management"** card
2. See list of all users with:
   - Name, Email, Role, Status
3. **Actions available:**
   - View user details
   - Change user role
   - Activate/Deactivate user

**Example: Promote User to IT Support**
1. Find user: "Mike Chen"
2. Current role: "user"
3. Click "Edit" or "Change Role"
4. Select new role: "it_support"
5. Click "Save"
6. User role updated
7. Audit log entry created

**Example: Create New User**
1. Click "Create User" button
2. Fill form:
   - Email: `newuser@company.com`
   - Name: `John Doe`
   - Password: `********`
   - Role: `user` (or select other role)
3. Click "Create"
4. User account created

#### Step 4: SLA Configuration
1. Click **"SLA Configuration"** card
2. See SLA settings by priority:
   - **Low**: Response 480 min, Resolution 72 hours
   - **Medium**: Response 240 min, Resolution 48 hours
   - **High**: Response 120 min, Resolution 24 hours
   - **Urgent**: Response 60 min, Resolution 8 hours

**Update SLA:**
1. Click "Edit" on "High" priority
2. Change Response Time: 90 minutes (was 120)
3. Change Resolution Time: 20 hours (was 24)
4. Click "Save"
5. SLA updated
6. New tickets use updated SLA

#### Step 5: View Audit Logs
1. Click **"Audit Logs"** card
2. See comprehensive audit trail:
   - **Action**: CREATE_TICKET, UPDATE_TICKET, etc.
   - **User**: Who performed action
   - **Resource Type**: ticket, incident, user, etc.
   - **Resource ID**: Which record
   - **Timestamp**: When it happened
   - **Details**: Additional information (JSON)

**Filter Audit Logs:**
1. Use filters:
   - **User**: Select specific user
   - **Action**: Select action type
   - **Date Range**: Select date range
2. View filtered results
3. Export to CSV/PDF (if implemented)

#### Step 6: Manage Tickets (Full Access)
1. Click **"Tickets"** in navigation
2. See ALL tickets in system (not just assigned)
3. Can:
   - View any ticket
   - Edit any ticket
   - Assign to any IT Support staff
   - Change status
   - Add comments
   - Convert to incidents

#### Step 7: Manage Incidents (Full Access)
1. Click **"Incidents"** in navigation
2. See ALL incidents in system
3. Can:
   - View any incident
   - Edit any incident
   - Change status
   - Add timeline entries
   - Document root cause and resolution

#### Step 8: System Monitoring
1. Go to **Dashboard**
2. Monitor system-wide statistics:
   - Total tickets and incidents
   - Open vs resolved
   - System health status
3. Identify trends and issues

#### Step 9: Generate Reports
1. Access reporting features (if implemented)
2. Generate reports:
   - Ticket volume by type
   - Resolution times
   - Incident counts by category
   - SLA compliance
   - User activity
3. Export to PDF/Excel

---

## 🔄 Cross-Role Scenarios

### Scenario: Ticket to Incident Conversion Flow

1. **User** (Sarah) creates ticket: "Received suspicious email"
2. **IT Support** (Mike) reviews ticket, recognizes security issue
3. **IT Support** converts ticket to incident
4. **Security Officer** (Alex) receives notification
5. **Security Officer** investigates incident
6. **Security Officer** documents and closes incident
7. **Admin** (Jennifer) reviews audit logs to see full flow

### Scenario: Escalation Flow

1. **User** creates urgent ticket
2. **IT Support** works on ticket but needs security review
3. **IT Support** adds internal note: "Needs security review"
4. **IT Support** converts to incident
5. **Security Officer** takes over investigation
6. **Admin** monitors via audit logs

---

## 📊 Account Summary Table

| Account Type | Login Access | Primary Function | Key Pages |
|--------------|--------------|------------------|-----------|
| **User** | ✅ | Submit tickets | Dashboard, Tickets, Create Ticket |
| **IT Support** | ✅ | Manage tickets | Dashboard, Tickets, IT Console |
| **Security Officer** | ✅ | Manage incidents | Dashboard, Incidents |
| **Admin** | ✅ | System admin | All pages + Admin Panel |

---

## 🎯 Quick Start Guide by Role

### New User Account
1. Register or get account from admin
2. Login
3. Go to Tickets → Create Ticket
4. Submit your first request

### New IT Support Account
1. Admin creates account with `it_support` role
2. Login
3. Go to IT Console
4. View pending tickets
5. Assign tickets to yourself
6. Start resolving

### New Security Officer Account
1. Admin creates account with `security_officer` role
2. Login
3. Go to Incidents
4. Review active incidents
5. Start investigations

### New Admin Account
1. Create account with `admin` role (or promote existing)
2. Login
3. Go to Admin Panel
4. Configure system settings
5. Manage users

---

For detailed navigation information, see [NAVIGATION_GUIDE.md](./NAVIGATION_GUIDE.md)
