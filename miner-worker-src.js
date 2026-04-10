// Source file for the browser mining worker.
// Bundled into public/miner-worker.js via:  npm run build:worker
//
// Uses hash-wasm's WASM SHA-256 (embedded base64, no network fetch needed).
// ~710 000 h/s vs ~123 000 h/s for pure-JS — 5.7× faster.

import { createSHA256 } from 'hash-wasm';

let hasher = null;

self.onmessage = async function (e) {
  // Initialise WASM once per worker lifetime
  if (!hasher) {
    hasher = await createSHA256();
  }

  const { index, timestamp, previousHash, transactions, difficulty } = e.data;
  const target   = '0'.repeat(difficulty);
  const prefix   = index + timestamp + previousHash + JSON.stringify(transactions);

  // Pre-encode the constant prefix bytes once — avoids string allocation per tick
  const prefixBytes = new TextEncoder().encode(prefix);

  let nonce = 0;
  const BATCH = 5000; // hashes per setTimeout slice (keeps Stop button responsive)

  function runBatch() {
    for (let i = 0; i < BATCH; i++) {
      hasher.init();
      hasher.update(prefixBytes);         // constant bytes, no re-allocation
      hasher.update(String(nonce));       // only the nonce changes
      const hash = hasher.digest('hex');

      if (nonce % 500 === 0) {
        self.postMessage({ type: 'progress', nonce, hash });
      }

      if (hash.startsWith(target)) {
        self.postMessage({ type: 'found', nonce, hash });
        return; // done — worker will be terminated by main thread
      }
      nonce++;
    }
    setTimeout(runBatch, 0); // yield so terminate() can land between batches
  }

  runBatch();
};
