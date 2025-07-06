/**
 * Date parsing utility for converting various date formats to MM-DD-YYYY
 * Handles formats like:
 * - "June 1st", "June 1", "6/1", "6-1" (current year)
 * - "June 1st 2024", "June 1 2024", "6/1/2024", "6-1-2024" (specific year)
 * - "yesterday", "today", "tomorrow"
 * - "3 days ago", "2 weeks ago"
 */

function parseDate(dateInput) {
    if (!dateInput || typeof dateInput !== 'string') {
        return { success: false, error: 'Invalid date input' };
    }

    const input = dateInput.trim().toLowerCase();
    const today = new Date();
    const currentYear = today.getFullYear();

    // Handle relative dates
    if (input === 'today') {
        return formatDate(today);
    }
    
    if (input === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return formatDate(yesterday);
    }
    
    if (input === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return formatDate(tomorrow);
    }

    // Handle "X days ago" format
    const daysAgoMatch = input.match(/^(\d+)\s*days?\s*ago$/);
    if (daysAgoMatch) {
        const days = parseInt(daysAgoMatch[1]);
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - days);
        return formatDate(targetDate);
    }

    // Handle "X weeks ago" format
    const weeksAgoMatch = input.match(/^(\d+)\s*weeks?\s*ago$/);
    if (weeksAgoMatch) {
        const weeks = parseInt(weeksAgoMatch[1]);
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - (weeks * 7));
        return formatDate(targetDate);
    }

    // Handle month names with day
    const monthNames = {
        'january': 1, 'jan': 1,
        'february': 2, 'feb': 2,
        'march': 3, 'mar': 3,
        'april': 4, 'apr': 4,
        'may': 5,
        'june': 6, 'jun': 6,
        'july': 7, 'jul': 7,
        'august': 8, 'aug': 8,
        'september': 9, 'sep': 9, 'sept': 9,
        'october': 10, 'oct': 10,
        'november': 11, 'nov': 11,
        'december': 12, 'dec': 12
    };

    // Pattern: "Month Day" or "Month Day Year"
    const monthDayPattern = new RegExp(
        `^(${Object.keys(monthNames).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(\\d{4})?$`
    );
    
    const monthDayMatch = input.match(monthDayPattern);
    if (monthDayMatch) {
        const monthName = monthDayMatch[1];
        const day = parseInt(monthDayMatch[2]);
        const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : currentYear;
        const month = monthNames[monthName];
        
        if (month && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            return formatDate(date);
        }
    }

    // Handle MM/DD or MM/DD/YYYY format
    const slashPattern = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;
    const slashMatch = input.match(slashPattern);
    if (slashMatch) {
        const month = parseInt(slashMatch[1]);
        const day = parseInt(slashMatch[2]);
        const year = slashMatch[3] ? parseInt(slashMatch[3]) : currentYear;
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            return formatDate(date);
        }
    }

    // Handle MM-DD or MM-DD-YYYY format
    const dashPattern = /^(\d{1,2})-(\d{1,2})(?:-(\d{4}))?$/;
    const dashMatch = input.match(dashPattern);
    if (dashMatch) {
        const month = parseInt(dashMatch[1]);
        const day = parseInt(dashMatch[2]);
        const year = dashMatch[3] ? parseInt(dashMatch[3]) : currentYear;
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            return formatDate(date);
        }
    }

    // Handle MM-DD-YYYY format (already in correct format)
    const exactPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const exactMatch = input.match(exactPattern);
    if (exactMatch) {
        const month = parseInt(exactMatch[1]);
        const day = parseInt(exactMatch[2]);
        const year = parseInt(exactMatch[3]);
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return { success: true, date: input, formatted: input };
        }
    }

    return { success: false, error: 'Unable to parse date format' };
}

function formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const formatted = `${month}-${day}-${year}`;
    
    return {
        success: true,
        date: date,
        formatted: formatted
    };
}

function formatDateForDisplay(dateStr) {
    const [month, day, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[month - 1];
    const daySuffix = getDaySuffix(day);
    
    return `${monthName} ${day}${daySuffix}`;
}

function getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

module.exports = {
    parseDate,
    formatDateForDisplay
}; 