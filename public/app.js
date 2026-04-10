/* ── app.js – MineRace frontend ────────────────────────────────────────────── */

// ── Elliptic setup ────────────────────────────────────────────────────────────
const EC = elliptic.ec;
const ec = new EC('secp256k1');

// ── State ─────────────────────────────────────────────────────────────────────
let wallets = JSON.parse(localStorage.getItem('minerace_wallets') || '[]');
let activeWallet = null;
let chain = [];
let minerWorker = null;
let lastKnownLength = 0;
const newBlockIndices = new Set();

// ── Miner colour map ──────────────────────────────────────────────────────────
const MINER_COLOURS = {
  'Bot-Paris': '#e74c3c',
  'Bot-Tokyo': '#3498db',
  'Bot-NYC':   '#2ecc71',
  genesis:     '#95a5a6',
};
const FALLBACK_COLOURS = ['#9b59b6', '#f39c12', '#1abc9c', '#e67e22', '#e91e63'];
const colourCache = {};

function getMinerColour(miner) {
  if (!miner || miner === 'genesis') return MINER_COLOURS.genesis;
  if (MINER_COLOURS[miner]) return MINER_COLOURS[miner];
  if (colourCache[miner]) return colourCache[miner];
  const idx = Object.keys(colourCache).length % FALLBACK_COLOURS.length;
  colourCache[miner] = FALLBACK_COLOURS[idx];
  return colourCache[miner];
}

// ── SHA-256 (SubtleCrypto) ────────────────────────────────────────────────────
async function sha256(data) {
  const encoded = new TextEncoder().encode(data);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Wallet management ─────────────────────────────────────────────────────────
function saveWallets() {
  localStorage.setItem('minerace_wallets', JSON.stringify(wallets));
}

function populateWalletSelect() {
  const sel = document.getElementById('wallet-select');
  sel.innerHTML = '<option value="">– none –</option>';
  wallets.forEach((w, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = w.address.substring(0, 20) + '…';
    sel.appendChild(opt);
  });
}

function setActiveWallet(idx) {
  activeWallet = wallets[idx] || null;
  const addrEl = document.getElementById('wallet-address');
  const balEl  = document.getElementById('wallet-balance');
  if (!activeWallet) {
    addrEl.textContent = 'No wallet selected';
    balEl.innerHTML = '– <span>coins</span>';
    return;
  }
  addrEl.textContent = activeWallet.address;
  refreshBalance();
}

async function refreshBalance() {
  if (!activeWallet) return;
  try {
    const data = await apiGet(`/api/balance/${activeWallet.address}`);
    document.getElementById('wallet-balance').innerHTML =
      `${data.balance} <span>coins</span>`;
  } catch {
    document.getElementById('wallet-balance').innerHTML = '? <span>coins</span>';
  }
}

document.getElementById('btn-new-wallet').addEventListener('click', () => {
  const keyPair = ec.genKeyPair();
  const wallet = {
    privateKey: keyPair.getPrivate('hex'),
    address: keyPair.getPublic('hex'),
  };
  wallets.push(wallet);
  saveWallets();
  populateWalletSelect();
  const sel = document.getElementById('wallet-select');
  sel.value = wallets.length - 1;
  setActiveWallet(wallets.length - 1);
  refreshWalletTable();
});

document.getElementById('wallet-select').addEventListener('change', (e) => {
  setActiveWallet(parseInt(e.target.value, 10));
  refreshWalletTable();
});

// ── Wallet table ──────────────────────────────────────────────────────────────
async function refreshWalletTable() {
  const tbody = document.getElementById('wallet-table-body');
  if (wallets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);font-size:0.75rem">No wallets yet</td></tr>';
    return;
  }
  try {
    const [stats, ...balResults] = await Promise.all([
      apiGet('/api/stats'),
      ...wallets.map((w) => apiGet(`/api/balance/${w.address}`)),
    ]);
    tbody.innerHTML = wallets.map((w, i) => {
      const s       = stats[w.address];
      const balance = balResults[i].balance;
      const blocks  = s ? s.blocks   : 0;
      const earned  = s ? s.earnings : 0;
      const isActive = activeWallet && activeWallet.address === w.address;
      const short   = w.address.substring(0, 10) + '…';
      return `<tr class="${isActive ? 'wallet-row-active' : ''}">
        <td title="${w.address}" onclick="navigator.clipboard.writeText('${w.address}')">${short}</td>
        <td>${balance}</td>
        <td>${blocks}</td>
        <td>${earned}</td>
      </tr>`;
    }).join('');
  } catch { /* ignore */ }
}


