# MineRace Project Summary

Source: https://mehditmimi.com/courses/blockchain/modules/project1

## Overview

MineRace is a Part 1 blockchain capstone project where the goal is to build a complete balance-based blockchain in JavaScript from scratch. The project combines:

- A blockchain engine with proof of work, transaction validation, balances, mempool, and chain validation
- An Express REST API
- A browser frontend for wallets, transactions, mining, and chain visualization
- Bot miners that compete for blocks
- A local AI assistant powered by Ollama
- Docker-based deployment

The project uses an account/balance model instead of Bitcoin's UTXO model, which makes it closer to Ethereum's design and prepares students for Part 2 of the course.

## Core Idea

The server is the source of truth. It stores the canonical chain, validates blocks and transactions, exposes the mining challenge, and accepts the first valid block submission. Mining is open to anyone:

- The browser UI can mine
- Built-in server bots can mine
- A custom student bot can mine through the same API

Each accepted block is persisted as a separate JSON file in `data/blocks/`, which makes the blockchain easy to inspect, tamper with, and validate manually.

## Main Architecture

Expected high-level structure:

- `config.js`: difficulty, rewards, bots, timings, port
- `server.js`: Express entry point
- `blockchain/`: `Block`, `Blockchain`, `Transaction`, `Wallet`
- `bots/`: bot miner logic
- `routes/`: chain, mining, transactions, chat
- `data/blocks/`: one JSON file per block
- `public/`: frontend files and browser mining worker
- `my-bot.js`: custom mining bot
- `Dockerfile` and `docker-compose.yml`

Main technologies:

- Node.js and Express
- HTML/CSS/JavaScript without a frontend framework
- `crypto` and `elliptic` with `secp256k1`
- Ollama for local LLM integration
- Docker and Docker Compose

## Functional Requirements

The application must support:

- Block creation with SHA-256 hashing
- Proof-of-work mining with configurable difficulty
- Wallet generation and ECDSA signatures
- Signed transactions with balance checks
- Mining rewards via a special `MINING_REWARD` transaction
- Mempool handling
- Chain validation on startup and during block submission
- Persistent storage of blocks on disk
- Competition between user mining and bots

## Mining Model

The mining flow is:

1. A miner requests the current challenge from `GET /api/challenge`
2. The miner hashes candidate blocks until the hash satisfies the difficulty target
3. The miner submits the block through `POST /api/submitBlock`
4. The server validates it and accepts the first valid submission
5. Other miners must refresh and start on the next block

Server bots mine empty blocks by default, which leaves mempool transactions pending until a user miner or custom bot includes them.

## REST API

Key endpoints:

- `GET /api/chain`: full blockchain
- `GET /api/chain/:index`: one block
- `GET /api/balance/:address`: confirmed and available balance
- `GET /api/mempool`: pending transactions
- `GET /api/challenge`: mining challenge
- `POST /api/transaction`: submit signed transaction
- `POST /api/submitBlock`: submit mined block
- `POST /api/chat`: ask the AI about chain state
- `GET /api/stats`: mining leaderboard and chain stats

Validation rules on submitted blocks include:

- Correct `previousHash`
- Valid proof of work
- Valid signatures
- Sufficient balances
- Exactly one mining reward transaction
- Rejection if the block was already mined by someone else

## Frontend Expectations

The frontend should provide:

- Wallet creation and switching
- Balance display
- Transaction form with client-side signing
- A mine button with live nonce updates
- A visual blockchain explorer using SVG or Canvas
- A leaderboard
- An AI chat panel

The frontend is intended to make the blockchain feel alive and interactive, not just functional.

## AI Integration

The AI feature uses Ollama running locally in Docker. The backend builds a text summary of the current blockchain state and sends it to the model through `/api/chat`. The AI should answer chain-aware questions such as:

- Who has the most coins?
- Who mined a given block?
- Is the chain valid?
- What happened in recent transactions?

The app must degrade gracefully if Ollama is unavailable or no model has been pulled yet.

## Incremental Milestones

The project is split into 10 mini-goals:

1. Block and chain basics
2. Proof of work
3. Wallets and signatures
4. Transactions and balances
5. Mining rewards and full transaction cycle
6. REST API
7. Bot miners
8. Frontend and visual blockchain explorer
9. AI agent with Ollama
10. Docker and containerization

Each step has an associated test file and is meant to be built and verified incrementally.

## Deliverables

Required deliverables are:

- A blockchain engine implemented in JavaScript without blockchain libraries
- A complete Express REST API
- A responsive frontend with a visual explorer
- A custom mining bot that speaks the API
- An Ollama-backed AI chat feature
- Docker setup plus project documentation

The documentation should include setup instructions, an architecture diagram, and screenshots or a demo video.

## Important Constraints

- The chain uses a balance/account model, not UTXO
- Wallet addresses are full uncompressed public keys in hex
- Transactions are signed over `SHA-256(from + to + amount)` with no delimiter
- Blocks persist on disk, but the mempool is intentionally in memory only
- Docker Compose should start the full system
- Ollama requires pulling a model separately on first use

## Short Summary

MineRace is a teaching project that turns blockchain theory into a full-stack system. Students build a simple Ethereum-style blockchain with PoW, wallets, signed transactions, bots, a live explorer, and local AI support, then package the entire experience in Docker.
