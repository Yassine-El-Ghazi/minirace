/**
 * my-bot.js – Custom mining bot that competes via the REST API.
 *
 * Usage:
 *   node my-bot.js                          → auto wallet (saved to my-bot-wallet.json)
 *   node my-bot.js --address 04abc...       → use an existing address (e.g. from the browser UI)
 *
 * The --address flag lets you direct mining rewards to any wallet you already
 * created in the browser, so your coins land in the same wallet you manage in the UI.
 * No private key is needed – the coinbase tx (MINING_REWARD → you) has null signature.
 */

const crypto = require('crypto');
const { ec: EC } = require('elliptic');
const fs = require('fs');
const readline = require('readline');

const ec = new EC('secp256k1');
const SERVER = process.env.SERVER_URL || 'http://localhost:3000';
const WALLET_FILE = './my-bot-wallet.json';

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--address' && args[i + 1]) {
      result.address = args[i + 1];
      i++;
    }
  }
  return result;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

function loadOrCreateWallet() {
  if (fs.existsSync(WALLET_FILE)) {
    const saved = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    console.log(`[MyBot] Wallet loaded from ${WALLET_FILE}`);
    console.log(`[MyBot] Reward address: ${saved.address.substring(0, 20)}...`);
    return saved;
  }
  const keyPair = ec.genKeyPair();
  const wallet = {
    privateKey: keyPair.getPrivate('hex'),
    address: keyPair.getPublic('hex'),
  };
  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2));
  console.log(`[MyBot] New wallet created → saved to ${WALLET_FILE}`);
  console.log(`[MyBot] Reward address: ${wallet.address.substring(0, 20)}...`);
  return wallet;
}

function resolveRewardAddress(cliArgs) {
  if (cliArgs.address) {
    console.log(`[MyBot] Using --address from CLI`);
    console.log(`[MyBot] Reward address: ${cliArgs.address.substring(0, 20)}...`);
    return cliArgs.address;
  }
  const wallet = loadOrCreateWallet();
  return wallet.address;
}

// ── Hashing ───────────────────────────────────────────────────────────────────

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function calculateHash(index, timestamp, previousHash, transactions, nonce) {
  return sha256(
    index + timestamp + previousHash + JSON.stringify(transactions) + nonce
  );
}

// ── Mining ────────────────────────────────────────────────────────────────────
// Mirrors Block.mineBlock(): test nonce=0 first, then increment.

function mine(index, timestamp, previousHash, transactions, difficulty) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;
  let hash = calculateHash(index, timestamp, previousHash, transactions, nonce);
  while (!hash.startsWith(target)) {
    nonce++;
    hash = calculateHash(index, timestamp, previousHash, transactions, nonce);
  }
  return { nonce, hash };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function get(path) {
  const res = await fetch(`${SERVER}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function run() {
  const cliArgs = parseArgs();
  const rewardAddress = resolveRewardAddress(cliArgs);

  console.log(`[MyBot] Server: ${SERVER}`);
  console.log(`[MyBot] Starting mining loop...\n`);

  while (true) {
    try {
      const challenge = await get('/api/challenge');
      const { index, previousHash, difficulty, miningReward, pendingTransactions } = challenge;

      console.log(
        `[MyBot] Block #${index} | diff: ${difficulty} | reward: ${miningReward} | mempool: ${pendingTransactions.length} tx(s)`
      );

      const rewardTx = {
        from: 'MINING_REWARD',
        to: rewardAddress,
        amount: miningReward,
        signature: null,
      };

      // Include all pending mempool transactions (already signed) plus the coinbase
      const txs = [...pendingTransactions, rewardTx];

      const timestamp = Date.now();
      const { nonce, hash } = mine(index, timestamp, previousHash, txs, difficulty);

      console.log(`[MyBot] Nonce found: ${nonce} | hash: ${hash.substring(0, 20)}...`);

      const result = await post('/api/submitBlock', {
        index,
        timestamp,
        previousHash,
        transactions: txs,
        nonce,
        hash,
      });

      if (result.block) {
        console.log(`[MyBot] ✓ Block #${index} ACCEPTED — reward → ${rewardAddress.substring(0, 16)}...`);
        // Small yield so the server can process before the next challenge fetch
        await sleep(100);
      } else {
        console.log(`[MyBot] ✗ Block #${index} rejected: ${result.error}`);
      }
    } catch (err) {
      console.error(`[MyBot] Error: ${err.message}`);
      await sleep(2000);
    }
  }
}

run();
