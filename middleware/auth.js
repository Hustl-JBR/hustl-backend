const jwt = require('jsonwebtoken');
const prisma = require('../db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - no token provided' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('[Auth] JWT_SECRET is not set in environment variables!');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('[Auth] JWT verification failed:', jwtError.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    let user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        roles: true,
        idVerified: true,
        stripeAccountId: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Ensure user has both CUSTOMER and HUSTLER roles (for existing users)
    const userRoles = (user.roles || []).map(r => r.toUpperCase());
    const hasCustomer = userRoles.includes('CUSTOMER');
    const hasHustler = userRoles.includes('HUSTLER');
    
    if (!hasCustomer || !hasHustler) {
      // Update user to have both roles
      const newRoles = [...user.roles];
      if (!hasCustomer) newRoles.push('CUSTOMER');
      if (!hasHustler) newRoles.push('HUSTLER');
      
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          roles: newRoles,
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          roles: true,
          idVerified: true,
          stripeAccountId: true,
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error.message);
    console.error('[Auth] Error stack:', error.stack);
    
    // More specific error messages
    if (error.message && error.message.includes('JWT')) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.message && error.message.includes('prisma')) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without user
      req.user = null;
      return next();
    }

    if (!process.env.JWT_SECRET) {
      // No JWT_SECRET - continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Invalid token - continue without user
      req.user = null;
      return next();
    }
    
    let user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        roles: true,
        idVerified: true,
        stripeAccountId: true,
      },
    });

    req.user = user || null;
    next();
  } catch (error) {
    // On any error, continue without user
    req.user = null;
    next();
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Case-insensitive role check
    const userRoles = (req.user.roles || []).map(r => r.toUpperCase());
    const requiredRoles = roles.map(r => r.toUpperCase());
    const hasRole = userRoles.some(role => requiredRoles.includes(role));
    
    if (!hasRole) {
      console.error(`Role check failed. User roles: ${JSON.stringify(req.user.roles)}, Required: ${JSON.stringify(roles)}`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}, User roles: ${req.user.roles?.join(', ') || 'none'}`
      });
    }
    
    next();
  };
};

module.exports = { authenticate, optionalAuth, requireRole };
