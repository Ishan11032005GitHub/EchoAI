import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// controllers/authController.js
export const signup = async (req, res) => {
  try {
    const { name, email, password, profilePicture } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      profilePicture: profilePicture || null,
    });

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
};

export const signin = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.name !== name) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const oauthSuccess = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`${process.env.FRONTEND_BASE_URL}/signin.html?error=no_user`);
    }

    const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET, { 
      expiresIn: '30d' 
    });

    // Secure cookie settings
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/'
    });

    // Remove token from URL - use cookie only
    res.redirect(`${process.env.FRONTEND_BASE_URL}/home.html`);
    
  } catch (error) {
    console.error("OAuth Success Error:", error);
    res.redirect(`${process.env.FRONTEND_BASE_URL}/signin.html?error=server_error`);
  }
};

export const signout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Signed out successfully' });
};
