/**
 * test-step5.js – Mining Rewards & Full Cycle
 * Tests: coinbase tx, miner receives 50 coins, can send to another wallet.
 */
const fs = require('fs');

const config = require('./config');
const TEST_DIR = './data/test-blocks-5';
if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
fs.mkdirSync(TEST_DIR, { recursive: true });
config.DATA_DIR = TEST_DIR;

Object.keys(require.cache).forEach((k) => { if (k.includes('blockchain/Blockchain')) delete require.cache[k]; });

const Blockchain  = require('./blockchain/Blockchain');
const Transaction = require('./blockchain/Transaction');
const Wallet      = require('./blockchain/Wallet');
const Block       = require('./blockchain/Block');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

console.log('\n=== Step 5: Mining Rewards & Full Cycle ===\n');

const bc = new Blockchain();
const miner = new Wallet();
const recipient = new Wallet();

assert(bc.getBalance(miner.address) === 0, 'Miner starts with 0 coins');

// Mine block with coinbase
const rewardTx = new Transaction('MINING_REWARD', miner.address, config.MINING_REWARD, null);
assert(rewardTx.from === 'MINING_REWARD',                    'Coinbase from is "MINING_REWARD"');
assert(rewardTx.amount === config.MINING_REWARD,             `Mining reward is ${config.MINING_REWARD} coins`);
assert(rewardTx.signature === null,                          'Coinbase signature is null');

const block1 = new Block(1, Date.now(), bc.getLatestBlock().hash, [rewardTx], 0);
block1.mineBlock(config.DIFFICULTY);
const result = bc.submitBlock(block1);

assert(result.success === true,                                           'Block with coinbase accepted');
assert(bc.getBalance(miner.address) === config.MINING_REWARD,             `Miner balance is ${config.MINING_REWARD} after mining`);

// Send half of reward to recipient
const sendAmount = Math.floor(config.MINING_REWARD / 2);
const tx = new Transaction(miner.address, recipient.address, sendAmount);
tx.sign(miner.privateKey);
bc.addTransaction(tx);
assert(bc.mempool.length === 1,            'Pending tx in mempool');

// Mine another block including that tx
const rewardTx2 = new Transaction('MINING_REWARD', miner.address, config.MINING_REWARD, null);
const block2 = new Block(2, Date.now(), bc.getLatestBlock().hash, [tx, rewardTx2], 0);
block2.mineBlock(config.DIFFICULTY);
const result2 = bc.submitBlock(block2);

const expectedBalance = config.MINING_REWARD * 2 - sendAmount;
assert(result2.success === true,                                          'Second block accepted');
assert(bc.getBalance(miner.address) === expectedBalance,                  `Miner balance: ${config.MINING_REWARD} - ${sendAmount} + ${config.MINING_REWARD} = ${expectedBalance}`);
assert(bc.getBalance(recipient.address) === sendAmount,                   `Recipient balance is ${sendAmount}`);
assert(bc.mempool.length === 0,            'Mempool cleared after confirmation');

// Exactly one reward enforced
const doubleReward = new Transaction('MINING_REWARD', miner.address, config.MINING_REWARD, null);
const blockBad = new Block(3, Date.now(), bc.getLatestBlock().hash,
  [doubleReward, doubleReward], 0);
blockBad.mineBlock(config.DIFFICULTY);
const badResult = bc.submitBlock(blockBad);
assert(badResult.success === false,        'Block with two rewards rejected');

// Cleanup
config.DATA_DIR = './data/blocks';
fs.rmSync(TEST_DIR, { recursive: true });

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
