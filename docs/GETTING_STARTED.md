# Getting Started with STARKSON

## 🚀 First Time Setup

### Step 1: Set Up Database
1. Follow the [Supabase Setup Guide](./SETUP_SUPABASE.md)
2. Run the database schema in Supabase SQL Editor
3. Verify all tables are created

### Step 2: Configure Backend
1. Navigate to `backend` folder
2. Copy `.env.example` to `.env`
3. Fill in your Supabase credentials:
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=your-secret-key-change-this
   JWT_EXPIRES_IN=7d
   ```

### Step 3: Install Dependencies
```bash
cd backend
npm install
```

### Step 4: Create Your First Admin Account

You have two options:

#### Option A: Create Admin via Script (Recommended)
```bash
node scripts/create-admin.js
```

Follow the prompts:
- Enter admin name
- Enter admin email
- Enter admin password (min 6 characters)

#### Option B: Create Test Users (All Roles)
```bash
node scripts/create-test-users.js
```

This creates 4 test accounts:
- **User**: sarah.johnson@company.com / Password123!
- **IT Support**: mike.chen@company.com / Password123!
- **Security Officer**: alex.rodriguez@company.com / Password123!
- **Admin**: jennifer.smith@company.com / Password123!

### Step 5: Start Backend Server
```bash
npm run dev
```

Server should start on `http://localhost:5000`

### Step 6: Configure Frontend
1. Navigate to `frontend` folder
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

### Step 7: Start Frontend
```bash
npm run dev
```

Frontend should start on `http://localhost:3000`

---

## 🔐 Login Options

### Option 1: Use Test Accounts
If you ran `create-test-users.js`, you can login with:
- Any of the 4 test accounts listed above
- All use password: `Password123!`

### Option 2: Register New Account
1. Go to `http://localhost:3000`
2. Click **"Register here"** link on login page
3. Fill in registration form
4. New account will have "user" role
5. Login with new credentials

### Option 3: Create Admin via API
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@company.com",
    "password": "admin123",
    "role": "admin"
  }'
```

---

## 📝 Quick Start Guide

### For End Users
1. **Register** a new account (or use test account)
2. **Login** with your credentials
3. Go to **Tickets** → **Create Ticket**
4. Submit your IT support request

### For IT Support
1. **Login** with IT Support account (or have admin assign role)
2. Go to **IT Console** to see pending tickets
3. Assign tickets to yourself
4. Update status and resolve tickets

### For Security Officers
1. **Login** with Security Officer account (or have admin assign role)
2. Go to **Incidents** to see all incidents
3. Create new incidents or manage existing ones
4. Document investigations and resolutions

### For Admins
1. **Login** with Admin account
2. Go to **Admin Panel**
3. Manage users, configure SLA, view audit logs
4. Full system access

---

## 🆘 Troubleshooting

### "Cannot connect to database"
- Check Supabase URL and Service Role Key in `.env`
- Verify database schema is installed
- Check Supabase project is active

### "Cannot login"
- Verify account exists in database
- Check password is correct
- Ensure account status is "active"

### "No accounts to login with"
- Run `create-admin.js` or `create-test-users.js`
- Or register a new account via the registration page
- Or create account via API (see above)

### "Registration fails"
- Check backend server is running
- Verify database connection
- Check email is unique
- Ensure password is at least 6 characters

### "Can't see certain pages"
- Verify your role has access
- Check role assignment in database
- Contact admin to change your role

---

## 📚 Next Steps

1. **Read Documentation**:
   - [Navigation Guide](./NAVIGATION_GUIDE.md) - How to navigate the system
   - [Accounts & Walkthroughs](./ACCOUNTS_AND_WALKTHROUGH.md) - Detailed scenarios
   - [System Description](./SYSTEM_DESCRIPTION.md) - System overview

2. **Create More Users**:
   - Use Admin panel to create users
   - Or use registration page for end users
   - Assign appropriate roles

3. **Configure System**:
   - Set up SLA configuration (Admin → SLA Configuration)
   - Customize system settings
   - Review audit logs

---

## 🔑 Default Test Accounts

After running `create-test-users.js`, you can use:

| Role | Email | Password | Name |
|------|-------|----------|------|
| User | sarah.johnson@company.com | Password123! | Sarah Johnson |
| IT Support | mike.chen@company.com | Password123! | Mike Chen |
| Security Officer | alex.rodriguez@company.com | Password123! | Alex Rodriguez |
| Admin | jennifer.smith@company.com | Password123! | Jennifer Smith |

**⚠️ Important**: Change these passwords in production!

---

## 💡 Tips

1. **First Admin**: Always create at least one admin account first
2. **Test Accounts**: Use test user script for quick setup
3. **Role Management**: Only admins can change user roles
4. **Registration**: New registrations default to "user" role
5. **Security**: Use strong passwords in production

---

For more help, see the [README.md](../README.md) or contact your system administrator.
