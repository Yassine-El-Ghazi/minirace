/**
 * test-step8.js – Frontend & Visual Blockchain
 * Checks that the frontend assets are served correctly.
 * For full visual testing, open http://localhost:3000 in a browser.
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

async function checkAsset(path, expectedType) {
  const res = await fetch(`${BASE}${path}`);
  assert(res.ok, `${path} served (${res.status})`);
  const ct = res.headers.get('content-type') || '';
  assert(ct.includes(expectedType), `${path} content-type includes "${expectedType}"`);
}

async function run() {
  console.log('\n=== Step 8: Frontend Assets ===\n');

  await checkAsset('/',                  'html');
  await checkAsset('/style.css',         'css');
  await checkAsset('/app.js',            'javascript');
  await checkAsset('/miner-worker.js',   'javascript');

  console.log('\n  → Open http://localhost:3000 in a browser to verify:');
  console.log('    • Wallet creation and balance display');
  console.log('    • Transaction signing and submission');
  console.log('    • Mining UI with live nonce counter');
  console.log('    • Visual blockchain explorer with coloured blocks');
  console.log('    • Leaderboard stats\n');

  console.log(`Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nCould not connect to server:', err.message);
  console.error('Start the server first: npm start\n');
  process.exit(1);
});
