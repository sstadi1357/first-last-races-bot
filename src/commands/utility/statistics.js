const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('statistics')
        .setDescription('View interesting server statistics'),

    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply to give time for processing

        try {
            const serverId = interaction.guildId; // Get the server ID
            const serverRef = db.collection('servers').doc(serverId); // Reference to the server document in Firestore
            const daysRef = serverRef.collection('days'); // Reference to the days sub-collection
            const daysSnapshot = await daysRef.get(); // Get all documents in the days collection

            // Initialize stats
            let totalDays = 0;
            let firstPlaceCount = {};
            let lastMessageCount = {};
            let secondLastCount = {};
            let topThreeCount = {};  // Track top 3 finishes
            let mostActiveDays = new Map();
            let longestStreak = { userId: null, count: 0, displayName: null };
            let currentStreak = { userId: null, count: 0, displayName: null };
            let lastDate = null;
            let uniqueParticipants = new Set();
            let totalMessages = 0;
            let perfectDays = 0; // Days where same person got first and last

            // Process each day's data
            for (const dayDoc of daysSnapshot.docs) {
                const dayData = dayDoc.data(); // Get the data of the day document
                const date = dayDoc.id; // Get the date (document ID)
                totalDays++; // Increment total days count

                // Count messages and track unique participants
                if (dayData.messages) {
                    totalMessages += dayData.messages.length; // Add the number of messages to total messages
                    dayData.messages.forEach(msg => uniqueParticipants.add(msg.userId)); // Add each user to the set of unique participants

                    // Track top 3 finishes
                    for (let i = 0; i < Math.min(3, dayData.messages.length); i++) {
                        const userId = dayData.messages[i].userId;
                        if (!topThreeCount[userId]) {
                            const member = await interaction.guild.members.fetch(userId).catch(() => null);
                            topThreeCount[userId] = {
                                count: 0,
                                displayName: member ? member.displayName : dayData.messages[i].username
                            };
                        }
                        topThreeCount[userId].count++; // Increment the count for top 3 finishes
                    }
                }

                // Count first places and track streaks
                if (dayData.messages?.[0]) {
                    const userId = dayData.messages[0].userId;
                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    const displayName = member ? member.displayName : dayData.messages[0].username;
                    
                    firstPlaceCount[userId] = firstPlaceCount[userId] || { count: 0, displayName };
                    firstPlaceCount[userId].count++; // Increment the count for first places

                    // Track streaks
                    const dayDate = new Date(date);
                    if (lastDate) {
                        const dayDiff = Math.abs(dayDate - lastDate) / (1000 * 60 * 60 * 24);
                        if (dayDiff === 1 && currentStreak.userId === userId) {
                            currentStreak.count++;
                            if (currentStreak.count > longestStreak.count) {
                                longestStreak = { ...currentStreak };
                            }
                        } else {
                            currentStreak = { userId, count: 1, displayName };
                        }
                    } else {
                        currentStreak = { userId, count: 1, displayName };
                    }
                    lastDate = dayDate;

                    // Check for perfect days (same person first and last)
                    if (dayData.lastMessages?.last?.userId === userId) {
                        perfectDays++;
                    }
                }

                // Count last messages
                if (dayData.lastMessages?.last) {
                    const userId = dayData.lastMessages.last.userId;
                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    const displayName = member ? member.displayName : dayData.lastMessages.last.username;
                    lastMessageCount[userId] = lastMessageCount[userId] || { count: 0, displayName };
                    lastMessageCount[userId].count++; // Increment the count for last messages
                }

                // Count second-last messages
                if (dayData.lastMessages?.secondLast) {
                    const userId = dayData.lastMessages.secondLast.userId;
                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    const displayName = member ? member.displayName : dayData.lastMessages.secondLast.username;
                    secondLastCount[userId] = secondLastCount[userId] || { count: 0, displayName };
                    secondLastCount[userId].count++; // Increment the count for second-last messages
                }

                // Track activity per day of week
                const [month, day, year] = date.split('-').map(num => parseInt(num));
                const dayOfWeek = new Date(year, month - 1, day).getDay();
                if (!mostActiveDays.has(dayOfWeek)) {
                    mostActiveDays.set(dayOfWeek, {
                        totalParticipants: 0,
                        dayCount: 0
                    });
                }
                const dayStats = mostActiveDays.get(dayOfWeek);
                dayStats.totalParticipants += (dayData.messages?.length || 0);
                dayStats.dayCount++;
                mostActiveDays.set(dayOfWeek, dayStats);
            }

            // Process the stats
            const topFirst = Object.entries(firstPlaceCount)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3)
                .map(([_, data], index) => `${['🥇', '🥈', '🥉'][index]} ${data.displayName}: ${data.count} times`);

            const topLast = Object.entries(lastMessageCount)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3)
                .map(([_, data], index) => `${['🌟', '⭐', '✨'][index]} ${data.displayName}: ${data.count} times`);

            const topSecondLast = Object.entries(secondLastCount)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3)
                .map(([_, data], index) => `${['🌙', '🌘', '🌗'][index]} ${data.displayName}: ${data.count} times`);

            const topThree = Object.entries(topThreeCount)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3)
                .map(([_, data], index) => `${['👑', '👏', '🎉'][index]} ${data.displayName}: ${data.count} times`);

            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayAverages = [...mostActiveDays.entries()].map(([day, stats]) => ({
                day,
                average: stats.totalParticipants / stats.dayCount,
                participants: stats.totalParticipants,
                count: stats.dayCount
            })).sort((a, b) => b.average - a.average);

            const mostActiveDay = dayAverages[0];
            const leastActiveDay = dayAverages[dayAverages.length - 1];
            const averageParticipants = (totalMessages / totalDays).toFixed(1);

            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📊 Advanced Server Statistics')
                .addFields(
                    { name: '📅 Overview', value: 
                      `• Total Days: **${totalDays}** days\n` +
                      `• Unique Participants: **${uniqueParticipants.size}** users\n` +
                      `• Average Daily Participation: **${averageParticipants}** users\n` +
                      `• Perfect Days: **${perfectDays}** (same person first & last)`,
                      inline: false 
                    },
                    { name: '📊 Activity Patterns', value:
                      `• Most Active: **${daysOfWeek[mostActiveDay.day]}** (avg. ${mostActiveDay.average.toFixed(1)} users)\n` +
                      `• Least Active: **${daysOfWeek[leastActiveDay.day]}** (avg. ${leastActiveDay.average.toFixed(1)} users)`,
                      inline: false
                    },
                    { name: '🏆 Top Achievers', value: topThree.join('\n') || 'No data', inline: false },
                    { name: '🥇 First Place Champions', value: topFirst.join('\n') || 'No data', inline: false },
                    { name: '🌙 Last Message Masters', value: topLast.join('\n') || 'No data', inline: false },
                    { name: '🌘 Second-Last Specialists', value: topSecondLast.join('\n') || 'No data', inline: false },
                    { name: '🔥 Longest First Place Streak', 
                      value: longestStreak.displayName ? 
                        `${longestStreak.displayName}: ${longestStreak.count} days` : 
                        'No streaks yet',
                      inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Stats are updated daily' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in statistics command:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving statistics. Please try again later.',
                ephemeral: true
            });
        }
    },
};