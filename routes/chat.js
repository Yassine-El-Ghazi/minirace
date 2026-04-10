const express = require('express');
const { runAgent } = require('../lib/chatAgent');

module.exports = (blockchain) => {
  const router = express.Router();

  router.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message field' });

    try {
      const reply = await runAgent(message, blockchain);
      res.json({ reply });
    } catch (err) {
      res.status(503).json({ error: 'AI agent unavailable', detail: err.message });
    }
  });

  return router;
};
