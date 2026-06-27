const jwt = require('jsonwebtoken');
const prisma = require('../config/database');


const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Fallback test users when database is not available
    const testUsers = [
      {
        id: '533c4c75-983d-452a-adcb-8091bb3bd03b', // Correct pharmacy user ID
        username: 'pharmacy',
        fullname: 'Pharmacy Staff',
        role: 'PHARMACIST'
      },
      {
        id: '2', // Map old ID '2' to pharmacy user
        username: 'pharmacy',
        fullname: 'Pharmacy Staff',
        role: 'PHARMACIST'
      },
      {
        id: 'f4bfc674-0598-47b1-9d7f-ae1784afdfb6', // Correct admin user ID
        username: 'admin',
        fullname: 'Admin User',
        role: 'ADMIN'
      },
      {
        id: '3', // Map old ID '3' to admin user
        username: 'admin',
        fullname: 'Admin User',
        role: 'ADMIN'
      },
      {
        id: '8ef8017b-9117-4571-bd45-86a64565bc4b', // Correct doctor user ID
        username: 'doctor1',
        fullname: 'Dr. Sarah Johnson',
        role: 'DOCTOR'
      },
      {
        id: '4', // Map old ID '4' to doctor user
        username: 'doctor',
        fullname: 'Dr. Smith',
        role: 'DOCTOR'
      },
      {
        id: '4aed4032-47eb-4c74-8e8a-6e4c51315a85', // Lab technician user ID
        username: 'labtech',
        fullname: 'Lab Technician',
        role: 'LAB_TECHNICIAN'
      },
      {
        id: '5', // Reception test user ID
        username: 'reception',
        fullname: 'Reception Staff',
        role: 'RECEPTIONIST'
      },
      {
        id: '6a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d', // Nurse test user ID
        username: 'nurse1',
        fullname: 'Nurse Mary Wilson',
        role: 'NURSE'
      },
      {
        id: '6', // Fallback nurse ID
        username: 'nurse',
        fullname: 'Nurse Staff',
        role: 'NURSE'
      }
    ];

    let user = null;

    try {
      // Try database first
      user = await prisma.user.findUnique({
        where: { id: decoded.userId || decoded.id },
        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
          email: true,
          phone: true,
          isActive: true,
          passwordChangedAt: true,
          createdAt: true
        }
      });

      // Check if user is active (only for database users)
      if (user && !user.isActive) {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact administrator.' });
      }

      // Debug: Log user found from database
      if (user) {
        console.log(`✅ [Auth] User found in database: ${user.username} (${user.id}), Role: ${user.role}`);
      }
    } catch (dbError) {
      console.log('Database not available, using test users for auth');
    }

    // Fallback to test users
    if (!user) {
      console.log(`⚠️ [Auth] User not found in database, checking test users for ID: ${decoded.userId || decoded.id}`);
      user = testUsers.find(u => u.id === (decoded.userId || decoded.id));
      if (user) {
        console.log(`✅ [Auth] Using test user: ${user.username}, Role: ${user.role}`);
      }
    }

    if (!user) {
      console.error(`❌ [Auth] User not found: ${decoded.userId || decoded.id}`);
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Override role from token if it exists (for compatibility)
    if (decoded.role && decoded.role !== user.role) {
      console.log(`⚠️ [Auth] Role mismatch - DB: ${user.role}, Token: ${decoded.role}. Using token role.`);
      user.role = decoded.role;
    }

    req.user = user;
    console.log(`✅ [Auth] Request authenticated - User: ${user.username}, Role: ${user.role}, ID: ${user.id}`);
    next();
  } catch (error) {
    console.error(`❌ [Auth] Error verifying token for ${req.method} ${req.url}:`, error.message);
    if (error.name === 'TokenExpiredError') {
      console.warn(`⚠️ [Auth] Token expired at ${error.expiredAt}`);
    }
    res.status(401).json({ error: 'Invalid token.', details: error.message });
  }
};

module.exports = authMiddleware;