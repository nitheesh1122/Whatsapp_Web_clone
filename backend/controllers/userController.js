const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const createUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !username.trim()) {
    throw new AppError('Username is required.', 400);
  }

  const normalizedUsername = username.trim();
  if (normalizedUsername.length < 2 || normalizedUsername.length > 30) {
    throw new AppError('Username must be 2 to 30 characters long.', 400);
  }

  if (!password || String(password).trim().length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }

  const normalizedEmail = email?.trim()?.toLowerCase();
  if (normalizedEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new AppError('Email format is invalid.', 400);
    }
  }

  const existingUser = await User.findOne({ username: normalizedUsername });

  if (existingUser) {
    throw new AppError('Username already exists.', 409);
  }

  const user = await User.create({
    username: normalizedUsername,
    email: normalizedEmail || undefined,
    password: String(password),
  });

  return res.status(201).json(user);
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !String(username).trim()) {
    throw new AppError('Username is required.', 400);
  }

  if (!password || !String(password).trim()) {
    throw new AppError('Password is required.', 400);
  }

  const normalizedUsername = String(username).trim();
  const user = await User.findOne({ username: normalizedUsername }).select('+password');

  if (!user) {
    throw new AppError('Invalid username or password.', 401);
  }

  const isPasswordValid = await user.comparePassword(String(password));
  if (!isPasswordValid) {
    throw new AppError('Invalid username or password.', 401);
  }

  return res.status(200).json({
    _id: user._id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  });
});

const getUsers = asyncHandler(async (req, res) => {
  const { excludeUserId, q } = req.query;

  const filter = {};
  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }

  if (q && String(q).trim()) {
    filter.username = { $regex: String(q).trim(), $options: 'i' };
  }

  const users = await User.find(filter).sort({ createdAt: 1 });
  return res.status(200).json(users);
});

module.exports = {
  createUser,
  loginUser,
  getUsers,
};