// ── Transaction ───────────────────────────────────────────────────────────────
document.getElementById('btn-send-tx').addEventListener('click', async () => {
  const msgEl = document.getElementById('tx-msg');
  msgEl.textContent = '';
  if (!activeWallet) {
    msgEl.className = 'msg-err';
    msgEl.textContent = 'Select a wallet first.';
    return;
  }
  const customTo = document.getElementById('tx-to-custom').value.trim();
  const selectTo = document.getElementById('tx-to-select').value;
  const to = customTo || selectTo;
  const amount = parseInt(document.getElementById('tx-amount').value, 10);

  if (!to || isNaN(amount) || amount <= 0) {
    msgEl.className = 'msg-err';
    msgEl.textContent = 'Please fill in recipient and a positive amount.';
    return;
  }

  const hash = await sha256(activeWallet.address + to + amount);
  const keyPair = ec.keyFromPrivate(activeWallet.privateKey, 'hex');
  const signature = keyPair.sign(hash, 'hex').toDER('hex');

  const result = await apiPost('/api/transaction', {
    from: activeWallet.address,
    to,
    amount,
    signature,
  });

  if (result.message) {
    msgEl.className = 'msg-ok';
    msgEl.textContent = result.message;
  } else {
    msgEl.className = 'msg-err';
    msgEl.textContent = result.error || 'Unknown error';
  }
});

// ── Mining ────────────────────────────────────────────────────────────────────
// keepMining = true while the user wants to mine continuously (auto-retry on stale)
let keepMining = false;

async function startMining() {
  const msgEl = document.getElementById('mine-msg');

  if (!activeWallet) {
    msgEl.className = 'msg-err';
    msgEl.textContent = 'Select a wallet first.';
    keepMining = false;
    stopMiner();
    return;
  }

  let challenge;
  try {
    challenge = await apiGet('/api/challenge');
  } catch {
    msgEl.className = 'msg-err';
    msgEl.textContent = 'Failed to fetch challenge.';
    keepMining = false;
    stopMiner();
    return;
  }

  // Guard: user may have clicked Stop while we were fetching the challenge
  if (!keepMining) return;

  const rewardTx = {
    from: 'MINING_REWARD',
    to: activeWallet.address,
    amount: challenge.miningReward,
    signature: null,
  };
  const transactions = [...challenge.pendingTransactions, rewardTx];
  const timestamp = Date.now();

  document.getElementById('nonce-display').textContent = '0';
  msgEl.className = '';
  msgEl.textContent = `Mining block #${challenge.index}…`;

  const workerScript = document.getElementById('worker-script').value.trim() || 'miner-worker.js';
  minerWorker = new Worker(workerScript);
  minerWorker.postMessage({
    index: challenge.index,
    timestamp,
    previousHash: challenge.previousHash,
    transactions,
    difficulty: challenge.difficulty,
  });

  minerWorker.onerror = (e) => {
    stopMiner();
    keepMining = false;
    msgEl.className = 'msg-err';
    msgEl.textContent = 'Mining error. Please try again.';
    console.error('Worker error:', e.message);
  };

  minerWorker.onmessage = async (e) => {
    if (e.data.type === 'progress') {
      document.getElementById('nonce-display').textContent = e.data.nonce.toLocaleString();
      document.getElementById('hash-display').textContent = e.data.hash;
    } else if (e.data.type === 'found') {
      const { nonce, hash } = e.data;
      document.getElementById('nonce-display').textContent = nonce.toLocaleString();
      document.getElementById('hash-display').textContent = hash;

      // Terminate this worker before submitting so a new one can be spawned
      if (minerWorker) { minerWorker.terminate(); minerWorker = null; }

      const result = await apiPost('/api/submitBlock', {
        index: challenge.index,
        timestamp,
        previousHash: challenge.previousHash,
        transactions,
        nonce,
        hash,
      });

      if (result.block) {
        msgEl.className = 'msg-ok';
        msgEl.textContent = `Block #${challenge.index} accepted! Reward: ${challenge.miningReward} coins.`;
        refreshChain();
        refreshBalance();
        // Immediately start mining the next block
        if (keepMining) startMining();
      } else if (keepMining && result.error && result.error.includes('Stale')) {
        // Chain moved on while we were hashing — silently retry with fresh challenge
        msgEl.className = '';
        msgEl.textContent = `Stale (#${challenge.index}), retrying…`;
        startMining();
      } else {
        msgEl.className = 'msg-err';
        msgEl.textContent = `Rejected: ${result.error}`;
        keepMining = false;
        stopMiner();
      }
    }
  };
}

document.getElementById('btn-mine').addEventListener('click', () => {
  if (minerWorker) return;
  keepMining = true;
  document.getElementById('btn-mine').style.display = 'none';
  document.getElementById('btn-stop-mine').style.display = '';
  startMining();
});

document.getElementById('btn-stop-mine').addEventListener('click', () => {
  keepMining = false;
  stopMiner();
  document.getElementById('mine-msg').textContent = 'Mining stopped.';
  document.getElementById('mine-msg').className = 'msg-err';
});

