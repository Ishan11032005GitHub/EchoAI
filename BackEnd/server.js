import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './Connection/connect.js';
import authMiddleware from './middleware/authMiddleware.js';
import Chat from './models/Chat.js';
import ImageChat from './models/ImageChat.js';
import User from './models/User.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateStateParam, verifyStateParam } from './utils/authUtils.js';
import helmet from 'helmet';
import morgan from 'morgan';
import express from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import Replicate from 'replicate';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Trust Railway/Heroku proxies

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

app.use(cors({
  origin: [
    'https://ishan11032005github.github.io',
    'https://ishan11032005github.github.io/EchoAI-frontend',
    process.env.FRONTEND_BASE_URL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.options('*', cors());

app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native' // Automatic cleanup
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();


mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB connection established');
});

mongoose.connection.on('disconnected', () => {
  console.warn('🔴 MongoDB disconnected');
});

// Graceful Shutdown Handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received - closing server');
  await mongoose.connection.close();
  process.exit(0);
});

// Health Check Endpoint (for Railway monitoring)
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  res.status(dbStatus === 'healthy' ? 200 : 503).json({
    status: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Error Handling Middleware (add after all routes)
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("❌ Missing Google OAuth credentials in environment variables");
  process.exit(1);
}

passport.use(
  new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({
        $or: [
          { googleId: profile.id },
          { email: profile.emails?.[0]?.value }
        ]
      });

      if (!user) {
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value,
          profilePicture: profile.photos?.[0]?.value,
          provider: 'google',
        });
      }

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  })
);

app.get('/auth/google', (req, res, next) => {
  const state = req.query.redirect || '/';
  const stateParam = generateStateParam(state);
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: stateParam,
    session: false
  })(req, res, next);
});

app.get('/auth/google/callback',
  (req, res, next) => {
    try {
      const { state } = req.query;
      const redirectUrl = verifyStateParam(state);
      req.session.redirectUrl = redirectUrl;
      next();
    } catch {
      return res.redirect(`${process.env.FRONTEND_BASE_URL}/signin.html?error=auth_failed`);
    }
  },
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_BASE_URL}/signin.html?error=auth_failed`, session: false }),
  async (req, res) => {
    const token = jwt.sign({
      userId: req.user._id,
      name: req.user.name,
      email: req.user.email,
      profilePicture: req.user.profilePicture,
    }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    const redirectWithToken = `${process.env.FRONTEND_BASE_URL}/home.html?token=${token}&user=${encodeURIComponent(JSON.stringify({
  id: req.user._id,
  name: req.user.name,
  email: req.user.email,
  profilePicture: req.user.profilePicture
}))}`;
    res.redirect(redirectWithToken);
  }
);

app.get('/api/auth/verify', async (req, res) => {
  const authHeader = req.headers.authorization || req.cookies?.token;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, profilePicture } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, profilePicture });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error("❌ Signin error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function sendPasswordResetEmail(email, token) {
  const resetLink = `${process.env.FRONTEND_BASE_URL}/reset-password.html?token=${token}`;
  const mailOptions = {
    from: `"EchoAI Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 EchoAI Password Reset',
    html: `<h3>Password Reset Requested</h3><p>Click <a href="${resetLink}">here</a> to reset your password.</p><p>This link is valid for 1 hour.</p>`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);
    return { success: true };
  } catch (error) {
    console.error("❌ Email error:", error);
    return { success: false, error };
  }
}

