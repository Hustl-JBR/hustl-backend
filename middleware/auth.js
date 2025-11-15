const jwt = require('jsonwebtoken');
const prisma = require('../db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        roles: true,
        idVerified: true,
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
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
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

module.exports = { authenticate, requireRole };
