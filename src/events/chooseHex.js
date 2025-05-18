const { FieldValue } = require('firebase-admin/firestore');
const db = require('../firebase'); // Import Firestore instance
const { hexChannelId } = require('../config/mainConfig.js');
const { serverId, spreadsheetId } = require('../config/mainConfig');
const { Events } = require('discord.js');
const sheets = require('../sheets');
const { formatAllUserCells } = require('../functions/userSheetFormatting'); // Import the new cell formatting module

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

// Calculate color distance using perceptual color difference (deltaE)
function colorDistance(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  try {
    // Convert RGB to Lab color space for more perceptually accurate comparison
    const lab1 = rgbToLab(rgb1);
    const lab2 = rgbToLab(rgb2);
    
    // Calculate deltaE (CIE76 formula)
    const lDiff = lab1.l - lab2.l;
    const aDiff = lab1.a - lab2.a;
    const bDiff = lab1.b - lab2.b;
    
    const deltaE = Math.sqrt(lDiff * lDiff + aDiff * aDiff + bDiff * bDiff);
    
    // Also check luminance difference for dark colors
    const lum1 = calculateLuminance(rgb1[0]/255, rgb1[1]/255, rgb1[2]/255);
    const lum2 = calculateLuminance(rgb2[0]/255, rgb2[1]/255, rgb2[2]/255);
    
    // Special adjustment for dark colors
    if (lum1 < 0.1 && lum2 < 0.1) {
      // If both colors are dark, increase their similarity
      return deltaE * 0.7;
    }
    
    // Special adjustment for light colors
    if (lum1 > 0.9 && lum2 > 0.9) {
      // If both colors are light, increase their similarity
      return deltaE * 0.7;
    }
    
    return deltaE;
  } catch (error) {
    console.error('Error calculating deltaE, falling back to RGB distance:', error);
    
    // Fallback to RGB distance if Lab conversion fails
    const rDiff = rgb1[0] - rgb2[0];
    const gDiff = rgb1[1] - rgb2[1];
    const bDiff = rgb1[2] - rgb2[2];
    
    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) / 4;
  }
}

