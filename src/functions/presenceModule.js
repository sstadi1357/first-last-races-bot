// Import necessary module from discord.js
const { ActivityType } = require('discord.js');


// Export a function that takes 'client' as a parameter
module.exports = (client) => {
    // Define an asynchronous method 'pickPresence' on 'client'
    client.pickPresence = async () => {
        // Define options for the bot's presence
        const options = [
            {
                type: ActivityType.Custom,
                text: "🏁 Watching the race for first and last!", // Activity text
                status: "online" // Bot status
            },
            {
                type: ActivityType.Custom,
                text: "📊 Updating the daily rankings!",
                status: "online"
            },
            {
                type: ActivityType.Custom,
                text: "🤔 Who will claim the top spot?",
                status: "online"
            },
            {
                type: ActivityType.Custom,
                text: "🏃 Encouraging daily participation!",
                status: "online"
            },
            {
                type: ActivityType.Custom,
                text: "🚀 Be bold. Be first. Be last.",
                status: "online"
            },
            {
                type: ActivityType.Custom,
                text: "⚔️ Racing to the finish line!",
                status: "online"
            },
        ];

        // Randomly select an option from 'options'
        const option = Math.floor(Math.random() * options.length);

        // Log that the bot is setting its presence
        console.log('Setting presence...');

        try {
            // Attempt to set the bot's presence using 'client.user.setPresence'
            await client.user.setPresence({
                activities: [{
                    name: options[option].text, // Set the activity name to the selected 'text'
                    type: options[option].type, // Set the activity type
                }],
                status: options[option].status // Set the bot's statu
            });

            // Log a message indicating the presence was successfully set
            console.log(`Presence set to: ${options[option].text}`);
        } catch (error) {
            // Catch and log any errors that occur during setting presence
            console.error('Error setting presence:', error);
        }
    };
};