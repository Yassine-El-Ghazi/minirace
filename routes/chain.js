const express = require('express');

module.exports = (blockchain) => {
  const router = express.Router();

  // GET /api/chain
  router.get('/', (req, res) => {
    res.json(blockchain.chain);
  });

  // GET /api/chain/:index
  router.get('/:index', (req, res) => {
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0 || idx >= blockchain.chain.length) {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.json(blockchain.chain[idx]);
  });

  return router;
};
