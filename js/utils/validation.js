/**
 * Formats a Date object into the local YYYY-MM-DDTHH:mm string format required by datetime-local inputs.
 * Uses local timezone values to ensure alignment with the user's environment.
 * @param {Date} [date] - The Date object to format. Defaults to current time.
 * @returns {string} The formatted local datetime string.
 */
export function formatDateTimeLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Validates if the selected datetime string is in the present or future.
 * Zeroes out seconds and milliseconds for comparison.
 * @param {string} selectedDateTimeStr - The datetime string from input (YYYY-MM-DDTHH:mm).
 * @returns {{isValid: boolean, error: string}} Validation result.
 */
export function validateDateTime(selectedDateTimeStr) {
  if (!selectedDateTimeStr) {
    return { isValid: false, error: 'Please select a date and time.' };
  }

  let selectedDate;
  if (selectedDateTimeStr.includes('T')) {
    const [datePart, timePart] = selectedDateTimeStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    selectedDate = new Date(year, month - 1, day, hours, minutes);
  } else {
    selectedDate = new Date(selectedDateTimeStr);
  }

  if (isNaN(selectedDate.getTime())) {
    return { isValid: false, error: 'Invalid date or time.' };
  }

  const now = new Date();
  // Round now down to the beginning of the minute to prevent validation failure
  // due to the seconds/milliseconds elapsed during user interaction.
  now.setSeconds(0, 0);

  console.log('validateDateTime comparison:', {
    input: selectedDateTimeStr,
    parsedSelectedDate: selectedDate.toString(),
    currentRoundedNow: now.toString(),
    isPast: selectedDate < now
  });

  if (selectedDate < now) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDateOnly = new Date(selectedDate);
    selectedDateOnly.setHours(0, 0, 0, 0);

    if (selectedDateOnly < today) {
      return { isValid: false, error: 'Cannot select a date in the past.' };
    } else {
      return { isValid: false, error: 'Invalid time' };
    }
  }

  return { isValid: true, error: '' };
}
