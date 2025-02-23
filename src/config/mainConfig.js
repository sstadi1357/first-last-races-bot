//You need to change the first 5 variables to your own links and server settings

const serverId = ('1300198974988357732')

const firebaseId = ("https://first-last-races-default-rtdb.firebaseio.com")

const spreadsheetId = ('1CH85wIWmj0H6zgnjkNtHm_rYIlW_8AFM4z16G44W8ow')

const mainChannelId = ('1300198975437275147')

const flairAnnouncementChannelId = '1336557845558333470'; 

//You can keep the rest of these as is, or you can change them to customize it.

//Announcement to send when someone gets a flair
const flairAnnouncement = `<@${member.id}> got the "${roleName}" flair in the First/Last Races server! Congratulations! [achieved ${yesterdayDateStr}]`

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
        time: '5 0 * * *',
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
    cronSchedule
}