import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  googleId: { type: String, required: true, unique: true },
  accessToken: { type: String },
  refreshToken: { type: String },
  tokenExpiry: { type: Date },
  lastCheckedEmailId: { type: String, default: null },
  monitoringEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export const User = mongoose.model('User', userSchema);
