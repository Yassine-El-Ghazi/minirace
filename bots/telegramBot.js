const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const { runAgent } = require('../lib/chatAgent');

function startTelegramBot(blockchain) {
  if (!config.TELEGRAM_TOKEN) {
    console.log('[Telegram] No TELEGRAM_TOKEN set — bot disabled.');
    return;
  }

  const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

    // Optional: restrict to a specific chat if TELEGRAM_CHAT_ID is set
    if (config.TELEGRAM_CHAT_ID && String(chatId) !== String(config.TELEGRAM_CHAT_ID)) {
      bot.sendMessage(chatId, 'Unauthorized.');
      return;
    }

    try {
      await bot.sendChatAction(chatId, 'typing');
      const reply = await runAgent(text, blockchain);
      // Telegram Markdown can break on model output — use plain text with fallback
      try {
        await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
      } catch {
        await bot.sendMessage(chatId, reply);
      }
    } catch (err) {
      bot.sendMessage(chatId, `Error: ${err.message}`);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[Telegram] Polling error:', err.message);
  });

  console.log('[Telegram] Bot started — waiting for messages.');
}

module.exports = { startTelegramBot };
