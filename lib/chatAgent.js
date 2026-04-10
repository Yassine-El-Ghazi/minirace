/**
 * chatAgent.js – Tool-calling AI agent shared by the HTTP route and Telegram bot.
 */
const config = require('../config');

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_balance',
      description: 'Get the confirmed coin balance for a wallet address',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Full hex wallet address' },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_transactions',
      description: 'Get all transactions sent or received by a wallet address',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Full hex wallet address' },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_block',
      description: 'Get details of a specific block by its index',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Block index (0 = genesis)' },
        },
        required: ['index'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Get mining leaderboard — blocks mined and earnings per address',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_chain_info',
      description: 'Get current chain height, difficulty, mining reward, mempool size, average block time, and DAA settings',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mempool',
      description: 'Get all pending (unconfirmed) transactions in the mempool',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────
function executeTool(name, args, blockchain) {
  switch (name) {
    case 'get_balance': {
      const bal = blockchain.getBalance(args.address);
      return JSON.stringify({ address: args.address, balance: bal });
    }
    case 'get_transactions': {
      const txs = blockchain.chain.flatMap((b) =>
        b.transactions
          .filter((tx) => tx.from === args.address || tx.to === args.address)
          .map((tx) => ({
            block:     b.index,
            direction: tx.from === args.address ? 'sent' : 'received',
            from:      tx.from,
            to:        tx.to,
            amount:    tx.amount,
          }))
      );
      const recent = txs.slice(-50);
      return JSON.stringify({ address: args.address, total: txs.length, showing: recent.length, transactions: recent });
    }
    case 'get_block': {
      const block = blockchain.chain[args.index];
      if (!block) return JSON.stringify({ error: `Block #${args.index} not found` });
      return JSON.stringify({
        index:        block.index,
        hash:         block.hash,
        previousHash: block.previousHash,
        timestamp:    block.timestamp,
        nonce:        block.nonce,
        transactions: block.transactions,
      });
    }
    case 'get_stats': {
      const stats = blockchain.getStats();
      const sorted = Object.entries(stats)
        .sort((a, b) => b[1].blocks - a[1].blocks)
        .map(([address, s]) => ({ address, blocks: s.blocks, earnings: s.earnings }));
      return JSON.stringify(sorted);
    }
    case 'get_chain_info': {
      const avgMs = blockchain.getAvgBlockTime();
      return JSON.stringify({
        height:           blockchain.chain.length,
        difficulty:       config.DIFFICULTY,
        miningReward:     config.MINING_REWARD,
        mempoolLength:    blockchain.mempool.length,
        latestHash:       blockchain.getLatestBlock().hash,
        avgBlockTimeSec:  avgMs ? (avgMs / 1000).toFixed(1) : null,
        targetBlockTimeSec: (config.TARGET_BLOCK_TIME / 1000).toFixed(0),
        daaEnabled:       config.DAA_ENABLED,
      });
    }
    case 'get_mempool': {
      return JSON.stringify(
        blockchain.mempool.map((tx) => ({ from: tx.from, to: tx.to, amount: tx.amount }))
      );
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ── Agent loop ────────────────────────────────────────────────────────────────
async function runAgent(message, blockchain) {
  const messages = [{ role: 'user', content: message }];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    for (let round = 0; round < 5; round++) {
      const ollamaRes = await fetch(`${config.OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:   config.OLLAMA_MODEL,
          messages,
          tools:   TOOLS,
          stream:  false,
        }),
        signal: controller.signal,
      });

      if (!ollamaRes.ok) throw new Error(`Ollama responded with status ${ollamaRes.status}`);

      const data = await ollamaRes.json();
      const assistantMsg = data.message;
      messages.push(assistantMsg);

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        clearTimeout(timeoutId);
        return assistantMsg.content;
      }

      for (const call of assistantMsg.tool_calls) {
        const toolName = call.function.name;
        const toolArgs = typeof call.function.arguments === 'string'
          ? JSON.parse(call.function.arguments)
          : call.function.arguments;
        const result = executeTool(toolName, toolArgs, blockchain);
        messages.push({ role: 'tool', content: result });
      }
    }

    clearTimeout(timeoutId);
    const last = messages[messages.length - 1];
    return last.content || 'Could not complete the request.';
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

module.exports = { runAgent };
