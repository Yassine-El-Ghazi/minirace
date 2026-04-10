/**
 * test-step1.js – Block & Chain
 * Tests: Genesis block created, correct hash format, saved to disk.
 */
const fs = require('fs');
const path = require('path');

// Clean test state
const TEST_DIR = './data/test-blocks-1';
if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

// Temporarily override DATA_DIR
const config = require('./config');
const origDir = config.DATA_DIR;
config.DATA_DIR = TEST_DIR;

const Blockchain = require('./blockchain/Blockchain');

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

console.log('\n=== Step 1: Block & Chain ===\n');

const bc = new Blockchain();
const genesis = bc.getLatestBlock();

assert(genesis !== null,                        'Genesis block exists');
assert(genesis.index === 0,                     'Genesis index is 0');
assert(typeof genesis.hash === 'string',        'Genesis has a hash string');
assert(genesis.hash.length === 64,              'Hash is 64 hex chars (SHA-256)');
assert(genesis.previousHash === '0'.repeat(64), 'Genesis previousHash is 64 zeros');
assert(genesis.transactions.length === 0,       'Genesis has no transactions');

const blockFile = path.join(TEST_DIR, 'block-0.json');
assert(fs.existsSync(blockFile),                'block-0.json written to disk');

const saved = JSON.parse(fs.readFileSync(blockFile, 'utf8'));
assert(saved.hash === genesis.hash,             'Saved hash matches in-memory hash');

// Reload from disk
config.DATA_DIR = TEST_DIR;
// Clear require cache so Blockchain re-reads
delete require.cache[require.resolve('./blockchain/Blockchain')];
const Blockchain2 = require('./blockchain/Blockchain');
const bc2 = new Blockchain2();
assert(bc2.chain.length === 1,                  'Chain reloaded with 1 block from disk');
assert(bc2.chain[0].hash === genesis.hash,      'Reloaded genesis hash matches original');

// Cleanup
config.DATA_DIR = origDir;
fs.rmSync(TEST_DIR, { recursive: true });

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
