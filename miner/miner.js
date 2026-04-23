/**
 * MineRace CLI miner.
 *
 * Usage:
 *   node miner.js --address <pubkey>              # direct mining rewards to this pubkey
 *   node miner.js --address <pubkey> --server http://host:3000
 *   node miner.js --address <pubkey> --threads 4  # override CPU count
 *
 * No private key is needed: coinbase (MINING_REWARD -> <pubkey>) is unsigned.
 * Get your pubkey from the MineRace wallet app (tap "Copy pubkey" on the wallet screen).
 */

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Worker } = require('worker_threads');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--address') out.address = argv[++i];
    else if (a === '--server') out.server = argv[++i];
    else if (a === '--threads') out.threads = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(
    'Usage: node miner.js --address <pubkey> [--server <url>] [--threads <n>]\n' +
      '\n' +
      '  --address  Reward recipient public key (130 hex chars, starts with 04).\n' +
      '  --server   MineRace server URL. Default: http://localhost:3000 or $SERVER_URL.\n' +
      '  --threads  Worker threads. Default: all CPU cores.\n'
  );
}

async function httpGet(server, urlPath) {
  const res = await fetch(server + urlPath);
  if (!res.ok) throw new Error(`GET ${urlPath} -> ${res.status}`);
  return res.json();
}

async function httpPost(server, urlPath, body) {
  const res = await fetch(server + urlPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function formatRate(hps) {
  if (hps >= 1e6) return (hps / 1e6).toFixed(2) + ' MH/s';
  if (hps >= 1e3) return (hps / 1e3).toFixed(2) + ' kH/s';
  return hps.toFixed(0) + ' H/s';
}

function mineParallel({ prefix, difficulty, threads }) {
  return new Promise((resolve, reject) => {
    const workers = [];
    const rates = new Array(threads).fill(0);
    let settled = false;
    let reportTimer = null;

    const cleanup = () => {
      if (reportTimer) clearInterval(reportTimer);
      for (const w of workers) {
        try { w.postMessage('stop'); } catch {}
        w.terminate().catch(() => {});
      }
    };

    for (let i = 0; i < threads; i++) {
      const w = new Worker(path.join(__dirname, 'minerWorker.js'), {
        workerData: {
          prefix,
          difficulty,
          startNonce: i,
          stride: threads,
        },
      });
      workers.push(w);

      w.on('message', (msg) => {
        if (msg.type === 'rate') {
          rates[i] = (msg.hashes * 1000) / msg.ms;
        } else if (msg.type === 'found' && !settled) {
          settled = true;
          cleanup();
          resolve({ nonce: msg.nonce, hash: msg.hash });
        }
      });
      w.on('error', (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      });
    }

    reportTimer = setInterval(() => {
      const total = rates.reduce((a, b) => a + b, 0);
      process.stdout.write(`\r  mining... ${formatRate(total)}   `);
    }, 1000);
  });
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.address) {
    console.error('error: --address <pubkey> is required');
    printHelp();
    process.exit(1);
  }
  if (!/^04[0-9a-fA-F]{128}$/.test(args.address)) {
    console.error('error: --address must be 130 hex chars starting with 04 (uncompressed secp256k1 public key)');
    process.exit(1);
  }

  const server = (args.server || process.env.SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const threads = args.threads || os.cpus().length;
  const rewardAddress = args.address;

  console.log(`MineRace miner`);
  console.log(`  server:  ${server}`);
  console.log(`  threads: ${threads}`);
  console.log(`  reward:  ${rewardAddress.slice(0, 16)}...${rewardAddress.slice(-8)}`);
  console.log('');

  let accepted = 0;
  let rejected = 0;

  while (true) {
    try {
      const challenge = await httpGet(server, '/api/challenge');
      const { index, previousHash, difficulty, miningReward, pendingTransactions } = challenge;

      const rewardTx = {
        from: 'MINING_REWARD',
        to: rewardAddress,
        amount: miningReward,
        signature: null,
      };
      const txs = [...pendingTransactions, rewardTx];
      const timestamp = Date.now();

      process.stdout.write(
        `[block #${index}] diff=${difficulty} reward=${miningReward} mempool=${pendingTransactions.length}\n`
      );

      // Build exact prefix string the server uses: index + timestamp + previousHash + JSON.stringify(txs)
      const prefix = index + timestamp + previousHash + JSON.stringify(txs);

      const t0 = Date.now();
      const { nonce } = await mineParallel({ prefix, difficulty, threads });
      // Recompute hash on main thread from the exact prefix we hold, so it matches what we send.
      const hash = crypto.createHash('sha256').update(prefix + nonce).digest('hex');
      const elapsed = (Date.now() - t0) / 1000;
      process.stdout.write(`\r  found nonce=${nonce} in ${elapsed.toFixed(1)}s hash=${hash.slice(0, 16)}...\n`);

      const result = await httpPost(server, '/api/submitBlock', {
        index, timestamp, previousHash, transactions: txs, nonce, hash,
      });

      if (result.block) {
        accepted++;
        console.log(`  accepted  [accepted: ${accepted}, rejected: ${rejected}]\n`);
        await sleep(100);
      } else {
        rejected++;
        console.log(`  rejected: ${result.error || '(no error)'}  [accepted: ${accepted}, rejected: ${rejected}]\n`);
      }
    } catch (err) {
      console.error(`  error: ${err.message}`);
      await sleep(2000);
    }
  }
}

run();
