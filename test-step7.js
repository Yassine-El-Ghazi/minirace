/**
 * test-step7.js – Bot Miners
 * Requires: server running on localhost:3000 (npm start)
 * Waits 15 seconds then checks bots have mined blocks.
 */

const BASE = process.env.SERVER_URL || 'http://localhost:3000';
const WAIT_MS = 15000;

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

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

async function run() {
  console.log('\n=== Step 7: Bot Miners ===\n');
  console.log(`  Waiting ${WAIT_MS / 1000}s for bots to mine...`);

  await new Promise((r) => setTimeout(r, WAIT_MS));

  const chain = await get('/api/chain');
  assert(chain.length > 1, `Chain grew beyond genesis (${chain.length} blocks)`);

  const botNames = ['Bot-Paris', 'Bot-Tokyo', 'Bot-NYC'];
  const stats = await get('/api/stats');
  const miners = Object.keys(stats);

  const hasBot = miners.some((m) => botNames.includes(m));
  assert(hasBot, `At least one bot has mined (found: ${miners.join(', ')})`);

  // Check each block has exactly one MINING_REWARD
  let rewardOk = true;
  for (const block of chain.slice(1)) {
    const rewards = block.transactions.filter((tx) => tx.from === 'MINING_REWARD');
    if (rewards.length !== 1) { rewardOk = false; break; }
  }
  assert(rewardOk, 'All blocks contain exactly one MINING_REWARD');

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nCould not connect to server:', err.message);
  console.error('Start the server first: npm start\n');
  process.exit(1);
});
