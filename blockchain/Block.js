const crypto = require('crypto');

class Block {
  constructor(index, timestamp, previousHash, transactions, nonce = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.previousHash = previousHash;
    this.transactions = transactions;
    this.nonce = nonce;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const data =
      this.index +
      this.timestamp +
      this.previousHash +
      JSON.stringify(this.transactions) +
      this.nonce;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  mineBlock(difficulty) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}

module.exports = Block;
