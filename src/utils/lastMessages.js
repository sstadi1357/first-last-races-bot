// Description: Utility functions for fetching the last messages  
const { mainChannelId } = require('../config/mainConfig');
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
  console.log(`\n🔍 Looking for races channel with ID: ${mainChannelId}`);
  const racesChannel = guild.channels.cache.find(channel => 
    channel.type === 0 && channel.viewable && channel.id === mainChannelId
  );

  if (!racesChannel) {
    console.log('❌ Races channel not found in this guild');
    return {
      lastMessageInfo: null,
      secondLastMessageInfo: null
    };
  }

  console.log(`✅ Found races channel: ${racesChannel.name}`);

  let lastMessageInfo = null;
  let secondLastMessageInfo = null;
  let lastUserId = null;
  let fetchedAll = false;
  let beforeId = undefined;

  while (!fetchedAll) {
    const options = { limit: 100 };
    if (beforeId) options.before = beforeId;
    const channelMessages = await racesChannel.messages.fetch(options);
    if (channelMessages.size === 0) break;

    // Sort messages from newest to oldest
    const sortedMessages = Array.from(channelMessages.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    for (const msg of sortedMessages) {
      const msgTime = new Date(msg.createdTimestamp);
      if (msgTime < startOfDay) {
        fetchedAll = true;
        break;
      }
      if (msgTime > endOfDay) continue; // skip messages after endOfDay (shouldn't happen, but safe)
      if (msg.author.bot) continue;

      if (!lastMessageInfo) {
        lastMessageInfo = {
          userId: msg.author.id,
          username: msg.author.username,
          timestamp: formatTimestamp(msg.createdTimestamp),
          messageId: msg.id
        };
        lastUserId = msg.author.id;
        continue;
      }
      if (!secondLastMessageInfo && msg.author.id !== lastUserId) {
        secondLastMessageInfo = {
          userId: msg.author.id,
          username: msg.author.username,
          timestamp: formatTimestamp(msg.createdTimestamp),
          messageId: msg.id
        };
        fetchedAll = true;
        break;
      }
    }
    // Prepare for next batch
    beforeId = sortedMessages[sortedMessages.length - 1]?.id;
    if (!beforeId) break;
  }

  // React to the last and second last messages with a ballot box with check
  try {
    if (lastMessageInfo && lastMessageInfo.messageId) {
      const msg = await racesChannel.messages.fetch(lastMessageInfo.messageId).catch(() => null);
      if (msg) await msg.react('☑️');
    }
    if (secondLastMessageInfo && secondLastMessageInfo.messageId) {
      const msg = await racesChannel.messages.fetch(secondLastMessageInfo.messageId).catch(() => null);
      if (msg) await msg.react('☑️');
    }
  } catch (reactError) {
    console.error('Error reacting to last/second last message:', reactError);
  }

  if (lastMessageInfo) {
    console.log(`\n✅ Last message found: ${lastMessageInfo.username} at ${lastMessageInfo.timestamp}`);
  } else {
    console.log('❌ No messages found for the specified time range');
  }
  if (secondLastMessageInfo) {
    console.log(`✅ Second last message found: ${secondLastMessageInfo.username} at ${secondLastMessageInfo.timestamp}`);
  } else if (lastMessageInfo) {
    console.log('❌ No second last message from a different user found');
  }

  return {
    lastMessageInfo,
    secondLastMessageInfo
  };
}

module.exports = {
  getLastMessages
};