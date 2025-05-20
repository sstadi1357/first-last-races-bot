const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../firebase');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('participation')
        .setDescription('View participation statistics'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const serverId = interaction.guildId;
            const daysSnapshot = await db.collection('servers').doc(serverId).collection('days').get();

            // Gather all dates (exclude today)
            let allDates = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            daysSnapshot.forEach(doc => {
                const [month, day, year] = doc.id.split('-').map(Number);
                const docDate = new Date(year, month - 1, day);
                docDate.setHours(0, 0, 0, 0);
                if (docDate < today) {
                    allDates.push(doc.id);
                }
            });
            allDates = allDates.sort((a, b) => {
                const [am, ad, ay] = a.split('-').map(Number);
                const [bm, bd, by] = b.split('-').map(Number);
                return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
            });
            const lastDate = allDates[allDates.length - 1];

            // Map userId -> { userId, count, firstDate }
            const userParticipation = new Map();
            daysSnapshot.forEach(doc => {
                if (!allDates.includes(doc.id)) return;
                const data = doc.data();
                if (data.messages) {
                    data.messages.forEach(msg => {
                        if (!userParticipation.has(msg.userId)) {
                            userParticipation.set(msg.userId, {
                                userId: msg.userId,
                                count: 0,
                                firstDate: doc.id
                            });
                        }
                        const userStats = userParticipation.get(msg.userId);
                        userStats.count++;
                        if (doc.id < userStats.firstDate) {
                            userStats.firstDate = doc.id;
                        }
                    });
                }
            });

            // Helper to count days between two MM-DD-YYYY dates (inclusive, but subtract 1 for percentage)
            function daysBetween(start, end) {
                const [sm, sd, sy] = start.split('-').map(Number);
                const [em, ed, ey] = end.split('-').map(Number);
                const startDate = new Date(sy, sm - 1, sd);
                const endDate = new Date(ey, em - 1, ed);
                return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 3;
            }

            // Fetch display names for all users from the server
            const userDisplayNames = new Map();
            await interaction.guild.members.fetch(); // Fetch all members
            for (const [userId] of userParticipation.entries()) {
                const member = interaction.guild.members.cache.get(userId);
                if (member) {
                    userDisplayNames.set(userId, member.displayName);
                }
            }

            // Prepare users with percentage (exclude users with no display name)
            const usersWithPercent = Array.from(userParticipation.values()).map(user => {
                let daysActive = daysBetween(user.firstDate, lastDate) - 1;
                if (daysActive < 1) daysActive = 1;
                return {
                    ...user,
                    displayName: userDisplayNames.get(user.userId),
                    percent: daysActive > 0 ? user.count / daysActive : 0
                };
            }).filter(user => user.displayName).sort((a, b) => b.percent - a.percent);

            const page1Description = usersWithPercent.map((user, idx) => 
                `**${idx + 1}.** ${user.displayName}: ${(user.percent * 100).toFixed(1)}%`
            ).join('\n') || 'No data';            // Page 2: Raw participation count
            const usersByCount = Array.from(userParticipation.values()).map(user => ({
                ...user,
                displayName: userDisplayNames.get(user.userId)
            })).filter(user => user.displayName).sort((a, b) => b.count - a.count);

            const page2Description = usersByCount.map((user, idx) =>
                `**${idx + 1}.** ${user.displayName}: ${user.count} participations`
            ).join('\n') || 'No data';

            // Embeds
            const embeds = [
                new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('📊 Participation Rate (Excluding Today)')
                    .setDescription(page1Description)
                    .setFooter({ text: 'Page 1/2 • Sorted by participation rate (since first activity, excluding today)' })
                    .setTimestamp(),
                new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('📊 Raw Participation Count')
                    .setDescription(page2Description)
                    .setFooter({ text: 'Page 2/2 • Sorted by total participations' })
                    .setTimestamp()
            ];

            let currentPageIndex = 0;
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
                            .setDisabled(pageIndex === embeds.length - 1),
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('Last ⏩')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageIndex === embeds.length - 1)
                    );
            };

            const response = await interaction.editReply({
                embeds: [embeds[currentPageIndex]],
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
                    case 'next': currentPageIndex = Math.min(embeds.length - 1, currentPageIndex + 1); break;
                    case 'last': currentPageIndex = embeds.length - 1; break;
                }
                await i.update({
                    embeds: [embeds[currentPageIndex]],
                    components: [generateButtons(currentPageIndex)]
                });
            });
            collector.on('end', async () => {
                await response.edit({ components: [] }).catch(() => {});
            });
        } catch (error) {
            console.error('Error creating participation stats:', error);
            await interaction.editReply('Error retrieving participation statistics. Please try again later.');
        }
    },
};