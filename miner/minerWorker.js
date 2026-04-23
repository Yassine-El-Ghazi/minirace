const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

const { prefix, difficulty, startNonce, stride } = workerData;
const target = '0'.repeat(difficulty);

let nonce = startNonce;
let hashes = 0;
let lastReport = Date.now();

parentPort.on('message', (msg) => {
  if (msg === 'stop') process.exit(0);
});

while (true) {
  const hash = crypto.createHash('sha256').update(prefix + nonce).digest('hex');
  hashes++;

  if (hash.startsWith(target)) {
    parentPort.postMessage({ type: 'found', nonce });
    break;
  }

  nonce += stride;

  if ((hashes & 0xffff) === 0) {
    const now = Date.now();
    const dt = now - lastReport;
    if (dt >= 1000) {
      parentPort.postMessage({ type: 'rate', hashes, ms: dt });
      hashes = 0;
      lastReport = now;
    }
  }
}
