import express from 'express';
import passport from 'passport';
import { signup, signin, signout, oauthSuccess } from '../controllers/authController.js';
import { generateStateParam } from '../utils/authUtils.js';

const router = express.Router();

// Google OAuth with state parameter
router.get('/auth/google', (req, res, next) => {
  const state = generateStateParam();
  req.session.oauthState = state;
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: state 
  })(req, res, next);
});

// Example cleanup in the callback
router.get('/auth/google/callback', (req, res, next) => {
  const { state } = req.query;
  
  try {
    verifyStateParam(req, state);
    // Clear the state after verification
    delete req.session.oauthState;
    next();
  } catch (error) {
    console.error('State verification failed:', error);
    return res.redirect(`${process.env.FRONTEND_BASE_URL}/signin.html?error=auth_failed`);
  }
}, passport.authenticate('google', { session: false }), oauthSuccess);

// Similar implementation for Facebook
router.get('/auth/facebook', (req, res, next) => {
  const state = generateStateParam();
  req.session.oauthState = state;
  passport.authenticate('facebook', { 
    scope: ['email'],
    state: state 
  })(req, res, next);
});


router.get('/auth/facebook/callback', passport.authenticate('facebook', {
  session: false,
  failureRedirect: '/auth/failure'
}), oauthSuccess);

// Add centralized failure handler
router.get('/auth/failure', (req, res) => {
  res.redirect(`${process.env.FRONTEND_BASE_URL}/signin.html?error=auth_failed`);
});

export default router;
