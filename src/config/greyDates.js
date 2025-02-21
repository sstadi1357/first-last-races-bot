// grayDates.js
const { isWeekend, parseISO } = require('date-fns');

// List of specific dates that should be grayed out (format: YYYY-MM-DD)
const GRAY_DATES = [

    '2025-04-14', '2025-04-15', '2025-04-16', '2025-04-17', '2025-04-18', '2025-04-21', // Spring Break
    '2025-05-26', // Memorial Day
    '2025-05-30', '2025-06-02', '2025-06-03', '2025-06-04', '2025-06-05', '2025-06-06', // Teacher Work Days / No Students
    
    // Summer Break (June-July)
    '2025-06-09', '2025-06-10', '2025-06-11', '2025-06-12', '2025-06-13',
    '2025-06-16', '2025-06-17', '2025-06-18', '2025-06-19', '2025-06-20',
    '2025-06-23', '2025-06-24', '2025-06-25', '2025-06-26', '2025-06-27',
    '2025-06-30', '2025-07-01', '2025-07-02', '2025-07-03', '2025-07-04',
    '2025-07-07', '2025-07-08', '2025-07-09', '2025-07-10', '2025-07-11',
    '2025-07-14', '2025-07-15', '2025-07-16', '2025-07-17', '2025-07-18',
    '2025-07-21', '2025-07-22', '2025-07-23', '2025-07-24', '2025-07-25',
    '2025-07-28', '2025-07-29', '2025-07-30', '2025-07-31',

    // 2025-2026 School Year
    '2025-08-01', '2025-08-04', '2025-08-05', '2025-08-06', '2025-08-07', // Teacher Work Days - No Students
    '2025-09-01', // Labor Day
    '2025-10-13', // No Students
    '2025-11-11', // Veterans Day
    '2025-11-24', '2025-11-25', '2025-11-26', '2025-11-27', '2025-11-28', // Thanksgiving Break
    '2025-12-22', '2025-12-23', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-29', '2025-12-30', '2025-12-31', // Winter Break
    '2026-01-01', '2026-01-02', // Winter Break continues
    '2026-01-19', // Martin Luther King Jr. Day
    '2026-02-16', '2026-02-17', // President’s Day Break
    '2026-02-18', '2026-02-19', '2026-02-20', // February Break
    '2026-04-04', '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10', // Spring Break
    '2026-05-25', // Memorial Day
    '2026-05-29', '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05' // Teacher Work Days
];


function shouldBeGray(dateStr) {
    // Convert YYYY-MM-DD to Date object
    const date = parseISO(dateStr);
    
    // Check if it's a weekend or in our list of gray dates
    return isWeekend(date) || GRAY_DATES.includes(dateStr);
}

module.exports = {
    GRAY_DATES,
    shouldBeGray
};