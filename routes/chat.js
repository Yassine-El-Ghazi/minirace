const express = require('express');
const config = require('../config');

// How many recent blocks to include in the AI context.
const CONTEXT_BLOCKS = 10;

function buildChainContext(blockchain) {
  const height = blockchain.chain.length;
  const stats = blockchain.getStats();

  function truncate(addr) {
    if (addr === 'MINING_REWARD' || addr.length <= 16) return addr;
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
  }

  const balanceLines = Object.entries(blockchain.balances)
    .map(([addr, bal]) => {
      const s = stats[addr];
      const minedInfo = s ? ` (mined ${s.blocks} block${s.blocks !== 1 ? 's' : ''})` : '';
      return `- ${truncate(addr)}: ${bal} coins${minedInfo}`;
    })
    .join('\n') || '(none)';

  // Only the last CONTEXT_BLOCKS blocks — keeps the prompt small enough for a fast reply
  const recent = blockchain.chain.slice(-CONTEXT_BLOCKS);
  const blockLines = recent
    .map((b) => {
      const reward = b.transactions.find((tx) => tx.from === 'MINING_REWARD');
      const miner = reward ? reward.to : 'genesis';
      return `  Block #${b.index} | hash: ${b.hash} | miner: ${truncate(miner)} | txs: ${b.transactions.length}`;
    })
    .join('\n');

  // Last 5 individual transactions from the recent window
  const recentTxs = recent.flatMap((b) =>
    b.transactions.map((tx) => ({ blockIndex: b.index, tx }))
  );
  const last5Txs = recentTxs.slice(-5);
  const recentTxLines = last5Txs
    .map(({ blockIndex, tx }) =>
      `  Block #${blockIndex}: ${truncate(tx.from)} -> ${truncate(tx.to)} : ${tx.amount} coins`
    )
    .join('\n') || '(none)';

  return `Blockchain Status:
- Block height: ${height}
- Difficulty: ${config.DIFFICULTY}

Last ${recent.length} blocks (showing most recent):
${blockLines}

Balances:
${balanceLines}

Last 5 transactions:
${recentTxLines}

Mempool: ${blockchain.mempool.length} pending transaction(s)`;
}

module.exports = (blockchain) => {
  const router = express.Router();

  // POST /api/chat
  router.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Missing message field' });
    }

    const context = buildChainContext(blockchain);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${config.OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.OLLAMA_MODEL,
          prompt: message,
          system: `You are a blockchain assistant.\n\n${context}\n\nAnswer based on this data.`,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama responded with status ${response.status}`);
      }

      const data = await response.json();
      res.json({ reply: data.response });
    } catch (err) {
      res.status(503).json({
        error: 'AI agent unavailable',
        detail: err.message,
      });
    }
  });

  return router;
};
