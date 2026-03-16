# STARKSON - IT Support & Cybersecurity Incident Monitoring System

Full-stack web application with Next.js frontend and Express.js backend.

## Project Structure

```
STARKSON/
├── frontend/              # Next.js 14 App Router (TypeScript, Tailwind)
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   └── lib/             # Utilities and API client
├── backend/              # Express.js API (Node.js)
│   ├── config/          # Configuration files
│   ├── database/        # Database schema
│   ├── middleware/      # Express middleware
│   └── routes/          # API routes
└── docs/                # Documentation
    ├── SYSTEM_DESCRIPTION.md
    ├── REQUIREMENTS.md
    └── WORKFLOWS.md
```

## Quick Start

**New to STARKSON?** See [Getting Started Guide](./docs/GETTING_STARTED.md) for step-by-step setup instructions.

**Need test accounts?** Run `node backend/scripts/create-test-users.js` after setting up the database.

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=5000
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

4. Set up Supabase database:
   - Create a new Supabase project at https://supabase.com
   - Run the SQL schema from `database/schema.sql` in the Supabase SQL Editor
   - Copy your project URL and service role key to the `.env` file

5. Start server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

4. Start development server:
```bash
npm run dev
```

## Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Roles: User, IT Support, Security Officer, Admin

### IT Support Tickets
- Request types: Account/Password, Software, Hardware, Network, Access, General
- Workflow: New → Assigned → In Progress → Waiting for User → Resolved → Closed
- SLA tracking and compliance
- Priority management (Low, Medium, High, Urgent)
- Comments (public and internal)
- File attachments

### Cybersecurity Incidents
- Categories: Phishing, Malware, Unauthorized Access, Data Exposure, Policy Violation, System Compromise
- Workflow: New → Triaged → Investigating → Contained → Recovered → Closed
- Severity levels (Low, Medium, High, Critical)
- Impact assessment (Confidentiality, Integrity, Availability)
- Timeline tracking
- Root cause analysis
- Resolution documentation

### Additional Features
- Ticket to Incident conversion
- File uploads for evidence
- Immutable audit logs
- In-app notifications
- Role-based dashboards
- SLA management
- Reporting capabilities

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Tickets
- `GET /api/tickets` - Get tickets (filtered by role)
- `GET /api/tickets/:id` - Get ticket details
- `POST /api/tickets` - Create ticket (users only)
- `PUT /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/comments` - Add comment
- `POST /api/tickets/:id/convert` - Convert to incident

### Incidents
- `GET /api/incidents` - Get incidents (security officers only)
- `GET /api/incidents/:id` - Get incident details
- `POST /api/incidents` - Create incident
- `PUT /api/incidents/:id` - Update incident
- `POST /api/incidents/:id/timeline` - Add timeline entry

### Attachments
- `POST /api/attachments/:recordType/:recordId` - Upload file
- `GET /api/attachments/:recordType/:recordId` - Get attachments
- `GET /api/attachments/download/:id` - Download file
- `DELETE /api/attachments/:id` - Delete file

### Other
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/staff/stats` - IT Support dashboard stats
- `GET /api/admin/stats` - Admin panel stats
- `GET /api/sla` - Get SLA configuration
- `GET /api/notifications` - Get user notifications
- `GET /api/audit` - Get audit logs (admin only)

## Deploy on Vercel (frontend only)

The Next.js app lives in `frontend/`, so Vercel must build from that folder:

1. In the [Vercel dashboard](https://vercel.com/dashboard), open your project → **Settings** → **General**.
2. Under **Root Directory**, click **Edit**, set it to **`frontend`**, and save.
3. Add environment variables (e.g. `NEXT_PUBLIC_API_URL`) under **Settings** → **Environment Variables**.
4. Redeploy (e.g. **Deployments** → … → **Redeploy**).

If you skip step 2, the build runs from the repo root and fails with: *"Couldn't find any \`pages\` or \`app\` directory"*.

## Documentation

- [Getting Started](./docs/GETTING_STARTED.md) - **START HERE** - First time setup and quick start guide
- [System Description](./docs/SYSTEM_DESCRIPTION.md) - System overview and architecture
- [Requirements](./docs/REQUIREMENTS.md) - Functional and non-functional requirements
- [Workflows](./docs/WORKFLOWS.md) - Ticket and incident workflows
- [Navigation Guide](./docs/NAVIGATION_GUIDE.md) - Complete navigation guide for all roles
- [Navigation Quick Reference](./docs/NAVIGATION_QUICK_REFERENCE.md) - Quick reference for navigation
- [Accounts & Walkthroughs](./docs/ACCOUNTS_AND_WALKTHROUGH.md) - Account types and step-by-step scenarios
- [Accounts Quick Reference](./docs/ACCOUNTS_QUICK_REFERENCE.md) - Quick reference for account types
- [Supabase Setup](./docs/SETUP_SUPABASE.md) - Supabase database setup guide
- [Supabase Migration](./docs/SUPABASE_MIGRATION.md) - Migration guide from MySQL to Supabase
- [Database Schema](./docs/DATABASE_SCHEMA.md) - Database schema documentation
