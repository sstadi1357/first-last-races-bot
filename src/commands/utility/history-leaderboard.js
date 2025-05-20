const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        .setName('history-leaderboard')
        .setDescription('View the leaderboard for a specific past day')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date in MM-DD-YYYY format')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply();
        const dateStr = interaction.options.getString('date');
        const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/;
        if (!dateRegex.test(dateStr)) {
            return await interaction.editReply('Please provide a valid date in MM-DD-YYYY format with zeroes (e.g., 01-20-2025).');
        }
        // Block today's date or future dates
        const [month, day, year] = dateStr.split('-').map(Number);
        const inputDate = new Date(year, month - 1, day);
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Set to midnight for comparison
        if (inputDate >= now) {
            return await interaction.editReply('You cannot use today\'s date or a future date for the history leaderboard. Please choose a past date.');
        }
        try {
            const serverId = interaction.guildId;
            const serverRef = db.collection('servers').doc(serverId);
            const historyRef = serverRef.collection('history-leaderboards').doc(dateStr);
            const historyDoc = await historyRef.get();
            if (historyDoc.exists && historyDoc.data().rankings) {
                // Use the same embed/pagination logic as leaderboard.js
                const { rankings, lastUpdated } = historyDoc.data();
                return await sendLeaderboardEmbed(interaction, rankings, lastUpdated, dateStr);
            }
            // If not found, aggregate from days
            const daysRef = serverRef.collection('days');
            const daysSnapshot = await daysRef.get();
            // Only consider days <= dateStr
            const filteredDays = daysSnapshot.docs.filter(doc => doc.id <= dateStr);
            if (filteredDays.length === 0) {
                return await interaction.editReply(`No race data found before or on ${dateStr}.`);
            }
            // Aggregate scores
            const userScores = new Map(); // userId -> { userId, username, score }
            for (const dayDoc of filteredDays) {
                const data = dayDoc.data();
                if (!data.messages) continue;
                data.messages.forEach((msg, idx) => {
                    if (!msg.userId) return;
                    if (!userScores.has(msg.userId)) {
                        userScores.set(msg.userId, { userId: msg.userId, username: msg.username, score: 0 });
                    }
                    // Use the same scoring logic as in firestoreService.js
                    let score = 0;
                    // Position-based score (assume scoring config is available globally or hardcode for now)
                    // You may want to import scoring from mainConfig if needed
                    const scoring = require('../../config/mainConfig').scoring;
                    const position = idx + 1;
                    score += (scoring.positions[position] || scoring.positions.default);
                    userScores.get(msg.userId).score += score;
                });
                // Bonus for last/second-last messages
                if (data.lastMessages) {
                    if (data.lastMessages.last && data.lastMessages.last.userId) {
                        if (!userScores.has(data.lastMessages.last.userId)) {
                            userScores.set(data.lastMessages.last.userId, { userId: data.lastMessages.last.userId, username: data.lastMessages.last.username, score: 0 });
                        }
                        userScores.get(data.lastMessages.last.userId).score += require('../../config/mainConfig').scoring.lastMessage;
                    }
                    if (data.lastMessages.secondLast && data.lastMessages.secondLast.userId) {
                        if (!userScores.has(data.lastMessages.secondLast.userId)) {
                            userScores.set(data.lastMessages.secondLast.userId, { userId: data.lastMessages.secondLast.userId, username: data.lastMessages.secondLast.username, score: 0 });
                        }
                        userScores.get(data.lastMessages.secondLast.userId).score += require('../../config/mainConfig').scoring.secondLastMessage;
                    }
                }
            }
            // Sort and format leaderboard
            const rankings = Array.from(userScores.values()).sort((a, b) => b.score - a.score).map((user, idx) => ({
                userId: user.userId,
                username: user.username,
                score: user.score,
                rank: idx + 1
            }));
            // Save to history-leaderboards
            await historyRef.set({
                lastUpdated: new Date(),
                rankings
            });
            // Display
            await sendLeaderboardEmbed(interaction, rankings, new Date(), dateStr);
        } catch (error) {
            console.error('Error fetching history leaderboard:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving the historic leaderboard. Please try again later.',
                ephemeral: true
            });
        }
    }
};

async function sendLeaderboardEmbed(interaction, rankings, lastUpdated, dateStr) {
    let description = '';
    const maxDescriptionLength = 4096;
    const pages = [];
    for (let i = 0; i < rankings.length; i++) {
        const user = rankings[i];
        const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
        const displayName = member ? member.displayName : user.username;
        const positionEmoji = getPositionEmoji(i);
        const entry = `${positionEmoji} **#${i + 1}.** ${displayName} - ${user.score} points\n`;
        if (description.length + entry.length > maxDescriptionLength) {
            pages.push(description);
            description = entry;
        } else {
            description += entry;
        }
    }
    if (description) pages.push(description);
    if (pages.length <= 1) {
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`🏆 Leaderboard for ${dateStr}`)
            .setDescription(description)
            .setFooter({ text: `Last updated: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}` })
            .setTimestamp();
        return await interaction.editReply({ embeds: [embed] });
    }
    let currentPageIndex = 0;
    const generateEmbed = (pageIndex) => {
        return new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`🏆 Leaderboard for ${dateStr}`)
            .setDescription(pages[pageIndex] || 'No rankings to display.')
            .setFooter({
                text: `Page ${pageIndex + 1}/${pages.length} • Last updated: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}`
            })
            .setTimestamp();
    };
    const generateButtons = (pageIndex) => {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('first')
                    .setLabel('⏪ First')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === pages.length - 1),
                new ButtonBuilder()
                    .setCustomId('last')
                    .setLabel('Last ⏩')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === pages.length - 1)
            );
    };
    const response = await interaction.editReply({
        embeds: [generateEmbed(currentPageIndex)],
        components: [generateButtons(currentPageIndex)]
    });
    const collector = response.createMessageComponentCollector({ time: 300000 });
    collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'You cannot use these buttons.', ephemeral: true });
            return;
        }
        switch (i.customId) {
            case 'first': currentPageIndex = 0; break;
            case 'previous': currentPageIndex = Math.max(0, currentPageIndex - 1); break;
            case 'next': currentPageIndex = Math.min(pages.length - 1, currentPageIndex + 1); break;
            case 'last': currentPageIndex = pages.length - 1; break;
        }
        await i.update({
            embeds: [generateEmbed(currentPageIndex)],
            components: [generateButtons(currentPageIndex)]
        });
    });
    collector.on('end', async () => {
        await response.edit({ components: [] }).catch(() => {});
    });
} 