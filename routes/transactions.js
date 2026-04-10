const express = require('express');
const Transaction = require('../blockchain/Transaction');

module.exports = (blockchain) => {
  const router = express.Router();

  // GET /api/balance/:address
  router.get('/balance/:address', (req, res) => {
    const { address } = req.params;
    res.json({ address, balance: blockchain.getBalance(address) });
  });

  // GET /api/mempool
  router.get('/mempool', (req, res) => {
    res.json(blockchain.mempool);
  });

  // GET /api/stats
  router.get('/stats', (req, res) => {
    res.json(blockchain.getStats());
  });

  // POST /api/transaction
  router.post('/transaction', (req, res) => {
    const { from, to, amount, signature } = req.body;
    const parsedAmount = Number(amount);
    if (!from || !to || !signature || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Missing required fields: from, to, amount (>0), signature' });
    }
    const tx = new Transaction(from, to, parsedAmount, signature);
    const result = blockchain.addTransaction(tx);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ message: 'Transaction added to mempool' });
  });

  return router;
};
