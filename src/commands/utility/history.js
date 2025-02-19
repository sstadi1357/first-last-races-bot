const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

function getPositionLabel(index) {
    switch (index) {
        case 0: return "🥇 First";
        case 1: return "🥈 Second";
        case 2: return "🥉 Third";
        case 3: return "4th";
        case 4: return "5th";
        default: return `${index + 1}th`;
    }
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('View message history for a specific day')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date in MM-DD-YYYY format')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const dateStr = interaction.options.getString('date');
        const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/;

        if (!dateRegex.test(dateStr)) {
            return await interaction.editReply('Please provide a valid date in MM-DD-YYYY format (e.g., 01-20-2025).');
        }

        try {
            const serverId = interaction.guildId;
            const serverRef = db.collection('servers').doc(serverId);
            const dayDoc = await serverRef.collection('days').doc(dateStr).get();

            if (!dayDoc.exists) {
                return await interaction.editReply(`No messages recorded for ${dateStr}.`);
            }

            const data = dayDoc.data();
            const messages = data.messages || [];
            const lastMessages = data.lastMessages || {};

            // Get all guild members
            const guild = interaction.guild;
            const members = await guild.members.fetch();

            // Process regular messages (first messages of the day)
            let description = '';
            messages.forEach((msg, index) => {
                const member = members.find(m => m.user.username === msg.username);
                const displayName = member ? member.displayName : msg.username;
                description += `${getPositionLabel(index)}: ${displayName}\n`;
            });

            // Add last/second-last messages if they exist
            if (lastMessages.last) {
                const lastMember = members.find(m => m.user.username === lastMessages.last.username);
                const lastDisplayName = lastMember ? lastMember.displayName : lastMessages.last.username;
                description += `\n🌙 **Last message**: ${lastDisplayName}`;
                
                if (lastMessages.secondLast) {
                    const secondLastMember = members.find(m => m.user.username === lastMessages.secondLast.username);
                    const secondLastDisplayName = secondLastMember ? secondLastMember.displayName : lastMessages.secondLast.username;
                    description += `\n🌑 **Second-last message**: ${secondLastDisplayName}`;
                }
            }

            // Validate and truncate description
            if (!description || typeof description !== 'string' || description.trim().length === 0) {
                description = 'No messages to display for this date.';
            } else if (description.length > 4096) {
                description = description.slice(0, 4093) + '...';
            }

            // Create embed with finalized description
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`📅 Message History for ${dateStr}`)
                .setDescription(description)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching history:', error);
            await interaction.editReply({
                content: 'An error occurred while retrieving message history. Please try again later.',
                ephemeral: true
            });
        }
    },
};