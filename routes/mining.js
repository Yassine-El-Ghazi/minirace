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

  // POST /api/target-time  – change target block time at runtime (minutes)
  router.post('/target-time', adminAuth, (req, res) => {
    const mins = Number(req.body.minutes);
    if (isNaN(mins) || mins <= 0) {
      return res.status(400).json({ error: 'minutes must be a positive number' });
    }
    config.TARGET_BLOCK_TIME = Math.round(mins * 60 * 1000);
    res.json({ targetBlockTime: config.TARGET_BLOCK_TIME, minutes: mins });
  });

  // POST /api/daa-enabled  – toggle DAA on/off
  router.post('/daa-enabled', adminAuth, (req, res) => {
    config.DAA_ENABLED = !!req.body.enabled;
    res.json({ daaEnabled: config.DAA_ENABLED });
  });

  // GET /api/admin/status  – full server snapshot for the admin panel
  router.get('/admin/status', adminAuth, (req, res) => {
    const stats = blockchain.getStats();
    const avgMs = blockchain.getAvgBlockTime();
    res.json({
      config: {
        difficulty:       config.DIFFICULTY,
        miningReward:     config.MINING_REWARD,
        bots:             config.BOTS.map((b) => ({ name: b.name, interval: b.interval })),
        targetBlockTime:  config.TARGET_BLOCK_TIME,
        adjustmentWindow: config.ADJUSTMENT_WINDOW,
        daaEnabled:       config.DAA_ENABLED,
      },
      chain: {
        height:          blockchain.chain.length,
        latestHash:      blockchain.getLatestBlock().hash,
        avgBlockTimeMs:  avgMs,
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
