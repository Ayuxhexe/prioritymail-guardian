import mongoose from 'mongoose';

const priorityRuleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['sender', 'subject_contains', 'is_important', 'attachment_type', 'body_contains'],
    required: true
  },
  value: { type: String, required: function() { return this.type !== 'is_important'; } }, // Not required if type is 'is_important'
  isEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

priorityRuleSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export const PriorityRule = mongoose.model('PriorityRule', priorityRuleSchema);
