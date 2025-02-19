const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

function getPositionName(position) {
    switch (position) {
        case 0: return "🥇 First";
        case 1: return "🥈 Second";
        case 2: return "🥉 Third";
        default: return `${position + 1}th`;
    }
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('streak')
        .setDescription('View streak statistics for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user');
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const serverId = interaction.guildId;
            const serverRef = db.collection('servers').doc(serverId);
            const daysRef = serverRef.collection('days');
            const daysSnapshot = await daysRef.get();

            // Sort days chronologically
            const sortedDays = daysSnapshot.docs
                .map(doc => ({
                    date: doc.id,
                    data: doc.data()
                }))
                .sort((a, b) => {
                    const [aMonth, aDay, aYear] = a.date.split('-').map(Number);
                    const [bMonth, bDay, bYear] = b.date.split('-').map(Number);
                    return new Date(aYear, aMonth - 1, aDay) - new Date(bYear, bMonth - 1, bDay);
                });

            // Initialize streak tracking for positions and special positions
            const streaks = {
                positions: Array.from({ length: 20 }, (_, i) => ({
                    position: i,
                    currentStreak: 0,
                    longestStreak: 0,
                    lastDate: null
                })),
                last: {
                    currentStreak: 0,
                    longestStreak: 0,
                    lastDate: null
                },
                secondLast: {
                    currentStreak: 0,
                    longestStreak: 0,
                    lastDate: null
                }
            };

            // Track streaks for each position
            for (const { date, data } of sortedDays) {
                const [month, day, year] = date.split('-').map(Number);
                const currentDate = new Date(year, month - 1, day);

                // Check regular positions
                data.messages?.forEach((message, position) => {
                    if (position >= 20) return; // Only track up to 20th position
                    
                    const streak = streaks.positions[position];
                    if (message.userId === targetUser.id) {
                        if (streak.lastDate) {
                            const dayDiff = (currentDate - streak.lastDate) / (1000 * 60 * 60 * 24);
                            if (dayDiff === 1) {
                                streak.currentStreak++;
                                streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
                            } else {
                                streak.currentStreak = 1;
                            }
                        } else {
                            streak.currentStreak = 1;
                            streak.longestStreak = Math.max(streak.longestStreak, 1);
                        }
                        streak.lastDate = currentDate;
                    } else if (streak.lastDate) {
                        const dayDiff = (currentDate - streak.lastDate) / (1000 * 60 * 60 * 24);
                        if (dayDiff > 1) {
                            streak.currentStreak = 0;
                        }
                    }
                });

                // Check last message streak
                if (data.lastMessages?.last?.userId === targetUser.id) {
                    if (streaks.last.lastDate) {
                        const dayDiff = (currentDate - streaks.last.lastDate) / (1000 * 60 * 60 * 24);
                        if (dayDiff === 1) {
                            streaks.last.currentStreak++;
                            streaks.last.longestStreak = Math.max(streaks.last.longestStreak, streaks.last.currentStreak);
                        } else {
                            streaks.last.currentStreak = 1;
                        }
                    } else {
                        streaks.last.currentStreak = 1;
                        streaks.last.longestStreak = Math.max(streaks.last.longestStreak, 1);
                    }
                    streaks.last.lastDate = currentDate;
                } else if (streaks.last.lastDate) {
                    const dayDiff = (currentDate - streaks.last.lastDate) / (1000 * 60 * 60 * 24);
                    if (dayDiff > 1) {
                        streaks.last.currentStreak = 0;
                    }
                }

                // Check second-last message streak
                if (data.lastMessages?.secondLast?.userId === targetUser.id) {
                    if (streaks.secondLast.lastDate) {
                        const dayDiff = (currentDate - streaks.secondLast.lastDate) / (1000 * 60 * 60 * 24);
                        if (dayDiff === 1) {
                            streaks.secondLast.currentStreak++;
                            streaks.secondLast.longestStreak = Math.max(streaks.secondLast.longestStreak, streaks.secondLast.currentStreak);
                        } else {
                            streaks.secondLast.currentStreak = 1;
                        }
                    } else {
                        streaks.secondLast.currentStreak = 1;
                        streaks.secondLast.longestStreak = Math.max(streaks.secondLast.longestStreak, 1);
                    }
                    streaks.secondLast.lastDate = currentDate;
                } else if (streaks.secondLast.lastDate) {
                    const dayDiff = (currentDate - streaks.secondLast.lastDate) / (1000 * 60 * 60 * 24);
                    if (dayDiff > 1) {
                        streaks.secondLast.currentStreak = 0;
                    }
                }
            }

            // Filter streaks that have data
            const activePositionStreaks = streaks.positions.filter(streak => 
                streak.longestStreak > 0 || streak.currentStreak > 0
            );

            const hasPositionStreaks = activePositionStreaks.length > 0;
            const hasLastStreak = streaks.last.longestStreak > 0 || streaks.last.currentStreak > 0;
            const hasSecondLastStreak = streaks.secondLast.longestStreak > 0 || streaks.secondLast.currentStreak > 0;

            if (!hasPositionStreaks && !hasLastStreak && !hasSecondLastStreak) {
                return await interaction.editReply(`${targetMember.displayName} has no recorded streaks yet.`);
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`🔥 Streak Statistics for ${targetMember.displayName}`)
                .setTimestamp();

            // Add position streaks
            if (hasPositionStreaks) {
                embed.addFields({ 
                    name: '📊 Position Streaks', 
                    value: '\u200b',
                    inline: false 
                });
                
                activePositionStreaks.forEach(streak => {
                    embed.addFields({
                        name: getPositionName(streak.position),
                        value: `Current: ${streak.currentStreak} day${streak.currentStreak !== 1 ? 's' : ''}\n` +
                              `Longest: ${streak.longestStreak} day${streak.longestStreak !== 1 ? 's' : ''}`,
                        inline: true
                    });
                });
            }

            // Add special streaks if they exist
            if (hasLastStreak || hasSecondLastStreak) {
                embed.addFields({ 
                    name: '🌙 Special Streaks', 
                    value: '\u200b',
                    inline: false 
                });
            }

            if (hasLastStreak) {
                embed.addFields({
                    name: '🌙 Last Message',
                    value: `Current: ${streaks.last.currentStreak} day${streaks.last.currentStreak !== 1 ? 's' : ''}\n` +
                          `Longest: ${streaks.last.longestStreak} day${streaks.last.longestStreak !== 1 ? 's' : ''}`,
                    inline: true
                });
            }

            if (hasSecondLastStreak) {
                embed.addFields({
                    name: '🌑 Second-Last Message',
                    value: `Current: ${streaks.secondLast.currentStreak} day${streaks.secondLast.currentStreak !== 1 ? 's' : ''}\n` +
                          `Longest: ${streaks.secondLast.longestStreak} day${streaks.secondLast.longestStreak !== 1 ? 's' : ''}`,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in streak command:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving streak information. Please try again later.',
                ephemeral: true
            });
        }
    },
};