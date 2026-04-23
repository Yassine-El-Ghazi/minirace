# MineRace

A from-scratch balance-based blockchain with three clients:

- **Web dashboard** (`public/`) — read-only chain explorer + AI agent.
- **Android wallet** (`android-app/`) — holds keys, signs transactions, shows balance.
- **CLI miner** (`miner/`) — cross-compiled native binaries that mine against the HTTP API.

The server (`server.js`) hosts a single blockchain node with REST endpoints, persistent block storage, a dynamic difficulty algorithm, server-side "competitor" bots, and a tool-calling AI agent served over both HTTP and Telegram.

## Repository layout

```
minirace/
├── server.js              # Express entry point, binds everything together
├── config.js              # All tunable parameters in one file
├── blockchain/
│   ├── Block.js           # Block class: fields + calculateHash() + mineBlock()
│   ├── Blockchain.js      # Chain state, mempool, submitBlock validation, DAA, persistence
│   ├── Transaction.js     # ECDSA sign/verify, coinbase rule
│   └── Wallet.js          # secp256k1 keypair generation
├── routes/                # Route handlers grouped by concern
│   ├── chain.js           # GET /api/chain…
│   ├── mining.js          # /api/challenge, /api/submitBlock, admin knobs
│   ├── transactions.js    # POST /api/transaction, /api/balance, /api/stats
│   └── chat.js            # POST /api/chat (AI agent bridge)
├── lib/chatAgent.js       # Tool-calling loop (shared by HTTP + Telegram)
├── middleware/auth.js     # HTTP Basic Auth for admin routes
├── bots/
│   ├── botMiner.js        # In-process "NPC" miners (run inside the server)
│   ├── botMinerWorker.js  # worker_threads helper for the bots
│   └── telegramBot.js     # Telegram front-end for the same AI agent
├── data/blocks/           # Persistent block-<N>.json files (source of truth on restart)
├── public/                # Web dashboard (read-only explorer)
├── android-app/           # Android wallet (Kotlin / Jetpack Compose)
├── miner/                 # CLI miner source + compiled binaries for 5 platforms
├── scripts/               # One-off helpers (seed-wallet, cross-check signatures…)
└── test-step1.js … test-step10.js
```

## Quick start

```bash
# Server
npm install
npm start
# Web dashboard:  http://localhost:3000
# Admin panel:    http://localhost:3000/admin.html   (admin / admin1234)

# CLI miner (pick your platform binary from miner/dist/)
./miner/dist/minerace-miner-linux-x64 \
    --address <pubkey-from-android-wallet> \
    --server http://<server-host>:3000

# Android wallet (debug APK)
adb install android-app/app/build/outputs/apk/debug/app-debug.apk
```

