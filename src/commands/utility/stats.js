const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View your current stats'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const userId = interaction.user.id;
            const serverId = interaction.guildId;
            const serverRef = db.collection('servers').doc(serverId);
            
            // Get user's data
            const userDoc = await serverRef.collection('users').doc(userId).get();
            const leaderboardDoc = await serverRef.collection('leaderboard').doc('current').get();

            if (!userDoc.exists) {
                return await interaction.editReply('You have not participated in any races yet!');
            }

            const userData = userDoc.data();
            
            // Find user's position in leaderboard
            let position = "Not ranked";
            if (leaderboardDoc.exists) {
                const rankings = leaderboardDoc.data().rankings || [];
                const userRank = rankings.findIndex(rank => rank.userId === userId);
                if (userRank !== -1) {
                    position = `#${userRank + 1}`;
                }
            }

            // Get member's display name
            const member = await interaction.guild.members.fetch(userId);
            const displayName = member ? member.displayName : interaction.user.username;

            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`📊 Stats for ${displayName}`)
                .addFields(
                    { name: 'Current Score', value: `${userData.score || 0} points`, inline: true },
                    { name: 'Current Rank', value: position, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Stats are updated daily' });

            await interaction.editReply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error fetching stats:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving your stats. Please try again later.',
                ephemeral: true
            });
        }
    },
};