function stopMiner() {
  if (minerWorker) {
    minerWorker.terminate();
    minerWorker = null;
  }
  document.getElementById('btn-mine').style.display = '';
  document.getElementById('btn-stop-mine').style.display = 'none';
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
document.getElementById('btn-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

function appendChatMsg(text, cls) {
  const log = document.getElementById('chat-log');
  const div = document.createElement('div');
  div.className = `chat-msg ${cls}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  appendChatMsg(`You: ${message}`, 'user');
  try {
    const data = await apiPost('/api/chat', { message });
    if (data.reply) {
      appendChatMsg(`AI: ${data.reply}`, 'ai');
    } else {
      appendChatMsg(`Error: ${data.error}`, 'error');
    }
  } catch {
    appendChatMsg('AI agent unavailable.', 'error');
  }
}

// ── Canvas Explorer ───────────────────────────────────────────────────────────
const BLOCK_W   = 130;
const BLOCK_H   = 70;
const BLOCK_GAP = 30;
const CANVAS_PAD = 20;

// Cross-browser rounded rectangle (ctx.roundRect added in Chrome 99 / Firefox 112)
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const MAX_VISIBLE_BLOCKS = 30;

function drawChain(blocks) {
  const wrap   = document.getElementById('chain-canvas-wrap');
  const canvas = document.getElementById('chain-canvas');
  const ctx    = canvas.getContext('2d');

  // Show only the most recent MAX_VISIBLE_BLOCKS to keep canvas size manageable
  const visible = blocks.slice(-MAX_VISIBLE_BLOCKS);

  const totalW = visible.length > 0
    ? CANVAS_PAD * 2 + visible.length * BLOCK_W + (visible.length - 1) * BLOCK_GAP
    : CANVAS_PAD * 2;
  const totalH = BLOCK_H + CANVAS_PAD * 2 + 20;

  canvas.width  = Math.max(totalW, wrap.clientWidth);
  canvas.height = totalH;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  visible.forEach((block, i) => {
    const x = CANVAS_PAD + i * (BLOCK_W + BLOCK_GAP);
    const y = CANVAS_PAD + 10;

    // Arrow connecting to previous block
    if (i > 0) {
      const ax = x - BLOCK_GAP;
      const ay = y + BLOCK_H / 2;
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(x, ay);
      ctx.stroke();
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.moveTo(x, ay);
      ctx.lineTo(x - 8, ay - 5);
      ctx.lineTo(x - 8, ay + 5);
      ctx.fill();
    }

    const miner  = getMinerForBlock(block);
    const colour = getMinerColour(miner);
    const isNew  = newBlockIndices.has(block.index);

    // Glow animation for newly added blocks
    if (isNew) {
      ctx.shadowColor = colour;
      ctx.shadowBlur  = 18;
    }

    // Block fill
    ctx.fillStyle = colour + '33';
    drawRoundRect(ctx, x, y, BLOCK_W, BLOCK_H, 6);
    ctx.fill();

    // Block border (brighter for new blocks)
    ctx.strokeStyle = isNew ? colour : colour + 'aa';
    ctx.lineWidth   = isNew ? 3 : 2;
    drawRoundRect(ctx, x, y, BLOCK_W, BLOCK_H, 6);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Block text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`#${block.index}`, x + BLOCK_W / 2, y + 20);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText(block.hash.substring(0, 12) + '…', x + BLOCK_W / 2, y + 36);

    ctx.fillStyle = colour;
    ctx.font = '10px sans-serif';
    ctx.fillText(miner.substring(0, 12), x + BLOCK_W / 2, y + 52);

    ctx.fillStyle = '#8b949e';
    ctx.font = '9px sans-serif';
    ctx.fillText(`${block.transactions.length} tx(s)`, x + BLOCK_W / 2, y + 64);
  });
}

function getMinerForBlock(block) {
  const reward = block.transactions.find((tx) => tx.from === 'MINING_REWARD');
  if (reward) return reward.to;
  return 'genesis';
}

// Click canvas to expand block detail
document.getElementById('chain-canvas').addEventListener('click', (e) => {
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const visible = chain.slice(-MAX_VISIBLE_BLOCKS);
  visible.forEach((block, i) => {
    const x = CANVAS_PAD + i * (BLOCK_W + BLOCK_GAP);
    const y = CANVAS_PAD + 10;
    if (mx >= x && mx <= x + BLOCK_W && my >= y && my <= y + BLOCK_H) {
      showBlockDetail(block);
    }
  });
});

