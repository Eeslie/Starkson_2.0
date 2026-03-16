const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { supabase } = require('./config/database')

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS configuration - MODIFIED SECTION
const corsOptions = {
  origin: function (origin, callback) {
  const allowedOrigins = [
    'https://starkson-afhs.onrender.com', 
    'http://localhost:3000', 
    'http://localhost:5173',
    'http://10.0.0.66:3000',
    'http://10.0.0.66:5173'
  ];
    
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
}

// Apply CORS middleware to ALL routes (not just API)
app.use(cors(corsOptions))

// Add CORS headers manually as a backup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://starkson-afhs.onrender.com', 
    'http://localhost:3000', 
    'http://localhost:5173',
    'http://10.0.0.66:3000',
    'http://10.0.0.66:5173'
  ];
  
  if (allowedOrigins.includes(origin) || !origin || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('🔧 Preflight request from:', origin);
    return res.status(200).end();
  }
  
  next();
});

// Body parsing middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/branches', require('./routes/branches'))
app.use('/api/tickets', require('./routes/tickets'))
app.use('/api/incidents', require('./routes/incidents'))
app.use('/api/users', require('./routes/users'))
app.use('/api/audit', require('./routes/audit'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/staff', require('./routes/staff'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api/maintenance', require('./routes/maintenance'))
// Attachments route - register before other routes that might conflict
app.use('/api/attachments', require('./routes/attachments'))
app.use('/api/sla', require('./routes/sla'))
app.use('/api/notifications', require('./routes/notifications'))

app.head('/api/health', (req, res) => {
  res.sendStatus(200)
})

// Health check
app.get('/api/health', async (req, res) => {
  res.status(200).json({ status: "ok" });
})

// Debug route to test attachments router (must be before 404 handler)
app.get('/api/attachments/test', (req, res) => {
  res.json({ message: 'Attachments route is accessible', timestamp: new Date().toISOString() })
})

// 404 handler for unmatched routes (MUST be last)
app.use('*', (req, res) => {
  console.log('⚠️  Unmatched route (404):', req.method, req.originalUrl)
  res.status(404).json({ 
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server - listen on all interfaces (0.0.0.0) to allow external access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Server accessible at http://10.0.0.66:${PORT}`)
  console.log('Supabase client initialized')
  console.log('CORS enabled for:', corsOptions.origin)
})

module.exports = app