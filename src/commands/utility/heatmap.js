const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../firebase');

function getIntensityEmoji(value, maxCount) {
    if (value === 0) return '⬛'; // black
    const intensity = value / maxCount;
    if (intensity <= 0.2) return '🟦'; // light activity
    if (intensity <= 0.4) return '🟪'; // medium-light activity
    if (intensity <= 0.6) return '🟨'; // medium activity
    if (intensity <= 0.8) return '🟧'; // medium-high activity
    return '🟥'; // high activity
}

function formatHour(hour) {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour-12}pm`;
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('heatmap')
        .setDescription('View activity heatmap')
        .addStringOption(option =>
            option.setName('view')
                .setDescription('Choose heatmap view')
                .setRequired(true)
                .addChoices(
                    { name: 'Daily Pattern', value: 'daily' },
                    { name: 'Hourly Pattern', value: 'hourly' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const serverId = interaction.guildId;
            const daysRef = await db.collection('servers').doc(serverId).collection('days').get();
            const view = interaction.options.getString('view');
            
            // Initialize data arrays
            const hourlyData = Array(24).fill(0);
            const dailyData = Array(7).fill(0);
            let maxHourly = 0;
            let maxDaily = 0;

            // Process messages
            daysRef.forEach(doc => {
                const data = doc.data();
                // Process regular first messages
                if (data.messages) {
                    data.messages.forEach(msg => {
                        if (msg.timestamp) {
                            const date = new Date(msg.timestamp);
                            const hour = date.getHours();
                            const day = date.getDay();
                            
                            hourlyData[hour]++;
                            dailyData[day]++;
                            
                            maxHourly = Math.max(maxHourly, hourlyData[hour]);
                            maxDaily = Math.max(maxDaily, dailyData[day]);
                        }
                    });
                }
                
                // Process last and second last messages
                if (data.lastMessages) {
                    if (data.lastMessages.last?.timestamp) {
                        const lastDate = new Date(data.lastMessages.last.timestamp);
                        const lastHour = lastDate.getHours();
                        const lastDay = lastDate.getDay();
                        
                        hourlyData[lastHour]++;
                        dailyData[lastDay]++;
                        
                        maxHourly = Math.max(maxHourly, hourlyData[lastHour]);
                        maxDaily = Math.max(maxDaily, dailyData[lastDay]);
                    }
                    
                    if (data.lastMessages.secondLast?.timestamp) {
                        const secondLastDate = new Date(data.lastMessages.secondLast.timestamp);
                        const secondLastHour = secondLastDate.getHours();
                        const secondLastDay = secondLastDate.getDay();
                        
                        hourlyData[secondLastHour]++;
                        dailyData[secondLastDay]++;
                        
                        maxHourly = Math.max(maxHourly, hourlyData[secondLastHour]);
                        maxDaily = Math.max(maxDaily, dailyData[secondLastDay]);
                    }
                }
            });

            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('🗺️ Activity Heatmap')
                .setTimestamp();

            if (view === 'hourly') {
                // Create hourly view (24-hour pattern)
                let hourlyMap = '';
                for (let i = 0; i < 24; i += 6) {
                    let row = '';
                    for (let j = i; j < i + 6 && j < 24; j++) {
                        row += getIntensityEmoji(hourlyData[j], maxHourly);
                    }
                    hourlyMap += `${formatHour(i).padStart(4)} ${row}\n`;
                }

                embed.addFields(
                    { name: 'Hourly Activity Pattern', value: hourlyMap },
                    { name: 'Peak Hours', value: hourlyData.reduce((acc, count, hour) => {
                        if (count > maxHourly * 0.7) { // Show hours with >70% of max activity
                            acc.push(`${formatHour(hour)}: ${count} messages`);
                        }
                        return acc;
                    }, []).join('\n') || 'No significant peaks' }
                );
            } else {
                // Create daily view (day of week pattern)
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                let dailyMap = '';
                days.forEach((day, index) => {
                    dailyMap += `${day.padEnd(4)} ${getIntensityEmoji(dailyData[index], maxDaily)} ${dailyData[index]} messages\n`;
                });

                embed.addFields(
                    { name: 'Daily Activity Pattern', value: dailyMap },
                    { name: 'Most Active Days', value: dailyData.reduce((acc, count, day) => {
                        if (count > maxDaily * 0.7) { // Show days with >70% of max activity
                            acc.push(`${days[day]}: ${count} messages`);
                        }
                        return acc;
                    }, []).join('\n') || 'No significant peaks' }
                );
            }

            embed.addFields({
                name: 'Activity Levels',
                value: '⬛ None  🟦 Low  🟪 Medium  🟨 High  🟧 Very High  🟥 Peak'
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating heatmap:', error);
            await interaction.editReply('Error creating heatmap. Please try again later.');
        }
    }
};