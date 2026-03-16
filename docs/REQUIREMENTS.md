# Functional & Non-Functional Requirements

## Functional Requirements

### User Management
- **FR-01**: The system shall support user authentication.
- **FR-02**: The system shall enforce role-based access control (RBAC).
- **FR-03**: The system shall support the following roles:
  - End User
  - IT Support
  - Security Officer
  - System Administrator

### IT Support Ticket Management
- **FR-04**: End users shall be able to submit IT support tickets.
- **FR-05**: Tickets shall include category, description, priority, and attachments.
- **FR-06**: Tickets shall follow a defined lifecycle:
  - New → Assigned → In Progress → Waiting for User → Resolved → Closed
- **FR-07**: IT staff shall be able to assign and reassign tickets.
- **FR-08**: The system shall track SLA timestamps.
- **FR-09**: End users shall view ticket status and add comments.

### Cybersecurity Incident Management
- **FR-10**: Authorized users shall create cybersecurity incident records.
- **FR-11**: Incidents shall be categorized and assigned severity levels.
- **FR-12**: Incidents shall follow a defined lifecycle:
  - New → Triaged → Investigating → Contained → Recovered → Closed
- **FR-13**: The system shall allow evidence attachment and investigation notes.
- **FR-14**: Root cause and resolution shall be documented before closure.

### Ticket-to-Incident Conversion
- **FR-15**: IT staff shall be able to convert a ticket into a security incident.
- **FR-16**: The original ticket shall remain preserved and linked.
- **FR-17**: All conversion actions shall be logged in the audit trail.

### Reporting & Dashboards
- **FR-18**: The system shall provide dashboards for tickets and incidents.
- **FR-19**: Users shall generate reports filtered by date, type, and severity.
- **FR-20**: Reports shall be exportable to PDF or Excel.

### Audit Logging
- **FR-21**: The system shall log all user actions.
- **FR-22**: Audit logs shall be immutable.
- **FR-23**: Audit logs shall be accessible only to administrators.

## Non-Functional Requirements

### Security
- **NFR-01**: Passwords shall be stored using secure hashing (bcrypt).
- **NFR-02**: The system shall enforce strong password policies.
- **NFR-03**: Data shall be encrypted at rest (optional but recommended).

### Availability
- **NFR-04**: The system shall support daily backups.
- **NFR-05**: The system shall allow manual data restoration.

### Performance
- **NFR-06**: Ticket and incident creation shall complete within 3 seconds.
- **NFR-07**: The system shall support at least 100 concurrent users.

### Usability
- **NFR-08**: The UI shall be browser-based and responsive.
- **NFR-09**: End-user views shall be simplified and role-restricted.
