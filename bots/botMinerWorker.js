const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

const { index, timestamp, previousHash, transactions, nonce, difficulty } = workerData;

const target = '0'.repeat(difficulty);
let n = nonce;

function calculateHash(n) {
  const data = index + timestamp + previousHash + JSON.stringify(transactions) + n;
  return crypto.createHash('sha256').update(data).digest('hex');
}

let hash = calculateHash(n);
while (!hash.startsWith(target)) {
  n++;
  hash = calculateHash(n);
}

parentPort.postMessage({ nonce: n, hash });
