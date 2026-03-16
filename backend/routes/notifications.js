const express = require('express')
const router = express.Router()
const { query } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Get user notifications with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query
    const userId = req.user.id
    
    // Use Supabase query builder syntax
    const notifications = await query('notifications', 'select', {
      filters: [
        { column: 'user_id', operator: 'eq', value: userId }
      ],
      orderBy: { column: 'created_at', ascending: false },
      limit: parseInt(limit),
      select: 'id, type, title, message, resource_type, resource_id, is_read, created_at'
    })
    
    // Transform data for frontend
    const formattedNotifications = notifications.map(notification => {
      // Generate link based on resource type
      let link = null
      if (notification.resource_type && notification.resource_id) {
        switch (notification.resource_type) {
          case 'ticket':
            link = `/tickets/${notification.resource_id}`
            break
          case 'incident':
            link = `/incidents/${notification.resource_id}`
            break
          case 'user':
            link = `/profile/${notification.resource_id}`
            break
          default:
            link = null
        }
      }
      
      return {
        id: notification.id,
        type: notification.type === 'ticket_created' ? 'ticket' : 
              notification.type === 'incident_reported' ? 'incident' : 
              notification.type.includes('system') ? 'system' : 'other',
        title: notification.title,
        message: notification.message,
        resourceType: notification.resource_type,
        resourceId: notification.resource_id,
        link: link,
        isRead: notification.is_read,
        createdAt: notification.created_at
      }
    })
    
    res.json(formattedNotifications)
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    
    const result = await query('notifications', 'count', {
      filters: [
        { column: 'user_id', operator: 'eq', value: userId },
        { column: 'is_read', operator: 'eq', value: false }
      ]
    })
    
    res.json({ count: result.count || 0 })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Mark notification as read (when user clicks on it)
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const notificationId = req.params.id
    
    // First check if notification exists and belongs to user
    const notification = await query('notifications', 'select', {
      filters: [
        { column: 'id', operator: 'eq', value: notificationId },
        { column: 'user_id', operator: 'eq', value: userId }
      ],
      single: true
    })

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    // Mark as read
    await query('notifications', 'update', {
      data: { is_read: true },
      filters: [
        { column: 'id', operator: 'eq', value: notificationId }
      ]
    })
    
    res.json({ message: 'Notification marked as read' })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Mark all as read (only when user explicitly clicks "Mark all as read")
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    
    // Use direct Supabase client for efficient bulk update
    const { supabase } = require('../config/database')
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    
    if (error) {
      throw error
    }
    
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('Mark all read error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Create notification
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      userId, 
      type, 
      title, 
      message, 
      resourceType, 
      resourceId 
    } = req.body

    const notification = await query('notifications', 'insert', {
      data: {
        user_id: userId,
        type: type,
        title: title,
        message: message,
        resource_type: resourceType,
        resource_id: resourceId,
        is_read: false
      }
    })
    
    res.status(201).json({ 
      message: 'Notification created',
      notification: notification
    })
  } catch (error) {
    console.error('Create notification error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router