// commands/position.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('position-counter')
    .setDescription('Shows statistics for a specific position in the race history')
    .addIntegerOption(option =>
      option
        .setName('place')
        .setDescription('Which position to analyze (e.g., 10 for 10th place)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(15)),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const position = interaction.options.getInteger('place');
      const serverId = interaction.guildId;

      // Get the guild and create username to display name mapping
      const guild = interaction.guild;
      await guild.members.fetch(); // Fetch all members
      const usernameToDisplayName = new Map();
      guild.members.cache.forEach(member => {
        usernameToDisplayName.set(member.user.username, member.displayName);
      });

      // Get all days
      const daysRef = db.collection('servers').doc(serverId).collection('days');
      const daysSnapshot = await daysRef.get();
      
      let totalDays = 0;
      let daysWithPosition = 0;
      let usersAtPosition = new Map();

      for (const dayDoc of daysSnapshot.docs) {
        const dayData = dayDoc.data();
        
        if (dayData.messages && dayData.messages.length > 0) {
          totalDays++;
          
          // Sort messages by timestamp
          const sortedMessages = dayData.messages.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
          );

          // Check if we had enough messages to have this position
          if (sortedMessages.length >= position) {
            const username = sortedMessages[position - 1].username;
            // Get display name from our mapping, fallback to username if not found
            const displayName = usernameToDisplayName.get(username) || username;
            daysWithPosition++;
            
            usersAtPosition.set(
              displayName, 
              (usersAtPosition.get(displayName) || 0) + 1
            );
          }
        }
      }

      // Calculate percentage
      const percentage = (daysWithPosition / totalDays * 100).toFixed(2);

      // Sort users by frequency
      const sortedUsers = Array.from(usersAtPosition.entries())
        .sort((a, b) => b[1] - a[1]);

      // Create embed response
      const responseEmbed = {
        color: 0x0099ff,
        title: `${position}${getOrdinalSuffix(position)} Place Statistics`,
        fields: [
          {
            name: 'Overview',
            value: [
              `**Total Days Analyzed:** ${totalDays}`,
              `**Days with ${position}${getOrdinalSuffix(position)} Place:** ${daysWithPosition}`,
              `**Percentage of Days:** ${percentage}%`
            ].join('\n'),
            inline: false
          }
        ],
        timestamp: new Date(),
        footer: {
          text: 'First/Last Race History'
        }
      };

      // Add top users field if there are any
      if (sortedUsers.length > 0) {
        const topUsersText = sortedUsers.slice(0, 5)
          .map(([displayName, count]) => {
            const userPercentage = (count / daysWithPosition * 100).toFixed(2);
            return `**${displayName}:** ${count} times (${userPercentage}% of ${position}${getOrdinalSuffix(position)} places)`;
          })
          .join('\n');

        responseEmbed.fields.push({
          name: 'Top Users in this Position',
          value: topUsersText,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [responseEmbed] });

    } catch (error) {
      console.error('Error in position command:', error);
      await interaction.editReply('There was an error analyzing the position data!');
    }
  }
};

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j == 1 && k != 11) return 'st';
  if (j == 2 && k != 12) return 'nd';
  if (j == 3 && k != 13) return 'rd';
  return 'th';
}