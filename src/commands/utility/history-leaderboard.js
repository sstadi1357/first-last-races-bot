const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');
const { parseDate, formatDateForDisplay } = require('../../utils/dateParser');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('history-leaderboard')
        .setDescription('Show the leaderboard for a specific date')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date (e.g., "June 1st", "yesterday", "6/1", "01-15-2024")')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const dateInput = interaction.options.getString('date');
        
        // Parse the date input using the new date parser
        const dateResult = parseDate(dateInput);
        if (!dateResult.success) {
            return await interaction.editReply(`❌ Invalid date format: ${dateResult.error}\n\nTry formats like:\n• "June 1st" or "June 1"\n• "yesterday" or "today"\n• "3 days ago"\n• "6/1" or "6/1/2024"\n• "01-15-2024"`);
        }

        const date = dateResult.formatted;
        const displayDate = formatDateForDisplay(date);
        
        const serverId = interaction.guildId;
        const serverRef = db.collection('servers').doc(serverId);
        const histRef = serverRef.collection('history-leaderboards');
        const doc = await histRef.doc(date).get();
        if (!doc.exists) {
            return await interaction.editReply(`No leaderboard data found for ${displayDate}. Please choose a date with data.`);
        }
        const data = doc.data();
        
        // Fetch all members to get display names
        await interaction.guild.members.fetch();
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`📊 Leaderboard for ${displayDate}`)
            .setDescription(data.rankings.map((user, i) => {
                const member = interaction.guild.members.cache.get(user.userId);
                const displayName = member ? member.displayName : user.username;
                return `**${i + 1}.** ${displayName} - ${user.score} points`;
            }).join('\n') || 'No data')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}; 