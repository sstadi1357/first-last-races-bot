const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase')

// Generate position choices dynamically
const positions = Array.from({ length: 20 }, (_, i) => {
    const num = i + 1;
    let suffix = 'th';
    if (num === 1) suffix = 'st';
    if (num === 2) suffix = 'nd';
    if (num === 3) suffix = 'rd';
    const name = num === 1 ? `${num}${suffix} (First)` :
                 num === 2 ? `${num}${suffix} (Second)` :
                 num === 3 ? `${num}${suffix} (Third)` :
                 `${num}${suffix}`;
    return { name, value: i.toString() };
});

// Add special positions
const rankChoices = [
    ...positions,
    { name: '🌙 Last Message', value: 'last' },
    { name: '🌑 Second Last Message', value: 'secondlast' }
];

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('rankcount')
        .setDescription('Check how many times a user achieved a specific rank')
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('The rank to check')
                .setRequired(true)
                .setAutocomplete(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true)),
    
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = rankChoices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice.name, value: choice.value }))
        );
    },

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const rank = interaction.options.getString('rank');
            const targetUser = interaction.options.getUser('user');
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const serverId = interaction.guildId;

            console.log(`Checking rank ${rank} for user ${targetMember.displayName}`);

            const serverRef = db.collection('servers').doc(serverId);
            const daysRef = serverRef.collection('days');
            const daysSnapshot = await daysRef.get();

            let count = 0;
            let datesList = [];

            // Process each day's data
            for (const dayDoc of daysSnapshot.docs) {
                const dayData = dayDoc.data();
                const date = dayDoc.id;

                if (rank === 'last' || rank === 'secondlast') {
                    // Check last/second-last messages
                    const lastMessages = dayData.lastMessages || {};
                    if ((rank === 'last' && lastMessages.last?.userId === targetUser.id) ||
                        (rank === 'secondlast' && lastMessages.secondLast?.userId === targetUser.id)) {
                        count++;
                        datesList.push(date);
                    }
                } else {
                    // Check regular position
                    const position = parseInt(rank);
                    const messages = dayData.messages || [];
                    if (messages[position]?.userId === targetUser.id) {
                        count++;
                        datesList.push(date);
                    }
                }
            }

            // Get rank name for display
            const rankName = rankChoices.find(choice => choice.value === rank)?.name || rank;

            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`Rank Count for ${targetMember.displayName}`)
                .setDescription(`Times achieved **${rankName}**: **${count}**`)
                .setTimestamp();

            // Add recent dates if any exist (up to 5)
            if (datesList.length > 0) {
                const recentDates = datesList.slice(-5).sort()
                    .map(date => `• ${date}`).join('\n');
                embed.addFields({
                    name: 'Most Recent Dates',
                    value: recentDates
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in rankcount command:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving the rank count. Please try again later.',
                ephemeral: true
            });
        }
    },
};