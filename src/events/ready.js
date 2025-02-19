const { Events } = require('discord.js');
const  { startScheduler } = require('../schedulers/pointsScheduler');
const presenceModule = require('../functions/presenceModule'); // Adjust the path as necessary
module.exports = {
    name: Events.ClientReady, // Event name to listen for
    once: true, // Whether this event listener should only execute once
    execute(client) { // Function to execute when the ClientReady event occurs
        console.log(`Ready! Logged in as ${client.user.tag}`); // Log bot readiness with its tag.
         // Pass the client object to the presence-setting module
         presenceModule(client);

         // Call pickPresence initially to set the bot's presence
         client.pickPresence();

         // Set presence every 15 minutes (15 * 60 * 1000 milliseconds)
         setInterval(() => {
            client.pickPresence();
         }, 15*60*1000); // Interval to update presence
         startScheduler(client)
                console.log('points scheduler started')
    },
};