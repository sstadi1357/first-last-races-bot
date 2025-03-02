const { FieldValue } = require('firebase-admin/firestore');
const db = require('../firebase'); // Import Firestore instance
const { hexChannelId} = require('../config/mainConfig.js');
const { serverId, spreadsheetId } = require('../config/mainConfig');
const { Events } = require('discord.js');
const { google } = require("googleapis");
const sheets = require('../sheets');
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
    if (message.author.bot || !message.guild || message.channel.id !== hexChannelId) return;
    //Check if message is a valid hex code 
    let hex = message.content;
    if (hex.startsWith('#') && hex.length === 7) {
      hex = hex.substring(1);
    } else {
        message.delete();
        message.author.send('Please enter a valid 6 digit hex code starting with #');
        return null
    }
    return true
  }
};