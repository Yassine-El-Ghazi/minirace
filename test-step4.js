/**
 * test-step4.js – Transactions & Balances
 * Tests: valid tx accepted, overdraft rejected, bad signature rejected.
 */
const fs = require('fs');

const config = require('./config');
const TEST_DIR = './data/test-blocks-4';
if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
fs.mkdirSync(TEST_DIR, { recursive: true });
config.DATA_DIR = TEST_DIR;

// Clear require cache
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

console.log('\n=== Step 4: Transactions & Balances ===\n');

const bc = new Blockchain();
const walletA = new Wallet();
const walletB = new Wallet();

// Give walletA 2 * MINING_REWARD coins
const rewardTx = new Transaction('MINING_REWARD', walletA.address, config.MINING_REWARD, null);
const block1 = new Block(1, Date.now(), bc.getLatestBlock().hash, [rewardTx], 0);
block1.mineBlock(config.DIFFICULTY);
bc.submitBlock(block1);

const rewardTx2 = new Transaction('MINING_REWARD', walletA.address, config.MINING_REWARD, null);
const block2 = new Block(2, Date.now(), bc.getLatestBlock().hash, [rewardTx2], 0);
block2.mineBlock(config.DIFFICULTY);
bc.submitBlock(block2);

const totalBalance = config.MINING_REWARD * 2;
assert(bc.getBalance(walletA.address) === totalBalance, `WalletA balance is ${totalBalance} (got ${bc.getBalance(walletA.address)})`);

// Valid transaction — send 30% of total balance
const sendAmount = Math.floor(totalBalance * 0.3);
const tx1 = new Transaction(walletA.address, walletB.address, sendAmount);
tx1.sign(walletA.privateKey);
const r1 = bc.addTransaction(tx1);
assert(r1.success === true,                    'Valid transaction accepted');
assert(bc.mempool.length === 1,                'Mempool has 1 pending tx');

// Available balance accounts for pending
const expectedAvail = totalBalance - sendAmount;
const avail = bc.getAvailableBalance(walletA.address);
assert(avail === expectedAvail,                `Available balance is ${expectedAvail} (got ${avail})`);

// Overdraft rejected
const tx2 = new Transaction(walletA.address, walletB.address, totalBalance * 10);
tx2.sign(walletA.privateKey);
const r2 = bc.addTransaction(tx2);
assert(r2.success === false,                   'Overdraft rejected');
assert(r2.error === 'Insufficient balance',    'Correct overdraft error message');

// Bad signature rejected
const tx3 = new Transaction(walletA.address, walletB.address, 10);
const otherWallet = new Wallet();
tx3.sign(otherWallet.privateKey); // wrong key
const r3 = bc.addTransaction(tx3);
assert(r3.success === false,                   'Bad signature rejected');
assert(r3.error === 'Invalid signature',       'Correct signature error message');

// Cleanup
config.DATA_DIR = './data/blocks';
fs.rmSync(TEST_DIR, { recursive: true });

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
