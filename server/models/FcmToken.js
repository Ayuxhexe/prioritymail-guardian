import mongoose from 'mongoose';

// The only stored phone token for this single-user app.
const fcmTokenSchema = new mongoose.Schema({
  _id: { type: String, default: 'current' },
  token: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

export const FcmToken = mongoose.model('FcmToken', fcmTokenSchema);
