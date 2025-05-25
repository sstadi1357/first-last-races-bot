const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');
const { ROLES, scoring } = require('../../config/mainConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flair')
        .setDescription('See all a user\'s flairs and when they got them')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (defaults to yourself)')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const serverId = interaction.guildId;
        const daysSnapshot = await db.collection('servers').doc(serverId).collection('days').get();
        // Sort days chronologically
        const sortedDays = daysSnapshot.docs
            .map(doc => ({ date: doc.id, data: doc.data() }))
            .sort((a, b) => {
                const [am, ad, ay] = a.date.split('-').map(Number);
                const [bm, bd, by] = b.date.split('-').map(Number);
                return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
            });
        // Aggregate score by day for the user
        let totalScore = 0;
        let firstLastDate = null;
        const flairDates = {};
        // Prepare flair thresholds sorted descending
        const flairTiers = Object.entries(ROLES)
            .filter(([key, role]) => role.points > 0)
            .sort((a, b) => b[1].points - a[1].points);
        for (const [tier, role] of flairTiers) {
            flairDates[tier] = null;
        }
        for (const { date, data } of sortedDays) {
            // Check for FIRST_LAST flair (first or last message)
            let gotFirstOrLast = false;
            if (data.lastMessages) {
                if (data.lastMessages.last && data.lastMessages.last.userId === targetUser.id) {
                    gotFirstOrLast = true;
                }
            }
            if (data.messages && data.messages.length > 0 && data.messages[0].userId === targetUser.id) {
                gotFirstOrLast = true;
            }
            if (gotFirstOrLast && !firstLastDate) {
                firstLastDate = date;
            }
            // Calculate points for this day for the user
            let dayScore = 0;
            if (data.messages) {
                data.messages.forEach((msg, idx) => {
                    if (msg.userId === targetUser.id) {
                        const position = idx + 1;
                        dayScore += (scoring.positions[position] || scoring.positions.default);
                    }
                });
            }
            if (data.lastMessages) {
                if (data.lastMessages.last && data.lastMessages.last.userId === targetUser.id) {
                    dayScore += scoring.lastMessage;
                }
                if (data.lastMessages.secondLast && data.lastMessages.secondLast.userId === targetUser.id) {
                    dayScore += scoring.secondLastMessage;
                }
            }
            totalScore += dayScore;
            // Check for new flairs (only if FIRST_LAST has been earned)
            for (const [tier, role] of flairTiers) {
                if (!flairDates[tier] && totalScore >= role.points && firstLastDate && date >= firstLastDate) {
                    flairDates[tier] = date;
                }
            }
        }
        // Prepare output
        const earnedFlairs = [];
        // Collect point-based flairs first (descending by points)
        for (const [tier, role] of flairTiers) {
            if (flairDates[tier] && firstLastDate && flairDates[tier] >= firstLastDate) {
                earnedFlairs.push({
                    name: role.name,
                    date: flairDates[tier],
                    points: role.points,
                    color: role.color
                });
            }
        }
        // Insert FIRST_LAST flair below 50 points (ORANGE) if earned
        if (firstLastDate) {
            // Find index of 50 points (ORANGE)
            const orangeIndex = earnedFlairs.findIndex(f => f.points === ROLES.ORANGE.points);
            const firstLastFlair = {
                name: ROLES.FIRST_LAST.name,
                date: firstLastDate,
                points: 0,
                color: ROLES.FIRST_LAST.color
            };
            if (orangeIndex !== -1) {
                earnedFlairs.splice(orangeIndex + 1, 0, firstLastFlair);
            } else {
                earnedFlairs.push(firstLastFlair);
            }
        }
        // Add RACER flair at the bottom if earned (first day user appears in any messages)
        let racerDate = null;
        for (const { date, data } of sortedDays) {
            if (data.messages && data.messages.some(msg => msg.userId === targetUser.id)) {
                racerDate = date;
                break;
            }
        }
        if (racerDate) {
            earnedFlairs.push({
                name: ROLES.RACER.name,
                date: racerDate,
                points: 0,
                color: ROLES.RACER.color
            });
        }
        if (earnedFlairs.length === 0) {
            return await interaction.editReply({
                content: `${targetUser.username} has not earned any flairs yet.`,
                ephemeral: true
            });
        }
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏅 Flairs for ${targetUser.username}`)
            .setDescription(earnedFlairs.map(f => `**${f.name}** — earned on ${f.date}`).join('\n'))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}; 