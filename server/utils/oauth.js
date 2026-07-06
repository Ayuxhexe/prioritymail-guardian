import { google } from 'googleapis';

/**
 * Creates and returns a Google OAuth2 client.
 */
export const getOAuth2Client = () => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('❌ Missing Google OAuth credentials in environment variables.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

/**
 * Generates the Google Consent Screen redirect URL.
 * Requests offline access and forces consent to guarantee a Refresh Token is returned.
 */
export const getAuthUrl = (state) => {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    ...(state ? { state } : {}),
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'openid',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });
};
