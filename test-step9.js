/**
 * test-step9.js – AI Agent (tool-calling via Ollama)
 * Requires: server running on localhost:3000 with Ollama available.
 */

const BASE = process.env.SERVER_URL || 'http://localhost:3000';

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

async function chat(message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return { res, data: await res.json() };
}

async function run() {
  console.log('\n=== Step 9: AI Agent (tool calling) ===\n');

  // ── 1. Missing body → 400 ─────────────────────────────────────────────────
  console.log('1. Input validation');
  const bad = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(bad.status === 400, 'Missing message → 400');

  // ── 2. Chain info query ───────────────────────────────────────────────────
  console.log('\n2. Chain info query');
  const { res: r1, data: d1 } = await chat('How many blocks are in the chain?');

  if (r1.status === 503) {
    console.log('  ⚠ Ollama unavailable – remaining tests skipped');
    console.log(`  Detail: ${d1.detail}`);
    assert(typeof d1.error === 'string', 'Returns error field when unavailable');
    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
    return;
  }

  assert(r1.ok,                          'POST /api/chat returns 200');
  assert(typeof d1.reply === 'string',   'Response has "reply" field');
  assert(d1.reply.length > 0,            'Reply is non-empty');
  console.log(`  Reply: "${d1.reply.substring(0, 150)}"`);

  // ── 3. Stats / leaderboard query ─────────────────────────────────────────
  console.log('\n3. Mining stats query');
  const { res: r2, data: d2 } = await chat('Who has mined the most blocks?');
  assert(r2.ok,                        'Stats query returns 200');
  assert(typeof d2.reply === 'string', 'Stats reply is a string');
  assert(d2.reply.length > 0,         'Stats reply is non-empty');
  console.log(`  Reply: "${d2.reply.substring(0, 150)}"`);

  // ── 4. Balance query for a real address ──────────────────────────────────
  console.log('\n4. Balance query');
  // Get a real address from the chain to query
  const chainRes = await fetch(`${BASE}/api/chain`);
  const chainData = await chainRes.json();
  const blocks = chainData.chain || chainData;
  let testAddress = null;
  for (const block of blocks) {
    const reward = (block.transactions || []).find((tx) => tx.from === 'MINING_REWARD');
    if (reward) { testAddress = reward.to; break; }
  }

  if (testAddress) {
    const { res: r3, data: d3 } = await chat(`What is the balance of address ${testAddress}?`);
    assert(r3.ok,                        'Balance query returns 200');
    assert(typeof d3.reply === 'string', 'Balance reply is a string');
    assert(d3.reply.length > 0,         'Balance reply is non-empty');
    console.log(`  Address: ${testAddress.substring(0, 20)}…`);
    console.log(`  Reply: "${d3.reply.substring(0, 150)}"`);
  } else {
    console.log('  ⚠ No mined blocks yet — balance query skipped');
  }

  // ── 5. Transaction history query ─────────────────────────────────────────
  if (testAddress) {
    console.log('\n5. Transaction history query');
    const { res: r4, data: d4 } = await chat(`Show me the transactions for address ${testAddress}`);
    assert(r4.ok,                        'Transaction query returns 200');
    assert(typeof d4.reply === 'string', 'Transaction reply is a string');
    assert(d4.reply && d4.reply.length > 0, 'Transaction reply is non-empty');
    if (d4.reply) console.log(`  Reply: "${d4.reply.substring(0, 150)}"`);
    else console.log(`  Error: ${JSON.stringify(d4)}`);
  }

  // ── 6. Mempool query ──────────────────────────────────────────────────────
  console.log('\n6. Mempool query');
  const { res: r5, data: d5 } = await chat('Are there any pending transactions in the mempool?');
  assert(r5.ok,                        'Mempool query returns 200');
  assert(typeof d5.reply === 'string', 'Mempool reply is a string');
  console.log(`  Reply: "${d5.reply.substring(0, 150)}"`);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nCould not connect to server:', err.message);
  console.error('Start the server first: npm start\n');
  process.exit(1);
});
