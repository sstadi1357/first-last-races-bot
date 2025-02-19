const DiscordBotManager = require('./discord-manager.js');
const fs = require('fs');
const path = require('path');

async function startBot() {
    try {
        // Save the process ID to a file
       console.log("yooo bet")

        // Set up cleanup on process termination
        process.on('SIGTERM', async () => {
            console.log('Received SIGTERM signal. Shutting down...');
            const bot = await getBotInstance();
            if (bot) {
                await bot.stop();
            }
            // Remove PID file
            if (fs.existsSync(pidPath)) {
                fs.unlinkSync(pidPath);
            }
            process.exit(0);
        });

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