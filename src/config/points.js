// config/points.js
module.exports = {
    scoring: {
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
    },
    cronSchedule: {
      time: '5 0 * * *',
      timezone: 'America/Los_Angeles'
    }
  };