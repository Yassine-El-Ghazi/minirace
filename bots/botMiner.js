const Block = require('../blockchain/Block');
const Transaction = require('../blockchain/Transaction');
const config = require('../config');

function startBots(blockchain) {
  for (const botConfig of config.BOTS) {
    setInterval(() => {
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

        const block = new Block(
          latest.index + 1,
          Date.now(),
          latest.hash,
          transactions,
          0
        );

        block.mineBlock(config.DIFFICULTY);

        const result = blockchain.submitBlock(block);
        if (result.success) {
          console.log(
            `[${botConfig.name}] Mined block #${block.index} | nonce: ${block.nonce} | hash: ${block.hash.substring(0, 16)}...`
          );
        }
      } catch (err) {
        console.error(`[${botConfig.name}] Mining error:`, err.message);
      }
    }, botConfig.interval);
  }
}

module.exports = { startBots };
