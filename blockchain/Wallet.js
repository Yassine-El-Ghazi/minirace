const { ec: EC } = require('elliptic');

const ec = new EC('secp256k1');

class Wallet {
  constructor() {
    this.keyPair = ec.genKeyPair();
    this.privateKey = this.keyPair.getPrivate('hex');
    // Uncompressed public key – starts with "04"
    this.publicKey = this.keyPair.getPublic('hex');
    this.address = this.publicKey;
  }

  sign(dataHash) {
    const sig = this.keyPair.sign(dataHash, 'hex');
    return sig.toDER('hex');
  }

  static verify(publicKeyHex, dataHash, signature) {
    try {
      const keyPair = ec.keyFromPublic(publicKeyHex, 'hex');
      return keyPair.verify(dataHash, signature);
    } catch {
      return false;
    }
  }
}

module.exports = Wallet;
