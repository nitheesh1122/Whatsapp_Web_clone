const userSocketMap = new Map();

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    socket.on('register-user', (userId) => {
      if (!userId) return;
      userSocketMap.set(String(userId), socket.id);
      socket.userId = String(userId);
    });

    socket.on('send-message', ({ toUserId, message }) => {
      if (!toUserId || !message) return;
      const receiverSocketId = userSocketMap.get(String(toUserId));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive-message', message);
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        userSocketMap.delete(socket.userId);
      }
    });
  });
};

const getUserSocketId = (userId) => userSocketMap.get(String(userId));
const getActiveConnectionsCount = () => userSocketMap.size;

module.exports = {
  setupSocket,
  getUserSocketId,
  getActiveConnectionsCount,
};
