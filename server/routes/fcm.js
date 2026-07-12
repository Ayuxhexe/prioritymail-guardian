import express from 'express';
import { sendPriorityAlarm } from '../config/firebase.js';
import { FcmToken } from '../models/FcmToken.js';

const router = express.Router();

router.post('/fcm-token', async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token is required.' });
  try {
    await FcmToken.findByIdAndUpdate('current', { token, updatedAt: new Date() }, { upsert: true });
    res.status(204).end();
  } catch (error) {
    console.error('Saving FCM token failed:', error.message);
    res.status(500).json({ error: 'Failed to save FCM token.' });
  }
});

router.post('/test-alarm', async (_req, res) => {
  try {
    const savedToken = await FcmToken.findById('current');
    if (!savedToken) return res.status(404).json({ error: 'No FCM token has been received yet.' });
    const messageId = await sendPriorityAlarm(savedToken.token, {
      sender: 'test@prioritymail-guardian.com',
      subject: 'PriorityMail Guardian test alarm'
    });
    res.json({ sent: true, messageId });
  } catch (error) {
    console.error('Test alarm failed:', error.message);
    res.status(500).json({ error: 'Failed to send test alarm.' });
  }
});

export default router;
