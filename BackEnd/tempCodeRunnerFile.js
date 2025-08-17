// backend/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import bodyParser from 'body-parser'; // ✅ ADD THIS
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';
import multer from 'multer';

import User from './models/User.js';
import Chat from './models/Chat.js';
import ImageChat from './models/ImageChat.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// --- Gemini AI Model Init ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- Signup Route ---
app.post('/api/signup', async (req, res) => {
  const { name, email, password, confirmPassword, agree } = req.body;

  if (!name || !email || !password || !confirmPassword)
    return res.status(400).json({ error: 'All fields are required.' });

  if (agree !== true)
    return res.status(400).json({ error: 'You must agree to the terms.' });

  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Passwords do not match.' });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(409).json({ error: 'User already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'Signup successful!' });
  } catch (error) {
    console.error('❌ Signup error:', error.message);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// --- Signin Route ---
app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: 'Invalid credentials.' });

    res.status(200).json({
      message: 'Signin successful!',
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('❌ Signin error:', error);
    res.status(500).json({ error: 'Server error during signin.' });
  }
});

// --- Save Chat Route (Modified) ---
app.post('/api/chat', async (req, res) => {
  const { prompt, response, userId } = req.body;

  console.log("🛠️ Chat body received:", req.body);

  if (!prompt || !response || !userId)
    return res.status(400).json({ error: 'Missing prompt, response, or userId' });

  try {
    const chat = new Chat({
      userId,
      prompt,
      response
      // createdAt auto-generated
    });

    await chat.save();
    console.log("✅ Chat saved to DB");
    res.status(201).json({ message: 'Chat saved successfully' });
  } catch (error) {
    console.error('❌ MongoDB Save Error:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

// IMAGE
const STABLE_HORDE_API = "https://stablehorde.net/api/v2";

app.post('/api/image', async (req, res) => {
  const { prompt, userId } = req.body;

  if (!prompt || !userId) {
    return res.status(400).json({ error: 'Missing prompt or userId' });
  }

  try {
    // Step 1: Submit generation job
    const submitRes = await fetch(`${STABLE_HORDE_API}/generate/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.STABLE_HORDE_API_KEY || "0000000000"
      },
      body: JSON.stringify({
        prompt: prompt,
        params: {
          width: 512,
          height: 512,
          steps: 30,
          sampler_name: "k_euler",
          cfg_scale: 7,
          model: "Deliberate", // Try: "DreamShaper", "RevAnimated"
          n: 1
        },
        nsfw: false,
        r2: true // Returns CDN URL instead of base64
      })
    });

    if (!submitRes.ok) {
      const error = await submitRes.json();
      throw new Error(error.message || 'Failed to submit job');
    }

    const { id: jobId } = await submitRes.json();

    // Step 2: Poll for completion
    let imageUrl;
    let attempts = 0;
    const maxAttempts = 30; // ~2.5 min timeout

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 sec delay
      
      const statusRes = await fetch(`${STABLE_HORDE_API}/generate/check/${jobId}`);
      const status = await statusRes.json();

      if (status.done) {
        const resultRes = await fetch(`${STABLE_HORDE_API}/generate/status/${jobId}`);
        const result = await resultRes.json();
        imageUrl = result.generations[0].img;
        break;
      } else if (status.faulted) {
        throw new Error('Generation failed on Stable Horde');
      }

      attempts++;
    }

    if (!imageUrl) throw new Error('Generation timeout');

    // Step 3: Fetch and convert image
    const imageRes = await fetch(imageUrl);
    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');

    // Save to DB (your existing code)
    const newImage = new ImageChat({
      userId,
      prompt,
      imageBase64: base64,
      timestamp: new Date()
    });

    await newImage.save();

    res.json({ imageBase64: base64 });

  } catch (err) {
    console.error('❌ Stable Horde Error:', err);
    res.status(500).json({ 
      error: err.message || 'Image generation failed (server error).' 
    });
  }
});

// --- Get Image History ---
app.get('/api/imagehistory/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const images = await ImageChat.find({ userId }).sort({ timestamp: -1 });
    res.json({ images });
  } catch (err) {
    console.error('❌ Image History Error:', err);
    res.status(500).json({ error: "Server error" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
