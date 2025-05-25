const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

function parseDate(str) {
    const [month, day, year] = str.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function daysBetween(start, end) {
    const d1 = parseDate(start);
    const d2 = parseDate(end);
    // Set both dates to start of day for accurate day counting
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    // Calculate difference in days
    const diffTime = d2 - d1;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return Math.abs(diffDays);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trends')
        .setDescription('Check the rate of leaderboard growth for all users between two dates')
        .addStringOption(option =>
            option.setName('date1')
                .setDescription('Start date (MM-DD-YYYY)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('date2')
                .setDescription('End date (MM-DD-YYYY)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const date1 = interaction.options.getString('date1');
        const date2 = interaction.options.getString('date2');
        const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/;
        if (!dateRegex.test(date1) || !dateRegex.test(date2)) {
            return await interaction.editReply('Please provide valid dates in MM-DD-YYYY format with zeroes (e.g., 01-20-2025).');
        }
        // Validate that both dates exist in Firestore
        const serverId = interaction.guildId;
        const serverRef = db.collection('servers').doc(serverId);
        const histRef = serverRef.collection('history-leaderboards');
        const doc1 = await histRef.doc(date1).get();
        const doc2 = await histRef.doc(date2).get();
        if (!doc1.exists || !doc2.exists) {
            return await interaction.editReply('One or both dates do not have leaderboard data. Please choose dates with data.');
        }
        // Calculate days between
        const days = daysBetween(date1, date2);
        if (days === 0) {
            return await interaction.editReply('Dates must be different and at least one day apart.');
        }
        // Get scores for both dates
        const scores1 = {};
        for (const user of doc1.data().rankings || []) {
            scores1[user.userId] = { score: user.score, username: user.username };
        }
        const scores2 = {};
        for (const user of doc2.data().rankings || []) {
            scores2[user.userId] = { score: user.score, username: user.username };
        }
        // Fetch all members to map userId to displayName
        await interaction.guild.members.fetch();
        // Compute growth
        const allUserIds = new Set([...Object.keys(scores1), ...Object.keys(scores2)]);
        const growth = [];
        for (const userId of allUserIds) {
            const a = scores2[userId]?.score ?? 0;
            const b = scores1[userId]?.score ?? 0;
            // Try to get displayName from guild, fallback to username
            const member = interaction.guild.members.cache.get(userId);
            const displayName = member ? member.displayName : (scores2[userId]?.username || scores1[userId]?.username || 'Unknown');
            const rate = (a - b) / days;
            growth.push({ displayName, rate });
        }
        growth.sort((a, b) => b.rate - a.rate);
        const description = growth.map((u, i) => `**${i + 1}.** ${u.displayName} - ${u.rate.toFixed(2)} pts/day`).join('\n') || 'No data';
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`📈 Leaderboard Growth Rate (${date1} to ${date2})`)
            .setDescription(description)
            .setFooter({ text: `Growth = (score2 - score1) / days` })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}; 