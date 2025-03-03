const { FieldValue } = require('firebase-admin/firestore');
const db = require('../firebase'); // Import Firestore instance
const { hexChannelId } = require('../config/mainConfig.js');
const { serverId, spreadsheetId } = require('../config/mainConfig');
const { Events } = require('discord.js');
const sheets = require('../sheets');
const { formatUserCells } = require('../functions/userSheetFormatting'); // Import the new cell formatting module

// Set strictnessFactor to a very low value for much less strict checking
// Lower value = less strict (colors can be more similar)
const strictnessFactor = 5; // Very lenient setting

function getPacificDate() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split(',')[0].split('/').join('-');
}

// Function to convert hex to RGB
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return [r, g, b];
}

// Calculate color distance (Euclidean distance in RGB space)
function colorDistance(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  // Calculate Euclidean distance
  const rDiff = rgb1[0] - rgb2[0];
  const gDiff = rgb1[1] - rgb2[1];
  const bDiff = rgb1[2] - rgb2[2];
  
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

// Check if color is too similar to existing colors
async function isTooSimilar(newHex, username) {
  try {
    // Fetch all user colors from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:B'
    });
    
    const rows = response.data.values || [];
    // Skip header row
    const userColors = rows.slice(1)
      .filter(row => row.length >= 2 && row[0] !== username && row[1]);
    
    // With strictnessFactor = 5, threshold will be 145
    // This means colors need to be very close to be rejected
    const threshold = 150 - strictnessFactor;
    
    console.log(`Checking color similarity with threshold: ${threshold} (very lenient)`);
    
    for (const userColor of userColors) {
      const existingColor = userColor[1];
      const distance = colorDistance(newHex, existingColor);
      
      console.log(`Distance between ${newHex} and ${existingColor} (${userColor[0]}): ${distance}`);
      
      // Only reject if colors are extremely similar
      if (distance < threshold && distance < 30) {
        console.log(`Color ${newHex} is extremely similar to existing color ${existingColor} (${userColor[0]}) with distance ${distance}`);
        return {
          tooSimilar: true,
          similarTo: userColor[0],
          distance: distance
        };
      }
    }
    
    console.log(`Color ${newHex} is accepted`);
    return { tooSimilar: false };
  } catch (error) {
    console.error('Error checking color similarity:', error);
    // On error, let the color through
    return { tooSimilar: false };
  }
}

async function updateUserHexInSheet(username, hexColor) {
  try {
    console.log(`Updating user ${username} with hex color ${hexColor} in Users sheet`);
    
    // First check if color is too similar to existing colors
    const similarityCheck = await isTooSimilar(hexColor, username);
    if (similarityCheck.tooSimilar) {
      return { 
        success: false, 
        reason: 'similar-color',
        details: similarityCheck
      };
    }
    
    // Fetch current users from the Users sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:B'
    });
    
    const rows = response.data.values || [];
    let userExists = false;
    let rowIndex = -1;
    
    // Check if user exists and find their row
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === username) {
        userExists = true;
        rowIndex = i + 1; // Add 1 for 1-based indexing in Sheets API
        break;
      }
    }
    
    if (userExists) {
      // Update existing user's hex color
      console.log(`User ${username} found at row ${rowIndex}, updating hex color`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Users!B${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[hexColor]]
        }
      });
      
      // Format the cells after updating the value
      await formatUserCells(rowIndex, hexColor);
    } else {
      // Add new user to the end of the sheet
      console.log(`User ${username} not found, adding as new entry to Users sheet`);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Users!A:B',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[username, hexColor]]
        }
      });
      
      // Get the row where the new user was added
      const updatedResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Users!A:B'
      });
      
      const updatedRows = updatedResponse.data.values || [];
      let newRowIndex = -1;
      
      // Find the row where the new user was added
      for (let i = 1; i < updatedRows.length; i++) {
        if (updatedRows[i] && updatedRows[i][0] === username) {
          newRowIndex = i + 1; // Add 1 for 1-based indexing in Sheets API
          break;
        }
      }
      
      if (newRowIndex > 0) {
        // Format the cells for the new user
        await formatUserCells(newRowIndex, hexColor);
      }
    }
    
    console.log(`Successfully updated Users sheet for user ${username}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating user hex in Users sheet:', error);
    return { success: false, reason: 'technical-error' };
  }
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignore bot messages, DMs, and messages not in the hex channel
    if (message.author.bot || !message.guild || message.channel.id !== hexChannelId) return;
    
    // Check if message is a valid hex code
    let hex = message.content.trim();
    if (hex.startsWith('#') && hex.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      // Valid hex code, continue processing
      console.log(`Valid hex code received: ${hex} from user ${message.author.username}`);
      
      // Update the user's hex in the sheet
      const username = message.author.username;
      const result = await updateUserHexInSheet(username, hex);
      
      if (result.success) {
        // React to message to indicate success
        await message.react('✅');
      } else if (result.reason === 'similar-color') {
        // Color is too similar to existing color
        await message.delete();
        await message.author.send(
          `Your color ${hex} is too similar to ${result.details.similarTo}'s color. ` +
          `Please choose a more distinct color. (Similarity: ${Math.round(result.details.distance)} out of ${150 - strictnessFactor} threshold)`
        );
      } else {
        // There was a technical error
        await message.delete();
        await message.author.send('There was an error processing your hex code. Please try again later.');
      }
    } else {
      // Invalid hex code, delete message and notify user
      await message.delete();
      await message.author.send('Please enter a valid 6-digit hex code starting with # (e.g., #FF0000 for red)');
      return null;
    }
    
    return true;
  }
};