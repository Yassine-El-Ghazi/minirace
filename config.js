module.exports = {
  DIFFICULTY: 8,
  MINING_REWARD: 10,
  PORT: 3000,
  BOTS: [
    { name: 'Bot-Paris', interval: 5000, includeTxs: false },
    { name: 'Bot-Tokyo', interval: 7000, includeTxs: false },
    { name: 'Bot-NYC',   interval: 9000, includeTxs: false },
  ],
  OLLAMA_HOST:  process.env.OLLAMA_HOST  || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen3:8b',
  DATA_DIR: './data/blocks',
  // Admin credentials – override via env vars in production
  ADMIN_USER:     process.env.ADMIN_USER     || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin1234',
  // Dynamic Difficulty Adjustment
  TARGET_BLOCK_TIME:   5 * 60 * 1000,  // target ms per block (default 5 min)
  ADJUSTMENT_WINDOW:   100,            // measure over last N blocks
  ADJUSTMENT_INTERVAL: 10,            // re-evaluate every N new blocks
  DAA_ENABLED:         true,
  // Telegram bot – set TELEGRAM_TOKEN env var to enable
  TELEGRAM_TOKEN:   process.env.TELEGRAM_TOKEN   || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
};
