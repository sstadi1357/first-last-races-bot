const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

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
    cooldown: 5, // Cooldown period for the command
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
    
    // Autocomplete handler for the rank option
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = rankChoices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice.name, value: choice.value }))
        );
    },

    // Command execution handler
    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply to allow time for processing
        
        try {
            const rank = interaction.options.getString('rank'); // Get the rank option
            const targetUser = interaction.options.getUser('user'); // Get the user option
            const targetMember = await interaction.guild.members.fetch(targetUser.id); // Fetch the guild member
            const serverId = interaction.guildId; // Get the server ID

            console.log(`Checking rank ${rank} for user ${targetMember.displayName}`);

            const serverRef = db.collection('servers').doc(serverId); // Reference to the server document
            const daysRef = serverRef.collection('days'); // Reference to the days subcollection
            const daysSnapshot = await daysRef.get(); // Get all documents in the days subcollection

            let count = 0; // Initialize count of ranks achieved
            let datesList = []; // Initialize list of dates when the rank was achieved

            // Process each day's data
            for (const dayDoc of daysSnapshot.docs) {
                const dayData = dayDoc.data(); // Get the data of the day document
                const date = dayDoc.id; // Get the date (document ID)

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

            // Create embed message
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

            await interaction.editReply({ embeds: [embed] }); // Send the embed message

        } catch (error) {
            console.error('Error in rankcount command:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving the rank count. Please try again later.',
                ephemeral: true
            });
        }
    },
};