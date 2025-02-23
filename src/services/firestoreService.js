// services/firestoreService.js
const { FieldValue } = require('firebase-admin/firestore');
const db = require('../firebase');
const { scoring } = require('../config/mainConfig');

// Calculate score based on message position
function calculateScore(messages, index) {
  const position = index + 1;
  return scoring.positions[position] || scoring.positions.default;
}

async function updateScoresAndLeaderboard(serverId, messages, lastMessageInfo, secondLastMessageInfo) {
  const serverDocRef = db.collection('servers').doc(serverId);
  const usersRef = serverDocRef.collection('users');
  
  try {
    await db.runTransaction(async (transaction) => {
      const userScoresMap = new Map();
      
      // Get current user scores if they exist
      const userDocs = await transaction.get(usersRef);
      userDocs.forEach(doc => {
        userScoresMap.set(doc.id, {
          userId: doc.id,
          score: doc.data().score || 0,
          username: doc.data().username
        });
      });

      // Process each message and calculate scores
      messages.forEach((message, index) => {
        const userData = userScoresMap.get(message.userId) || {
          userId: message.userId,
          score: 0,
          username: message.username
        };
        
        // Calculate base score from position
        let totalScore = calculateScore(messages, index);
        
        // Add bonus points for last/second-last messages
        if (lastMessageInfo && message.userId === lastMessageInfo.userId) {
          totalScore += scoring.lastMessage;
          console.log(`${message.username} gets +${scoring.lastMessage} points for last message`);
        }
        if (secondLastMessageInfo && message.userId === secondLastMessageInfo.userId) {
          totalScore += scoring.secondLastMessage;
          console.log(`${message.username} gets +${scoring.secondLastMessage} points for second-last message`);
        }

        userData.score += totalScore;
        console.log(`${message.username} gets total ${totalScore} points (position ${index + 1})`);
        userScoresMap.set(message.userId, userData);
      });

      // Convert map to sorted array
      const sortedUsers = Array.from(userScoresMap.values()).sort((a, b) => b.score - a.score);

      console.log('\nUpdating user scores and ranks...');
      
      // Update each user's document
      for (const [index, userData] of sortedUsers.entries()) {
        const userRef = usersRef.doc(userData.userId);
        transaction.set(userRef, {
          score: userData.score,
          username: userData.username,
          rank: index + 1,
          lastUpdated: FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`Updated user ${userData.username}: Score ${userData.score}, Rank ${index + 1}`);
      }

      // Create/Update leaderboard
      const leaderboardRef = serverDocRef.collection('leaderboard').doc('current');
      transaction.set(leaderboardRef, {
        lastUpdated: FieldValue.serverTimestamp(),
        rankings: sortedUsers.map((user, index) => ({
          userId: user.userId,
          username: user.username,
          score: user.score,
          rank: index + 1
        }))
      });

      console.log(`Updated leaderboard with ${sortedUsers.length} users`);
    });

    console.log(`Successfully updated all scores and leaderboard for server ${serverId}`);
  } catch (error) {
    console.error(`Error in updateScoresAndLeaderboard for server ${serverId}:`, error);
    throw error;
  }
}

async function storeLastMessages(serverDocRef, date, lastMessageInfo, secondLastMessageInfo) {
  try {
    const dayDocRef = serverDocRef.collection('days').doc(date);
    
    await dayDocRef.set({
      lastMessages: {
        last: lastMessageInfo ? {
          userId: lastMessageInfo.userId,
          username: lastMessageInfo.username,
          timestamp: lastMessageInfo.timestamp
        } : null,
        secondLast: secondLastMessageInfo ? {
          userId: secondLastMessageInfo.userId,
          username: secondLastMessageInfo.username,
          timestamp: secondLastMessageInfo.timestamp
        } : null
      }
    }, { merge: true });
    
    console.log(`Stored last messages for ${date}`);
  } catch (error) {
    console.error(`Error storing last messages:`, error);
    throw error;
  }
}

module.exports = {
  updateScoresAndLeaderboard,
  storeLastMessages
};
