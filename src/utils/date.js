/**
 * Centralized Date utility for Turkey Time (UTC+3)
 */

/**
 * Returns current date/time in Turkey as a Date object
 */
const getTurkeyNow = () => {
    // Turkey is always UTC+3 (no DST change since 2016)
    const now = new Date();
    // Offset in minutes for UTC+3 is -180, but getTimezoneOffset returns positive for west of UTC.
    // So for UTC+3, it would return -180. 
    // However, to force a specific timezone regardless of server location:
    const turkeyOffset = 3 * 60; // 3 hours in minutes
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (turkeyOffset * 60000));
};

/**
 * Returns YYYY-MM-DD string for today in Turkey
 */
const getTurkeyTodayString = () => {
    const now = getTurkeyNow();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Returns current hour in Turkey (0-23)
 */
const getTurkeyHour = () => {
    return getTurkeyNow().getHours();
};

/**
 * Returns current minute in Turkey (0-59)
 */
const getTurkeyMinute = () => {
    return getTurkeyNow().getMinutes();
};

module.exports = {
    getTurkeyNow,
    getTurkeyTodayString,
    getTurkeyHour,
    getTurkeyMinute
};
