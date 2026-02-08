// utils/eventConstants.js
export const EVENT_TYPES = {
  SUNDAY_SERVICE: 'sunday_service',
  EVENT: 'event',
  TRAINING: 'training',
  MEETING: 'meeting',
  SPECIAL: 'special'
};

export const EVENT_STATUSES = {
  DRAFT: 'draft',
  PROPOSED: 'proposed',
  APPROVED: 'approved',
  DECLINED: 'declined',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

export const ATTENDANCE_STATUSES = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent'
};

export const getStatusColor = (status) => {
  const colors = {
    [EVENT_STATUSES.DRAFT]: 'bg-gray-100 text-gray-800',
    [EVENT_STATUSES.PROPOSED]: 'bg-yellow-100 text-yellow-800',
    [EVENT_STATUSES.APPROVED]: 'bg-green-100 text-green-800',
    [EVENT_STATUSES.DECLINED]: 'bg-red-100 text-red-800',
    [EVENT_STATUSES.POSTPONED]: 'bg-orange-100 text-orange-800',
    [EVENT_STATUSES.CANCELLED]: 'bg-red-100 text-red-800',
    [EVENT_STATUSES.COMPLETED]: 'bg-blue-100 text-blue-800'
  };
  return colors[status] || colors[EVENT_STATUSES.PROPOSED];
};

export const getTypeColor = (type) => {
  const colors = {
    [EVENT_TYPES.SUNDAY_SERVICE]: 'bg-indigo-100 text-indigo-800',
    [EVENT_TYPES.EVENT]: 'bg-purple-100 text-purple-800',
    [EVENT_TYPES.TRAINING]: 'bg-blue-100 text-blue-800',
    [EVENT_TYPES.MEETING]: 'bg-orange-100 text-orange-800',
    [EVENT_TYPES.SPECIAL]: 'bg-pink-100 text-pink-800'
  };
  return colors[type] || colors[EVENT_TYPES.EVENT];
};

export const getAttendanceStatusColor = (status) => {
  const colors = {
    [ATTENDANCE_STATUSES.PRESENT]: 'bg-green-100 text-green-800',
    [ATTENDANCE_STATUSES.LATE]: 'bg-yellow-100 text-yellow-800',
    [ATTENDANCE_STATUSES.ABSENT]: 'bg-red-100 text-red-800'
  };
  return colors[status] || colors[ATTENDANCE_STATUSES.PRESENT];
};

export const formatEventDate = (dateStr) => {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatTime = (timeStr) => {
  if (!timeStr) return '—';
  const candidate = new Date(`2000-01-01T${timeStr}`);
  if (isNaN(candidate.getTime())) return '—';
  return candidate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};