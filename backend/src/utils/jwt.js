const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';

exports.generateToken = (user) => {
  if (!user || !user.id || !user.role) {
    throw new Error('Invalid user data for token generation');
  }
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '4h' });
};

exports.verifyToken = (token) => jwt.verify(token, JWT_SECRET);