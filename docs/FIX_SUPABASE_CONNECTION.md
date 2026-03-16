# Fix Supabase Connection Error

## Error: `getaddrinfo ENOTFOUND wyutuuhwxmrwxhlmdie.supabase.co`

This error means the Supabase URL cannot be found. Here's how to fix it:

## Steps to Fix

### 1. Check Your Supabase Project

1. Go to https://supabase.com/dashboard
2. Log in to your account
3. Check if your project exists:
   - If project is **paused**: Click "Restore project" to resume it
   - If project is **deleted**: You need to create a new one
   - If project doesn't exist: Create a new project

### 2. Get Correct Credentials

1. In Supabase dashboard, select your project
2. Go to **Settings** → **API**
3. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

### 3. Update backend/.env File

Create or update `backend/.env` with:

```env
PORT=5000
SUPABASE_URL=https://your-actual-project-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

**Important**: 
- Use the **Project URL** (not anon key URL)
- Use the **Service Role Key** (not anon key)
- The URL should start with `https://` and end with `.supabase.co`

### 4. Verify Connection

1. Restart your backend server
2. Check the health endpoint:
   ```bash
   curl http://localhost:5000/api/health
   ```
3. Should return: `{"status":"ok","database":"connected"}`

### 5. Run Database Schema

If connection works but tables don't exist:

1. Go to Supabase dashboard → SQL Editor
2. Copy contents of `backend/database/schema.sql`
3. Paste and run in SQL Editor
4. Verify tables are created

## Common Issues

### Project is Paused
- Free tier projects pause after inactivity
- Go to dashboard and click "Restore project"
- Wait a few minutes for it to resume

### Wrong URL Format
- Correct: `https://xxxxx.supabase.co`
- Wrong: `https://supabase.co/project/xxxxx`
- Wrong: `http://xxxxx.supabase.co` (must be https)

### Wrong Key Type
- Use **Service Role Key** (for backend)
- NOT anon key (for frontend)
- Service Role Key starts with `eyJ` and is very long

### Network/Firewall
- Check internet connection
- Check if firewall blocks Supabase
- Try accessing Supabase dashboard in browser

## Test Connection

After updating `.env`, test with:

```bash
cd backend
node -e "require('dotenv').config(); const {createClient} = require('@supabase/supabase-js'); const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); supabase.from('users').select('count').then(r => console.log('✅ Connected!', r)).catch(e => console.log('❌ Error:', e.message))"
```

If successful, you'll see: `✅ Connected!`
