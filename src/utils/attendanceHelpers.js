/**
 * Shared attendance helper functions
 * SINGLE SOURCE OF TRUTH for attendance logic
 */

/**
 * Determines attendance status based on check-in time
 * @param {string} timeString - ISO timestamp of check-in
 * @returns {Object} { status: 'present' | 'late' | 'absent', text: string }
 */
export const getAttendanceStatus = (timeString) => {
  const time = new Date(timeString);
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const totalMinutes = (hours * 60) + minutes;
  
  // Absent threshold: 12:00 PM (noon)
  const absentThreshold = 12 * 60;
  
  // Late threshold: 9:30 AM
  const lateThreshold = (9 * 60) + 30;
  
  // After noon = Absent
  if (totalMinutes >= absentThreshold) {
    return { status: 'absent', text: 'Absent' };
  }
  
  // 9:30 AM to 11:59 AM = Late
  if (totalMinutes >= lateThreshold) {
    return { status: 'late', text: 'Late' };
  }
  
  // Before 9:30 AM = Present
  return { status: 'present', text: 'Present' };
};

/**
 * Determines if a date is in the past (before today)
 * Uses local date to avoid timezone issues
 * @param {Date|string} date - Date to check
 * @returns {boolean}
 */
export const isPastDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let checkDate;
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    checkDate = new Date(year, month - 1, day);
  } else {
    checkDate = new Date(date);
  }
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate < today;
};

/**
 * Determines if a date is today
 * Uses local date to avoid timezone issues
 * @param {Date|string} date - Date to check
 * @returns {boolean}
 */
export const isToday = (date) => {
  const today = new Date();
  
  let checkDate;
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    checkDate = new Date(year, month - 1, day);
  } else {
    checkDate = new Date(date);
  }
  
  return today.getFullYear() === checkDate.getFullYear() &&
         today.getMonth() === checkDate.getMonth() &&
         today.getDate() === checkDate.getDate();
};

/**
 * Determines if a date is in the future (after today)
 * Uses local date to avoid timezone issues
 * @param {Date|string} date - Date to check
 * @returns {boolean}
 */
export const isFutureDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let checkDate;
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    checkDate = new Date(year, month - 1, day);
  } else {
    checkDate = new Date(date);
  }
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate > today;
};

/**
 * Determines attendance status for a specific date
 * CRITICAL: This is the authoritative logic for all attendance displays
 * 
 * @param {Date|string} date - The date to check
 * @param {Object} attendanceData - Map of date strings to attendance records
 * @returns {string} 'present' | 'late' | 'absent' | 'pending' | 'future' | null
 */
export const determineAttendanceStatus = (date, attendanceData) => {
  // Convert to local date string to avoid timezone issues
  let dateStr;
  if (typeof date === 'string') {
    dateStr = date;
  } else {
    // Use local date components to avoid timezone offset issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }
  
  const record = attendanceData[dateStr];
  
  // Future dates have no status
  if (isFutureDate(dateStr)) {
    return null;
  }
  
  // If there's a record, use the status from the check-in time
  if (record) {
    return record.status;
  }
  
  // Today with no record = pending (service may not be over yet)
  if (isToday(dateStr)) {
    return 'pending';
  }
  
  // Past date with no record = absent
  if (isPastDate(dateStr)) {
    return 'absent';
  }
  
  return null;
};

/**
 * Get all Sundays in a given month
 * @param {Date} month - The month to get Sundays from
 * @returns {Date[]} Array of Sunday dates
 */
export const getSundaysInMonth = (month) => {
  const sundays = [];
  const year = month.getFullYear();
  const monthNum = month.getMonth();
  const firstDay = new Date(year, monthNum, 1);
  const lastDay = new Date(year, monthNum + 1, 0);
  
  for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
    if (day.getDay() === 0) {
      sundays.push(new Date(day));
    }
  }
  
  return sundays;
};

/**
 * Get status badge classes for UI rendering
 * @param {string} status - The attendance status
 * @returns {string} Tailwind CSS classes
 */
export const getStatusBadgeClasses = (status) => {
  switch (status) {
    case 'present':
      return 'bg-green-100 text-green-800';
    case 'late':
      return 'bg-yellow-100 text-yellow-800';
    case 'absent':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-50 text-gray-500';
  }
};

/**
 * Get status display text
 * @param {string} status - The attendance status
 * @returns {string} Display text
 */
export const getStatusText = (status) => {
  switch (status) {
    case 'present':
      return 'Present';
    case 'late':
      return 'Late';
    case 'absent':
      return 'Absent';
    case 'pending':
      return 'Pending';
    case 'future':
      return 'Upcoming';
    default:
      return 'N/A';
  }
};