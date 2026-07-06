import express from 'express';
import { PriorityRule } from '../models/PriorityRule.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all rules routes
router.use(authMiddleware);

/**
 * @route   GET /api/rules
 * @desc    Get all priority rules for the logged-in user
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const rules = await PriorityRule.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(rules);
  } catch (error) {
    console.error('Fetch rules error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve rules.' });
  }
});

/**
 * @route   POST /api/rules
 * @desc    Create a new priority rule
 * @access  Private
 */
router.post('/', async (req, res) => {
  const { name, type, value } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and Type are required.' });
  }

  const validTypes = ['sender', 'subject_contains', 'body_contains', 'attachment_type', 'is_important'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid rule type.' });
  }

  if (type !== 'is_important' && !value) {
    return res.status(400).json({ error: 'Value is required for this rule type.' });
  }

  try {
    const newRule = new PriorityRule({
      userId: req.user.id,
      name,
      type,
      value: type === 'is_important' ? 'Important' : value,
      isEnabled: true
    });

    const savedRule = await newRule.save();
    res.status(201).json(savedRule);
  } catch (error) {
    console.error('Create rule error:', error.message);
    res.status(500).json({ error: 'Failed to create rule.' });
  }
});

/**
 * @route   DELETE /api/rules/:id
 * @desc    Delete a priority rule
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const rule = await PriorityRule.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found or unauthorized.' });
    }

    res.json({ message: 'Rule deleted successfully.', id: req.params.id });
  } catch (error) {
    console.error('Delete rule error:', error.message);
    res.status(500).json({ error: 'Failed to delete rule.' });
  }
});

/**
 * @route   PUT /api/rules/:id
 * @desc    Toggle rule enabled state
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const rule = await PriorityRule.findOne({ _id: req.params.id, userId: req.user.id });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found or unauthorized.' });
    }

    rule.isEnabled = !rule.isEnabled;
    await rule.save();

    res.json(rule);
  } catch (error) {
    console.error('Toggle rule error:', error.message);
    res.status(500).json({ error: 'Failed to update rule state.' });
  }
});

export default router;
