require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./config');
const Blockchain = require('./blockchain/Blockchain');
const chainRoutes = require('./routes/chain');
const miningRoutes = require('./routes/mining');
const txRoutes = require('./routes/transactions');
const chatRoutes = require('./routes/chat');
const { startBots } = require('./bots/botMiner');
const { startTelegramBot } = require('./bots/telegramBot');
const adminAuth = require('./middleware/auth');

const app = express();
const blockchain = new Blockchain();

app.use(express.json());

// Protect admin static files before the general static middleware
const ADMIN_FILES = ['/admin.html', '/admin.js', '/admin.css'];
ADMIN_FILES.forEach((file) => {
  app.get(file, adminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/chain', chainRoutes(blockchain));
app.use('/api', miningRoutes(blockchain));
app.use('/api', txRoutes(blockchain));
app.use('/api', chatRoutes(blockchain));

startBots(blockchain);
startTelegramBot(blockchain);

app.listen(config.PORT, () => {
  console.log(`MineRace server running on http://localhost:${config.PORT}`);
  console.log(`Chain loaded: ${blockchain.chain.length} block(s)`);
  console.log(`Bots started: ${config.BOTS.map((b) => b.name).join(', ')}`);
  console.log(`Admin panel:  http://localhost:${config.PORT}/admin.html  (user: ${config.ADMIN_USER})`);
});
