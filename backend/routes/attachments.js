const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const cloudinary = require('cloudinary').v2
const { query, runQuery } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
}

if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.error('⚠️  Cloudinary configuration missing! Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file')
} else {
  cloudinary.config(cloudinaryConfig)
  console.log('✅ Cloudinary configured successfully')
}

// Multer in-memory storage
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|log|csv/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (mimetype && extname) cb(null, true)
    else cb(new Error('Invalid file type'))
  }
})

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' })
    }
    return res.status(400).json({ message: 'File upload error', error: err.message })
  }
  if (err) {
    return res.status(400).json({ message: err.message || 'File upload error' })
  }
  next()
}

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Attachments router is working', timestamp: new Date().toISOString() })
})

// Get recent attachments for dashboard
router.get('/recent', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    const role = req.user.role
    const userId = req.user.id

    // Base attachments query (joined with users for uploader name)
    const baseSql = `
      SELECT
        a.*,
        u.fullname AS uploaded_by_fullname,
        u.username AS uploaded_by_username
      FROM attachments a
      LEFT JOIN users u ON u.id = a.uploaded_by
    `
    let where = ''
    const params = []

    if (role === 'user') {
      // Only attachments from tickets they created or incidents from those tickets
      const userTickets = await query('tickets', 'select', {
        select: 'id',
        filters: [{ column: 'created_by', value: userId }]
      }) || []
      const ticketIds = userTickets.map(t => t.id)
      if (ticketIds.length === 0) {
        return res.json({ attachments: [] })
      }
      where = 'WHERE (a.record_type = "ticket" AND a.record_id IN (?))'
      params.push(ticketIds)
    } else if (role === 'it_support') {
      // Tickets assigned to them or created by them
      const assigned = await query('tickets', 'select', {
        select: 'id',
        filters: [{ column: 'assigned_to', value: userId }]
      }) || []
      const created = await query('tickets', 'select', {
        select: 'id',
        filters: [{ column: 'created_by', value: userId }]
      }) || []
      const allIds = [...new Set([...assigned.map(t => t.id), ...created.map(t => t.id)])]
      if (allIds.length === 0) {
        return res.json({ attachments: [] })
      }
      where = 'WHERE (a.record_type = "ticket" AND a.record_id IN (?))'
      params.push(allIds)
    } else if (role === 'security_officer') {
      // Incidents assigned to them or created by them
      const assignedInc = await query('incidents', 'select', {
        select: 'id',
        filters: [{ column: 'assigned_to', value: userId }]
      }) || []
      const createdInc = await query('incidents', 'select', {
        select: 'id',
        filters: [{ column: 'created_by', value: userId }]
      }) || []
      const incIds = [...new Set([...assignedInc.map(i => i.id), ...createdInc.map(i => i.id)])]
      if (incIds.length === 0) {
        return res.json({ attachments: [] })
      }
      where = 'WHERE (a.record_type = "incident" AND a.record_id IN (?))'
      params.push(incIds)
    } else if (role === 'admin') {
      // Admin sees all
      where = ''
    }

    const sql = `
      ${baseSql}
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ?
    `
    params.push(limit)

    const attachments = await runQuery(sql, params)

    // Enhance with ticket/incident display
    const enhanced = await Promise.all((attachments || []).map(async (att) => {
      let referenceNumber = null
      let title = null

      if (att.record_type === 'ticket') {
        const ticket = await query('tickets', 'select', {
          select: 'ticket_number, title',
          filters: [{ column: 'id', value: att.record_id }],
          single: true
        })
        if (ticket) {
          referenceNumber = ticket.ticket_number
          title = ticket.title
        }
      } else if (att.record_type === 'incident') {
        const incident = await query('incidents', 'select', {
          select: 'incident_number, title',
          filters: [{ column: 'id', value: att.record_id }],
          single: true
        })
        if (incident) {
          referenceNumber = incident.incident_number
          title = incident.title
        }
      }

      const uploaderName = att.uploaded_by_fullname || att.uploaded_by_username || 'Unknown'

      return {
        id: att.id,
        record_type: att.record_type,
        record_id: att.record_id,
        filename: att.filename,
        original_name: att.original_name,
        mime_type: att.mime_type,
        size: att.size,
        file_path: att.file_path,
        uploaded_by: att.uploaded_by,
        uploader_name: uploaderName,
        created_at: att.created_at,
        reference_number: referenceNumber,
        title: title,
        parent_display: referenceNumber
          ? `${referenceNumber} - ${title || 'Untitled'}`
          : `${att.record_type} #${String(att.record_id).slice(0, 8)}`
      }
    }))

    res.json({ attachments: enhanced })
  } catch (error) {
    console.error('Get recent attachments error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Upload attachment
router.post(
  '/:recordType/:recordId',
  authenticate,
  (req, res, next) => {
    console.log('🔐 Authentication passed, proceeding to file upload...')
    console.log('📋 Route params:', req.params)
    next()
  },
  upload.single('file'),
  handleMulterError,
  async (req, res) => {
    try {
      const { recordType, recordId } = req.params
      const file = req.file

      if (!file) return res.status(400).json({ message: 'No file uploaded' })
      if (!['ticket', 'incident'].includes(recordType)) {
        return res.status(400).json({ message: 'Invalid record type' })
      }

      if (recordType === 'ticket') {
        const ticket = await query('tickets', 'select', {
          filters: [{ column: 'id', value: recordId }],
          single: true
        })
        if (!ticket) {
          return res.status(404).json({ message: 'Ticket not found' })
        }
        if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
          return res.status(403).json({ message: 'Forbidden' })
        }
      } else if (recordType === 'incident') {
        if (!['security_officer', 'admin'].includes(req.user.role)) {
          return res.status(403).json({ message: 'Forbidden' })
        }
        const incident = await query('incidents', 'select', {
          filters: [{ column: 'id', value: recordId }],
          single: true
        })
        if (!incident) {
          return res.status(404).json({ message: 'Incident not found' })
        }
      }

      if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
        return res.status(500).json({
          message: 'File upload service not configured. Please contact administrator.',
          error: 'Cloudinary credentials missing'
        })
      }

      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`

      let cloudinaryResult
      try {
        cloudinaryResult = await cloudinary.uploader.upload(dataUri, {
          folder: `starkson/${recordType}s/${recordId}`,
          resource_type: 'auto',
          public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
          overwrite: false,
          access_mode: 'public'
        })
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError)
        return res.status(500).json({
          message: 'Failed to upload file to cloud storage',
          error: cloudinaryError.message || 'Unknown Cloudinary error'
        })
      }

      let result
      try {
        result = await query('attachments', 'insert', {
          data: {
            record_type: recordType,
            record_id: recordId,
            filename: cloudinaryResult.public_id,
            original_name: file.originalname,
            mime_type: file.mimetype,
            size: file.size,
            file_path: cloudinaryResult.secure_url,
            uploaded_by: req.user.id
          }
        })
      } catch (dbError) {
        try {
          await cloudinary.uploader.destroy(cloudinaryResult.public_id)
        } catch {}
        return res.status(500).json({
          message: 'Failed to save attachment to database',
          error: dbError.message || 'Database error'
        })
      }

      await query('audit_logs', 'insert', {
        data: {
          action: 'UPLOAD_ATTACHMENT',
          user_id: req.user.id,
          resource_type: recordType,
          resource_id: recordId,
          details: { filename: file.originalname, size: file.size }
        }
      })

      res.status(201).json({ message: 'File uploaded', attachmentId: result.id })
    } catch (error) {
      console.error('Upload attachment error:', error)
      res.status(500).json({
        message: 'Server error',
        error: error.message || 'Unknown error'
      })
    }
  }
)

// Get attachments for a record
router.get('/:recordType/:recordId', authenticate, async (req, res) => {
  try {
    const { recordType, recordId } = req.params

    if (recordType === 'ticket') {
      const ticket = await query('tickets', 'select', {
        filters: [{ column: 'id', value: recordId }],
        single: true
      })
      if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
      if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (recordType === 'incident') {
      if (!['security_officer', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    const sql = `
      SELECT
        a.*,
        u.fullname AS uploaded_by_fullname
      FROM attachments a
      LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.record_type = ?
        AND a.record_id = ?
      ORDER BY a.created_at DESC
    `
    const attachments = await runQuery(sql, [recordType, recordId])

    const formatted = (attachments || []).map(att => ({
      id: att.id,
      recordType: att.record_type,
      recordId: att.record_id,
      filename: att.filename,
      originalName: att.original_name,
      mimeType: att.mime_type,
      size: att.size,
      filePath: att.file_path,
      uploadedBy: att.uploaded_by,
      uploadedByName: att.uploaded_by_fullname || 'Unknown',
      createdAt: att.created_at,
      record_type: att.record_type,
      record_id: att.record_id,
      original_name: att.original_name,
      mime_type: att.mime_type,
      file_path: att.file_path,
      uploaded_by: att.uploaded_by,
      created_at: att.created_at
    }))

    res.json(formatted)
  } catch (error) {
    console.error('Get attachments error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// View attachment (with token)
router.get('/view/:id', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ message: 'Unauthorized' })

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const attachment = await query('attachments', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })
    if (!attachment) return res.status(404).json({ message: 'Attachment not found' })

    if (attachment.record_type === 'ticket') {
      const ticket = await query('tickets', 'select', {
        filters: [{ column: 'id', value: attachment.record_id }],
        single: true
      })
      if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
      if (decoded.role === 'user' && ticket.created_by !== decoded.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (attachment.record_type === 'incident') {
      if (!['security_officer', 'admin'].includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    if (attachment.file_path && attachment.file_path.startsWith('http')) {
      return res.redirect(attachment.file_path)
    }

    const filePath = path.join(__dirname, '../', attachment.file_path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' })
    }

    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.sendFile(path.resolve(filePath))
  } catch (error) {
    console.error('View attachment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Download attachment
router.get('/download/:id', authenticate, async (req, res) => {
  try {
    const attachment = await query('attachments', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })
    if (!attachment) return res.status(404).json({ message: 'Attachment not found' })

    if (attachment.record_type === 'ticket') {
      const ticket = await query('tickets', 'select', {
        filters: [{ column: 'id', value: attachment.record_id }],
        single: true
      })
      if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
      if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (attachment.record_type === 'incident') {
      if (!['security_officer', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    if (attachment.file_path && attachment.file_path.startsWith('http')) {
      try {
        const cloudinaryResponse = await fetch(attachment.file_path)
        if (!cloudinaryResponse.ok) {
          return res.status(cloudinaryResponse.status).json({
            message: 'Failed to fetch file from cloud storage',
            error: `Cloudinary returned ${cloudinaryResponse.status}`
          })
        }
        const fileBuffer = await cloudinaryResponse.arrayBuffer()
        const buffer = Buffer.from(fileBuffer)
        res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_name}"`)
        res.setHeader('Content-Length', buffer.length)
        return res.send(buffer)
      } catch (fetchError) {
        console.error('Error fetching from Cloudinary:', fetchError)
        return res.status(500).json({
          message: 'Failed to download file from cloud storage',
          error: fetchError.message
        })
      }
    }

    const filePath = path.join(__dirname, '../', attachment.file_path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' })
    }
    res.download(filePath, attachment.original_name)
  } catch (error) {
    console.error('Download attachment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete attachment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const attachment = await query('attachments', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' })
    }

    if (req.user.role !== 'admin' && attachment.uploaded_by !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    if (attachment.file_path && attachment.file_path.startsWith('http')) {
      try {
        const publicId = attachment.filename
        await cloudinary.uploader.destroy(publicId)
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError)
      }
    } else {
      const filePath = path.join(__dirname, '../', attachment.file_path)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await query('attachments', 'delete', {
      filters: [{ column: 'id', value: req.params.id }]
    })

    await query('audit_logs', 'insert', {
      data: {
        action: 'DELETE_ATTACHMENT',
        user_id: req.user.id,
        resource_type: attachment.record_type,
        resource_id: attachment.record_id
      }
    })

    res.json({ message: 'Attachment deleted' })
  } catch (error) {
    console.error('Delete attachment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router