// Calculate relative luminance (used in WCAG contrast calculations)
function calculateLuminance(r, g, b) {
  // Convert RGB to linear RGB
  const R = r <= 0.04045 ? r/12.92 : Math.pow((r+0.055)/1.055, 2.4);
  const G = g <= 0.04045 ? g/12.92 : Math.pow((g+0.055)/1.055, 2.4);
  const B = b <= 0.04045 ? b/12.92 : Math.pow((b+0.055)/1.055, 2.4);
  
  // Calculate luminance
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Convert RGB to Lab color space
function rgbToLab(rgb) {
  // First convert RGB to XYZ
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let blue = rgb[2] / 255; // Renamed from 'b' to 'blue' to avoid variable collision
  
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  blue = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;
  
  r *= 100;
  g *= 100;
  blue *= 100;
  
  const x = r * 0.4124 + g * 0.3576 + blue * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + blue * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + blue * 0.9505;
  
  // Then convert XYZ to Lab
  const xn = 95.047;
  const yn = 100.0;
  const zn = 108.883;
  
  const x1 = x / xn;
  const y1 = y / yn;
  const z1 = z / zn;
  
  const fx = x1 > 0.008856 ? Math.pow(x1, 1/3) : (7.787 * x1) + (16/116);
  const fy = y1 > 0.008856 ? Math.pow(y1, 1/3) : (7.787 * y1) + (16/116);
  const fz = z1 > 0.008856 ? Math.pow(z1, 1/3) : (7.787 * z1) + (16/116);
  
  const l = (116 * fy) - 16;
  const a = 500 * (fx - fy);
  const bValue = 200 * (fy - fz); // Renamed from 'b' to 'bValue' to avoid variable collision
  
  return { l, a, b: bValue };
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
    
    // Calculate perceptual deltaE threshold based on strictnessFactor
    // strictnessFactor ranges from 1 (least strict) to 10 (most strict)
    // For deltaE, smaller values mean colors are more similar
    // A deltaE of ~2.3 is just noticeable to the average person
    // A deltaE of ~5.0 is clearly noticeable
    const baseThreshold = 25 - (strictnessFactor * 2);
    console.log(`Base deltaE threshold from strictnessFactor (${strictnessFactor}): ${baseThreshold}`);
    
    // Get RGB and luminance of the new color
    const newRgb = hexToRgb(newHex);
    const newLuminance = calculateLuminance(newRgb[0]/255, newRgb[1]/255, newRgb[2]/255);
    console.log(`New color ${newHex} has luminance: ${newLuminance.toFixed(4)}`);
    
    // Check for very dark colors (nearly black)
    if (newLuminance < 0.05) {
      console.log(`Color ${newHex} is very dark (luminance < 0.05)`);
      
      // Find existing dark colors
      const darkColors = userColors.filter(user => {
        if (!user[1]) return false;
        
        const colorHex = user[1].trim();
        if (!colorHex) return false;
        
        try {
          const rgb = hexToRgb(colorHex);
          if (!rgb) return false;
          
          const lum = calculateLuminance(rgb[0]/255, rgb[1]/255, rgb[2]/255);
          return lum < 0.05; // Consider any color with luminance < 0.05 as "dark"
        } catch (err) {
          console.error(`Error processing color ${colorHex}:`, err);
          return false;
        }
      });
      
      if (darkColors.length > 0) {
        console.log(`Found ${darkColors.length} other dark colors already in use`);
        return {
          tooSimilar: true,
          similarTo: darkColors[0][0],
          distance: 3,
          reason: "too-dark",
          threshold: 5
        };
      }
    }
    
    // Check for very light colors (nearly white)
    if (newLuminance > 0.95) {
      console.log(`Color ${newHex} is very light (luminance > 0.95)`);
      
      // Find existing light colors
      const lightColors = userColors.filter(user => {
        if (!user[1]) return false;
        
        const colorHex = user[1].trim();
        if (!colorHex) return false;
        
        try {
          const rgb = hexToRgb(colorHex);
          if (!rgb) return false;
          
          const lum = calculateLuminance(rgb[0]/255, rgb[1]/255, rgb[2]/255);
          return lum > 0.90; // Consider any color with luminance > 0.90 as "light"
        } catch (err) {
          console.error(`Error processing color ${colorHex}:`, err);
          return false;
        }
      });
      
      if (lightColors.length > 0) {
        console.log(`Found ${lightColors.length} other light colors already in use`);
        return {
          tooSimilar: true,
          similarTo: lightColors[0][0],
          distance: 3,
          reason: "too-light",
          threshold: 5
        };
      }
    }
    
    // Adjust threshold based on luminance
    let adjustedThreshold = baseThreshold;
    
    // Make threshold stricter (smaller) for very dark or very light colors
    if (newLuminance < 0.1 || newLuminance > 0.9) {
      adjustedThreshold = baseThreshold * 0.7;
      console.log(`Adjusted threshold for dark/light color: ${adjustedThreshold}`);
    }
    
    // Compare with all existing colors
    for (const userColor of userColors) {
      if (!userColor[1]) continue;
      
      const existingColor = userColor[1].trim();
      if (!existingColor) continue;
      
      try {
        const distance = colorDistance(newHex, existingColor);
        console.log(`DeltaE between ${newHex} and ${existingColor} (${userColor[0]}): ${distance.toFixed(2)}`);
        
        if (distance < adjustedThreshold) {
          console.log(`Color ${newHex} is too similar to existing color ${existingColor} (${userColor[0]}) with deltaE ${distance.toFixed(2)}`);
          return {
            tooSimilar: true,
            similarTo: userColor[0],
            distance: distance,
            threshold: adjustedThreshold
          };
        }
      } catch (err) {
        console.error(`Error comparing colors ${newHex} and ${existingColor}:`, err);
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
      await formatAllUserCells();
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
        await formatAllUserCells()
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