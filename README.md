# MineRace

A balance-based blockchain built from scratch in JavaScript — wallets, transactions, proof-of-work mining, REST API, visual frontend, AI agent, admin panel, and Docker.

## Architecture

```
minerace/
├── config.js              # Tuneable parameters (difficulty, reward, bots, port, admin credentials)
├── server.js              # Express entry point
├── blockchain/
│   ├── Block.js           # Block class (index, hash, PoW)
│   ├── Blockchain.js      # Chain, balances, mempool, validation
│   ├── Transaction.js     # Tx class (sign/verify)
│   └── Wallet.js          # ECDSA key pair generation
├── bots/
│   └── botMiner.js        # Server-side bot miners
├── middleware/
│   └── auth.js            # HTTP Basic Auth for admin routes
├── routes/
│   ├── chain.js           # GET /api/chain endpoints
│   ├── mining.js          # Challenge, submitBlock, admin API
│   ├── transactions.js    # Tx submission, balance, mempool, stats
│   └── chat.js            # Ollama AI integration
├── data/blocks/           # Persistent block files (block-0.json, …)
├── public/
│   ├── index.html         # Miner UI
│   ├── style.css
│   ├── app.js             # Frontend logic
│   ├── miner-worker.js    # Web Worker (WASM SHA-256, ~710k h/s)
│   ├── admin.html         # Admin panel (password-protected)
│   ├── admin.css
│   └── admin.js
├── miner-worker-src.js    # Worker source (built with esbuild + hash-wasm)
├── my-bot.js              # Custom mining bot (API-based)
├── test-step1.js … test-step10.js
├── Dockerfile
└── docker-compose.yml
```

## Quick Start

### Local

```bash
npm install
npm start
# Miner UI:  http://localhost:3000
# Admin UI:  http://localhost:3000/admin.html
```

### Docker (includes Ollama)

```bash
docker-compose up
# Pull the model once:
docker exec minerace-ollama-1 ollama pull qwen3:8b
# Open http://localhost:3000
```

## Miner UI

Open `http://localhost:3000` to:

- **Create wallets** — generates an ECDSA secp256k1 key pair in the browser; private key never leaves the page
- **Mine blocks** — browser Web Worker runs WASM SHA-256 (~710,000 h/s); auto-retries on stale blocks
- **Send transactions** — sign and broadcast transfers between wallets
- **View the chain** — canvas showing the last 30 blocks with click-to-inspect
- **Ask the AI** — natural-language queries answered by the Ollama agent
- **Wallet table** — live balance, blocks mined, and earnings for every local wallet

## Admin Panel

Open `http://localhost:3000/admin.html` — protected by HTTP Basic Auth.

Default credentials: `admin` / `admin1234`  
Override via environment variables: `ADMIN_USER`, `ADMIN_PASSWORD`

The admin panel lets you:

- Change **difficulty** at runtime (takes effect on the next block)
- Change **mining reward** at runtime
- Monitor chain height, latest hash, and mempool
- View per-bot and per-address stats and balances

## REST API

### Public endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chain` | Full blockchain |
| GET | `/api/chain/:index` | Single block |
| GET | `/api/balance/:address` | Address balance |
| GET | `/api/mempool` | Pending transactions |
| GET | `/api/stats` | Mining leaderboard |
| GET | `/api/challenge` | Current mining challenge (includes live difficulty & reward) |
| POST | `/api/transaction` | Submit a signed transaction |
| POST | `/api/submitBlock` | Submit a mined block |
| POST | `/api/chat` | Query the AI agent (tool-calling) |

### Admin endpoints (Basic Auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/difficulty` | Current difficulty and mining reward |
| POST | `/api/difficulty` | Set difficulty `{ difficulty: N }` |
| POST | `/api/reward` | Set mining reward `{ reward: N }` |
| GET | `/api/admin/status` | Full server snapshot (config, chain, balances, mempool, stats) |

## Configuration (`config.js`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `DIFFICULTY` | 5 | Leading zeros required (changeable at runtime) |
| `MINING_REWARD` | 10 | Coins per mined block (changeable at runtime) |
| `PORT` | 3000 | Server port |
| `BOTS` | Paris/Tokyo/NYC | Bot names, intervals |
| `OLLAMA_HOST` | localhost:11434 | Ollama endpoint |
| `OLLAMA_MODEL` | qwen3:8b | Ollama model name |
| `ADMIN_USER` | admin | Admin panel username (override via env) |
| `ADMIN_PASSWORD` | admin1234 | Admin panel password (override via env) |

## Running the Custom Bot

```bash
node my-bot.js
```

Reads/creates `my-bot-wallet.json` for persistent identity. Automatically picks up the live difficulty and reward from the challenge endpoint.

## Running Tests

```bash
node test-step1.js   # Block & Chain
node test-step2.js   # Proof of Work
node test-step3.js   # Wallet (ECDSA)
node test-step4.js   # Transactions & Balances
node test-step5.js   # Mining Rewards & Full Cycle
# Steps 6-10 require a running server (npm start):
node test-step6.js   # REST API
node test-step7.js   # Bot Miners (waits 15s)
node test-step8.js   # Frontend assets
node test-step9.js   # AI Agent
node test-step10.js  # Docker files
```

## AI Agent

The chat endpoint uses **tool calling** — the model doesn't read a wall of text, it calls functions to look up exactly what it needs.

Available tools the model can invoke:

| Tool | What it returns |
|------|----------------|
| `get_balance(address)` | Exact confirmed balance for an address |
| `get_transactions(address)` | Last 50 transactions sent or received by an address |
| `get_block(index)` | Full block data by index |
| `get_stats()` | Mining leaderboard sorted by blocks mined |
| `get_chain_info()` | Height, difficulty, reward, mempool size, latest hash |
| `get_mempool()` | All pending unconfirmed transactions |

The server runs an agentic loop — the model can call multiple tools per question before giving a final answer. No hallucination on structured data like balances or transaction history because the data is fetched directly from the blockchain, not inferred from text.

Example questions:
- "What is the balance of address 04fb59…?"
- "Show me the transactions for address 04ab12…"
- "Who has mined the most blocks?"
- "How many blocks are in the chain?"
- "Are there any pending transactions?"

## Mining Flow

1. `GET /api/challenge` — get next block index, previousHash, difficulty, miningReward, and pending txs
2. Assemble block: pending txs + one `MINING_REWARD` coinbase to your address
3. Increment nonce until `SHA256(index + timestamp + previousHash + transactions + nonce)` starts with `difficulty` zeros
4. `POST /api/submitBlock` — first valid submission wins; stale blocks (beaten by another miner) auto-retry

## Browser Mining Performance

| Method | Speed |
|--------|-------|
| `crypto.subtle.digest` (async) | ~1,000 h/s |
| Pure-JS SHA-256 (sync) | ~123,000 h/s |
| hash-wasm WASM SHA-256 | ~710,000 h/s |

The default worker uses hash-wasm. To rebuild it after editing `miner-worker-src.js`:

```bash
npm run build:worker
```
