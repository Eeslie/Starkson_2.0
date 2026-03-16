# Cloudinary Setup Guide

This guide will help you set up Cloudinary for file uploads in the STARKSON system.

## Why Cloudinary?

Cloudinary provides:
- Reliable cloud storage for images and files
- Automatic image optimization and transformations
- CDN delivery for fast image loading
- Better scalability than local file storage

## Setup Steps

### 1. Create a Cloudinary Account

1. Go to [https://cloudinary.com](https://cloudinary.com)
2. Sign up for a free account (includes 25GB storage and 25GB bandwidth)
3. After signing up, you'll be taken to your dashboard

### 2. Get Your Cloudinary Credentials

1. In your Cloudinary dashboard, go to **Settings** (gear icon)
2. Navigate to the **Product Environment Credentials** section
3. Copy the following values:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

### 3. Add Credentials to Backend Environment

1. Open `backend/.env` file
2. Add the following environment variables:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Important:** Never commit your `.env` file to version control. The API Secret is sensitive.

### 4. Install Cloudinary Package

The package is already added to `package.json`. Run:

```bash
cd backend
npm install
```

This will install the `cloudinary` package.

### 5. Update Database Schema (Important!)

The `file_path` column in the `attachments` table needs to be updated from `VARCHAR(500)` to `TEXT` to support longer Cloudinary URLs.

**Option A: Run the migration script (Recommended)**

1. Connect to your Supabase database (via Supabase Dashboard > SQL Editor)
2. Run the migration script:

```sql
-- Update file_path column to TEXT
ALTER TABLE attachments ALTER COLUMN file_path TYPE TEXT;
```

**Option B: Use the provided migration file**

1. Open `backend/database/migration_update_file_path.sql`
2. Copy the SQL and run it in your Supabase SQL Editor

**Note:** If you're setting up a new database, the schema already uses `TEXT` for `file_path`, so you can skip this step.

### 6. Restart Your Backend Server

After adding the environment variables, restart your backend server:

```bash
npm start
# or
npm run dev
```

You should see a message in the console: `✅ Cloudinary configured successfully`

## How It Works

1. **File Upload**: When a user uploads a file (image, PDF, etc.), it's uploaded to Cloudinary instead of local storage
2. **Storage**: Files are organized in Cloudinary folders: `starkson/tickets/{ticketId}/` or `starkson/incidents/{incidentId}/`
3. **URLs**: Cloudinary provides secure URLs that are stored in the database
4. **Display**: Images are displayed directly from Cloudinary's CDN for fast loading
5. **Deletion**: When files are deleted, they're also removed from Cloudinary

## Benefits

- ✅ **Reliable**: No more file upload failures
- ✅ **Fast**: CDN delivery for images
- ✅ **Scalable**: Handles large files and high traffic
- ✅ **Optimized**: Automatic image optimization
- ✅ **Secure**: Secure URLs with access control

## Troubleshooting

### Upload Still Failing?

1. **Check Environment Variables**: Make sure all three Cloudinary credentials are in `backend/.env`
   - The backend will show `⚠️  Cloudinary configuration missing!` if credentials are not set
   - You should see `✅ Cloudinary configured successfully` when credentials are correct

2. **Verify Credentials**: Double-check that you copied the correct values from Cloudinary dashboard
   - Cloud Name: Usually your account name
   - API Key: Found in Product Environment Credentials
   - API Secret: Found in Product Environment Credentials (keep this secret!)

3. **Check Database Schema**: Make sure `file_path` column is `TEXT` type, not `VARCHAR(500)`
   - Run: `SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'attachments' AND column_name = 'file_path';`
   - If it shows `character varying` with length 500, run the migration

4. **Check Backend Logs**: Look for detailed error messages in your backend console
   - Upload errors will show: `❌ Cloudinary upload error:` with details
   - Database errors will show: `❌ Database insert error:` with details

5. **Test Connection**: The backend will log errors if Cloudinary connection fails
   - Check for HTTP error codes (401 = invalid credentials, 400 = bad request, etc.)

### Images Not Displaying?

1. **Check URL Format**: Cloudinary URLs should start with `https://res.cloudinary.com/`
2. **Verify File Path**: Check the database to see if `file_path` contains a Cloudinary URL
3. **CORS Issues**: Cloudinary URLs should work without CORS issues

## Migration from Local Storage

If you have existing files in local storage:
- Old files will continue to work (backward compatibility)
- New uploads will use Cloudinary
- You can migrate old files to Cloudinary manually if needed

## Free Tier Limits

Cloudinary's free tier includes:
- 25GB storage
- 25GB bandwidth per month
- 25GB monthly net viewing bandwidth

For production use with high traffic, consider upgrading to a paid plan.
