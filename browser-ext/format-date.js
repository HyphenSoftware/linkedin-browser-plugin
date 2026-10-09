const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a date from the API like "12 Mar 2026"
 * @param {string} value
 * @returns {string} the formatted date, or the value unchanged when it isn't a date
 */
export const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        // A date without a time parses as midnight UTC, which is still the day before west of UTC
        timeZone: DATE_ONLY.test(value) ? 'UTC' : undefined
    });
};
