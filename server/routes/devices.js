import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { Device } from '../models/Device.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user.id })
      .select('-token')
      .sort({ lastActive: -1 });
    res.json(devices);
  } catch (error) {
    console.error('List devices error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve devices.' });
  }
});

router.post('/register', async (req, res) => {
  const token = String(req.body.token || '').trim();
  const deviceName = String(req.body.deviceName || 'Android device').trim().slice(0, 100);

  if (!token) {
    return res.status(400).json({ error: 'FCM token is required.' });
  }

  try {
    const device = await Device.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: req.user.id,
          deviceName,
          isEnabled: true,
          lastActive: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({
      id: device._id,
      deviceName: device.deviceName,
      isEnabled: device.isEnabled,
      lastActive: device.lastActive
    });
  } catch (error) {
    console.error('Register device error:', error.message);
    res.status(500).json({ error: 'Failed to register device.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    res.json({ message: 'Device removed.' });
  } catch (error) {
    console.error('Remove device error:', error.message);
    res.status(500).json({ error: 'Failed to remove device.' });
  }
});

export default router;
