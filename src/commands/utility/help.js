const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all commands and what they do'),
    async execute(interaction) {
        // Find all command files in the utility directory
        const commandsDir = path.join(__dirname);
        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && file !== 'help.js');
        const commands = [];
        for (const file of commandFiles) {
            const command = require(path.join(commandsDir, file));
            if (command.data && typeof command.data.name === 'string' && typeof command.data.description === 'string') {
                commands.push({
                    name: command.data.name,
                    description: command.data.description
                });
            }
        }
        // Sort commands alphabetically
        commands.sort((a, b) => a.name.localeCompare(b.name));
        // Build embed
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('🤖 Help: Command List')
            .setDescription('Here are all available commands:')
            .addFields(commands.map(cmd => ({
                name: `/${cmd.name}`,
                value: cmd.description,
                inline: false
            })))
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}; 