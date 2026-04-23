/* ── app.js – MineRace read-only dashboard ─────────────────────────────────── */

let chain = [];
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

function shortAddr(addr) {
  if (!addr) return '';
  if (addr === 'MINING_REWARD') return 'MINING_REWARD';
  return addr.substring(0, 12) + '…';
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Canvas Explorer ───────────────────────────────────────────────────────────
const BLOCK_W   = 130;
const BLOCK_H   = 70;
const BLOCK_GAP = 30;
const CANVAS_PAD = 20;
const MAX_VISIBLE_BLOCKS = 30;

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

function getMinerForBlock(block) {
  const reward = block.transactions.find((tx) => tx.from === 'MINING_REWARD');
  if (reward) return reward.to;
  return 'genesis';
}

function drawChain(blocks) {
  const wrap   = document.getElementById('chain-canvas-wrap');
  const canvas = document.getElementById('chain-canvas');
  const ctx    = canvas.getContext('2d');

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

    if (isNew) {
      ctx.shadowColor = colour;
      ctx.shadowBlur  = 18;
    }

    ctx.fillStyle = colour + '33';
    drawRoundRect(ctx, x, y, BLOCK_W, BLOCK_H, 6);
    ctx.fill();

    ctx.strokeStyle = isNew ? colour : colour + 'aa';
    ctx.lineWidth   = isNew ? 3 : 2;
    drawRoundRect(ctx, x, y, BLOCK_W, BLOCK_H, 6);
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`#${block.index}`, x + BLOCK_W / 2, y + 20);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText(block.hash.substring(0, 12) + '…', x + BLOCK_W / 2, y + 36);

    ctx.fillStyle = colour;
    ctx.font = '10px sans-serif';
    ctx.fillText(shortAddr(miner), x + BLOCK_W / 2, y + 52);

    ctx.fillStyle = '#8b949e';
    ctx.font = '9px sans-serif';
    ctx.fillText(`${block.transactions.length} tx(s)`, x + BLOCK_W / 2, y + 64);
  });
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
        `<tr><td>${shortAddr(tx.from)}</td>
         <td>→</td>
         <td>${shortAddr(tx.to)}</td>
         <td>${tx.amount}</td></tr>`
    )
    .join('');

  content.innerHTML = `
    <table>
      <tr><td>Index</td><td>${block.index}</td></tr>
      <tr><td>Timestamp</td><td>${new Date(block.timestamp).toLocaleString()}</td></tr>
      <tr><td>Miner</td><td>${shortAddr(miner)}</td></tr>
      <tr><td>Nonce</td><td>${block.nonce}</td></tr>
      <tr><td>Hash</td><td style="word-break:break-all">${block.hash}</td></tr>
      <tr><td>PrevHash</td><td style="word-break:break-all">${block.previousHash}</td></tr>
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
    span.innerHTML = `${dot}${shortAddr(m)}`;
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
          <td><span class="legend-dot" style="background:${colour}"></span>${shortAddr(miner)}</td>
          <td>${s.blocks}</td>
          <td>${s.earnings}</td>
        </tr>`;
      });
    tbody.innerHTML = rows.join('') || '<tr><td colspan="3" class="empty-msg">No data yet</td></tr>';
  } catch { /* ignore */ }
}

// ── Mempool ───────────────────────────────────────────────────────────────────
async function refreshMempool() {
  try {
    const mempool = await apiGet('/api/mempool');
    const countEl = document.getElementById('mempool-count');
    const listEl  = document.getElementById('mempool-list');
    countEl.textContent = mempool.length;

    if (mempool.length === 0) {
      listEl.innerHTML = '<div class="empty-msg">No pending transactions</div>';
      return;
    }
    listEl.innerHTML = mempool.map((tx) => `
      <div class="mempool-row">
        <div><span class="mempool-addr">${shortAddr(tx.from)}</span> → <span class="mempool-addr">${shortAddr(tx.to)}</span></div>
        <div class="mempool-amount">${tx.amount} coins</div>
      </div>
    `).join('');
  } catch { /* ignore */ }
}

// ── Known addresses ───────────────────────────────────────────────────────────
async function refreshAddresses() {
  const tbody = document.getElementById('address-table-body');
  const addresses = new Set();
  chain.forEach((b) => {
    b.transactions.forEach((tx) => {
      if (tx.from !== 'MINING_REWARD') addresses.add(tx.from);
      addresses.add(tx.to);
    });
  });

  if (addresses.size === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="empty-msg">No addresses yet</td></tr>';
    return;
  }

  try {
    const list = Array.from(addresses);
    const balances = await Promise.all(
      list.map((addr) => apiGet(`/api/balance/${addr}`).catch(() => ({ balance: '?' })))
    );
    const rows = list
      .map((addr, i) => ({ addr, balance: balances[i].balance }))
      .sort((a, b) => (typeof b.balance === 'number' ? b.balance : 0) - (typeof a.balance === 'number' ? a.balance : 0))
      .map(({ addr, balance }) => {
        const colour = getMinerColour(addr);
        const display = addr.length <= 20
          ? addr
          : `<span title="${addr}" onclick="navigator.clipboard.writeText('${addr}')">${shortAddr(addr)}</span>`;
        return `<tr>
          <td><span class="legend-dot" style="background:${colour}"></span>${display}</td>
          <td>${balance}</td>
        </tr>`;
      });
    tbody.innerHTML = rows.join('');
  } catch { /* ignore */ }
}

// ── Chain info panel ──────────────────────────────────────────────────────────
async function refreshInfo() {
  try {
    const diff = await apiGet('/api/difficulty');
    document.getElementById('info-height').textContent     = chain.length;
    document.getElementById('info-difficulty').textContent = diff.difficulty;
    document.getElementById('info-reward').textContent     = diff.miningReward;

    if (chain.length >= 2) {
      const recent = chain.slice(-Math.min(20, chain.length));
      const elapsed = recent[recent.length - 1].timestamp - recent[0].timestamp;
      const avgSec = (elapsed / (recent.length - 1) / 1000).toFixed(1);
      document.getElementById('info-avgtime').textContent = `${avgSec}s`;
    } else {
      document.getElementById('info-avgtime').textContent = '–';
    }
  } catch { /* ignore */ }
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

    if (lastKnownLength === 0) {
      lastKnownLength = newChain.length;
    } else if (newChain.length > lastKnownLength) {
      for (let i = lastKnownLength; i < newChain.length; i++) {
        newBlockIndices.add(i);
      }
      lastKnownLength = newChain.length;
      const wrap = document.getElementById('chain-canvas-wrap');
      setTimeout(() => { wrap.scrollLeft = wrap.scrollWidth; }, 50);
      setTimeout(() => {
        newBlockIndices.clear();
        drawChain(chain);
      }, 5000);
    }

    chain = newChain;
    drawChain(chain);
    buildLegend(chain);
    checkChainValidity();
    refreshLeaderboard();
    refreshMempool();
    refreshAddresses();
    refreshInfo();
  } catch (err) {
    console.error('Failed to refresh chain:', err);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
refreshChain();
setInterval(refreshChain, 5000);
