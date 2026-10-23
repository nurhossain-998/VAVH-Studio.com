const express = require('express');
const { requireAdmin } = require('../../middleware/authMiddleware');
const { buildDashboard, answerQuestion } = require('../../services/vavhAiService');

const router = express.Router();
router.use(requireAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    res.json({ success: true, data: await buildDashboard(req.query) });
  } catch (err) {
    console.error('[VAVH AI dashboard]', err);
    res.status(500).json({ success: false, message: 'Unable to build VAVH AI analytics.' });
  }
});

router.post('/ask', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ success: false, message: 'Ask a question first.' });
    res.json({ success: true, data: await answerQuestion(question, req.body || {}) });
  } catch (err) {
    console.error('[VAVH AI ask]', err);
    res.status(500).json({ success: false, message: 'Unable to answer from current analytics.' });
  }
});

module.exports = router;
