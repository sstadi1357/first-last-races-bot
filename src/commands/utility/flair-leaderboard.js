const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const db = require("../../firebase");
const { ROLES } = require("../../config/mainConfig.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("flair-leaderboard")
        .setDescription("Shows users grouped by their highest point flair"),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const serverId = interaction.guild.id;
            const serverRef = db.collection("servers").doc(serverId);
            const usersSnapshot = await serverRef.collection("users").get();

            // Create role groups to store users
            const roleGroups = {};
            Object.keys(ROLES).forEach((tier) => {
                roleGroups[tier] = [];
            });

            // Process each user
            for (const doc of usersSnapshot.docs) {
                const userData = doc.data();
                const userId = doc.id;
                const member = await interaction.guild.members.fetch(userId).catch(() => null);

                if (member) {
                    const userRoles = member.roles.cache;
                    let highestTier = null;
                    let highestPoints = -1;

                    // Find highest point role
                    for (const [roleTier, tierData] of Object.entries(ROLES)) {
                        if (userRoles.has(tierData.id) && tierData.points > highestPoints) {
                            highestTier = roleTier;
                            highestPoints = tierData.points;
                        }
                    }

                    // Check for special roles if no point roles found
                    if (highestPoints === -1) {
                        if (userRoles.has(ROLES.FIRST_LAST.id)) {
                            highestTier = "FIRST_LAST";
                        } else if (userRoles.has(ROLES.RACER.id)) {
                            highestTier = "RACER";
                        }
                    }

                    if (highestTier) {
                        roleGroups[highestTier].push({
                            name: member.displayName,
                            points: userData.score || 0,
                        });
                    } else if (userData.score > 0) {
                        const qualifyingTier = Object.entries(ROLES)
                            .filter(([_, tierData]) => tierData.points > 0)
                            .sort((a, b) => a[1].points - b[1].points)
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

            // Create initial embed
            let description = '';
            const maxDescriptionLength = 4096;
            const pages = [];

            // Process all role tiers
            for (const [tier, tierData] of Object.entries(ROLES)) {
                const users = roleGroups[tier];
                if (users.length > 0) {
                    users.sort((a, b) => b.points - a.points);
                    const tierContent = `**${tierData.name}** (${users.length} ${users.length === 1 ? "user" : "users"})\n` +
                        users.map((user) => `${user.name} (${user.points} pts)`).join("\n") + "\n\n";

                    if (description.length + tierContent.length > maxDescriptionLength) {
                        pages.push(description);
                        description = tierContent;
                    } else {
                        description += tierContent;
                    }
                }
            }

            // Add remaining content
            if (description) {
                pages.push(description);
            }

            // Single page response
            if (pages.length <= 1) {
                const embed = new EmbedBuilder()
                    .setTitle("🏆 Flair Leaderboard")
                    .setColor("#FFD700")
                    .setDescription(description || "No users found.")
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            // Multi-page response
            let currentPageIndex = 0;

            const generateEmbed = (pageIndex) => {
                return new EmbedBuilder()
                    .setTitle("🏆 Flair Leaderboard")
                    .setColor("#FFD700")
                    .setDescription(pages[pageIndex])
                    .setFooter({ text: `Page ${pageIndex + 1}/${pages.length}` })
                    .setTimestamp();
            };

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
                embeds: [generateEmbed(currentPageIndex)],
                components: [generateButtons(currentPageIndex)]
            });

            const collector = response.createMessageComponentCollector({ time: 300000 });

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
                    embeds: [generateEmbed(currentPageIndex)],
                    components: [generateButtons(currentPageIndex)]
                });
            });

            collector.on('end', async () => {
                await response.edit({ components: [] }).catch(() => {});
            });

        } catch (error) {
            console.error("Error creating flair leaderboard:", error);
            await interaction.editReply({
                content: "There was an error while creating the leaderboard. Please try again later.",
                ephemeral: true,
            });
        }
    },
};