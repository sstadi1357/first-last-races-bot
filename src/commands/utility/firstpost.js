const { 
    SlashCommandBuilder, 
    EmbedBuilder
} = require('discord.js');
const db = require('../../firebase');
const { parseDate, formatDateForDisplay } = require('../../utils/dateParser');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('firstpost')
        .setDescription('Check what place a user got on a specific day')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date (e.g., "June 1st", "yesterday", "6/1", "01-15-2024")')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user');
            const dateInput = interaction.options.getString('date');

            // Parse the date input
            const dateResult = parseDate(dateInput);
            if (!dateResult.success) {
                return await interaction.editReply(`❌ Invalid date format: ${dateResult.error}\n\nTry formats like:\n• "June 1st" or "June 1"\n• "yesterday" or "today"\n• "3 days ago"\n• "6/1" or "6/1/2024"\n• "01-15-2024"`);
            }

            const dateStr = dateResult.formatted;
            const displayDate = formatDateForDisplay(dateStr);

            // Get the server ID and fetch the day's data
            const serverId = interaction.guildId;
            const serverRef = db.collection('servers').doc(serverId);
            const dayDoc = await serverRef.collection('days').doc(dateStr).get();

            if (!dayDoc.exists) {
                return await interaction.editReply(`📅 **${displayDate}**: No messages recorded for this day.`);
            }

            const data = dayDoc.data();
            const messages = data.messages || [];
            const lastMessages = data.lastMessages || {};

            // Find the user's position in the messages array
            let userPosition = -1;
            let userMessage = null;

            // Check regular messages (first messages of the day)
            for (let i = 0; i < messages.length; i++) {
                if (messages[i].userId === targetUser.id) {
                    userPosition = i + 1; // Convert to 1-based index
                    userMessage = messages[i];
                    break;
                }
            }

            // Check if user was last or second-last
            let isLast = false;
            let isSecondLast = false;

            if (lastMessages.last && lastMessages.last.userId === targetUser.id) {
                isLast = true;
            }
            if (lastMessages.secondLast && lastMessages.secondLast.userId === targetUser.id) {
                isSecondLast = true;
            }

            // Build the response
            let response = `📅 **${displayDate}**: `;

            if (userPosition > 0) {
                // User participated and got a position
                const positionText = getPositionText(userPosition);
                response += `${targetUser.displayName} got ${positionText}`;
                
                // Add last/second-last info if applicable
                if (isLast) {
                    response += ` & Last`;
                } else if (isSecondLast) {
                    response += ` & Second-last`;
                }
            } else if (isLast) {
                // User was only last (didn't get a position)
                response += `${targetUser.displayName} got Last`;
            } else if (isSecondLast) {
                // User was only second-last (didn't get a position)
                response += `${targetUser.displayName} got Second-last`;
            } else {
                // User didn't participate
                response += `${targetUser.displayName} was slacking on this day`;
            }

            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('🏁 First Post Check')
                .setDescription(response)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in firstpost command:', error);
            await interaction.editReply('❌ An error occurred while checking the user\'s position. Please try again later.');
        }
    }
};

function getPositionText(position) {
    switch (position) {
        case 1: return '1st';
        case 2: return '2nd';
        case 3: return '3rd';
        default: return `${position}th`;
    }
} 