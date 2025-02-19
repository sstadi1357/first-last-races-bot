// config/flairs.js

const ROLES = {
    PINK: { points: 5000, id: '1336556598998601760', name: '5000 Point God', color: 'pink'},
    PURPLE: { points: 2000, id: '1336556534217441370', name: '2000 Points', color: 'purple' },
    BLUE: { points: 1000, id: '1336556482220785737', name: '1000 Points', color: 'blue' },
    DARK_GREEN: { points: 500, id: '1336556444954132480', name: '500 Points', color: 'dark green' },
    GREEN: { points: 250, id: '1336556322165882893', name: '250 Points', color: 'green' },
    YELLOW: { points: 100, id: '1336556271075332128', name: '100 Points', color: 'yellow' },
    ORANGE: { points: 50, id: '1336555846888325130', name: '50 Points', color: 'orange' },
    FIRST_LAST: { id: '1336556008125763714', name: 'Got a First/Last', color: 'red' }
};

// Hierarchy from lowest to highest
const HIERARCHY = [
    'red',        // First/Last
    'orange',     // 50 Points
    'yellow',     // 100 Points
    'green',      // 250 Points
    'dark green', // 500 Points
    'blue',       // 1000 Points
    'purple',     // 2000 Points
    'pink'        // 5000 Points
];

// We don't actually need ROLE_IDS since we can look up the id from ROLES
// But if you're using it elsewhere, here it is:
const ROLE_IDS = {
    'pink': ROLES.PINK.id,
    'purple': ROLES.PURPLE.id,
    'blue': ROLES.BLUE.id,
    'dark green': ROLES.DARK_GREEN.id,
    'green': ROLES.GREEN.id,
    'yellow': ROLES.YELLOW.id,
    'orange': ROLES.ORANGE.id,
    'red': ROLES.FIRST_LAST.id
};

module.exports = {
    ROLES,
    HIERARCHY,
    ROLE_IDS
};