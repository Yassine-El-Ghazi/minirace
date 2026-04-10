/**
 * test-step6.js – REST API
 * Requires: server running on localhost:3000 (npm start)
 * Tests all endpoints return expected shapes.
 */

const BASE = process.env.SERVER_URL || 'http://localhost:3000';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
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
  console.log('\n=== Step 6: REST API ===\n');
  console.log(`  Server: ${BASE}\n`);

  // GET /api/chain
  const chain = await get('/api/chain');
  assert(Array.isArray(chain),                   'GET /api/chain returns array');
  assert(chain.length >= 1,                      'Chain has at least genesis block');

  // GET /api/chain/0
  const block0 = await get('/api/chain/0');
  assert(block0.index === 0,                     'GET /api/chain/0 returns genesis (index 0)');
  assert(typeof block0.hash === 'string',        'Block has hash field');

  // GET /api/chain/9999 (not found)
  const r404 = await fetch(`${BASE}/api/chain/9999`);
  assert(r404.status === 404,                    'GET /api/chain/9999 returns 404');

  // GET /api/balance/:address
  const fakeAddr = '0'.repeat(130);
  const balData = await get(`/api/balance/${fakeAddr}`);
  assert(balData.balance === 0,                  'GET /api/balance returns 0 for unknown address');

  // GET /api/mempool
  const mempool = await get('/api/mempool');
  assert(Array.isArray(mempool),                 'GET /api/mempool returns array');

  // GET /api/challenge
  const challenge = await get('/api/challenge');
  assert(typeof challenge.index === 'number',    'GET /api/challenge has index');
  assert(typeof challenge.previousHash === 'string', 'Challenge has previousHash');
  assert(typeof challenge.difficulty === 'number',   'Challenge has difficulty');

  // GET /api/stats
  const stats = await get('/api/stats');
  assert(typeof stats === 'object',              'GET /api/stats returns object');

  // POST /api/transaction – missing fields
  const badTx = await post('/api/transaction', { from: 'a' });
  assert(badTx.status === 400,                   'POST /api/transaction with missing fields → 400');

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nCould not connect to server:', err.message);
  console.error('Start the server first: npm start\n');
  process.exit(1);
});
