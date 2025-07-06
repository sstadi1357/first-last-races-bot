const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../firebase');
const { parseDate, formatDateForDisplay } = require('../../utils/dateParser');

// This function returns a label for the position based on the index
function getPositionLabel(index) {
    switch (index) {
        case 0: return "🥇 First";
        case 1: return "🥈 Second";
        case 2: return "🥉 Third";
        case 3: return "4th";
        case 4: return "5th";
        default: return `${index + 1}th`; // 6th, 7th, 8th, etc.
    }
}

module.exports = {
    cooldown: 5, // Cooldown time for the command
    data: new SlashCommandBuilder()
        .setName('history') // Command name
        .setDescription('View message history for a specific day') // Command description
        .addStringOption(option =>
            option.setName('date') // Option name
                .setDescription('Date (e.g., "June 1st", "yesterday", "6/1", "01-15-2024")') // Option description
                .setRequired(true) // Option is required
        ),

    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply to allow time for processing

        const dateInput = interaction.options.getString('date'); // Get the date string from the command options
        
        // Parse the date input using the new date parser
        const dateResult = parseDate(dateInput);
        if (!dateResult.success) {
            return await interaction.editReply(`❌ Invalid date format: ${dateResult.error}\n\nTry formats like:\n• "June 1st" or "June 1"\n• "yesterday" or "today"\n• "3 days ago"\n• "6/1" or "6/1/2024"\n• "01-15-2024"`);
        }

        const dateStr = dateResult.formatted;
        const displayDate = formatDateForDisplay(dateStr);

        try {
            const serverId = interaction.guildId; // Get the server ID
            const serverRef = db.collection('servers').doc(serverId); // Reference to the server document in Firebase
            const dayDoc = await serverRef.collection('days').doc(dateStr).get(); // Get the document for the specified date

            // Check if the document exists
            if (!dayDoc.exists) {
                return await interaction.editReply(`No messages recorded for ${displayDate}.`);
            }

            const data = dayDoc.data(); // Get the data from the document
            const messages = data.messages || []; // Get the messages array or an empty array if it doesn't exist
            const lastMessages = data.lastMessages || {}; // Get the last messages object or an empty object if it doesn't exist

            // Get all guild members
            const guild = interaction.guild;
            const members = await guild.members.fetch();

            // Process regular messages (first messages of the day)
            let description = '';
            messages.forEach((msg, index) => {
                const member = members.find(m => m.user.username === msg.username); // Find the member by username
                const displayName = member ? member.displayName : msg.username; // Use the display name if the member is found, otherwise use the username
                description += `${getPositionLabel(index)}: ${displayName}\n`; // Add the message to the description
            });

            // Add last/second-last messages
            if (lastMessages.last) {
                const lastMember = members.find(m => m.user.username === lastMessages.last.username); // Find the member by username
                const lastDisplayName = lastMember ? lastMember.displayName : lastMessages.last.username; // Use the display name if the member is found, otherwise use the username
                description += `\n Last message: ${lastDisplayName}`;
                
                if (lastMessages.secondLast) {
                    const secondLastMember = members.find(m => m.user.username === lastMessages.secondLast.username); // Find the member by username
                    const secondLastDisplayName = secondLastMember ? secondLastMember.displayName : lastMessages.secondLast.username; // Use the display name if the member is found, otherwise use the username
                    description += `\n Second-last message: ${secondLastDisplayName}`;
                }
            }

            // Check if the description is empty or not a string
            if (!description || typeof description !== 'string' || description.trim().length === 0) {
                description = 'No messages to display for this date.';
            } else {
                const maxDescriptionLength = 4096; // Maximum length for the description
                const pages = []; // Array to hold the pages of the description
                while (description.length > maxDescriptionLength) {
                    let splitIndex = description.lastIndexOf('\n', maxDescriptionLength); // Find the last newline character within the maximum length
                    if (splitIndex === -1) splitIndex = maxDescriptionLength; // If no newline character is found, split at the maximum length
                    pages.push(description.slice(0, splitIndex)); // Add the page to the array
                    description = description.slice(splitIndex).trim(); // Remove the page from the description
                }
                pages.push(description); // Add the remaining description as the last page
            
                let currentPageIndex = 0; // Index of the current page
            
                // Function to generate an embed for a specific page
                const generateEmbed = (pageIndex) => {
                    return new EmbedBuilder()
                        .setColor('#0099FF')
                        .setTitle(`📅 Message History for ${displayDate} (Page ${pageIndex + 1}/${pages.length})`)
                        .setDescription(pages[pageIndex])
                        .setTimestamp();
                };
            
                // Function to generate buttons for pagination
                const generateButtons = (pageIndex) => {
                    return new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('first')
                                .setLabel('⏪ First')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageIndex === 0), // Disable the button if on the first page
                            new ButtonBuilder()
                                .setCustomId('previous')
                                .setLabel('◀️ Previous')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageIndex === 0), // Disable the button if on the first page
                            new ButtonBuilder()
                                .setCustomId('next')
                                .setLabel('Next ▶️')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageIndex === pages.length - 1), // Disable the button if on the last page
                            new ButtonBuilder()
                                .setCustomId('last')
                                .setLabel('Last ⏩')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageIndex === pages.length - 1) // Disable the button if on the last page
                        );
                };
            
                // If there are multiple pages, set up pagination
                if (pages.length > 1) {
                    const response = await interaction.editReply({
                        embeds: [generateEmbed(currentPageIndex)], // Send the first page
                        components: [generateButtons(currentPageIndex)] // Send the buttons
                    });
            
                    const collector = response.createMessageComponentCollector({ time: 300000 }); // Collector to handle button interactions (5 minutes)
            
                    collector.on('collect', async (i) => {
                        if (i.user.id !== interaction.user.id) {
                            await i.reply({ content: 'You cannot use these buttons.', ephemeral: true });
                            return;
                        }
            
                        // Update the current page index based on the button clicked
                        switch (i.customId) {
                            case 'first': currentPageIndex = 0; break;
                            case 'previous': currentPageIndex = Math.max(0, currentPageIndex - 1); break;
                            case 'next': currentPageIndex = Math.min(pages.length - 1, currentPageIndex + 1); break;
                            case 'last': currentPageIndex = pages.length - 1; break;
                        }
            
                        // Update the embed and buttons
                        await i.update({
                            embeds: [generateEmbed(currentPageIndex)],
                            components: [generateButtons(currentPageIndex)]
                        });
                    });
            
                    collector.on('end', async () => {
                        await response.edit({ components: [] }).catch(() => {}); // Remove the buttons when the collector ends
                    });
                    return;
                }
            }
            
            // For a single page, create and send the embed
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`📅 Message History for ${displayDate}`)
                .setDescription(description)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching history:', error); // Log the error
            await interaction.editReply({
                content: 'An error occurred while retrieving message history. Please try again later.',
                ephemeral: true // Send the error message as ephemeral
            });
        }
    }
};