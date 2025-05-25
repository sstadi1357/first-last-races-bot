const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function pad(n) {
    return n.toString().padStart(2, '0');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('monthly-leaderboard')
        .setDescription('Show the combined leaderboard for a specific month and year')
        .addStringOption(option =>
            option.setName('month')
                .setDescription('Month')
                .setRequired(true)
                .addChoices(...MONTHS.map((m, i) => ({ name: m, value: m })))
        )
        .addIntegerOption(option =>
            option.setName('year')
                .setDescription('Year (e.g., 2024)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const monthName = interaction.options.getString('month');
        const year = interaction.options.getInteger('year');
        const monthIndex = MONTHS.findIndex(m => m === monthName);
        if (monthIndex === -1) {
            return await interaction.editReply('Invalid month selected.');
        }
        const monthStr = pad(monthIndex + 1);
        const yearStr = year.toString();
        const serverId = interaction.guildId;
        const histRef = db.collection('servers').doc(serverId).collection('history-leaderboards');
        const snapshot = await histRef.get();
        // Filter docs for the given month/year and sort by date
        const docs = snapshot.docs
            .filter(doc => {
                const [docMonth, , docYear] = doc.id.split('-');
                return docMonth === monthStr && docYear === yearStr;
            })
            .sort((a, b) => {
                // Sort by date ascending
                const [am, ad, ay] = a.id.split('-').map(Number);
                const [bm, bd, by] = b.id.split('-').map(Number);
                return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
            });
        if (docs.length === 0) {
            return await interaction.editReply(`No leaderboard data found for ${monthName} ${yearStr}.`);
        }
        // Map of userId -> { displayName, totalGain }
        const userGains = new Map();
        // Map of userId -> previous cumulative score
        const prevScores = new Map();
        // Fetch all members to map userId to displayName
        await interaction.guild.members.fetch();
        for (const doc of docs) {
            const rankings = doc.data().rankings || [];
            // Build a map for this day's scores
            const todayScores = new Map();
            for (const user of rankings) {
                todayScores.set(user.userId, user);
            }
            // For all users seen so far or today, calculate gain
            const allUserIds = new Set([...prevScores.keys(), ...todayScores.keys()]);
            for (const userId of allUserIds) {
                const today = todayScores.get(userId);
                const prev = prevScores.get(userId);
                const todayScore = today ? today.score : 0;
                const prevScore = prev ? prev.score : 0;
                const gain = todayScore - prevScore;
                // Try to get displayName from guild, fallback to username
                const member = interaction.guild.members.cache.get(userId);
                const displayName = member ? member.displayName : (today ? today.username : (prev ? prev.username : 'Unknown'));
                if (!userGains.has(userId)) {
                    userGains.set(userId, { userId, displayName, totalGain: 0 });
                }
                userGains.get(userId).totalGain += gain;
            }
            // Update prevScores for next day
            for (const [userId, user] of todayScores.entries()) {
                prevScores.set(userId, user);
            }
        }
        // Sort and rank
        const sorted = Array.from(userGains.values()).sort((a, b) => b.totalGain - a.totalGain);
        sorted.forEach((u, i) => u.rank = i + 1);
        // Build embed
        const description = sorted.map(u => `**#${u.rank}.** ${u.displayName} - ${u.totalGain} points`).join('\n') || 'No data';
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`📅 Monthly Leaderboard for ${monthName} ${yearStr}`)
            .setDescription(description)
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}; 