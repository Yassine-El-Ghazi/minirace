const fs = require('fs');
const path = require('path');
const Block = require('./Block');
const Transaction = require('./Transaction');
const config = require('../config');

class Blockchain {
  constructor() {
    this.chain = [];
    this.mempool = [];
    this.balances = {};
    this._ensureDataDir();
    this._loadFromDisk();
  }

  _ensureDataDir() {
    if (!fs.existsSync(config.DATA_DIR)) {
      fs.mkdirSync(config.DATA_DIR, { recursive: true });
    }
  }

  _loadFromDisk() {
    const files = fs
      .readdirSync(config.DATA_DIR)
      .filter((f) => f.match(/^block-\d+\.json$/))
      .sort((a, b) => {
        const ai = parseInt(a.replace('block-', '').replace('.json', ''), 10);
        const bi = parseInt(b.replace('block-', '').replace('.json', ''), 10);
        return ai - bi;
      });

    if (files.length === 0) {
      const genesis = this._createGenesis();
      this.chain.push(genesis);
      this._saveBlock(genesis);
      this._applyBlock(genesis);
    } else {
      for (const file of files) {
        const data = JSON.parse(
          fs.readFileSync(path.join(config.DATA_DIR, file), 'utf8')
        );
        // Reconstruct Block instance so calculateHash() works
        const block = new Block(
          data.index,
          data.timestamp,
          data.previousHash,
          data.transactions,
          data.nonce
        );
        block.hash = data.hash;
        this.chain.push(block);
        this._applyBlock(block);
      }
    }
  }

  _createGenesis() {
    const genesis = new Block(0, Date.now(), '0'.repeat(64), [], 0);
    return genesis;
  }

  _saveBlock(block) {
    const filePath = path.join(config.DATA_DIR, `block-${block.index}.json`);
    fs.writeFileSync(filePath, JSON.stringify(block, null, 2));
  }

  _applyBlock(block) {
    for (const tx of block.transactions) {
      if (tx.from !== 'MINING_REWARD') {
        this.balances[tx.from] = (this.balances[tx.from] || 0) - tx.amount;
      }
      this.balances[tx.to] = (this.balances[tx.to] || 0) + tx.amount;
    }
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getBalance(address) {
    return this.balances[address] || 0;
  }

  getAvailableBalance(address) {
    const confirmed = this.getBalance(address);
    const pending = this.mempool
      .filter((tx) => tx.from === address)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return confirmed - pending;
  }

  addTransaction(txData) {
    const tx =
      txData instanceof Transaction
        ? txData
        : Object.assign(new Transaction('', '', 0), txData);

    if (!tx.isValid()) {
      return { success: false, error: 'Invalid signature' };
    }
    if (tx.from !== 'MINING_REWARD') {
      const available = this.getAvailableBalance(tx.from);
      if (available < tx.amount) {
        return { success: false, error: 'Insufficient balance' };
      }
    }
    this.mempool.push(tx);
    return { success: true };
  }

  getChallenge() {
    const latest = this.getLatestBlock();
    return {
      index: latest.index + 1,
      previousHash: latest.hash,
      difficulty: config.DIFFICULTY,
      miningReward: config.MINING_REWARD,
      pendingTransactions: this.mempool.map((tx) => ({
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        signature: tx.signature,
      })),
    };
  }

  submitBlock(blockData) {
    const latest = this.getLatestBlock();

    if (blockData.index !== latest.index + 1) {
      return { success: false, error: 'Stale block: index mismatch' };
    }
    if (blockData.previousHash !== latest.hash) {
      return { success: false, error: 'Previous hash mismatch' };
    }

    // Rebuild block to verify hash
    const block = new Block(
      blockData.index,
      blockData.timestamp,
      blockData.previousHash,
      blockData.transactions,
      blockData.nonce
    );
    block.hash = block.calculateHash();

    if (block.hash !== blockData.hash) {
      return { success: false, error: 'Hash mismatch' };
    }

    const target = '0'.repeat(config.DIFFICULTY);
    if (!block.hash.startsWith(target)) {
      return { success: false, error: 'Insufficient proof of work' };
    }

    const txs = blockData.transactions;

    // Exactly one mining reward
    const rewards = txs.filter((tx) => tx.from === 'MINING_REWARD');
    if (rewards.length !== 1) {
      return { success: false, error: 'Must have exactly one mining reward' };
    }
    if (rewards[0].amount !== config.MINING_REWARD) {
      return { success: false, error: `Mining reward must be ${config.MINING_REWARD}` };
    }

    // Validate signatures and balances (simulate sequential application)
    const tempBalances = { ...this.balances };
    for (const txData of txs) {
      const tx = Object.assign(new Transaction('', '', 0), txData);
      if (!tx.isValid()) {
        return { success: false, error: 'Invalid transaction signature' };
      }
      if (tx.from !== 'MINING_REWARD') {
        if ((tempBalances[tx.from] || 0) < tx.amount) {
          return { success: false, error: 'Insufficient balance in transaction' };
        }
        tempBalances[tx.from] -= tx.amount;
      }
      tempBalances[tx.to] = (tempBalances[tx.to] || 0) + tx.amount;
    }

    // Accept block
    this.chain.push(block);
    this._saveBlock(block);
    this._applyBlock(block);

    // Remove confirmed transactions from mempool by signature
    const confirmedSigs = new Set(txs.map((tx) => tx.signature));
    this.mempool = this.mempool.filter((tx) => !confirmedSigs.has(tx.signature));

    return { success: true, block };
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      const recalculated = new Block(
        current.index,
        current.timestamp,
        current.previousHash,
        current.transactions,
        current.nonce
      );
      if (current.hash !== recalculated.calculateHash()) return false;
      if (current.previousHash !== previous.hash) return false;
    }
    return true;
  }

  getStats() {
    const stats = {};
    for (const block of this.chain) {
      const reward = block.transactions.find((tx) => tx.from === 'MINING_REWARD');
      if (reward) {
        if (!stats[reward.to]) stats[reward.to] = { blocks: 0, earnings: 0 };
        stats[reward.to].blocks++;
        stats[reward.to].earnings += reward.amount;
      }
    }
    return stats;
  }
}

module.exports = Blockchain;
