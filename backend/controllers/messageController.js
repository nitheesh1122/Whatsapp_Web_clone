const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');
const { getUserSocketId } = require('../socket');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const sendMessage = asyncHandler(async (req, res) => {
  const { sender, receiver, text } = req.body;

  if (!sender || !receiver) {
    throw new AppError('Sender and receiver are required.', 400);
  }

  if (!text || !text.trim()) {
    throw new AppError('Message text cannot be empty.', 400);
  }

  if (sender === receiver) {
    throw new AppError('Sender and receiver cannot be the same.', 400);
  }

  if (!mongoose.Types.ObjectId.isValid(sender) || !mongoose.Types.ObjectId.isValid(receiver)) {
    throw new AppError('Invalid sender or receiver.', 400);
  }

  const [senderUser, receiverUser] = await Promise.all([
    User.findById(sender),
    User.findById(receiver),
  ]);

  if (!senderUser || !receiverUser) {
    throw new AppError('Invalid sender or receiver.', 404);
  }

  const message = await Message.create({
    sender,
    receiver,
    text: text.trim(),
  });

  const populatedMessage = await message.populate([
    { path: 'sender', select: 'username' },
    { path: 'receiver', select: 'username' },
  ]);

  const io = req.app.get('io');
  const receiverSocketId = getUserSocketId(String(receiver));

  if (receiverSocketId && io) {
    io.to(receiverSocketId).emit('receive-message', populatedMessage);
  }

  return res.status(201).json(populatedMessage);
});

const getMessages = asyncHandler(async (req, res) => {
  const { senderId, receiverId } = req.params;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
    throw new AppError('Invalid sender or receiver.', 400);
  }

  const [senderUser, receiverUser] = await Promise.all([
    User.findById(senderId),
    User.findById(receiverId),
  ]);

  if (!senderUser || !receiverUser) {
    throw new AppError('Invalid sender or receiver.', 404);
  }

  const filter = {
    $or: [
      { sender: senderId, receiver: receiverId },
      { sender: receiverId, receiver: senderId },
    ],
  };

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username')
      .populate('receiver', 'username'),
    Message.countDocuments(filter),
  ]);

  return res.status(200).json({
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

module.exports = {
  sendMessage,
  getMessages,
};
