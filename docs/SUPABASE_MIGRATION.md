# Supabase Migration Guide

## Overview
The backend has been migrated from MySQL to Supabase (PostgreSQL). This document outlines the key changes and patterns.

## Key Changes

### Database Client
- **Before**: MySQL2 connection pool
- **After**: Supabase JavaScript client (`@supabase/supabase-js`)

### Query Pattern
- **Before**: Raw SQL queries with placeholders
  ```javascript
  await query('SELECT * FROM users WHERE id = ?', [userId])
  ```
- **After**: Supabase query builder
  ```javascript
  await query('users', 'select', {
    filters: [{ column: 'id', value: userId }],
    single: true
  })
  ```

### Database Schema
- **Before**: MySQL syntax with `AUTO_INCREMENT`, `ENUM` types
- **After**: PostgreSQL syntax with `UUID`, `CHECK` constraints
- Column names changed from camelCase to snake_case

## Column Name Mapping

| MySQL (Old) | PostgreSQL/Supabase (New) |
|-------------|---------------------------|
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `userId` | `user_id` |
| `ticketId` | `ticket_id` |
| `isInternal` | `is_internal` |
| `ticketNumber` | `ticket_number` |
| `requestType` | `request_type` |
| `affectedSystem` | `affected_system` |
| `createdBy` | `created_by` |
| `assignedTo` | `assigned_to` |
| `slaDue` | `sla_due` |

## Query Operations

### Select
```javascript
// Simple select
const users = await query('users', 'select')

// With filters
const user = await query('users', 'select', {
  filters: [{ column: 'email', value: 'user@example.com' }],
  single: true
})

// With joins (using foreign key syntax)
const tickets = await query('tickets', 'select', {
  select: '*, created_by_user:users!tickets_created_by_fkey(id, name)',
  orderBy: { column: 'created_at', ascending: false }
})
```

### Insert
```javascript
const result = await query('tickets', 'insert', {
  data: {
    ticket_number: 'TKT-2024-000001',
    title: 'Test Ticket',
    description: 'Description',
    created_by: userId
  }
})
```

### Update
```javascript
await query('tickets', 'update', {
  filters: [{ column: 'id', value: ticketId }],
  data: { status: 'closed', closed_at: new Date().toISOString() }
})
```

### Delete
```javascript
await query('attachments', 'delete', {
  filters: [{ column: 'id', value: attachmentId }]
})
```

### Count
```javascript
const { count } = await query('tickets', 'count', {
  filters: [{ column: 'status', value: 'open' }]
})
```

## Filter Operators

- `eq` - Equals (default)
- `neq` - Not equals
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `like` - LIKE pattern
- `ilike` - Case-insensitive LIKE
- `in` - IN array
- `is` - IS NULL/IS NOT NULL

## Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important**: Use the Service Role Key (not the anon key) for backend operations as it bypasses Row Level Security.

## Remaining Route Updates Needed

The following routes still need to be updated to use Supabase:
- `routes/incidents.js`
- `routes/users.js`
- `routes/audit.js`
- `routes/dashboard.js`
- `routes/staff.js`
- `routes/admin.js`
- `routes/attachments.js`
- `routes/sla.js`
- `routes/notifications.js`

Follow the same pattern as `routes/tickets.js` and `routes/auth.js`.
