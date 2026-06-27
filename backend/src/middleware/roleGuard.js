module.exports = (roles) => (req, res, next) => {
  // Debug logging
  if (!req.user) {
    console.error('❌ [roleGuard] No user found in request');
    return res.status(403).json({ error: 'Forbidden - No user authenticated' });
  }
  
  const userRole = req.user.role;
  const hasAccess = roles.includes(userRole);
  
  if (!hasAccess) {
    console.warn(`⚠️ [roleGuard] Access denied - User role: ${userRole}, Required roles: ${roles.join(', ')}`);
    return res.status(403).json({ 
      error: 'Forbidden',
      message: `Access denied. Required roles: ${roles.join(', ')}, Your role: ${userRole}`
    });
  }
  
  // Access granted
  next();
};