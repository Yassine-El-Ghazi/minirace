const express = require('express');
const config = require('../config');
const adminAuth = require('../middleware/auth');

module.exports = (blockchain) => {
  const router = express.Router();

  // GET /api/challenge
  router.get('/challenge', (req, res) => {
    res.json(blockchain.getChallenge());
  });

  // POST /api/submitBlock
  router.post('/submitBlock', (req, res) => {
    const result = blockchain.submitBlock(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ message: 'Block accepted', block: result.block });
  });

  // GET /api/difficulty  – returns current difficulty and reward
  router.get('/difficulty', (req, res) => {
    res.json({ difficulty: config.DIFFICULTY, miningReward: config.MINING_REWARD });
  });

  // POST /api/difficulty  – change difficulty at runtime (any positive integer)
  router.post('/difficulty', adminAuth, (req, res) => {
    const d = parseInt(req.body.difficulty, 10);
    if (isNaN(d) || d < 1) {
      return res.status(400).json({ error: 'difficulty must be a positive integer' });
    }
    config.DIFFICULTY = d;
    res.json({ difficulty: config.DIFFICULTY });
  });

  // POST /api/reward  – change mining reward at runtime (any positive number)
  router.post('/reward', adminAuth, (req, res) => {
    const r = Number(req.body.reward);
    if (isNaN(r) || r <= 0) {
      return res.status(400).json({ error: 'reward must be a positive number' });
    }
    config.MINING_REWARD = r;
    res.json({ miningReward: config.MINING_REWARD });
  });

  // GET /api/admin/status  – full server snapshot for the admin panel
  router.get('/admin/status', adminAuth, (req, res) => {
    const stats = blockchain.getStats();
    res.json({
      config: {
        difficulty:    config.DIFFICULTY,
        miningReward:  config.MINING_REWARD,
        bots:          config.BOTS.map((b) => ({ name: b.name, interval: b.interval })),
      },
      chain: {
        height:     blockchain.chain.length,
        latestHash: blockchain.getLatestBlock().hash,
      },
      balances: blockchain.balances,
      stats,
      mempool: blockchain.mempool.map((tx) => ({
        from: tx.from, to: tx.to, amount: tx.amount,
      })),
    });
  });

  return router;
};
