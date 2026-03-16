# Fix Image Upload Issues

## Problem
Image uploads were failing with "Upload failed" error, and images were not showing after ticket creation.

## Root Causes Identified

1. **Database Schema Limitation**: The `file_path` column was `VARCHAR(500)`, which may be too short for some Cloudinary URLs
2. **Missing Error Details**: Error messages weren't detailed enough to diagnose issues
3. **Cloudinary Configuration**: No validation to check if Cloudinary credentials are set

## Solutions Implemented

### 1. Database Schema Update

The `file_path` column has been updated from `VARCHAR(500)` to `TEXT` in:
- `backend/database/schema.sql` (for new databases)
- `backend/database/migration_update_file_path.sql` (for existing databases)

**Action Required:** If you have an existing database, run the migration:

```sql
ALTER TABLE attachments ALTER COLUMN file_path TYPE TEXT;
```

You can run this in Supabase Dashboard > SQL Editor.

### 2. Enhanced Error Handling

**Backend (`backend/routes/attachments.js`):**
- ✅ Added Cloudinary configuration validation on startup
- ✅ Added detailed error logging for upload failures
- ✅ Added database error handling with Cloudinary cleanup
- ✅ Improved error messages returned to frontend

**Frontend (`frontend/app/tickets/create/page.tsx`):**
- ✅ Enhanced error message display
- ✅ Added console logging for debugging
- ✅ Better error status indicators

### 3. Cloudinary Configuration Validation

The backend now checks for Cloudinary credentials on startup:
- ✅ Shows warning if credentials are missing
- ✅ Shows success message if configured correctly
- ✅ Validates credentials before each upload

## Steps to Fix Your Setup

### Step 1: Update Database Schema

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run this SQL:

```sql
ALTER TABLE attachments ALTER COLUMN file_path TYPE TEXT;
```

### Step 2: Verify Cloudinary Configuration

1. Check your `backend/.env` file has:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

2. Restart your backend server
3. Check the console for:
   - `✅ Cloudinary configured successfully` (good)
   - `⚠️  Cloudinary configuration missing!` (needs setup)

### Step 3: Test Upload

1. Create a new ticket with an image attachment
2. Check the browser console for detailed error messages if upload fails
3. Check the backend console for upload logs:
   - `Uploading file to Cloudinary: filename.jpg (size bytes)`
   - `✅ File uploaded to Cloudinary: https://...`
   - `✅ Attachment saved to database: attachment-id`

## Troubleshooting

### Error: "Cloudinary credentials missing"
- **Solution**: Add Cloudinary credentials to `backend/.env` (see `docs/CLOUDINARY_SETUP.md`)

### Error: "Failed to save attachment to database"
- **Solution**: Run the database migration to change `file_path` to `TEXT`

### Error: "Failed to upload file to cloud storage"
- **Solution**: 
  1. Verify Cloudinary credentials are correct
  2. Check Cloudinary dashboard for account status
  3. Check backend console for detailed error (HTTP code, message)

### Images not showing after upload
- **Solution**:
  1. Check if `file_path` in database contains a Cloudinary URL (starts with `https://res.cloudinary.com/`)
  2. Verify the URL is accessible (try opening in browser)
  3. Check browser console for CORS or loading errors

## Testing Checklist

- [ ] Database schema updated (`file_path` is `TEXT`)
- [ ] Cloudinary credentials in `backend/.env`
- [ ] Backend shows `✅ Cloudinary configured successfully`
- [ ] Can upload image when creating ticket
- [ ] Image appears in ticket details page
- [ ] Image can be downloaded/viewed
- [ ] Error messages are clear if upload fails

## Next Steps

If uploads are still failing after these fixes:

1. **Check Backend Logs**: Look for detailed error messages
2. **Check Browser Console**: Look for network errors or API response errors
3. **Verify Cloudinary Account**: Make sure your Cloudinary account is active
4. **Test Cloudinary Directly**: Try uploading a test image via Cloudinary dashboard

For more information, see:
- `docs/CLOUDINARY_SETUP.md` - Complete Cloudinary setup guide
- `backend/routes/attachments.js` - Upload implementation details
