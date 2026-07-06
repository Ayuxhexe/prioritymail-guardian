import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { getAuthUrl, getOAuth2Client } from '../utils/oauth.js';
import { User } from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/auth/google
 * @desc    Redirect to Google OAuth consent screen
 */
router.get('/google', (req, res) => {
  try {
    const state = req.query.client === 'android' ? 'android' : undefined;
    const authUrl = getAuthUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Redirect error:', error.message);
    res.status(500).json({ error: 'Failed to initiate Google Authentication.' });
  }
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback handler. Exchanges code for tokens, creates/updates User, redirects to dashboard with JWT.
 */
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('http://localhost:5173/?error=no_code');
  }

  try {
    const oauth2Client = getOAuth2Client();
    
    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoResponse = await oauth2.userinfo.get();
    const { id, email, name, picture } = userInfoResponse.data;

    if (!email) {
      return res.redirect('http://localhost:5173/?error=no_email');
    }

    // Find or create User in MongoDB
    let user = await User.findOne({ googleId: id });

    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

    if (user) {
      // Update existing user tokens
      user.accessToken = tokens.access_token;
      
      // Google only returns refresh_token on initial consent. We force prompt='consent' in oauth.js,
      // but we should still retain the old refresh token if it is not sent in this login.
      if (tokens.refresh_token) {
        user.refreshToken = tokens.refresh_token;
      }
      
      user.tokenExpiry = tokenExpiry;
      user.name = name;
      await user.save();
    } else {
      // Create new user
      user = new User({
        googleId: id,
        email,
        name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token, // Guaranteed if prompt='consent' was used
        tokenExpiry
      });
      await user.save();
    }

    // Sign session JWT
    const sessionSecret = process.env.SESSION_SECRET || 'priority_mail_guardian_secure_secret_123!';
    const jwtToken = jwt.sign({ id: user._id }, sessionSecret, { expiresIn: '7d' });

    console.log(`✅ User authenticated successfully: ${email}`);

    if (state === 'android') {
      res.redirect(`prioritymailguardian://auth?token=${encodeURIComponent(jwtToken)}`);
    } else {
      res.redirect(`http://localhost:5173/?token=${encodeURIComponent(jwtToken)}`);
    }
  } catch (error) {
    console.error('❌ Google OAuth callback error:', error.message);
    res.redirect('http://localhost:5173/?error=auth_failed');
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get authenticated user profile details
 * @access  Private
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // req.user is attached by authMiddleware
    res.json({
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      createdAt: req.user.createdAt
    });
  } catch (error) {
    console.error('Profile retrieval error:', error.message);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout endpoint (confirms logout action)
 * @access  Private
 */
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

export default router;
