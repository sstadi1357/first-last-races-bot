// utils/scoreCalculator.js
const { scoring } = require('../config/points');

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

async function getLastMessages(guild, startOfDay, endOfDay) {
  const messages = new Map();
  
  // Find the races channel
  const racesChannel = guild.channels.cache.find(channel => 
    channel.type === 0 && channel.viewable && channel.name === 'general-races'
  );

  if (!racesChannel) {
    console.log('Races channel not found in this guild');
    return {
      lastMessageInfo: null,
      secondLastMessageInfo: null
    };
  }

  console.log(`Checking races channel for messages...`);

  try {
    console.log(`Fetching messages from races channel`);
    const channelMessages = await racesChannel.messages.fetch({ limit: 100 });
    console.log(`Found ${channelMessages.size} messages in races channel`);

    // Filter messages from yesterday
    const yesterdaysMessages = channelMessages.filter(msg => {
      const msgTime = new Date(msg.createdTimestamp);
      return !msg.author.bot && 
             msgTime >= startOfDay &&
             msgTime <= endOfDay;
    });

    // Add all yesterday's messages to our map
    yesterdaysMessages.forEach(msg => {
      messages.set(msg.id, msg);
    });
  } catch (error) {
    console.error(`Error fetching messages from races channel:`, error);
  }

  // Sort messages by timestamp
  const sortedMessages = Array.from(messages.values())
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

  console.log(`Found ${sortedMessages.length} total messages from yesterday in races channel`);
  
  let lastMessageInfo = null;
  let secondLastMessageInfo = null;

  if (sortedMessages.length > 0) {
    // Get last message
    lastMessageInfo = {
      userId: sortedMessages[0].author.id,
      username: sortedMessages[0].author.username,
      timestamp: formatTimestamp(sortedMessages[0].createdTimestamp)
    };
    console.log(`Last message in races channel by: ${lastMessageInfo.username}`);

    // Find second last message from a different user
    const secondLastMessage = sortedMessages.find(msg => 
      msg.author.id !== lastMessageInfo.userId
    );

    if (secondLastMessage) {
      secondLastMessageInfo = {
        userId: secondLastMessage.author.id,
        username: secondLastMessage.author.username,
        timestamp: formatTimestamp(secondLastMessage.createdTimestamp)
      };
      console.log(`Second last message in races channel by: ${secondLastMessageInfo.username}`);
    } else {
      console.log('No second last message from a different user found in races channel');
    }
  }

  return {
    lastMessageInfo,
    secondLastMessageInfo
  };
}

module.exports = {
  getLastMessages
};