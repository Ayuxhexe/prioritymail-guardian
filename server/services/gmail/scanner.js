import { google } from 'googleapis';
import { getOAuth2Client } from '../../utils/oauth.js';
import { User } from '../../models/User.js';
import { PriorityRule } from '../../models/PriorityRule.js';
import { AlertHistory } from '../../models/AlertHistory.js';
import { FcmToken } from '../../models/FcmToken.js';
import { sendPriorityAlarm } from '../../config/firebase.js';

let scannerIntervalId = null;
const SCAN_INTERVAL_MS = 5000; // Check every 5 seconds

/**
 * Starts the background scanning loop.
 */
export const startEmailScanner = () => {
  if (scannerIntervalId) {
    console.warn('⚠️  Email scanner is already running.');
    return;
  }

  console.log('🚀 Starting Gmail background scanner daemon (polling every 5s)...');
  scannerIntervalId = setInterval(async () => {
    try {
      await scanAllUsers();
    } catch (error) {
      console.error('❌ Error during background scanner tick:', error.message);
    }
  }, SCAN_INTERVAL_MS);
};

/**
 * Stops the background scanning loop.
 */
export const stopEmailScanner = () => {
  if (scannerIntervalId) {
    clearInterval(scannerIntervalId);
    scannerIntervalId = null;
    console.log('🛑 Gmail background scanner daemon stopped.');
  }
};

/**
 * Scans the inboxes of all users who have monitoring enabled.
 */
const scanAllUsers = async () => {
  const users = await User.find({ monitoringEnabled: true, refreshToken: { $ne: null } });
  
  for (const user of users) {
    try {
      await scanUserInbox(user);
    } catch (error) {
      console.error(`❌ Failed scanning inbox for user ${user.email}:`, error.message);
    }
  }
};

/**
 * Checks for new emails and runs rules on a specific user's inbox.
 */
const scanUserInbox = async (user) => {
  const oauth2Client = getOAuth2Client();

  // 1. Token Refresh Check
  const tokenExpiry = user.tokenExpiry ? new Date(user.tokenExpiry) : new Date(0);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (tokenExpiry < fiveMinutesFromNow) {
    console.log(`🔄 Refreshing Google access token for user: ${user.email}`);
    try {
      oauth2Client.setCredentials({ refresh_token: user.refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      user.accessToken = credentials.access_token;
      user.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);
      await user.save();
    } catch (refreshErr) {
      console.error(`❌ Token refresh failed for ${user.email}. Disabling monitoring. Error:`, refreshErr.message);
      user.monitoringEnabled = false;
      await user.save();
      return;
    }
  }

  oauth2Client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // 2. Fetch recent message summaries
  let response;
  try {
    response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5
    });
  } catch (apiErr) {
    console.error(`❌ Gmail API call failed for ${user.email}:`, apiErr.message);
    return;
  }

  const { messages } = response.data;
  if (!messages || messages.length === 0) {
    return;
  }

  const newestMessageId = messages[0].id;

  // If first email matches last checked email, no new emails have arrived.
  if (user.lastCheckedEmailId === newestMessageId) {
    return;
  }

  // 3. Identify new messages
  let newMessages = [];
  for (const msg of messages) {
    if (msg.id === user.lastCheckedEmailId) {
      break;
    }
    newMessages.push(msg);
  }

  // Reverse so we process from oldest to newest new message
  newMessages.reverse();

  console.log(`📩 Detected ${newMessages.length} new email(s) for user: ${user.email}`);

  // Get active rules
  const activeRules = await PriorityRule.find({ userId: user._id, isEnabled: true });

  // 4. Retrieve details for each new message and evaluate rules
  for (const messageSummary of newMessages) {
    try {
      const emailDetail = await gmail.users.messages.get({
        userId: 'me',
        id: messageSummary.id
      });

      const parsedEmail = parseEmailDetails(emailDetail.data);
      const matchedRules = evaluateRules(parsedEmail, activeRules);

      if (matchedRules.length > 0) {
        console.log(`🚨 Priority Email Matched rules! Sender: ${parsedEmail.sender}, Subject: ${parsedEmail.subject}`);
        
        // Log Alert to Database
        const alert = new AlertHistory({
          userId: user._id,
          emailId: messageSummary.id,
          sender: parsedEmail.sender,
          subject: parsedEmail.subject,
          snippet: parsedEmail.snippet,
          receivedAt: parsedEmail.receivedAt,
          matchedRules: matchedRules.map(r => ({
            ruleId: r._id,
            name: r.name,
            type: r.type,
            value: r.value
          })),
          status: 'detected'
        });

        const savedAlert = await alert.save();

        // Send Push FCM Notifications
        const savedToken = await FcmToken.findById('current');
        const devices = savedToken ? [savedToken] : [];
        if (devices.length > 0) {
          let delivered = false;
          for (const device of devices) {
            try {
              await sendPriorityAlarm(device.token, {
                // These legacy display fields are ignored; Firebase receives data only.
                  title: `🛡️ Priority: ${parsedEmail.senderName || parsedEmail.sender}`,
                  body: parsedEmail.subject || 'Priority alert triggered',
                  data: {
                  alertId: savedAlert._id.toString(),
                  sender: parsedEmail.sender,
                  subject: parsedEmail.subject || '',
                  snippet: parsedEmail.snippet || ''
                }
              });
              delivered = true;
            } catch (fcmErr) {
              console.error(`❌ FCM notification failed for device token ${device.token.substring(0, 10)}...:`, fcmErr.message);
            }
          }
          if (delivered) {
            savedAlert.status = 'sent';
            await savedAlert.save();
          }
        }
      }
    } catch (getErr) {
      console.error(`❌ Failed to retrieve/process email ID ${messageSummary.id}:`, getErr.message);
    }
  }

  // 5. Update user's last checked message ID
  user.lastCheckedEmailId = newestMessageId;
  await user.save();
};

