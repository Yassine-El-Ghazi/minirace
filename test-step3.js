/**
 * test-step3.js – Wallet (Keys & Signatures)
 * Tests: key generation, sign, verify, tampered hash fails.
 */
const crypto = require('crypto');
const Wallet = require('./blockchain/Wallet');

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

console.log('\n=== Step 3: Wallet (Keys & Signatures) ===\n');

const wallet = new Wallet();

assert(typeof wallet.privateKey === 'string',      'Private key is a string');
assert(wallet.privateKey.length > 0,               'Private key is non-empty');
assert(wallet.publicKey.startsWith('04'),           'Public key starts with "04" (uncompressed)');
assert(wallet.address === wallet.publicKey,         'Address equals public key');

const hash = crypto.createHash('sha256').update('test-data').digest('hex');
const signature = wallet.sign(hash);

assert(typeof signature === 'string',              'Signature is a string');
assert(signature.length > 0,                       'Signature is non-empty');

const valid = Wallet.verify(wallet.publicKey, hash, signature);
assert(valid === true,                             'Valid signature verifies correctly');

const tamperedHash = crypto.createHash('sha256').update('tampered-data').digest('hex');
const invalid = Wallet.verify(wallet.publicKey, tamperedHash, signature);
assert(invalid === false,                          'Tampered hash fails verification');

// Different wallet cannot verify
const other = new Wallet();
const wrongKey = Wallet.verify(other.publicKey, hash, signature);
assert(wrongKey === false,                         'Wrong public key fails verification');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
