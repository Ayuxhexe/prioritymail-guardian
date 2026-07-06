import mongoose from 'mongoose';

const alertHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  emailId: { type: String, required: true, index: true }, // Gmail API message ID (to avoid duplicate processing)
  sender: { type: String, required: true },
  subject: { type: String },
  snippet: { type: String },
  receivedAt: { type: Date, default: Date.now },
  matchedRules: [{
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriorityRule' },
    name: { type: String },
    type: { type: String },
    value: { type: String }
  }],
  status: {
    type: String,
    enum: ['detected', 'sent', 'dismissed'],
    default: 'detected'
  },
  createdAt: { type: Date, default: Date.now }
});

export const AlertHistory = mongoose.model('AlertHistory', alertHistorySchema);
