#!/usr/bin/env node
/**
 * Credits an address by mining one block with its mining-reward payout.
 *
 * Use this to give the Android wallet a starting balance so you can test
 * a real (non-rejected) send. The script:
 *   1) lowers difficulty to 2 via the admin endpoint (fast CPU-mine, no GPU needed)
 *   2) fetches /api/challenge, CPU-mines the nonce, POSTs /api/submitBlock
 *   3) retries if the bots grabbed the same index first
 *   4) restores the original difficulty
 *
 * Usage:
 *   node scripts/seed-wallet.js <public-key-hex> [blocks]
 *
 * Example:
 *   node scripts/seed-wallet.js 04e73dd8...980725 3
 */
const crypto = require('crypto');

const BASE = process.env.MINERACE_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin1234';
const SEED_DIFFICULTY = 2;
const MAX_NONCE_TRIES = 10_000_000;
const SUBMIT_RETRIES = 5;

const adminAuthHeader =
  'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

async function post(path, body, auth = false) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: adminAuthHeader } : {}),
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json;
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = { raw }; }
  return { ok: res.ok, status: res.status, body: json };
}

async function get(path) {
  const res = await fetch(BASE + path);
  const raw = await res.text();
  let json;
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = { raw }; }
  return { ok: res.ok, status: res.status, body: json };
}

// Matches blockchain/Block.js#calculateHash exactly:
//   data = index + timestamp + previousHash + JSON.stringify(transactions) + nonce
// (note: index + timestamp is numeric addition because both are numbers; the
// string concat starts once previousHash joins in. Don't "fix" that or the
// server will reject the block with "Hash mismatch".)
function mineOne(blockData, difficulty) {
  const target = '0'.repeat(difficulty);
  const txsJson = JSON.stringify(blockData.transactions);
  for (let nonce = 0; nonce < MAX_NONCE_TRIES; nonce++) {
    const data =
      blockData.index + blockData.timestamp + blockData.previousHash + txsJson + nonce;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (hash.startsWith(target)) return { nonce, hash };
  }
  throw new Error(`Could not mine in ${MAX_NONCE_TRIES} attempts at difficulty ${difficulty}`);
}

async function mineBlockFor(pubkey) {
  for (let attempt = 1; attempt <= SUBMIT_RETRIES; attempt++) {
    const ch = await get('/api/challenge');
    if (!ch.ok) throw new Error(`challenge failed: ${ch.status} ${JSON.stringify(ch.body)}`);
    const { index, previousHash, miningReward } = ch.body;

    const transactions = [
      { from: 'MINING_REWARD', to: pubkey, amount: miningReward, signature: null },
    ];
    const blockData = {
      index,
      timestamp: Date.now(),
      previousHash,
      transactions,
      nonce: 0,
    };

    // Mine locally at whatever the *current* difficulty is. The server may have
    // recomputed via DAA between our difficulty-lower request and this mine, but
    // difficulty 2 is cheap either way.
    const diff = (await get('/api/difficulty')).body.difficulty;
    const { nonce, hash } = mineOne(blockData, diff);
    blockData.nonce = nonce;

    const submission = { ...blockData, hash };
    const res = await post('/api/submitBlock', submission);
    if (res.ok) return res.body.block;

    const err = res.body?.error || '';
    if (/previous hash|index/i.test(err)) {
      // A bot raced us; loop and try again on the next tip.
      console.log(`  retry (${attempt}/${SUBMIT_RETRIES}): ${err}`);
      continue;
    }
    throw new Error(`submitBlock failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  throw new Error(`submitBlock kept racing bots after ${SUBMIT_RETRIES} tries`);
}

(async () => {
  const pubkey = process.argv[2];
  const blocks = parseInt(process.argv[3] || '1', 10);
  if (!pubkey || pubkey.length !== 130 || !pubkey.startsWith('04')) {
    console.error('Usage: node scripts/seed-wallet.js <uncompressed-pubkey-130-hex> [blocks]');
    process.exit(1);
  }

  const before = await get('/api/difficulty');
  if (!before.ok) throw new Error(`cannot reach server at ${BASE}`);
  const originalDifficulty = before.body.difficulty;
  console.log(`server: ${BASE}, original difficulty: ${originalDifficulty}`);

  if (originalDifficulty > SEED_DIFFICULTY) {
    const lower = await post('/api/difficulty', { difficulty: SEED_DIFFICULTY }, true);
    if (!lower.ok) throw new Error(`could not lower difficulty: ${JSON.stringify(lower.body)}`);
    console.log(`lowered difficulty → ${SEED_DIFFICULTY}`);
  }

  try {
    for (let i = 0; i < blocks; i++) {
      const block = await mineBlockFor(pubkey);
      console.log(`  mined block #${block.index} | hash: ${block.hash.slice(0, 16)}…`);
    }

    const bal = await get(`/api/balance/${pubkey}`);
    console.log(`balance for ${pubkey.slice(0, 10)}… = ${bal.body.balance}`);
  } finally {
    if (originalDifficulty > SEED_DIFFICULTY) {
      const restore = await post('/api/difficulty', { difficulty: originalDifficulty }, true);
      console.log(
        restore.ok
          ? `restored difficulty → ${originalDifficulty}`
          : `WARNING: failed to restore difficulty: ${JSON.stringify(restore.body)}`,
      );
    }
  }
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