/**
 * Extracts sender, sender display name, subject, date, labels, and attachment extensions from raw message.
 */
const parseEmailDetails = (messageData) => {
  const headers = messageData.payload.headers;
  
  const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
  const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value;
  
  // Extract clean email address and name from "Display Name <email@address.com>"
  let sender = fromHeader;
  let senderName = '';
  const emailRegex = /([^<]+)<([^>]+)>/;
  const match = fromHeader.match(emailRegex);
  if (match) {
    senderName = match[1].trim();
    sender = match[2].trim();
  }

  const isImportant = messageData.labelIds?.includes('IMPORTANT') || false;
  const snippet = messageData.snippet || '';
  const receivedAt = dateStr ? new Date(dateStr) : new Date();

  // Parse attachments
  const attachmentTypes = [];
  const collectAttachmentTypes = (parts) => {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename) {
        const ext = part.filename.split('.').pop().toLowerCase();
        if (ext) attachmentTypes.push(ext);
      }
      if (part.parts) {
        collectAttachmentTypes(part.parts);
      }
    }
  };
  collectAttachmentTypes(messageData.payload.parts);

  return {
    sender,
    senderName,
    subject,
    snippet,
    isImportant,
    attachmentTypes,
    receivedAt
  };
};

/**
 * Evaluates rules against parsed email details. Returns matched rules.
 */
const evaluateRules = (email, rules) => {
  const matches = [];

  for (const rule of rules) {
    let matched = false;

    switch (rule.type) {
      case 'sender':
        // Exact email match or domain match (e.g. '@google.com')
        if (rule.value.startsWith('@')) {
          matched = email.sender.toLowerCase().endsWith(rule.value.toLowerCase());
        } else {
          matched = email.sender.toLowerCase() === rule.value.toLowerCase();
        }
        break;

      case 'subject_contains':
        matched = email.subject.toLowerCase().includes(rule.value.toLowerCase());
        break;

      case 'body_contains':
        matched = email.snippet.toLowerCase().includes(rule.value.toLowerCase());
        break;

      case 'is_important':
        matched = email.isImportant === true;
        break;

      case 'attachment_type':
        matched = email.attachmentTypes.includes(rule.value.toLowerCase());
        break;
      
      default:
        break;
    }

    if (matched) {
      matches.push(rule);
    }
  }

  return matches;
};
