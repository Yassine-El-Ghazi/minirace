/**
 * test-step9.js – AI Agent (Ollama)
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

async function run() {
  console.log('\n=== Step 9: AI Agent ===\n');

  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'How many blocks are in the chain?' }),
  });

  const data = await res.json();

  if (res.status === 503) {
    console.log('  ⚠ Ollama unavailable – graceful error returned');
    assert(typeof data.error === 'string',  'Returns error field when unavailable');
    console.log(`  Detail: ${data.detail}`);
  } else {
    assert(res.ok,                           'POST /api/chat returns 200');
    assert(typeof data.reply === 'string',   'Response has "reply" field');
    assert(data.reply.length > 0,            'Reply is non-empty');
    console.log(`\n  AI reply: "${data.reply.substring(0, 200)}…"`);
  }

  // Missing message body → 400
  const bad = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(bad.status === 400, 'Missing message → 400');

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nCould not connect to server:', err.message);
  console.error('Start the server first: npm start\n');
  process.exit(1);
});
