# MineRace miner

Multi-threaded CLI miner for the MineRace blockchain. Connects to a running
MineRace server over HTTP, solves proof-of-work for new blocks, and directs the
mining reward to a public key you choose.

No private key is needed — the coinbase transaction (`MINING_REWARD -> <pubkey>`)
is unsigned by protocol.

## Requirements

- Node.js 18+ (uses built-in `fetch` and `worker_threads`).
- A running MineRace server reachable from this machine.
- A MineRace wallet pubkey (get it from the Android wallet app: tap "Copy pubkey").

## Usage

```
node miner.js --address <pubkey>
node miner.js --address <pubkey> --server http://192.168.1.23:3000
node miner.js --address <pubkey> --threads 4
```

Arguments:

- `--address` — 130-hex-char uncompressed secp256k1 pubkey starting with `04`.
- `--server`  — server URL. Defaults to `$SERVER_URL` or `http://localhost:3000`.
- `--threads` — number of worker threads. Defaults to all CPU cores.

## Example

```
$ node miner.js --address 04abc...def --server http://192.168.1.23:3000
MineRace miner
  server:  http://192.168.1.23:3000
  threads: 8
  reward:  04abc...def12345

[block #42] diff=8 reward=10 mempool=1
  mining... 2.41 MH/s
  found nonce=18342991 in 7.8s hash=000000001a2b3c4d...
  accepted  [accepted: 1, rejected: 0]
```
