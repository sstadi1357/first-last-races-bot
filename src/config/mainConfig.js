//You need to change the first 6 variables to your own links and server settings and users and colors. 

const { hex } = require("color-convert");

const serverId = ('1300198974988357732')

const firebaseId = ("https://first-last-races-default-rtdb.firebaseio.com")
//Delete the line below if you're not using a sheet or the implementation might break. 
// Change the spreadsheetId to your own if you do want to use a google sheet.
const spreadsheetId = ('1CH85wIWmj0H6zgnjkNtHm_rYIlW_8AFM4z16G44W8ow')

const mainChannelId = ('1300198975437275147')

const flairAnnouncementChannelId = '1336557845558333470'; 
/* The hexChannelId is the channel where people can post a hex color for the sheet. 
You don't need it if you're not using a google sheet. But you do need a sheet that's called "Users". 
This won't change the users array below. If people post a hex code in the hex channel, it will go on the "Users" sheet
and update their color for the entire sheet.*/
const hexChannelId = '1345867387575996436'
// the users is for conditional formatting for the sheet, you don't need it if you're not using a google sheet
/* The values below are just in case you do not want to create a "Users" sheet in the google sheet.
You can always change these HEX codes and users if you want. However, if a new user comes, it will only log and create a color for it if it as a sheet.*/
const users = [
  { username: "sstadi1357", hexColor: "#980000" },
  { username: "mathdude_314", hexColor: "#FFFF00" },
  { username: "iamgod289", hexColor: "#00FF00" },
  { username: "monkeyfury13", hexColor: "#FF9900" },
  { username: "_g.l.i.t.c.h_", hexColor: "#000000" },
  { username: "greekdrakon783", hexColor: "#F9CB9C" },
  { username: "simbapuffleikfood", hexColor: "#4A86E8" },
  { username: "dafish0838", hexColor: "#B6D7A8" },
  { username: "echow916", hexColor: "#783F04" },
  { username: "winterscroll908_31230", hexColor: "#9900FF" },
  { username: "bob05956", hexColor: "#274E13" },
  { username: "lr_better", hexColor: "#00FFFF" },
  { username: "the_amazing_lizard", hexColor: "#EA9999" },
  { username: "kb1234567890", hexColor: "#0C343D" },
  { username: "prec1sebee", hexColor: "#FF00FF" },
  { username: "lightningkrish1217", hexColor: "#76A5AF" }
];


//You can keep the rest of these as is, or you can change them to customize it.

//Announcement to send when someone gets a flair use <member> for the member's name, <roleName> for the role name, and <date> for the date
const flairAnnouncement = '<member> got the "<roleName>" flair in the First/Last Races server! Congratulations! [achieved <date>]';

// Role (flair) tiers and their corresponding points
const ROLES = {
    PINK: { points: 5000, id: '1336556598998601760', name: '5000 Point God', color: 'pink'},
    PURPLE: { points: 2000, id: '1336556534217441370', name: '2000 Points', color: 'purple' },
    BLUE: { points: 1000, id: '1336556482220785737', name: '1000 Points', color: 'blue' },
    DARK_GREEN: { points: 500, id: '1336556444954132480', name: '500 Points', color: 'dark green' },
    GREEN: { points: 250, id: '1336556322165882893', name: '250 Points', color: 'green' },
    YELLOW: { points: 100, id: '1336556271075332128', name: '100 Points', color: 'yellow' },
    ORANGE: { points: 50, id: '1336555846888325130', name: '50 Points', color: 'orange' },
    FIRST_LAST: { points: 0, id: '1336556008125763714', name: 'Got a First/Last', color: 'red' },
    RACER: { points: 0, id: "1335822775901749299", name: "Racer", color: 'gray' }
};
// points
const scoring = {
    lastMessage: 20,
    secondLastMessage: 10,
    positions: {
      1: 20,  // First message
      2: 12,  // Second message
      3: 10,  // Third message
      4: 7,   // Fourth message
      5: 5,   // Fifth message
      6: 4,   // 6th-8th messages
      7: 4,
      8: 4,
      9: 3,   // 9th-15th messages
      10: 3,
      11: 3,
      12: 3,
      13: 3,
      14: 3,
      15: 3,
      default: 2  // 16th and beyond
    } 
  }
  //Time to schedule the points scheduler.
const cronSchedule = {
        time: '21 10 * * *',
        timezone: 'America/Los_Angeles'
}

module.exports = {
    serverId,
    firebaseId,
    spreadsheetId,
    mainChannelId,
    flairAnnouncement,
    flairAnnouncementChannelId,
    ROLES,
    scoring,
    cronSchedule,
    users,
    hexChannelId
}