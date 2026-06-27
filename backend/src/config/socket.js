const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      socket.join(`role:${decoded.role}`);
      socket.join(`user:${decoded.id}`);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] ${socket.user?.fullname || socket.user?.role || 'Unknown'} connected`);

    socket.on('disconnect', () => {
      console.log(`[WS] ${socket.user?.fullname || 'Unknown'} disconnected`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

function emitQueueEvent(event, data) {
  if (!io) return;
  io.emit(event, data);
}

function emitToRole(role, event, data) {
  if (!io) return;
  io.to(`role:${role}`).emit(event, data);
}

module.exports = { initSocket, getIO, emitQueueEvent, emitToRole };
