const DiscordBotManager = require('./discord-manager.js');
const fs = require('fs');
const path = require('path');

async function startBot() {
    try {
        // Start the bot
        const bot = new DiscordBotManager();
        await bot.start();
        return bot;
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

startBot();