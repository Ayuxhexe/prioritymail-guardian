import express from 'express';
import { AlertHistory } from '../models/AlertHistory.js';
import { User } from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendFCMNotification } from '../config/firebase.js';
import { Device } from '../models/Device.js';

const router = express.Router();

// Apply auth middleware to all alerts routes
router.use(authMiddleware);

/**
 * @route   GET /api/alerts
 * @desc    Get recent alert history logs
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const alerts = await AlertHistory.find({ userId: req.user.id })
      .sort({ receivedAt: -1 })
      .limit(20);
    res.json(alerts);
  } catch (error) {
    console.error('Fetch alerts error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve alert history.' });
  }
});

/**
 * @route   POST /api/alerts/test
 * @desc    Trigger a test alarm (mock alert creation + broadcast FCM to registered devices)
 * @access  Private
 */
router.post('/test', async (req, res) => {
  try {
    const testAlert = new AlertHistory({
      userId: req.user.id,
      emailId: `test-${Date.now()}`,
      sender: 'hr@google.com',
      subject: 'Interview Schedule - Next Steps',
      snippet: 'We would love to schedule a follow-up assessment interview with you for the Software Engineer role.',
      receivedAt: new Date(),
      matchedRules: [{
        name: 'Test Alert Rule',
        type: 'subject_contains',
        value: 'Interview'
      }],
      status: 'detected'
    });

    const savedAlert = await testAlert.save();

    // Find registered devices for this user
    const devices = await Device.find({ userId: req.user.id, isEnabled: true });
    
    let fcmResults = [];
    let delivered = false;
    if (devices.length > 0) {
      console.log(`📱 Triggering test alarm for ${devices.length} device(s)`);
      for (const device of devices) {
        try {
          const result = await sendFCMNotification(device.token, {
            notification: {
              title: '🛡️ PriorityMail Alert: hr@google.com',
              body: 'Interview Schedule - Next Steps'
            },
            data: {
              alertId: savedAlert._id.toString(),
              sender: 'hr@google.com',
              subject: 'Interview Schedule - Next Steps',
              snippet: 'We would love to schedule a follow-up assessment interview...'
            }
          });
          fcmResults.push({ deviceId: device._id, success: true, messageId: result });
          delivered = true;
        } catch (fcmErr) {
          console.error(`❌ FCM failed for token ${device.token.substring(0, 10)}...:`, fcmErr.message);
          fcmResults.push({ deviceId: device._id, success: false, error: fcmErr.message });
        }
      }
      if (delivered) {
        savedAlert.status = 'sent';
        await savedAlert.save();
      }
    } else {
      console.log('⚠️  No active Android devices registered for this user to send test FCM notifications.');
    }

    res.status(201).json({
      alert: savedAlert,
      devicesContacted: devices.length,
      fcmResults
    });
  } catch (error) {
    console.error('Test alarm error:', error.message);
    res.status(500).json({ error: 'Failed to trigger test alarm.' });
  }
});

/**
 * @route   PUT /api/settings
 * @desc    Toggle user background scanning profile settings
 * @access  Private
 */
router.put('/settings', async (req, res) => {
  const { monitoringEnabled } = req.body;

  if (monitoringEnabled === undefined) {
    return res.status(400).json({ error: 'monitoringEnabled field is required.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.monitoringEnabled = monitoringEnabled;
    await user.save();

    res.json({
      monitoringEnabled: user.monitoringEnabled,
      email: user.email
    });
  } catch (error) {
    console.error('Update settings error:', error.message);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

export default router;
