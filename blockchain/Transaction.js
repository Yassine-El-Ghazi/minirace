const crypto = require('crypto');
const { ec: EC } = require('elliptic');

const ec = new EC('secp256k1');

class Transaction {
  constructor(from, to, amount, signature = null) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.signature = signature;
  }

  getDataHash() {
    return crypto
      .createHash('sha256')
      .update(this.from + this.to + this.amount)
      .digest('hex');
  }

  sign(privateKeyHex) {
    const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
    const hash = this.getDataHash();
    const sig = keyPair.sign(hash, 'hex');
    this.signature = sig.toDER('hex');
  }

  isValid() {
    if (this.from === 'MINING_REWARD') return true;
    if (!this.signature) return false;
    try {
      const keyPair = ec.keyFromPublic(this.from, 'hex');
      const hash = this.getDataHash();
      return keyPair.verify(hash, this.signature);
    } catch {
      return false;
    }
  }
}

module.exports = Transaction;
