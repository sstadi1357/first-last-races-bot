const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

function getPositionEmoji(index) {
    switch (index) {
        case 0: return "🥇";
        case 1: return "🥈";
        case 2: return "🥉";
        default: return "▫️";
    }
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the current leaderboard'),
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const serverId = interaction.guildId;
            const serverRef = db.collection('servers').doc(serverId);
            const leaderboardDoc = await serverRef.collection('leaderboard').doc('current').get();

            if (!leaderboardDoc.exists || !leaderboardDoc.data().rankings) {
                return await interaction.editReply('No leaderboard data available.');
            }

            const { rankings, lastUpdated } = leaderboardDoc.data();
            
            let description = '';
            for (let i = 0; i < Math.min(rankings.length, 15); i++) {
                const user = rankings[i];
                const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
                const displayName = member ? member.displayName : user.username;
                const positionEmoji = getPositionEmoji(i);
                description += `${positionEmoji} **#${i + 1}.** ${displayName} - ${user.score} points\n`;
            }

            // Validate and truncate description
            if (!description || typeof description !== 'string' || description.trim().length === 0) {
                description = 'No rankings to display.';
            } else if (description.length > 4096) {
                description = description.slice(0, 4093) + '...';
            }

            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('🏆 Current Leaderboard')
                .setDescription(description)
                .setFooter({ 
                    text: lastUpdated ? 
                        `Last updated: ${new Date(lastUpdated.toDate()).toLocaleString()}` : 
                        'Last updated: Unknown'
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving the leaderboard. Please try again later.',
                ephemeral: true
            });
        }
    },
};