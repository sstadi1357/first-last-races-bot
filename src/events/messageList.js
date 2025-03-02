const { FieldValue } = require('firebase-admin/firestore');
const db = require('../firebase'); // Import Firestore instance
const { Events } = require('discord.js');
const { mainChannelId } = require('../config/mainConfig.js');
function getPacificDate() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split(',')[0].split('/').join('-');
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignore bot messages, DMs, and messages not in the races channel
    if (message.author.bot || !message.guild || message.channel.id !== mainChannelId) return;

    try {
      const serverId = message.guild.id;
      const today = getPacificDate();
      const serverDocRef = db.collection('servers').doc(serverId);
      const dayDocRef = serverDocRef.collection('days').doc(today);

      const dayDocSnapshot = await dayDocRef.get();
      if (!dayDocSnapshot.exists) {
        await dayDocRef.set({ createdAt: FieldValue.serverTimestamp(), messages: [] });
        console.log(`Created new document for ${today} in server ${serverId}.`);
      }

      // Retrieve the existing messages array
      const dayDoc = await dayDocRef.get();
      const messages = dayDoc.data().messages || [];

      // Check if this user's first message is already logged
      const userExists = messages.some(msg => msg.userId === message.author.id);

      if (!userExists) {
        // Prepare the new message data
        const messageData = {
          userId: message.author.id,
          username: message.author.username,
          id: message.id,
          timestamp: new Date().toLocaleString("en-US", {
            timeZone: "America/Los_Angeles"
          })
        };

        // Add the new message to the list and update Firestore
        messages.push(messageData);

        // Sort messages by timestamp for ordering
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        await dayDocRef.update({ messages });

        console.log(
          `Logged first message for user ${message.author.tag} in races channel on ${today} in server ${serverId}`
        );
      }
    } catch (error) {
      console.error('Error logging first message of the day:', error);
    }
  },
};