# Database Schema Documentation

## Overview
The database uses MySQL with the following main tables:

## Tables

### users
Stores user accounts and authentication information.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| email | VARCHAR(255) | Unique email address |
| password | VARCHAR(255) | Hashed password (bcrypt) |
| name | VARCHAR(255) | User's full name |
| role | ENUM | 'user', 'it_support', 'security_officer', 'admin' |
| status | ENUM | 'active', 'inactive' |
| createdAt | TIMESTAMP | Account creation time |
| updatedAt | TIMESTAMP | Last update time |

### tickets
IT Support ticket records.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| ticketNumber | VARCHAR(50) | Unique ticket number (TKT-YYYY-NNNNNN) |
| requestType | ENUM | Ticket category |
| title | VARCHAR(255) | Ticket title |
| description | TEXT | Detailed description |
| affectedSystem | VARCHAR(255) | Affected system/application |
| priority | ENUM | 'low', 'medium', 'high', 'urgent' |
| status | ENUM | Workflow status |
| category | VARCHAR(100) | Optional category |
| createdBy | INT | FK to users.id |
| assignedTo | INT | FK to users.id (nullable) |
| slaDue | DATETIME | SLA deadline |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |
| resolvedAt | TIMESTAMP | Resolution time |
| closedAt | TIMESTAMP | Closure time |

### ticket_comments
Comments on tickets (public and internal).

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| ticketId | INT | FK to tickets.id |
| userId | INT | FK to users.id |
| comment | TEXT | Comment text |
| isInternal | BOOLEAN | Internal note flag |
| createdAt | TIMESTAMP | Creation time |

### incidents
Cybersecurity incident records.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| incidentNumber | VARCHAR(50) | Unique incident number (INC-YYYY-NNNNNN) |
| sourceTicketId | INT | FK to tickets.id (nullable) |
| detectionMethod | ENUM | How incident was detected |
| category | ENUM | Incident category |
| title | VARCHAR(255) | Incident title |
| description | TEXT | Detailed description |
| severity | ENUM | 'low', 'medium', 'high', 'critical' |
| status | ENUM | Workflow status |
| impactConfidentiality | ENUM | CIA impact |
| impactIntegrity | ENUM | CIA impact |
| impactAvailability | ENUM | CIA impact |
| affectedAsset | VARCHAR(255) | Affected asset |
| affectedUser | VARCHAR(255) | Affected user |
| rootCause | TEXT | Root cause analysis |
| resolutionSummary | TEXT | Resolution documentation |
| assignedTo | INT | FK to users.id (nullable) |
| createdBy | INT | FK to users.id |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |
| triagedAt | TIMESTAMP | Triage time |
| containedAt | TIMESTAMP | Containment time |
| recoveredAt | TIMESTAMP | Recovery time |
| closedAt | TIMESTAMP | Closure time |

### incident_timeline
Timeline entries for incidents.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| incidentId | INT | FK to incidents.id |
| userId | INT | FK to users.id |
| action | VARCHAR(100) | Action type |
| description | TEXT | Description |
| isInternal | BOOLEAN | Internal flag |
| createdAt | TIMESTAMP | Creation time |

### attachments
File attachments for tickets and incidents.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| recordType | ENUM | 'ticket' or 'incident' |
| recordId | INT | ID of related record |
| filename | VARCHAR(255) | Stored filename |
| originalName | VARCHAR(255) | Original filename |
| mimeType | VARCHAR(100) | File MIME type |
| size | INT | File size in bytes |
| filePath | VARCHAR(500) | Storage path |
| uploadedBy | INT | FK to users.id |
| createdAt | TIMESTAMP | Upload time |

### sla_config
SLA configuration by priority.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| priority | ENUM | 'low', 'medium', 'high', 'urgent' |
| responseTimeMinutes | INT | Response time in minutes |
| resolutionTimeHours | INT | Resolution time in hours |
| isActive | BOOLEAN | Active flag |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

### audit_logs
Immutable audit trail.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| action | VARCHAR(100) | Action performed |
| userId | INT | FK to users.id |
| resourceType | VARCHAR(50) | Type of resource |
| resourceId | INT | ID of resource |
| details | JSON | Additional details |
| ipAddress | VARCHAR(45) | User IP address |
| userAgent | VARCHAR(255) | User agent |
| createdAt | TIMESTAMP | Action time |

### notifications
In-app notifications.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| userId | INT | FK to users.id |
| type | VARCHAR(50) | Notification type |
| title | VARCHAR(255) | Notification title |
| message | TEXT | Notification message |
| resourceType | VARCHAR(50) | Related resource type |
| resourceId | INT | Related resource ID |
| isRead | BOOLEAN | Read status |
| createdAt | TIMESTAMP | Creation time |

## Indexes
- Tickets: userId, status, priority, assignedTo
- Incidents: status, severity, category, sourceTicketId
- Audit logs: userId, resourceType/resourceId, createdAt
- Attachments: recordType/recordId

## Relationships
- Tickets → Users (createdBy, assignedTo)
- Incidents → Tickets (sourceTicketId)
- Incidents → Users (createdBy, assignedTo)
- Comments → Tickets/Users
- Timeline → Incidents/Users
- Attachments → Users
- Audit Logs → Users