For a signed release APK rebuild, see the [Android wallet](#android-wallet) section.

---

## How the blockchain actually works

### Block structure

A block (`blockchain/Block.js`) has six fields:

| Field | Meaning |
|-------|---------|
| `index` | Height in the chain (genesis = 0) |
| `timestamp` | `Date.now()` when the miner assembled the block |
| `previousHash` | `hash` field of block `index − 1` |
| `transactions` | Array of transactions, ends with exactly one coinbase |
| `nonce` | Integer the miner incremented to find a valid hash |
| `hash` | `sha256(index + timestamp + previousHash + JSON.stringify(transactions) + nonce)` |

The hash formula is the important one — all clients (server, CLI miner, tests, Android) must compute it byte-for-byte identically or submissions are rejected. Note the quirk: `index + timestamp` are added as **numbers** first (left-to-right), and the result becomes a string only when `previousHash` joins the expression. That's why `my-bot.js`-style clones always replicate that exact expression rather than concatenating strings manually.

### Transaction structure and signing

A transaction (`blockchain/Transaction.js`) has `from`, `to`, `amount`, and `signature`. Signing works like this:

1. Build a signing digest: `SHA256(from + to + amount.toString())`.
2. Sign with secp256k1 (ECDSA) using the sender's private key.
3. The public key (uncompressed, 130 hex chars starting with `04`) is both the address and the verification key — there is no separate address format.

Verification inverts the process: recompute the digest, use `from` as the public key, check the signature. Two special rules:

- **Coinbase.** When `from === 'MINING_REWARD'`, the signature is `null` and `isValid()` returns `true`. This is how mining rewards enter circulation.
- **Low-S / DER encoding.** Signatures are serialized as DER hex with a "low-s" normalization so the same (message, key) always produces the same canonical signature (RFC 6979 deterministic k). The Android wallet replicates this exactly; see `android-app/.../crypto/Secp256k1.kt`.

### Mining: the challenge / submit loop

Mining is a pure HTTP flow — no persistent connection, no push. A miner (browser, CLI, server bot) does this:

1. `GET /api/challenge` returns `{ index, previousHash, difficulty, miningReward, pendingTransactions }`. This is a snapshot, not a lock — multiple miners can pull the same challenge simultaneously.
2. The miner assembles a candidate block: `[...pendingTransactions, coinbase]` where the coinbase is `{ from: 'MINING_REWARD', to: <yourPubKey>, amount: miningReward, signature: null }`.
3. Pick a `timestamp = Date.now()`, then loop: increment `nonce`, recompute `hash`, stop when `hash` starts with `difficulty` zeros. This is the proof-of-work.
4. `POST /api/submitBlock { index, timestamp, previousHash, transactions, nonce, hash }`.

The server validates in strict order (`blockchain/Blockchain.js::submitBlock`):

1. `index` must equal `latest.index + 1` — else "Stale block: index mismatch".
2. `previousHash` must equal `latest.hash` — else "Previous hash mismatch".
3. Server reconstructs the `Block` and recomputes `hash` — must equal submitted `hash`, else "Hash mismatch".
4. Hash must have the required leading zeros for the current live difficulty — else "Insufficient proof of work".
5. Exactly one coinbase tx, amount matches current reward.
6. Every non-coinbase tx's signature verifies, and the sender has enough confirmed balance.

Only after all six pass does the block get appended, persisted to `data/blocks/block-<N>.json`, removed from mempool, and "won".

### Dynamic difficulty adjustment (DAA)

Every 10 new blocks (`ADJUSTMENT_INTERVAL`), the server looks at the average block time over the last 100 blocks (`ADJUSTMENT_WINDOW`) and compares it to the target (`TARGET_BLOCK_TIME`, default 5 minutes). If blocks arrive more than twice as fast as target it raises difficulty by 1; more than twice as slow, lowers by 1; otherwise leaves it alone. Difficulty is capped in `[1, 20]`.

DAA can be turned off from the admin panel — then difficulty stays wherever it was last set manually, useful for deterministic tests. The current value travels with every `/api/challenge` response, so miners automatically adapt without restarting.

### Persistence

Every accepted block is written to `data/blocks/block-<N>.json`. On startup (`blockchain/Blockchain.js::_loadFromDisk`), the server walks that directory, rebuilds `Block` instances in order, and resumes. If the directory is empty it creates the genesis block. This means `kill`ing and restarting the server does **not** lose the chain — only wiping `data/` does.

### Mempool

Transactions submitted via `POST /api/transaction` go into an in-memory mempool. A miner including `pendingTransactions` in its block is what confirms them. When a block is accepted, its txs are removed from mempool by signature match. The mempool is not persisted — a server restart empties it, but no confirmed state is lost.

---

## Web dashboard

`public/index.html` — the web UI is being intentionally demoted to a **read-only explorer**. Signing now lives on the Android app; the browser no longer creates wallets or signs transactions as part of the planned architecture. What it still does:

- Render the chain (canvas, last 30 blocks, click-to-inspect).
- Show a wallet's balance if you paste its pubkey.
- Host the AI agent chat box.
- Show the admin panel (separate page, Basic Auth gated).

If you still see in-browser mining or signing UI, it's legacy from the pre-split version and will come out as the read-only transition completes.

## Admin panel

`public/admin.html` is protected by HTTP Basic Auth (`middleware/auth.js`). Default credentials `admin` / `admin1234`, override via `ADMIN_USER` / `ADMIN_PASSWORD` env vars.

It's a thin wrapper around the admin REST endpoints — you can do everything it does with `curl`:

```bash
curl -u admin:admin1234 -X POST http://localhost:3000/api/difficulty \
    -H 'Content-Type: application/json' -d '{"difficulty":5}'
```

Runtime knobs: difficulty, mining reward, DAA target time, DAA on/off. The full-snapshot endpoint `/api/admin/status` dumps config, chain height, every known balance, mempool, and per-miner stats — the dashboard polls it for updates.

## AI agent — how it actually answers

`POST /api/chat` and the Telegram bot both route through `lib/chatAgent.js`. The model (Ollama, default `qwen3:8b`) runs in a **tool-calling loop**, not a single-shot Q&A. The logic:

1. The server sends the user's message to the model along with a list of available tools. Each tool is a function with a name, a JSON-schema for its arguments, and a description of when to use it.
2. The model replies with either (a) a natural-language answer, or (b) one or more tool calls (`{"name": "get_balance", "arguments": {"address": "04…"}}`).
3. If it asked for a tool, the server actually executes that function against the live blockchain in memory, gets a structured result, and feeds it back as a new message.
4. The loop repeats until the model produces a final answer with no more tool calls.

The tools exposed:

| Tool | Returns |
|------|---------|
| `get_balance(address)` | Confirmed balance for an address |
| `get_transactions(address)` | Last 50 txs involving that address |
| `get_block(index)` | Full block by height |
| `get_stats()` | Mining leaderboard |
| `get_chain_info()` | Height, difficulty, reward, avg block time, DAA status |
| `get_mempool()` | Unconfirmed transactions |

Because every numeric claim in the answer comes from one of those tool returns, the model can't hallucinate balances or block counts — the worst it can do is fetch the wrong tool and give an unrelated-but-real answer.

The Telegram bot (`bots/telegramBot.js`) uses this same `chatAgent` module, so behaviour is identical whether you ask via the web UI or via DM.

## Server-side "NPC" miners (bots)

`bots/botMiner.js` spins up a few goroutine-style in-process miners when the server starts (`config.BOTS`). They exist so the chain keeps moving even when no humans or real miners are connected, which matters for demos and for DAA (which can only lower difficulty if blocks actually arrive).

These bots are different from the CLI miner in `miner/`:

- Bots `require()` the `Block` / `Transaction` / blockchain instance directly — they live in the server process.
- The CLI miner is an external HTTP client — it could be running on another continent.

Both ultimately compete for the same `/api/challenge` → `/api/submitBlock` slot, which is how the "race" in the project's name becomes visible.

---

## Android wallet (`android-app/`)

Jetpack Compose app (Kotlin, minSdk 26, targetSdk 34). Architecture choices:

### Key storage

Secp256k1 is not in the JCA (Android's standard crypto provider list), so the private key can't live inside the Android Keystore as a first-class key. Instead:

- A Keystore-backed AES-256-GCM master key is created through `androidx.security.crypto` (`EncryptedSharedPreferences`). The master key never leaves the TEE.
- The raw 32-byte secp256k1 private key is wrapped by that master key and stored in `shared_prefs/minerace_wallet_v1.xml`. Dumping the file with `adb` shows only AES-GCM ciphertext and a Tink-managed keyset — no plaintext.
- During signing, the plaintext bytes exist only briefly in JVM heap, just long enough to produce the DER signature.

This is the best you can do on stock Android for non-standard curves without shipping NDK/native code.

### First-run flow

1. **Server URL** — on first launch the app lands on `ServerSetupScreen` and refuses to proceed until a server URL is saved. This is the `serverConfigured` bit in `Settings`; once true, subsequent launches skip this screen (but `Settings → Server` lets you change it later).
2. **Create or import** — `SetupScreen`. Creating generates a fresh keypair. Importing accepts either a BIP-39 24-word recovery phrase or a 64-hex-character raw private key; scanned-QR also feeds this field.
3. **Forced backup** — immediately after create, the app **forces** the user through `ExportScreen` (first-time mode). The "Continue to wallet" button is disabled until the "I wrote down my 24 words" checkbox is ticked; the back stack is cleared so the user can't bounce back. This exists because the only copy of the key is in `EncryptedSharedPreferences` — if the user loses the phone or uninstalls the app before seeing the key, the coins are gone forever.

### Backup: BIP-39 mnemonic

`crypto/Bip39.kt` encodes the 32-byte private key as a 24-word phrase using the standard BIP-39 English wordlist (shipped as `assets/bip39-english.txt`). The encoding is: 256 entropy bits + 8-bit SHA-256 checksum = 264 bits, split into 24 × 11-bit word indices. This is mnemonic **encoding** (reversible — same key material, just printable), not BIP-32 HD derivation.

Why not plain hex? 64 hex chars is famously unforgiving: one wrong character and the wallet is unrecoverable, and you can't spot a typo by looking at it. With a word list, typos land on "this isn't a BIP-39 word" errors, and the checksum word catches word-order mistakes.

### Biometric gate

`ui/Biometric.kt` wraps `androidx.biometric.BiometricPrompt` and exposes a coroutine-friendly `authenticate()` returning `Success | Cancelled | Failed`. It requests `BIOMETRIC_WEAK or DEVICE_CREDENTIAL`, which means "use fingerprint if you have one, else fall back to the device PIN/pattern". Two places trigger it:

- **Sign & submit** on `SendScreen` — must authenticate before the signing coroutine runs.
- **Reveal private key** on `SettingsScreen` — must authenticate before navigating to `ExportScreen`.

`MainActivity` extends `FragmentActivity` (not the default `ComponentActivity`) because `BiometricPrompt` requires a FragmentManager.

### QR scanning

CameraX + ZXing. `ui/ScanScreen.kt` runs an `ImageAnalysis` use-case, pulls the Y plane of each frame into ZXing's `PlanarYUVLuminanceSource`, and decodes. Two subtle things:

- The decoded callback fires on the analyzer's background thread. Navigating from there used to crash the app — it now posts the result to the main thread via `Handler(Looper.getMainLooper())` before calling the nav controller.
- On dispose we explicitly `ProcessCameraProvider.getInstance(context).get().unbindAll()` so the camera doesn't stay attached to an already-destroyed screen.

### Export / import

- **Export** (`ExportScreen.kt`) — 24 words in a numbered 4-column grid, a "copy to clipboard" button (flagged `IS_SENSITIVE` on Android 13+ so launchers hide previews), and a QR of the space-separated phrase for device-to-device transfer.
- **Import** (`SetupScreen.kt`) — the import text field accepts a 24-word phrase (checksum-verified via `Bip39.decode`) or a 64-hex private key. "Scan QR" opens the camera flow and writes the decoded text back into the field via the nav `SavedStateHandle`.

### Settings

- Server URL (pre-filled; saving re-runs balance fetch).
- **Reveal private key** → biometric → ExportScreen (non-first-time mode, "Back" visible, "Done" always enabled after tick).
- **Delete wallet** → `AlertDialog` confirm → wipes `EncryptedSharedPreferences` and bounces back to SetupScreen.

### Build / signing

- ABI filters restricted to `arm64-v8a` + `armeabi-v7a` — no x86_64 `.so` ships, which removes the MIUI 16 KB-alignment warning and trims APK size.
- `jniLibs.useLegacyPackaging = false` so native libs are stored uncompressed and page-aligned.
- Release APK (`app/build/outputs/apk/release/app-release.apk`, ~13 MB) is signed with `keystore/minerace-release.jks` via v2/v3. The keystore and any `*.jks` are gitignored; the gradle `signingConfigs.release` block reads `MINERACE_KEYSTORE`, `MINERACE_KEYSTORE_PASSWORD`, `MINERACE_KEY_ALIAS`, `MINERACE_KEY_PASSWORD` env vars with the checked-in defaults as fallback.

To rebuild:

```bash
cd android-app
JAVA_HOME=/opt/android-studio/jbr ./gradlew :app:assembleRelease
# or for dev:
JAVA_HOME=/opt/android-studio/jbr ./gradlew :app:installDebug
```

---

## CLI miner (`miner/`)

`miner/miner.js` + `miner/minerWorker.js`. Pure external HTTP client — needs only a public key as reward target, no signing.

### Parallelism

The main process fetches `/api/challenge` once per round, builds the exact hash **prefix string** (`index + timestamp + previousHash + JSON.stringify(transactions)`), and spawns `N` worker threads (`N` = CPU cores by default). Each worker gets the prefix plus a `startNonce` and `stride`: worker `i` hashes `i, i+N, i+2N, …`, so no two workers test the same nonce. First worker to find a valid hash posts a message back, the parent tells the others to stop.

Why pass the prefix string and not the raw transactions object? Because workers receive data via Node's structured clone, which can change object key order between main thread and worker. If the worker computed the hash from a cloned `transactions` array, its JSON.stringify could differ from the main thread's stringify of the original — server would reject as "Hash mismatch". By serializing once on the main thread and shipping a frozen string, both sides are guaranteed to hash identical bytes.

### Live hashrate

Every ~65k hashes a worker checks the clock; if ≥1 second has passed, it posts a `{ hashes, ms }` sample. The main thread keeps a rate-per-worker array and prints the sum once per second (carriage-returned). No heavy IPC.

### Cross-compiled binaries

Compiled with `bun build --compile`:

```bash
cd miner
for t in linux-x64 linux-arm64 windows-x64 darwin-x64 darwin-arm64; do
  ext=""; [ "$t" = "windows-x64" ] && ext=".exe"
  bun build --compile --minify --target=bun-$t \
      --outfile dist/minerace-miner-$t$ext ./miner.js
done
```

Output binaries (~60–115 MB each, Bun runtime statically linked) live in `miner/dist/`. Ship one per platform — recipients don't need Node or Bun installed.

Usage:

```
./minerace-miner-linux-x64 --address <pubkey> [--server <url>] [--threads <n>]
```

---

## REST API

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chain` | Full blockchain |
| GET | `/api/chain/:index` | Single block |
| GET | `/api/balance/:address` | Confirmed balance |
| GET | `/api/mempool` | Unconfirmed txs |
| GET | `/api/stats` | Mining leaderboard |
| GET | `/api/challenge` | Next block template + current difficulty & reward |
| POST | `/api/transaction` | Submit a signed tx to the mempool |
| POST | `/api/submitBlock` | Submit a mined block candidate |
| POST | `/api/chat` | Run the AI agent |

### Admin (HTTP Basic Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/difficulty` | Current difficulty and reward |
| POST | `/api/difficulty` | `{ difficulty: N }` |
| POST | `/api/reward` | `{ reward: N }` |
| POST | `/api/target-time` | `{ minutes: N }` — DAA target |
| POST | `/api/daa-enabled` | `{ enabled: true/false }` |
| GET | `/api/admin/status` | Full snapshot |

---

## Configuration (`config.js`)

| Key | Default | Notes |
|-----|---------|-------|
| `DIFFICULTY` | 8 | Live; DAA overrides if enabled |
| `MINING_REWARD` | 10 | Live |
| `PORT` | 3000 | — |
| `BOTS` | `[...]` | Server-side NPC miners |
| `OLLAMA_HOST` | `localhost:11434` | AI backend |
| `OLLAMA_MODEL` | `qwen3:8b` | — |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / `admin1234` | Override via env |
| `TARGET_BLOCK_TIME` | `300000` (5 min) | DAA target |
| `ADJUSTMENT_WINDOW` | 100 | Blocks used for avg |
| `ADJUSTMENT_INTERVAL` | 10 | DAA runs every N blocks |
| `DAA_ENABLED` | `true` | — |
| `TELEGRAM_TOKEN` | — | Optional |
| `TELEGRAM_CHAT_ID` | — | Optional whitelist |

---

## Tests

```bash
node test-step1.js   # Block & chain
node test-step2.js   # Proof of work
node test-step3.js   # Wallet ECDSA
node test-step4.js   # Transactions & balances
node test-step5.js   # Mining rewards & full cycle
# Steps 6-10 require a running server:
node test-step6.js   # REST API
node test-step7.js   # Bot miners (waits 15s)
node test-step8.js   # Frontend assets
node test-step9.js   # AI agent tool calling
node test-step10.js  # Docker files
```

---

## Docker

```bash
docker-compose up
# Ollama model (one-time):
docker exec minerace-ollama-1 ollama pull qwen3:8b
```
