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
            const daysRef = await db.collection('servers').doc(serverId).collection('days').get();

            // Initialize tracking objects
            const userParticipation = new Map(); // Track each user's participation
            const dailyStats = new Map(); // Track participation by day
            const dayOfWeekStats = new Map(); // Track participation by day of week
            let totalDays = 0;

            // Process each day
            daysRef.forEach(doc => {
                const data = doc.data();
                totalDays++;

                if (data.messages) {
                    // Track daily participation count
                    const date = doc.id;
                    const participantCount = data.messages.length;
                    dailyStats.set(date, participantCount);

                    // Track day of week participation
                    const [month, day, year] = date.split('-').map(Number);
                    const dayOfWeek = new Date(year, month - 1, day).getDay();
                    dayOfWeekStats.set(dayOfWeek, (dayOfWeekStats.get(dayOfWeek) || 0) + participantCount);

                    // Track user participation
                    data.messages.forEach(msg => {
                        if (!userParticipation.has(msg.userId)) {
                            userParticipation.set(msg.userId, {
                                userId: msg.userId,
                                username: msg.username, // Keep username as fallback
                                count: 0,
                                firstPlaces: 0
                            });
                        }
                        const userStats = userParticipation.get(msg.userId);
                        userStats.count++;
                        if (data.messages.indexOf(msg) === 0) {
                            userStats.firstPlaces++;
                        }
                    });
                }
            });

            // Fetch display names for all users
            const userDisplayNames = new Map();
            for (const [userId, stats] of userParticipation.entries()) {
                try {
                    const member = await interaction.guild.members.fetch(userId);
                    userDisplayNames.set(userId, member.displayName);
                } catch (error) {
                    userDisplayNames.set(userId, stats.username); // Fallback to username if member not found
                }
            }

            // Calculate most active days
            const sortedDays = [...dailyStats.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            // Calculate most active users
            const sortedUsers = [...userParticipation.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 5);

            // Calculate best day of week
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const avgDayParticipation = [...dayOfWeekStats.entries()].map(([day, total]) => ({
                day: daysOfWeek[day],
                avg: total / Math.ceil(totalDays / 7)
            }));
            const bestDay = avgDayParticipation.sort((a, b) => b.avg - a.avg)[0];

            // Create embed
            const pages = [];
            
            // Page 1: Most Active Users
            pages.push(new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📊 Participation Statistics - Most Active Users')
                .addFields({
                    name: '🏆 Most Active Users',
                    value: sortedUsers.map(([userId, stats], index) => 
                        `${index + 1}. ${userDisplayNames.get(userId)} - ${stats.count} participations ` 
                    ).join('\n') || 'No data',
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: 'Page 1/3 • Statistics are updated daily' }));

            // Page 2: Most Active Days
            pages.push(new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📊 Participation Statistics - Most Active Days')
                .addFields({
                    name: '📅 Most Active Days',
                    value: sortedDays.map(([date, count], index) => 
                        `${index + 1}. ${date} - ${count} participants`
                    ).join('\n') || 'No data',
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: 'Page 2/3 • Statistics are updated daily' }));

            // Page 3: Average Participation
            pages.push(new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📊 Participation Statistics - Average Participation')
                .addFields({
                    name: '📈 Average Participation',
                    value: [
                        `Most Active Day: ${bestDay.day} (avg. ${bestDay.avg.toFixed(1)} participants)`,
                        `Total Days Tracked: ${totalDays}`,
                        `Total Unique Participants: ${userParticipation.size}`
                    ].join('\n'),
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: 'Page 3/3 • Statistics are updated daily' }));

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
                            .setDisabled(pageIndex === pages.length - 1),
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('Last ⏩')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageIndex === pages.length - 1)
                    );
            };

            const response = await interaction.editReply({
                embeds: [pages[currentPageIndex]],
                components: [generateButtons(currentPageIndex)]
            });

            const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 minutes

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
                    embeds: [pages[currentPageIndex]],
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