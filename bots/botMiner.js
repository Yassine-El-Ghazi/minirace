const path = require('path');
const { Worker } = require('worker_threads');
const Block = require('../blockchain/Block');
const Transaction = require('../blockchain/Transaction');
const config = require('../config');

function mineInWorker(blockData, difficulty) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'botMinerWorker.js'), {
      workerData: { ...blockData, difficulty },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

function startBots(blockchain) {
  for (const botConfig of config.BOTS) {
    let mining = false;

    setInterval(async () => {
      if (mining) return;
      mining = true;

      try {
        const latest = blockchain.getLatestBlock();

        const rewardTx = new Transaction(
          'MINING_REWARD',
          botConfig.name,
          config.MINING_REWARD,
          null
        );

        const transactions = botConfig.includeTxs
          ? [...blockchain.mempool.map((tx) => ({ ...tx })), rewardTx]
          : [rewardTx];

        const blockData = {
          index: latest.index + 1,
          timestamp: Date.now(),
          previousHash: latest.hash,
          transactions,
          nonce: 0,
        };

        const { nonce, hash } = await mineInWorker(blockData, config.DIFFICULTY);

        const block = new Block(
          blockData.index,
          blockData.timestamp,
          blockData.previousHash,
          blockData.transactions,
          nonce
        );
        block.hash = hash;

        const result = blockchain.submitBlock(block);
        if (result.success) {
          console.log(
            `[${botConfig.name}] Mined block #${block.index} | nonce: ${block.nonce} | hash: ${block.hash.substring(0, 16)}...`
          );
        }
      } catch (err) {
        console.error(`[${botConfig.name}] Mining error:`, err.message);
      } finally {
        mining = false;
      }
    }, botConfig.interval);
  }
}

module.exports = { startBots };
