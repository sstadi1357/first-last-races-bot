const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Says whatever you type in')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to say')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Double-check admin permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ You need Administrator permissions to use this command!', 
                ephemeral: true 
            });
        }

        const message = interaction.options.getString('message');
        await interaction.reply({ content: '✅ Message sent!', ephemeral: true });
        await interaction.channel.send(message);
    },
};