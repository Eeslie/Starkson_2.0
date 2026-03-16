# Supabase Setup Guide

## Quick Start

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Sign up or log in
   - Create a new project
   - Wait for the project to be provisioned

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy your Project URL
   - Copy your Service Role Key (⚠️ Keep this secret!)

3. **Run Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Copy the contents of `backend/database/schema.sql`
   - Paste and run it in the SQL Editor
   - Verify all tables are created

4. **Configure Backend**
   - Create `backend/.env` file:
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=your-secret-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   ```

5. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

6. **Start Server**
   ```bash
   npm run dev
   ```

## Important Notes

- **Service Role Key**: Use the Service Role Key (not the anon key) for backend operations
- **Row Level Security**: The schema doesn't include RLS policies. You can add them later if needed
- **UUIDs**: All IDs are UUIDs, not integers
- **Column Names**: Use snake_case (e.g., `created_at`, not `createdAt`)

## Verifying Setup

1. Check database connection:
   ```bash
   curl http://localhost:5000/api/health
   ```
   Should return: `{"status":"ok","message":"STARKSON API is running","database":"connected"}`

2. Test authentication:
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
   ```

## Troubleshooting

- **Connection Error**: Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
- **Table Not Found**: Make sure you ran the schema.sql file in Supabase SQL Editor
- **Permission Denied**: Ensure you're using the Service Role Key, not the anon key
