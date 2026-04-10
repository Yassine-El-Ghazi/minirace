/**
 * test-step2.js – Proof of Work
 * Tests: mineBlock() produces hash starting with difficulty zeros, nonce > 0.
 */
const Block = require('./blockchain/Block');
const config = require('./config');

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

console.log('\n=== Step 2: Proof of Work ===\n');

const difficulty = config.DIFFICULTY;
const target = '0'.repeat(difficulty);

const block = new Block(1, Date.now(), '0'.repeat(64), [], 0);
console.log(`  Mining with difficulty ${difficulty} (target: "${target}")...`);
const start = Date.now();
block.mineBlock(difficulty);
const elapsed = ((Date.now() - start) / 1000).toFixed(2);
console.log(`  Done in ${elapsed}s`);

assert(block.hash.startsWith(target),           `Hash starts with "${target}"`);
assert(block.nonce > 0,                         `Nonce is positive (${block.nonce})`);
assert(block.hash.length === 64,                'Hash is 64 hex chars');
assert(block.hash === block.calculateHash(),    'Stored hash matches recalculation');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
