# System Workflows

## IT Support Ticket Workflow

```
End User
   ↓
Submit Ticket
   ↓
New
   ↓
Assigned (by IT Support)
   ↓
In Progress
   ↓
Waiting for User (if needed)
   ↓
Resolved
   ↓
Closed
```

### Status Transitions
- **New**: Initial state when ticket is created
- **Assigned**: Ticket assigned to IT staff member
- **In Progress**: Work has begun on the ticket
- **Waiting for User**: Awaiting user response or action
- **Resolved**: Issue resolved, pending user confirmation
- **Closed**: Ticket fully closed

## Cybersecurity Incident Workflow

```
User / IT Staff / Security Officer
   ↓
Create Incident
   ↓
New
   ↓
Triaged (initial assessment)
   ↓
Investigating
   ↓
Contained (threat neutralized)
   ↓
Recovered (systems restored)
   ↓
Closed (post-incident review complete)
```

### Status Transitions
- **New**: Initial incident creation
- **Triaged**: Initial assessment completed
- **Investigating**: Active investigation in progress
- **Contained**: Threat has been contained
- **Recovered**: Systems and services restored
- **Closed**: Incident fully resolved and documented

## Ticket → Incident Conversion Workflow

```
IT Ticket (any status)
   ↓
Security suspicion identified
   ↓
IT Support / Security Officer converts
   ↓
Linked Security Incident created
   ↓
Original ticket preserved (read-only)
   ↓
Incident follows independent lifecycle
   ↓
Full audit trail maintained
```

### Conversion Rules
- Only IT Support, Security Officer, and Admin can convert
- Original ticket status changes to "Closed"
- Incident is created with link to source ticket
- All ticket data is preserved
- Conversion action is logged in audit trail

## User Access Workflows

### End User Workflow
1. Login
2. View dashboard (own tickets only)
3. Create new ticket
4. View ticket details
5. Add comments
6. Upload attachments
7. View ticket status updates

### IT Support Workflow
1. Login
2. View ticket queue (assigned + unassigned)
3. Assign tickets to self or others
4. Update ticket status
5. Add internal notes
6. Convert tickets to incidents
7. View SLA compliance

### Security Officer Workflow
1. Login
2. View incident dashboard
3. Create incidents
4. Update incident status
5. Add timeline entries
6. Document root cause
7. Close incidents with resolution summary

### Admin Workflow
1. Login
2. Access all system areas
3. Manage users and roles
4. Configure SLA settings
5. View audit logs
6. Generate reports
7. System administration
