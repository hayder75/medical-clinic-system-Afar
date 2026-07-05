/**
 * Ethiopian Timezone (EAT / UTC+3 / Africa/Addis_Ababa) Date Utilities
 * 
 * Ethiopian Local Time is UTC+3.
 * For any given Ethiopian date string "YYYY-MM-DD":
 * - Start of Ethiopian Day (00:00:00.000 EAT) = (previous day 21:00:00.000Z in UTC)
 * - End of Ethiopian Day (23:59:59.999 EAT) = (current day 20:59:59.999Z in UTC)
 */

function getEthiopianDateRange(dateInput) {
  let dateStr;
  if (dateInput instanceof Date) {
    // Offset by +3 hours to get Ethiopian date string
    const eatDate = new Date(dateInput.getTime() + (3 * 60 * 60 * 1000));
    dateStr = eatDate.toISOString().split('T')[0];
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.split('T')[0];
  } else {
    const eatDate = new Date(Date.now() + (3 * 60 * 60 * 1000));
    dateStr = eatDate.toISOString().split('T')[0];
  }

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10) - 1;
  const d = parseInt(dayStr, 10);

  const startOfDayUTC = new Date(Date.UTC(y, m, d - 1, 21, 0, 0, 0));
  const endOfDayUTC = new Date(Date.UTC(y, m, d, 20, 59, 59, 999));

  return {
    dateStr,
    startOfDayUTC,
    endOfDayUTC
  };
}

function getEthiopianMonthRange(year, monthIndex) {
  const y = parseInt(year, 10);
  const m = parseInt(monthIndex, 10); // 0-indexed month
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  const startOfMonthEAT = getEthiopianDateRange(`${y}-${String(m + 1).padStart(2, '0')}-01`).startOfDayUTC;
  const endOfMonthEAT = getEthiopianDateRange(`${y}-${String(m + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`).endOfDayUTC;

  return {
    year: y,
    month: m,
    daysInMonth,
    startOfMonthUTC: startOfMonthEAT,
    endOfMonthUTC: endOfMonthEAT
  };
}


function format12HourEAT(dateInput) {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const eatTime = new Date(d.getTime() + (3 * 60 * 60 * 1000));
  let hours = eatTime.getUTCHours();
  const minutes = String(eatTime.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[eatTime.getUTCMonth()];
  const day = eatTime.getUTCDate();
  return `${month} ${day}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm} EAT`;
}

module.exports = {
  getEthiopianDateRange,
  getEthiopianMonthRange,
  format12HourEAT
};