app.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.status(200).json({ message: '✅ Password updated successfully' });

  } catch (err) {
    console.error('❌ Reset error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/signout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

app.post("/chat", authMiddleware, async (req, res) => {
  const { prompt, response } = req.body;
  const userId = req.userId;
  if (!prompt && !response) return res.status(400).json({ message: "Prompt or response required" });

  try {
    const chat = new Chat({ userId, prompt, response });
    await chat.save();
    res.status(201).json({ message: "Chat saved", chat });
  } catch (error) {
    res.status(500).json({ message: "Error saving chat", error });
  }
});

app.post("/chatWithFile", authMiddleware, upload.single("file"), async (req, res) => {
  const { prompt, response } = req.body;
  const userId = req.userId;

  if (!prompt && !req.file) return res.status(400).json({ message: "Either prompt or file is required" });

  try {
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const chat = new Chat({ userId, prompt, response, fileUrl });
    await chat.save();
    res.status(201).json({ message: "Chat with file saved", chat });
  } catch (error) {
    res.status(500).json({ message: "Failed to save chat with file", error });
  }
});

app.get("/chathistory", authMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId }).sort({ timestamp: 1 });
    res.status(200).json({ chats });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving chats", error });
  }
});

app.delete("/chatDelete", authMiddleware, async (req, res) => {
  try {
    await Chat.deleteMany({ userId: req.userId });
    res.status(200).json({ message: "Chat history cleared." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting chats", error });
  }
});

app.post('/api/chat', authMiddleware, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://ishan11032005github.github.io'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter error:", data);
      return res.status(response.status).json({ error: data?.error?.message || 'OpenRouter error' });
    }

    const aiResponse = data.choices?.[0]?.message?.content || 'No response received';
    return res.status(200).json({ response: aiResponse });

  } catch (error) {
    console.error("❌ Error calling OpenRouter:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});


app.post('/api/image', authMiddleware, async (req, res) => {
  const { prompt, imageBase64 } = req.body;
  if (!prompt || !imageBase64) return res.status(400).json({ error: 'Missing prompt or imageBase64' });

  const newImage = new ImageChat({ userId: req.userId, prompt, imageBase64, timestamp: new Date() });
  await newImage.save();
  res.status(200).json({ message: 'Image saved', imageBase64 });
});

app.get('/api/imagehistory', authMiddleware, async (req, res) => {
  const images = await ImageChat.find({ userId: req.userId }).sort({ timestamp: -1 });
  res.status(200).json({ images });
});

const STABLE_HORDE_API = "https://stablehorde.net/api/v2";

app.post('/api/image/generate', authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const submitRes = await fetch(`${STABLE_HORDE_API}/generate/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.STABLE_HORDE_API_KEY || "0000000000"
      },
      body: JSON.stringify({
        prompt,
        params: {
          width: 384,
          height: 384,
          steps: 20,
          sampler_name: "k_dpmpp_2s_a",
          cfg_scale: 7,
          model: "Deliberate",
          n: 1
        },
        nsfw: false,
        r2: true
      })
    });

    if (!submitRes.ok) throw new Error('Failed to submit job');
    const { id: jobId } = await submitRes.json();

    let imageUrl;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const status = await (await fetch(`${STABLE_HORDE_API}/generate/check/${jobId}`)).json();
      if (status.done) {
        const result = await (await fetch(`${STABLE_HORDE_API}/generate/status/${jobId}`)).json();
        imageUrl = result.generations[0].img;
        break;
      }
    }

    if (!imageUrl) throw new Error('Timeout');
    const imageBuffer = await (await fetch(imageUrl)).arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');

    const newImage = new ImageChat({ userId: req.userId, prompt, imageBase64: base64, timestamp: new Date() });
    await newImage.save();

    res.json({ imageBase64: base64 });

  } catch (err) {
    console.error('❌ Stable Horde Error:', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

app.delete('/api/imageDelete', authMiddleware, async (req, res) => {
  try {
    await ImageChat.deleteMany({ userId: req.userId });
    res.status(200).json({ message: '🧹 Image chat history cleared.' });
  } catch (error) {
    console.error('❌ Error deleting image chats:', error);
    res.status(500).json({ message: 'Failed to clear image history', error });
  }
});

app.get('/', (req, res) => {
  res.json({
    status: 'EchoAI Backend is Running',
    routes: {
      auth: '/auth/google',
      api: '/api/...',
      docs: 'https://your-docs-link.com'
    }
  });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
