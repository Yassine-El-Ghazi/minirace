#!/usr/bin/env node
/**
 * Cross-check that a signature produced by the Android/Kotlin crypto layer
 * is accepted by the server's Transaction.isValid().
 *
 * Usage A — pass a JSON payload as argv:
 *   node scripts/verify-kotlin-sig.js '{"from":"04..","to":"04..","amount":10,"signature":"3045..","dataHash":"abcd..."}'
 *
 * Usage B — pipe it on stdin:
 *   cat payload.json | node scripts/verify-kotlin-sig.js
 *
 * The `dataHash` field is optional; when present we also check that
 * SHA256(from+to+amount) on the Node side equals what Kotlin produced.
 */
const crypto = require('crypto');
const Transaction = require('../blockchain/Transaction');

function die(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

(async () => {
  const raw = process.argv[2] || (await readStdin());
  if (!raw || !raw.trim()) die('no payload provided (argv or stdin)');

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    die(`invalid JSON: ${e.message}`);
  }

  const { from, to, amount, signature, dataHash } = payload;
  if (!from || !to || signature == null || amount == null) {
    die('payload must include {from, to, amount, signature}');
  }

  const nodeHash = crypto
    .createHash('sha256')
    .update(from + to + amount)
    .digest('hex');

  if (dataHash && dataHash.toLowerCase() !== nodeHash) {
    die(
      `hash mismatch\n  kotlin: ${dataHash}\n  node:   ${nodeHash}\n` +
        `=> the amount stringification or the UTF-8 encoding differs between platforms`,
    );
  }

  const tx = new Transaction(from, to, Number(amount), signature);
  const ok = tx.isValid();
  if (!ok) die('Transaction.isValid() returned false — signature rejected');

  console.log('OK — Transaction.isValid() accepted the Kotlin signature.');
  console.log(`  dataHash (node) = ${nodeHash}`);
  console.log(`  signature       = ${signature.slice(0, 32)}...`);
})();
