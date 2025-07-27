// const { Events } = require('discord.js');
// const { mainChannelId } = require('../config/mainConfig');

// module.exports = {
//     name: Events.ClientReady,
//     once: true,
//     execute(client) {
//         console.log('Spam event started - sending message every second');
        
//         // Send the spam message every second
//         setInterval(async () => {
//             try {
//                 const channel = await client.channels.fetch(mainChannelId);
//                 if (channel) {
//                     await channel.send('<@1334413914842206272> spam');
//                 } else {
//                     console.error('Could not find main channel');
//                 }
//             } catch (error) {
//                 console.error('Error sending spam message:', error);
//             }
//         }, 1000); // 1000ms = 1 second
//     },
// }; 