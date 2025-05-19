require('dotenv').config();
const { REST, Routes } = require('discord.js');
const clientId = process.env.CLIENT_ID;
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const commands = await rest.get(Routes.applicationCommands(clientId));
        if (!commands.length) {
            console.log('No global commands to delete.');
            return;
        }
        for (const command of commands) {
            await rest.delete(Routes.applicationCommand(clientId, command.id));
            console.log(`Deleted command: ${command.name} (${command.id})`);
        }
        console.log('All global commands deleted.');
    } catch (error) {
        console.error('Error deleting commands:', error);
    }
})(); 