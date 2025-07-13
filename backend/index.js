import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import Chat from '/models.Chat.js';
import ImageChat from '/models.ImageChat.js';
import User from '/models/User.js'

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(cookieParser());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}));

const Chat = mongoose.model('Chat', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  prompt: { type: String, required: true },
  response: { type: String, required: true },
  context: { type: Array, default: [] },
  timestamp: { type: Date, default: Date.now, index: true }
}));

// Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.cookies?.jwt || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('jwt');
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/signin.html'));
});

// Auth Routes
app.post('/api/signup', async (req, res) => {
  const { name, email, password, confirmPassword, agree } = req.body;
  
  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (agree !== true) {
    return res.status(400).json({ error: 'You must agree to the terms.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(201).json({ 
      message: 'Signup successful!',
      user: { id: newUser._id, name: newUser.name, email: newUser.email } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({ 
      message: 'Signin successful!',
      user: { id: user._id, name: user.name, email: user.email } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during signin.' });
  }
});

app.post('/api/signout', authenticate, (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: "Successfully signed out" });
});

// Chat Routes
app.post('/api/chat', authenticate, async (req, res) => {
  const { prompt, response, context } = req.body;
  const userId = req.user.userId;
  
  if (!prompt || !response) {
    return res.status(400).json({ error: 'Missing prompt or response.' });
  }

  try {
    const chat = new Chat({ 
      userId, 
      prompt: prompt.trim(), 
      response: response.trim(), 
      context: context || [] 
    });
    await chat.save();
    res.status(201).json({ success: true, chatId: chat._id });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/chathistory/:userId', authenticate, async (req, res) => {
  if (req.params.userId !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const chats = await Chat.find({ userId: req.user.userId }).sort({ timestamp: -1 });
    res.json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

app.delete('/api/chathistory', authenticate, async (req, res) => {
  try {
    const result = await Chat.deleteMany({ userId: req.user.userId });
    res.json({ 
      success: true, 
      message: "Chat history cleared", 
      deleted: result.deletedCount 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));