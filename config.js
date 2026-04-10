module.exports = {
  DIFFICULTY: 5,
  MINING_REWARD: 10,
  PORT: 3000,
  BOTS: [
    { name: 'Bot-Paris', interval: 5000, includeTxs: false },
    { name: 'Bot-Tokyo', interval: 7000, includeTxs: false },
    { name: 'Bot-NYC',   interval: 9000, includeTxs: false },
  ],
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen3:8b',
  DATA_DIR: './data/blocks',
  // Admin credentials – override via env vars in production
  ADMIN_USER:     process.env.ADMIN_USER     || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin1234',
};
