// utils/userFormatting.js
const sheets = require('../sheets.js');
const { spreadsheetId, users } = require('../config/mainConfig');
const { formatAllUserCells } = require('../functions/userSheetFormatting.js');
function hexToRgb(hex) {
  console.log(`Converting hex color ${hex} to RGB`);
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  console.log(`Hex ${hex} converted to RGB: [${r}, ${g}, ${b}]`);
  return [r, g, b];
}
function calculateDistinctHexColor(existingColors) {
    const getRandomHex = () => {
        const hex = Math.floor(Math.random() * 16777215).toString(16);
        return '#' + '0'.repeat(6 - hex.length) + hex;
    };

    const colorDistance = (color1, color2) => {
        const rgb1 = hexToRgb(color1);
        const rgb2 = hexToRgb(color2);
        return Math.sqrt(
            Math.pow(rgb2[0] - rgb1[0], 2) +
            Math.pow(rgb2[1] - rgb1[1], 2) +
            Math.pow(rgb2[2] - rgb1[2], 2)
        );
    };

    let attempts = 0;
    let maxAttempts = 1000;
    let bestColor = getRandomHex();
    let maxMinDistance = 0;

    while (attempts < maxAttempts) {
        const candidateColor = getRandomHex();
        let minDistance = Number.MAX_VALUE;

        for (const existingColor of existingColors) {
            const distance = colorDistance(candidateColor, existingColor);
            minDistance = Math.min(minDistance, distance);
        }

        if (minDistance > maxMinDistance) {
            maxMinDistance = minDistance;
            bestColor = candidateColor;
        }

        attempts++;
    }

    return bestColor;
}
function shouldUseWhiteText(rgb) {
    // Calculate relative luminance
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const useWhite = luminance < 0.5;
    
    console.log(`Calculated luminance for RGB [${rgb}]: ${luminance.toFixed(2)} - Using ${useWhite ? 'white' : 'black'} text`);
    return useWhite;
}

async function fetchUsersFromSheet() {
    console.log(`Fetching users from Google Sheet (spreadsheetId: ${spreadsheetId})`);
    try {
        // Get data from the 'Users' sheet, columns A and B
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Users!A:B'
        });

        const rows = response.data.values || [];
        console.log(`Retrieved ${rows.length} rows from sheet (including headers if present)`);
        
        // Skip the header row if it exists
        const dataRows = rows.length > 0 ? rows.slice(1) : [];
        console.log(`Processing ${dataRows.length} data rows after skipping header`);
        
        if (dataRows.length === 0) {
            console.log('No data rows found in sheet, will use fallback');
            return null;
        }
        
        // Map sheet data to user objects with username and hexColor
        const users = dataRows.map(row => {
            if (!row[0] || !row[1]) {
                console.log(`Skipping row with missing data: ${JSON.stringify(row)}`);
                return null;
            }
            
            const username = row[0].trim();
            let hexColor = row[1].trim();
            
            // Add # if missing
            if (!hexColor.startsWith('#')) {
                console.log(`Adding # prefix to hex color: ${hexColor}`);
                hexColor = '#' + hexColor;
            }
            
            console.log(`Processed user from sheet: ${username} with color ${hexColor}`);
            return { username, hexColor };
        }).filter(user => user !== null);
        
        // Check if any username is missing or any color is invalid
        const isValidUserData = users.every(user => 
            user.username && user.username.trim() !== '' && 
            user.hexColor && /^#[0-9A-Fa-f]{6}$/.test(user.hexColor)
        );
        
        if (!isValidUserData) {
            console.log('Invalid user data found in sheet. Falling back to mainConfig users.');
            return null;
        }
        
        console.log(`Successfully processed ${users.length} users from sheet`);
        return users;
    } catch (error) {
        console.error('Error fetching users from sheet:', error);
        return null;
    }
}
async function addNewUserToSheet(username) {
    try {
        // Fetch existing users and their colors
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Users!A:B'
        });

        const rows = response.data.values || [];
        
        // Check if user already exists (case-insensitive, trimmed)
        const userExists = rows.some(row => row[0] && row[0].trim().toLowerCase() === username.trim().toLowerCase());
        if (userExists) {
            console.log(`User ${username} already exists in sheet, skipping addition`);
            return { username, exists: true };
        }
        
        const existingColors = rows.slice(1).map(row => row[1].startsWith('#') ? row[1] : `#${row[1]}`);
        
        // Calculate a new distinct hex color
        const newHexColor = calculateDistinctHexColor(existingColors);
        
        // Append the new user to the sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Users!A:B',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[username, newHexColor]]
            }
        });
        
        console.log(`Added new user ${username} with color ${newHexColor}`);
        await formatAllUserCells();
        return { username, hexColor: newHexColor, exists: false };
    } catch (error) {
        console.error('Error adding new user to sheet:', error);
        return false;
    }
}
async function generateUserFormatRules(sheetId) {
    console.log(`Generating user format rules for sheet ID: ${sheetId}`);
    try {
        // Try to get users from Google Sheet
        let usersData = await fetchUsersFromSheet();
        
        // If no users from sheet, fall back to mainConfig
        if (!usersData || usersData.length === 0) {
            console.log('No users found in Google Sheet, using mainConfig users instead');
            
            // Make sure users exists and is an array
            if (!users || !Array.isArray(users)) {
                console.log('No users array found in mainConfig');
                usersData = [];
            } else {
                console.log(`Using ${users.length} users from mainConfig`);
                usersData = users;
            }
        }
        
        // Add 'NONE' user
        usersData.push({ username: 'NONE', hexColor: '#999999' });
        console.log(`Added 'NONE' user with gray color. Total users: ${usersData.length}`);

        // Prepare addition requests for new rules
        const addRequests = [];
        
        // Add new rules for each user
        usersData.forEach((user, index) => {
            if (!user.hexColor) {
                console.log(`Skipping user ${user.username} - missing hex color`);
                return;
            }
            
            // Convert hex to RGB for Google Sheets API
            console.log(`Creating format rule for user: ${user.username} with color ${user.hexColor}`);
            const rgb = hexToRgb(user.hexColor);
            
            addRequests.push({
                addConditionalFormatRule: {
                    rule: {
                        ranges: [{
                            sheetId: sheetId,
                            startRowIndex: 1  // Skip header row
                        }],
                        booleanRule: {
                            condition: {
                                type: "TEXT_CONTAINS",
                                values: [{
                                    userEnteredValue: user.username
                                }]
                            },
                            format: {
                                backgroundColor: {
                                    red: rgb[0] / 255,
                                    green: rgb[1] / 255,
                                    blue: rgb[2] / 255
                                },
                                // Add text color based on background brightness
                                textFormat: {
                                    foregroundColor: shouldUseWhiteText(rgb) ? 
                                        { red: 1, green: 1, blue: 1 } : 
                                        { red: 0, green: 0, blue: 0 }
                                }
                            }
                        }
                    },
                    index: index + 2  // Start after the time-based formatting rules
                }
            });
            console.log(`Added format rule for user ${user.username}`);
        });
        
        console.log(`Generated ${addRequests.length} formatting requests in total`);
        return addRequests;
    } catch (error) {
        console.error('Error generating user format rules:', error);
        return [];
    }
}

module.exports = {
    generateUserFormatRules,
    fetchUsersFromSheet,
    hexToRgb,
    shouldUseWhiteText,
    addNewUserToSheet
};