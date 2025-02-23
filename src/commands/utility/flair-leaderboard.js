const {SlashCommandBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,} = require("discord.js");
const { EmbedBuilder } = require("discord.js");
const db = require("../../firebase");
const { ROLES } = require("../../config/mainConfig.js"); // Import the role tiers from the config file

module.exports = {
  data: new SlashCommandBuilder()
    .setName("flair-leaderboard")
    .setDescription("Shows users grouped by their highest point flair"),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const serverId = interaction.guild.id; // Accesses the server in firebase
      const serverRef = db.collection("servers").doc(serverId);

      // Get all users in the server
      const usersSnapshot = await serverRef.collection("users").get();

      // Create role groups to store users
      const roleGroups = {};
      Object.keys(ROLES).forEach((tier) => {
        roleGroups[tier] = [];
      });

      // Process each user
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data(); //Accesses the user data in firebase
        const userId = doc.id;
        const member = await interaction.guild.members
          .fetch(userId)
          .catch(() => null); // Fetches the member in the server

        if (member) {
          // Find all roles the user has
          const userRoles = member.roles.cache;
          let highestTier = null;
          let highestPoints = -1;

          // Check ALL roles the user has and find the highest point role
          for (const [roleTier, tierData] of Object.entries(ROLES)) {
            if (userRoles.has(tierData.id)) {
              // If this is a point role and has more points than current highest
              if (tierData.points > highestPoints) {
                highestTier = roleTier;
                highestPoints = tierData.points;
              }
            }
          }

          // If no point roles were found (highestPoints is still -1), check for First/Last and Racer
          if (highestPoints === -1) {
            if (userRoles.has(ROLES.FIRST_LAST.id)) {
              highestTier = "FIRST_LAST";
            } else if (userRoles.has(ROLES.RACER.id)) {
              highestTier = "RACER";
            }
          }

          if (highestTier) {
            roleGroups[highestTier].push({
              name: member.displayName, // Find the user's display name
              points: userData.score || 0,
            });
          }
          // ...rest of the code remains the same...
          else if (userData.score > 0) {
            // If user has points but no role, add them to the lowest point role they qualify for
            const qualifyingTier = Object.entries(ROLES)
              .filter(([_, tierData]) => tierData.points > 0) // Filter out non-point roles
              .sort((a, b) => a[1].points - b[1].points) // Sort ascending
              .find(([_, tierData]) => userData.score >= tierData.points);

            if (qualifyingTier) {
              roleGroups[qualifyingTier[0]].push({
                name: member.displayName,
                points: userData.score,
              });
            }
          }
        }
      }

      // Create embed
      const pages = [];
      const itemsPerPage = 3; // Number of role tiers per page
      
      // Create embed pages
      const roleTierEntries = Object.entries(ROLES);
      for (let i = 0; i < roleTierEntries.length; i += itemsPerPage) {
          const pageEmbed = new EmbedBuilder()
              .setTitle("🏆 Flair Leaderboard")
              .setColor("#FFD700")
              .setDescription("Users grouped by their highest flair")
              .setTimestamp()
              .setFooter({ text: `Page ${Math.floor(i/itemsPerPage) + 1}/${Math.ceil(roleTierEntries.length/itemsPerPage)}` });

          // Add fields for each role tier on this page
          const pageTiers = roleTierEntries.slice(i, i + itemsPerPage);
          pageTiers.forEach(([tier, tierData]) => {
              const users = roleGroups[tier];
              if (users.length > 0) {
                  users.sort((a, b) => b.points - a.points);
                  const userList = users
                      .map((user) => `${user.name} (${user.points} pts)`)
                      .join("\n");

                  pageEmbed.addFields({
                      name: `${tierData.name} (${users.length} ${users.length === 1 ? "user" : "users"})`,
                      value: userList || "No users",
                      inline: false,
                  });
              }
          });

          pages.push(pageEmbed);
      }

      let currentPageIndex = 0;

      const generateButtons = (pageIndex) => {
          return new ActionRowBuilder()
              .addComponents(
                  new ButtonBuilder()
                      .setCustomId('first')
                      .setLabel('⏪ First')
                      .setStyle(ButtonStyle.Primary)
                      .setDisabled(pageIndex === 0),
                  new ButtonBuilder()
                      .setCustomId('previous')
                      .setLabel('◀️ Previous')
                      .setStyle(ButtonStyle.Primary)
                      .setDisabled(pageIndex === 0),
                  new ButtonBuilder()
                      .setCustomId('next')
                      .setLabel('Next ▶️')
                      .setStyle(ButtonStyle.Primary)
                      .setDisabled(pageIndex === pages.length - 1),
                  new ButtonBuilder()
                      .setCustomId('last')
                      .setLabel('Last ⏩')
                      .setStyle(ButtonStyle.Primary)
                      .setDisabled(pageIndex === pages.length - 1)
              );
      };

      const response = await interaction.editReply({
          embeds: [pages[currentPageIndex]],
          components: pages.length > 1 ? [generateButtons(currentPageIndex)] : []
      });

      if (pages.length > 1) {
          const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 minutes

          collector.on('collect', async (i) => {
              if (i.user.id !== interaction.user.id) {
                  await i.reply({ content: 'You cannot use these buttons.', ephemeral: true });
                  return;
              }

              switch (i.customId) {
                  case 'first': currentPageIndex = 0; break;
                  case 'previous': currentPageIndex = Math.max(0, currentPageIndex - 1); break;
                  case 'next': currentPageIndex = Math.min(pages.length - 1, currentPageIndex + 1); break;
                  case 'last': currentPageIndex = pages.length - 1; break;
              }

              await i.update({
                  embeds: [pages[currentPageIndex]],
                  components: [generateButtons(currentPageIndex)]
              });
          });

          collector.on('end', async () => {
              await response.edit({ components: [] }).catch(() => {});
          });
      }

  } catch (error) {
      console.error("Error creating flair leaderboard:", error);
      await interaction.editReply({
          content: "There was an error while creating the leaderboard. Please try again later.",
          ephemeral: true,
      });
  }
},
};

