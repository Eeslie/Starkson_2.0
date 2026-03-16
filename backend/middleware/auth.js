const jwt = require('jsonwebtoken')

// Verify JWT token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    next()
  }
}

// Check if user can access resource (owner or has role)
const canAccessResource = (resourceUserId, userRole, allowedRoles = []) => {
  // Admin and security officers can access all
  if (['admin', 'security_officer'].includes(userRole)) {
    return true
  }
  // IT support can access assigned resources
  if (userRole === 'it_support' && allowedRoles.includes('it_support')) {
    return true
  }
  // Users can only access their own resources
  return resourceUserId === userRole
}

module.exports = {
  authenticate,
  authorize,
  canAccessResource
}
