const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { generateToken } = require('../utils/jwt');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';

// Refresh token endpoint
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { JWT_SECRET } = require('../config/database'); // Fallback if not in env
    const secret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, secret);

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate new access token
    const token = generateToken(user);

    res.json({
      message: 'Token refreshed successfully',
      token
    });
  } catch (error) {
    console.error('❌ [Auth] Refresh error:', error.message);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// Get users for login (public endpoint - includes all active users including admin)
exports.getLoginUsers = async (req, res) => {
  try {
    const users = await retryQuery(() => prisma.user.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        specialty: true
      },
      orderBy: [
        { role: 'asc' }, // Admin first
        { fullname: 'asc' }
      ]
    }));

    if (!users || users.length === 0) {
      console.warn('⚠️ [getLoginUsers] No active users found in database');
    } else {
      console.log(`✅ [getLoginUsers] Fetched ${users.length} active users`);
    }

    res.json({ users: users || [] });
  } catch (error) {
    console.error('❌ [getLoginUsers] Error:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
};

// Helper to retry database operations for sleeping Render database
async function retryQuery(queryFn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      if (error.message?.includes('Server has closed the connection') && i < retries - 1) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

// Login with isActive check
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await retryQuery(() => prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        fullname: true,
        username: true,
        password: true,
        role: true,
        isActive: true,
        consultationFee: true,
        waiveConsultationFee: true,
        qualifications: true,
        specialty: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true
      }
    }));

    if (!user) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact administrator.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    // Generate JWT token
    let token;
    try {
      token = generateToken(user);
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({ error: 'Failed to generate authentication token. Please check JWT_SECRET configuration.' });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Generate refresh token (longer lived)
    const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date()
      }
    });

    res.json({
      message: 'Password changed successfully',
      passwordChangedAt: new Date()
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        passwordChangedAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Toggle user activation status (Admin only)
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

module.exports = exports;