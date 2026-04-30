const crypto = require('crypto');

// ── 개별 블록 ──────────────────────────────────────────────────
class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index        = index;
    this.timestamp    = timestamp;
    this.data         = data;
    this.previousHash = previousHash;
    this.nonce        = 0;
    this.hash         = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.previousHash +
        this.timestamp +
        JSON.stringify(this.data) +
        this.nonce
      )
      .digest('hex');
  }
}

// ── 블록체인 ───────────────────────────────────────────────────
class Blockchain {
  constructor() {
    this.chain = [this._genesis()];
  }

  _genesis() {
    return new Block(0, Date.now(), {
      type: 'GENESIS',
      message: '성동 코인 블록체인 — 성동구청 2026'
    }, '0000000000000000');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(data) {
    const prev = this.getLatestBlock();
    const block = new Block(this.chain.length, Date.now(), data, prev.hash);
    this.chain.push(block);
    return block;
  }

  isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const cur  = this.chain[i];
      const prev = this.chain[i - 1];
      if (cur.hash !== cur.calculateHash()) return false;
      if (cur.previousHash !== prev.hash)  return false;
    }
    return true;
  }

  // 특정 유저 잔액 (EARN - SPEND)
  getBalance(userId) {
    return this.chain.reduce((bal, block) => {
      if (!block.data.userId || block.data.userId !== userId) return bal;
      if (block.data.type === 'EARN')  return bal + (block.data.amount || 0);
      if (block.data.type === 'SPEND') return bal - (block.data.amount || 0);
      return bal;
    }, 0);
  }

  // 유저별 거래 내역
  getTxHistory(userId) {
    return this.chain
      .filter(b => b.data.userId === userId)
      .map(b => ({
        hash:      b.hash,
        index:     b.index,
        timestamp: b.timestamp,
        ...b.data,
      }));
  }

  // 전체 통계
  getStats() {
    const earnBlocks  = this.chain.filter(b => b.data.type === 'EARN');
    const spendBlocks = this.chain.filter(b => b.data.type === 'SPEND');
    const totalEarned = earnBlocks.reduce((s, b)  => s + (b.data.amount || 0), 0);
    const totalSpent  = spendBlocks.reduce((s, b) => s + (b.data.amount || 0), 0);
    const uniqueUsers = new Set(
      this.chain.filter(b => b.data.userId).map(b => b.data.userId)
    ).size;

    return {
      blockCount:  this.chain.length,
      totalEarned,
      totalSpent,
      inCirculation: totalEarned - totalSpent,
      uniqueUsers,
      isValid: this.isValid(),
    };
  }
}

module.exports = new Blockchain();
