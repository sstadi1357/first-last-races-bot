const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

// Define role tiers
const ROLE_TIERS = {
  POINT_GOD: { points: 5000, id: '1336556598998601760', name: '5000 Point God' },
  PURPLE: { points: 2000, id: '1336556534217441370', name: '2000 Points' },
  BLUE: { points: 1000, id: '1336556482220785737', name: '1000 Points' },
  DARK_GREEN: { points: 500, id: '1336556444954132480', name: '500 Points' },
  GREEN: { points: 250, id: '1336556322165882893', name: '250 Points' },
  YELLOW: { points: 100, id: '1336556271075332128', name: '100 Points' },
  ORANGE: { points: 50, id: '1336556846888325130', name: '50 Points' },
  FIRST_LAST: { points: 0, id: '1336556008125763714', name: 'Got a First/Last' },
  RACER: { points: 0, id: '1335822775901749299', name: 'Racer' }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flair-leaderboard')
    .setDescription('Shows users grouped by their highest point flair'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const serverId = interaction.guild.id;
      const serverRef = db.collection('servers').doc(serverId);
      
      // Get all users in the server
      const usersSnapshot = await serverRef.collection('users').get();
      
      // Create role groups to store users
      const roleGroups = {};
      Object.keys(ROLE_TIERS).forEach(tier => {
        roleGroups[tier] = [];
      });

      // Process each user
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        const userId = doc.id;
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (member) {
          // Find all roles the user has
          const userRoles = new Set(member.roles.cache.map(role => role.id));
          
          // Find the highest tier role the user has
          let highestTier = null;
          let highestPoints = -1;

          // First check point-based roles
          for (const [tier, tierData] of Object.entries(ROLE_TIERS)) {
            if (userRoles.has(tierData.id) && tierData.points > 0) {
              if (tierData.points > highestPoints) {
                highestTier = tier;
                highestPoints = tierData.points;
              }
            }
          }

          // If no point-based role found, check for First/Last role
          if (!highestTier && userRoles.has(ROLE_TIERS.FIRST_LAST.id)) {
            highestTier = 'FIRST_LAST';
          }
          
          // If no point-based role or First/Last role, check for Racer role
          if (!highestTier && userRoles.has(ROLE_TIERS.RACER.id)) {
            highestTier = 'RACER';
          }

          if (highestTier) {
            roleGroups[highestTier].push({
              name: member.displayName, // Changed to use displayName instead of username
              points: userData.score || 0
            });
          } else if (userData.score > 0) {
            // If user has points but no role, add them to the lowest point role they qualify for
            const qualifyingTier = Object.entries(ROLE_TIERS)
              .filter(([_, tierData]) => tierData.points > 0) // Filter out non-point roles
              .sort((a, b) => a[1].points - b[1].points) // Sort ascending
              .find(([_, tierData]) => userData.score >= tierData.points);

            if (qualifyingTier) {
              roleGroups[qualifyingTier[0]].push({
                name: member.displayName, // Changed to use displayName instead of username
                points: userData.score
              });
            }
          }
        }
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('🏆 Flair Leaderboard')
        .setColor('#FFD700')
        .setDescription('Users grouped by their highest flair')
        .setTimestamp();

      // Add fields for each role tier that has users
      Object.entries(ROLE_TIERS).forEach(([tier, tierData]) => {
        const users = roleGroups[tier];
        if (users.length > 0) {
          // Sort users by points within their tier
          users.sort((a, b) => b.points - a.points);
          
          const userList = users
            .map(user => `${user.name} (${user.points} pts)`)
            .join('\n');

          embed.addFields({
            name: `${tierData.name} (${users.length} users)`,
            value: userList || 'No users',
            inline: false
          });
        }
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error creating flair leaderboard:', error);
      await interaction.editReply({
        content: 'There was an error while creating the leaderboard. Please try again later.',
        ephemeral: true
      });
    }
  },
};