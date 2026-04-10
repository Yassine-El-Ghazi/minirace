/* ── admin.js – MineRace server admin panel ─────────────────────────────── */

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

function truncate(addr) {
  if (!addr || addr === 'MINING_REWARD') return addr;
  if (addr.length <= 16) return addr;
  return addr.substring(0, 8) + '…' + addr.substring(addr.length - 6);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderStatus(data) {
  // Config inputs (only set once on first load to avoid resetting while typing)
  if (!document.getElementById('cfg-difficulty')._loaded) {
    document.getElementById('cfg-difficulty').value = data.config.difficulty;
    document.getElementById('cfg-reward').value     = data.config.miningReward;
    document.getElementById('cfg-difficulty')._loaded = true;
  }

  // Chain
  document.getElementById('s-height').textContent  = data.chain.height.toLocaleString() + ' blocks';
  document.getElementById('s-hash').textContent    = data.chain.latestHash;
  document.getElementById('s-mempool').textContent = data.mempool.length + ' pending tx(s)';

  // Bots
  const botsBody = document.getElementById('bots-body');
  botsBody.innerHTML = data.config.bots.map((b) => {
    const s = data.stats[b.name] || { blocks: 0, earnings: 0 };
    return `<tr>
      <td>${b.name}</td>
      <td>${(b.interval / 1000).toFixed(0)} s</td>
      <td>${s.blocks}</td>
      <td>${s.earnings}</td>
    </tr>`;
  }).join('');

  // Balances — all addresses sorted by balance descending
  const balBody = document.getElementById('balances-body');
  const entries = Object.entries(data.balances).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    balBody.innerHTML = '<tr><td colspan="4" style="color:var(--muted)">No balances yet</td></tr>';
  } else {
    balBody.innerHTML = entries.map(([addr, bal]) => {
      const s = data.stats[addr] || { blocks: 0, earnings: 0 };
      return `<tr>
        <td title="${addr}" style="font-family:monospace;cursor:pointer"
            onclick="navigator.clipboard.writeText('${addr}')">${truncate(addr)}</td>
        <td><strong>${bal}</strong></td>
        <td>${s.blocks}</td>
        <td>${s.earnings}</td>
      </tr>`;
    }).join('');
  }

  // Mempool
  const mpCount = document.getElementById('mempool-count');
  const mpBody  = document.getElementById('mempool-body');
  mpCount.textContent = data.mempool.length ? `(${data.mempool.length})` : '';
  if (data.mempool.length === 0) {
    mpBody.innerHTML = '<tr><td colspan="3" style="color:var(--muted)">Empty</td></tr>';
  } else {
    mpBody.innerHTML = data.mempool.map((tx) => `<tr>
      <td title="${tx.from}" style="font-family:monospace">${truncate(tx.from)}</td>
      <td title="${tx.to}"   style="font-family:monospace">${truncate(tx.to)}</td>
      <td>${tx.amount}</td>
    </tr>`).join('');
  }
}

// ── Refresh loop ──────────────────────────────────────────────────────────────
async function refresh() {
  try {
    const data = await apiGet('/api/admin/status');
    renderStatus(data);
    document.getElementById('server-status').textContent  = 'Server: Online';
    document.getElementById('server-status').className   = 'valid';
  } catch {
    document.getElementById('server-status').textContent = 'Server: Offline';
    document.getElementById('server-status').className  = 'invalid';
  }
}

// ── Config controls ───────────────────────────────────────────────────────────
function showMsg(id, text, isErr = false) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className   = 'cfg-msg' + (isErr ? ' err' : '');
  setTimeout(() => { el.textContent = ''; }, 3000);
}

document.getElementById('btn-difficulty').addEventListener('click', async () => {
  const val = parseInt(document.getElementById('cfg-difficulty').value, 10);
  if (isNaN(val) || val < 1) { showMsg('msg-difficulty', 'Must be a positive integer', true); return; }
  const r = await apiPost('/api/difficulty', { difficulty: val });
  if (r.difficulty !== undefined) showMsg('msg-difficulty', `Applied — difficulty is now ${r.difficulty}`);
  else showMsg('msg-difficulty', r.error || 'Error', true);
});

document.getElementById('btn-reward').addEventListener('click', async () => {
  const val = Number(document.getElementById('cfg-reward').value);
  if (isNaN(val) || val <= 0) { showMsg('msg-reward', 'Must be a positive number', true); return; }
  const r = await apiPost('/api/reward', { reward: val });
  if (r.miningReward !== undefined) showMsg('msg-reward', `Applied — reward is now ${r.miningReward} coins`);
  else showMsg('msg-reward', r.error || 'Error', true);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
refresh();
setInterval(refresh, 3000);
