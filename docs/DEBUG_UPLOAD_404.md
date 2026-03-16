# Debugging 404 Error on File Upload

## Problem
Getting 404 error when trying to upload files to `/api/attachments/ticket/{ticketId}`

## Possible Causes

1. **Route not matching** - The route pattern might not be matching the URL
2. **Middleware failing silently** - Authentication or multer middleware might be failing
3. **Route order issue** - Another route might be catching the request first
4. **Server not running** - Backend server might not be running or route not registered

## Debugging Steps

### Step 1: Test if attachments router is accessible

Open in browser or use curl:
```
GET http://localhost:5000/api/attachments/test
```

Expected response:
```json
{
  "message": "Attachments router is working",
  "timestamp": "2024-..."
}
```

If this fails, the router isn't registered properly.

### Step 2: Check backend console logs

When you try to upload, check your backend console for:
- `📥 Upload request received:` - Means the route was matched
- `🔍 Checking ticket existence:` - Means ticket lookup started
- `⚠️  Unmatched route:` - Means route wasn't matched

### Step 3: Verify the URL being called

Check browser console for the exact URL:
```
📤 Uploading Resume-Honrado.pdf to: http://localhost:5000/api/attachments/ticket/{ticketId}
```

Make sure:
- The URL is correct
- The ticketId is a valid UUID
- The backend server is running on the correct port

### Step 4: Test with curl/Postman

Test the upload endpoint directly:

```bash
curl -X POST http://localhost:5000/api/attachments/ticket/{TICKET_ID} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/file.pdf"
```

Replace:
- `{TICKET_ID}` with an actual ticket UUID from your database
- `YOUR_TOKEN` with a valid JWT token
- `/path/to/file.pdf` with an actual file path

### Step 5: Check route registration

Verify in `backend/server.js` that the attachments route is registered:
```javascript
app.use('/api/attachments', require('./routes/attachments'))
```

### Step 6: Check for route conflicts

The route pattern is `/:recordType/:recordId`. Make sure:
- `recordType` is exactly `ticket` (not `tickets`)
- `recordId` is a valid UUID
- No other routes are matching first

## Common Issues

### Issue 1: Ticket ID format
**Symptom:** 404 even though ticket exists
**Solution:** Verify the ticket ID is a UUID format (e.g., `550e8400-e29b-41d4-a716-446655440000`)

### Issue 2: Route not registered
**Symptom:** `/api/attachments/test` returns 404
**Solution:** Restart backend server and check for errors on startup

### Issue 3: Authentication failing
**Symptom:** Should return 401, but getting 404
**Solution:** Check if token is being sent correctly in Authorization header

### Issue 4: Multer error
**Symptom:** File type or size error
**Solution:** Check file type is allowed and size is under 10MB

## Expected Flow

1. Frontend calls: `POST /api/attachments/ticket/{ticketId}`
2. Express matches route: `/:recordType/:recordId`
3. `authenticate` middleware verifies JWT token
4. `upload.single('file')` middleware processes file
5. Route handler checks if ticket exists
6. Uploads to Cloudinary
7. Saves to database
8. Returns success

## Next Steps

After trying the debugging steps above:

1. **Check backend console** - Look for any error messages
2. **Check browser console** - Look for the exact error and URL
3. **Verify ticket exists** - Make sure the ticket ID is correct
4. **Test with curl** - Isolate if it's a frontend or backend issue

If still getting 404, share:
- Backend console output
- Browser console output
- The exact URL being called
- Whether `/api/attachments/test` works
