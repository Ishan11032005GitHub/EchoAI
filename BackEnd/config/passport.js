import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
 
const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET=process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_APP_ID=process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET=process.env.FACEBOOK_APP_SECRET;
const BACKEND_BASE_URL=process.env.BACKEND_BASE_URL;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET || !BACKEND_BASE_URL) {
  throw new Error('❌ Missing one or more OAuth environment variables in .env');
}

// ✅ Google OAuth Strategy
passport.use(new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "https://echoai-backend-development.up.railway.app/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ providerId: profile.id, provider: 'google' });
      if (!user) {
        user = await User.create({
          name: profile.displayName,
          email: profile.emails?.[0]?.value,
          provider: 'google',
          providerId: profile.id,
          photo: profile.photos?.[0]?.value || null,
        });
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));

// ✅ Facebook OAuth Strategy
passport.use(new FacebookStrategy(
  {
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: `${BACKEND_BASE_URL}/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'emails', 'photos'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ providerId: profile.id, provider: 'facebook' });
      if (!user) {
        user = await User.create({
          name: profile.displayName,
          email: profile.emails?.[0]?.value || null,
          provider: 'facebook',
          providerId: profile.id,
          photo: profile.photos?.[0]?.value || null,
        });
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));
