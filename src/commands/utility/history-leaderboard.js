const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('history-leaderboard')
        .setDescription('Show the leaderboard for a specific date')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date to show leaderboard for (MM-DD-YYYY)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const date = interaction.options.getString('date');
        const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/;
        if (!dateRegex.test(date)) {
            return await interaction.editReply('Please provide a valid date in MM-DD-YYYY format with zeroes (e.g., 01-20-2025).');
        }
        const serverId = interaction.guildId;
        const serverRef = db.collection('servers').doc(serverId);
        const histRef = serverRef.collection('history-leaderboards');
        const doc = await histRef.doc(date).get();
        if (!doc.exists) {
            return await interaction.editReply('No leaderboard data found for this date. Please choose a date with data.');
        }
        const data = doc.data();
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`📊 Leaderboard for ${date}`)
            .setDescription(data.rankings.map((user, i) => `**${i + 1}.** ${user.username} - ${user.score} points`).join('\n') || 'No data')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}; 