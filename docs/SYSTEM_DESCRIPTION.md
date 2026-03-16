# IT Support & Cybersecurity Incident Monitoring System

## System Name
IT Support & Cybersecurity Incident Monitoring System (Stand-Alone)

## Purpose
The system provides a centralized, stand-alone platform for managing:
- End-user IT support requests (tickets)
- Cybersecurity incidents

It ensures proper incident handling, traceability, accountability, and compliance without reliance on external integrations.

## Scope
- Covers all IT-related service requests submitted by end users
- Covers all cybersecurity incidents identified by users or IT staff
- Applies to all employees, contractors, and IT personnel

## System Characteristics
- Stand-alone (no integrations with email, SIEM, ERP, or third-party tools)
- Web-based internal application
- Manual incident and ticket creation only
- Role-based access control
- Full audit logging

## Compliance Alignment
- ISO 27001 (A.5, A.8)
- ISO 27035 (Information Security Incident Management)
- NIST SP 800-61 (Incident Response)
- SOC 2 (Security & Availability)

## Architecture
- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend**: Express.js (Node.js)
- **Database**: MySQL
- **Authentication**: JWT-based
- **File Storage**: Local filesystem

## User Roles
1. **User** - End users who can submit tickets and view their own tickets
2. **IT Support** - IT staff who manage tickets, assign work, and convert tickets to incidents
3. **Security Officer** - Security personnel who manage cybersecurity incidents
4. **Admin** - System administrators with full access

## Record Types

### IT Support Tickets
- Request types: Account/Password, Software Installation, Hardware, Network/Internet, Access Requests, General
- Workflow: New → Assigned → In Progress → Waiting for User → Resolved → Closed
- Features: SLA tracking, priority management, comments, attachments

### Cybersecurity Incidents
- Categories: Phishing, Malware, Unauthorized Access, Data Exposure, Policy Violation, System Compromise
- Workflow: New → Triaged → Investigating → Contained → Recovered → Closed
- Features: Severity levels, impact assessment (CIA), timeline, root cause analysis

## Key Features
- Ticket to Incident conversion
- SLA management and compliance tracking
- File attachments for evidence
- Audit logging (immutable)
- In-app notifications
- Role-based dashboards
- Reporting capabilities
