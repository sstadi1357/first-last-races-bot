const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');const db = require('../../firebase');

// This function returns an emoji based on the user's position in the leaderboard.
function getPositionEmoji(index) {
    switch (index) {
        case 0: return "🥇"; // Gold medal for 1st place
        case 1: return "🥈"; // Silver medal for 2nd place
        case 2: return "🥉"; // Bronze medal for 3rd place
        default: return "▫️"; // White square for other positions
    }
}

module.exports = {
    cooldown: 5, // Cooldown time for the command in seconds
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the current leaderboard'),
    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply to give time for processing

        try {
            const serverId = interaction.guildId; // Get the server ID
            const serverRef = db.collection('servers').doc(serverId); // Reference to the server document in the database
            const leaderboardDoc = await serverRef.collection('leaderboard').doc('current').get(); // Get the current leaderboard document

            // Check if the leaderboard document exists and has rankings data
            if (!leaderboardDoc.exists || !leaderboardDoc.data().rankings) {
                return await interaction.editReply('No leaderboard data available.');
            }

            const { rankings, lastUpdated } = leaderboardDoc.data();
            
            let description = '';
            const maxDescriptionLength = 4096; // Discord's embed description limit
            const pages = [];

            // Loop through the rankings and create pages
                     // Create the full leaderboard description
                     for (let i = 0; i < rankings.length; i++) {
                        const user = rankings[i];
                        const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
                        const displayName = member ? member.displayName : user.username;
                        const positionEmoji = getPositionEmoji(i);
                        const entry = `${positionEmoji} **#${i + 1}.** ${displayName} - ${user.score} points\n`;
                        
                        // If adding this entry would exceed the limit, create a new page
                        if (description.length + entry.length > maxDescriptionLength) {
                            pages.push(description);
                            description = entry;
                        } else {
                            description += entry;
                        }
                    }
                    
                    // Add the remaining description as the last page
                    if (description) {
                        pages.push(description);
                    }
        
                    // If we only have one page within limits, send a simple embed
                    if (pages.length <= 1) {
                        const embed = new EmbedBuilder()
                            .setColor('#0099FF')
                            .setTitle('🏆 Current Leaderboard')
                            .setDescription(description)
                            .setFooter({ 
                                text: `Last updated: ${lastUpdated ? new Date(lastUpdated.toDate()).toLocaleString() : 'Unknown'}`
                            })
                            .setTimestamp();
        
                        return await interaction.editReply({ embeds: [embed] });
                    }
        
                    // If we need pagination, use the existing pagination code
                    let currentPageIndex = 0;
                    
            // Function to generate an embed for a specific page
            const generateEmbed = (pageIndex) => {
                return new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('🏆 Current Leaderboard')
                    .setDescription(pages[pageIndex] || 'No rankings to display.')
                    .setFooter({ 
                        text: `Page ${pageIndex + 1}/${pages.length} • Last updated: ${
                            lastUpdated ? new Date(lastUpdated.toDate()).toLocaleString() : 'Unknown'
                        }`
                    })
                    .setTimestamp();
            };

            // Function to generate navigation buttons for a specific page
            const generateButtons = (pageIndex) => {
                return new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('first')
                            .setLabel('⏪ First')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageIndex === 0), // Disable if on the first page
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('◀️ Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageIndex === 0), // Disable if on the first page
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next ▶️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageIndex === pages.length - 1), // Disable if on the last page
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('Last ⏩')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageIndex === pages.length - 1) // Disable if on the last page
                    );
            };

            // Send the initial response with the first page of the leaderboard
            const response = await interaction.editReply({
                embeds: [generateEmbed(currentPageIndex)],
                components: [generateButtons(currentPageIndex)]
            });

            const collector = response.createMessageComponentCollector({ time: 300000 });
                // Handle button interactions
                collector.on('collect', async (i) => {
                    if (i.user.id !== interaction.user.id) {
                        await i.reply({ content: 'You cannot use these buttons.', ephemeral: true });
                        return;
                    }

                    // Update the current page index based on the button pressed
                    switch (i.customId) {
                        case 'first': currentPageIndex = 0; break;
                        case 'previous': currentPageIndex = Math.max(0, currentPageIndex - 1); break;
                        case 'next': currentPageIndex = Math.min(pages.length - 1, currentPageIndex + 1); break;
                        case 'last': currentPageIndex = pages.length - 1; break;
                    }

                    // Update the message with the new page
                    await i.update({
                        embeds: [generateEmbed(currentPageIndex)],
                        components: [generateButtons(currentPageIndex)]
                    });
                });

                // Remove buttons when the collector ends
                collector.on('end', async () => {
                    await response.edit({ components: [] }).catch(() => {});
                });
    
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                await interaction.editReply({
                    content: 'An error occurred while retrieving the leaderboard. Please try again later.',
                    ephemeral: true
                });
            }
        },
    };