function showBlockDetail(block) {
  const content = document.getElementById('block-detail-content');
  const miner = getMinerForBlock(block);

  const txRows = block.transactions
    .map(
      (tx) =>
        `<tr><td>${tx.from === 'MINING_REWARD' ? 'MINING_REWARD' : tx.from.substring(0, 12) + '…'}</td>
         <td>→</td>
         <td>${tx.to.substring(0, 12)}…</td>
         <td>${tx.amount}</td></tr>`
    )
    .join('');

  content.innerHTML = `
    <table>
      <tr><td>Index</td><td>${block.index}</td></tr>
      <tr><td>Timestamp</td><td>${new Date(block.timestamp).toLocaleString()}</td></tr>
      <tr><td>Miner</td><td>${miner}</td></tr>
      <tr><td>Nonce</td><td>${block.nonce}</td></tr>
      <tr><td>Hash</td><td>${block.hash}</td></tr>
      <tr><td>PrevHash</td><td>${block.previousHash}</td></tr>
    </table>
    <br/>
    <strong style="font-size:0.8rem;color:var(--muted)">Transactions:</strong>
    <table style="margin-top:6px">
      <tr><th>From</th><th></th><th>To</th><th>Amount</th></tr>
      ${txRows}
    </table>`;

  document.getElementById('block-detail').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
}

document.getElementById('close-block-detail').addEventListener('click', closeBlockDetail);
document.getElementById('overlay').addEventListener('click', closeBlockDetail);

function closeBlockDetail() {
  document.getElementById('block-detail').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

// ── Legend ────────────────────────────────────────────────────────────────────
function buildLegend(blocks) {
  const miners = new Set(blocks.map(getMinerForBlock));
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  miners.forEach((m) => {
    const span = document.createElement('span');
    const dot = `<span class="legend-dot" style="background:${getMinerColour(m)}"></span>`;
    span.innerHTML = `${dot}${m}`;
    legend.appendChild(span);
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
async function refreshLeaderboard() {
  try {
    const stats = await apiGet('/api/stats');
    const tbody = document.getElementById('leaderboard-body');
    const rows = Object.entries(stats)
      .sort((a, b) => b[1].blocks - a[1].blocks)
      .map(([miner, s]) => {
        const colour = getMinerColour(miner);
        return `<tr>
          <td><span class="legend-dot" style="background:${colour}"></span>${miner.substring(0, 20)}</td>
          <td>${s.blocks}</td>
          <td>${s.earnings}</td>
        </tr>`;
      });
    tbody.innerHTML = rows.join('') || '<tr><td colspan="3">No data yet</td></tr>';
  } catch { /* ignore */ }
}

// ── Recipient dropdown (populated from chain history) ─────────────────────────
function populateRecipients(blocks) {
  const addresses = new Set();
  blocks.forEach((b) => {
    b.transactions.forEach((tx) => {
      if (tx.from !== 'MINING_REWARD') addresses.add(tx.from);
      addresses.add(tx.to);
    });
  });
  wallets.forEach((w) => addresses.add(w.address));

  const sel = document.getElementById('tx-to-select');
  const current = sel.value;
  sel.innerHTML = '<option value="">– select –</option>';
  addresses.forEach((addr) => {
    const opt = document.createElement('option');
    opt.value = addr;
    opt.textContent = addr.substring(0, 20) + '…';
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

// ── Chain validity indicator ──────────────────────────────────────────────────
function checkChainValidity() {
  let valid = true;
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].previousHash !== chain[i - 1].hash) {
      valid = false;
      break;
    }
  }
  const el = document.getElementById('chain-status');
  if (valid) {
    el.textContent = 'Chain: Valid';
    el.className = 'valid';
  } else {
    el.textContent = 'Chain: INVALID';
    el.className = 'invalid';
  }
}

// ── Main refresh ──────────────────────────────────────────────────────────────
async function refreshChain() {
  try {
    const newChain = await apiGet('/api/chain');

    // Detect new blocks and mark them for animation.
    // On the very first load, just set the baseline — don't glow all existing blocks.
    if (lastKnownLength === 0) {
      lastKnownLength = newChain.length;
    } else if (newChain.length > lastKnownLength) {
      for (let i = lastKnownLength; i < newChain.length; i++) {
        newBlockIndices.add(i);
      }
      lastKnownLength = newChain.length;
      // Scroll canvas to show the latest block
      const wrap = document.getElementById('chain-canvas-wrap');
      setTimeout(() => { wrap.scrollLeft = wrap.scrollWidth; }, 50);
      // Clear glow after one extra refresh cycle
      setTimeout(() => {
        newBlockIndices.clear();
        drawChain(chain);
      }, 5000);
    }

    chain = newChain;
    drawChain(chain);
    buildLegend(chain);
    checkChainValidity();
    populateRecipients(chain);
    refreshLeaderboard();
    refreshWalletTable();
    if (activeWallet) refreshBalance();
  } catch (err) {
    console.error('Failed to refresh chain:', err);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
populateWalletSelect();
refreshChain();
setInterval(refreshChain, 5000);
