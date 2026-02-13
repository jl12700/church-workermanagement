import { useState, useEffect } from 'react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function WorkersAttendance() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('all');
  const [ministries, setMinistries] = useState([]);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyAttendance, setMonthlyAttendance] = useState({});
  const [showCalendarView, setShowCalendarView] = useState(false);
  
  // State for calendar day modal
  const [selectedDateEvents, setSelectedDateEvents] = useState(null);
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  
  // State for CSV export
  const [exportLoading, setExportLoading] = useState(false);
  
  // State for all events this month
  const [allMonthEvents, setAllMonthEvents] = useState([]);
  
  // State for hover effects
  const [hoveredDate, setHoveredDate] = useState(null);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setWorkers(data || []);
      
      const uniqueMinistries = [...new Set(data?.map(worker => worker.ministry).filter(Boolean))];
      setMinistries(uniqueMinistries);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Export Worker Complete Attendance History to CSV
  const exportWorkerAttendanceCSV = async (worker) => {
    setExportLoading(true);
    try {
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .order('event_date', { ascending: true });
      
      if (eventsError) throw eventsError;
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('worker_id', worker.id);
      
      if (attendanceError) throw attendanceError;
      
      const attendanceMap = {};
      attendance?.forEach(record => {
        attendanceMap[record.event_id] = record;
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let csvContent = [];
      
      csvContent.push([
        'Worker Name',
        'Worker ID',
        'Event Name',
        'Event Date',
        'Event Type',
        'Attendance Status',
        'Scan Time',
        'Check-in Time',
        'Event Start Time',
        'Event End Time',
        'Event Location',
        'Is Event Ended'
      ].join(','));
      
      allEvents?.forEach(event => {
        const eventDate = new Date(event.event_date);
        eventDate.setHours(0, 0, 0, 0);
        
        const attendanceRecord = attendanceMap[event.id];
        let status = 'Upcoming';
        let scanTime = '';
        let checkInTime = '';
        
        if (attendanceRecord) {
          status = attendanceRecord.status || 'Present';
          scanTime = attendanceRecord.check_in_time || '';
          if (attendanceRecord.check_in_time) {
            checkInTime = new Date(attendanceRecord.check_in_time).toLocaleString();
          }
        } else if (eventDate < today) {
          status = 'Absent';
        } else if (eventDate > today) {
          status = 'Upcoming';
        } else if (eventDate.getTime() === today.getTime()) {
          if (event.is_ended) {
            status = 'Absent';
          } else {
            status = 'Upcoming';
          }
        }
        
        const formattedEventDate = new Date(event.event_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        const escapeCSV = (field) => {
          if (field === null || field === undefined) return '';
          const stringField = String(field);
          if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
          }
          return stringField;
        };
        
        csvContent.push([
          escapeCSV(worker.name),
          escapeCSV(worker.id),
          escapeCSV(event.title),
          escapeCSV(formattedEventDate),
          escapeCSV(event.type?.replace('_', ' ') || 'Event'),
          escapeCSV(status),
          escapeCSV(scanTime),
          escapeCSV(checkInTime),
          escapeCSV(event.start_time || ''),
          escapeCSV(event.end_time || ''),
          escapeCSV(event.place || ''),
          escapeCSV(event.is_ended ? 'Yes' : 'No')
        ].join(','));
      });
      
      const csvString = csvContent.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${worker.name.replace(/\s+/g, '_')}_attendance_history.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert('Failed to export attendance history');
    } finally {
      setExportLoading(false);
    }
  };

  // Export Worker Attendance for Specific Month to CSV
  const exportWorkerMonthAttendanceCSV = async (worker, month) => {
    setExportLoading(true);
    try {
      const year = month.getFullYear();
      const monthNum = month.getMonth() + 1;
      
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .gte('event_date', startDateStr)
        .lte('event_date', endDateStr)
        .order('event_date', { ascending: true });
      
      if (eventsError) throw eventsError;
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('worker_id', worker.id)
        .gte('event_date', startDateStr)
        .lte('event_date', endDateStr);
      
      if (attendanceError) throw attendanceError;
      
      const attendanceMap = {};
      attendance?.forEach(record => {
        attendanceMap[record.event_id] = record;
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let csvContent = [];
      
      csvContent.push(`Worker Attendance Report - ${worker.name}`);
      csvContent.push(`Month: ${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
      csvContent.push(`Generated: ${new Date().toLocaleString()}`);
      csvContent.push('');
      
      csvContent.push([
        'Worker Name',
        'Worker ID',
        'Ministry',
        'Event Name',
        'Event Date',
        'Event Type',
        'Attendance Status',
        'Scan Time',
        'Check-in Time',
        'Event Start Time',
        'Event End Time',
        'Event Location',
        'Is Event Ended'
      ].join(','));
      
      events?.forEach(event => {
        const eventDate = new Date(event.event_date);
        eventDate.setHours(0, 0, 0, 0);
        
        const attendanceRecord = attendanceMap[event.id];
        let status = 'Upcoming';
        let scanTime = '';
        let checkInTime = '';
        
        if (attendanceRecord) {
          status = attendanceRecord.status || 'Present';
          scanTime = attendanceRecord.check_in_time || '';
          if (attendanceRecord.check_in_time) {
            checkInTime = new Date(attendanceRecord.check_in_time).toLocaleString();
          }
        } else if (eventDate < today || event.is_ended) {
          status = 'Absent';
        }
        
        const formattedEventDate = new Date(event.event_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        const escapeCSV = (field) => {
          if (field === null || field === undefined) return '';
          const stringField = String(field);
          if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
          }
          return stringField;
        };
        
        csvContent.push([
          escapeCSV(worker.name),
          escapeCSV(worker.id),
          escapeCSV(worker.ministry || ''),
          escapeCSV(event.title),
          escapeCSV(formattedEventDate),
          escapeCSV(event.type?.replace('_', ' ') || 'Event'),
          escapeCSV(status),
          escapeCSV(scanTime),
          escapeCSV(checkInTime),
          escapeCSV(event.start_time || ''),
          escapeCSV(event.end_time || ''),
          escapeCSV(event.place || ''),
          escapeCSV(event.is_ended ? 'Yes' : 'No')
        ].join(','));
      });
      
      csvContent.push('');
      csvContent.push('SUMMARY');
      csvContent.push(`Total Events,${events?.length || 0}`);
      
      const presentCount = events?.filter(e => {
        const record = attendanceMap[e.id];
        return record && (record.status === 'present' || record.status === 'Present');
      }).length || 0;
      
      const lateCount = events?.filter(e => {
        const record = attendanceMap[e.id];
        return record && (record.status === 'late' || record.status === 'Late');
      }).length || 0;
      
      const absentCount = events?.filter(e => {
        if (attendanceMap[e.id]) return false;
        const eventDate = new Date(e.event_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate < today || e.is_ended;
      }).length || 0;
      
      const upcomingCount = events?.filter(e => {
        if (attendanceMap[e.id]) return false;
        const eventDate = new Date(e.event_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate > today && !e.is_ended;
      }).length || 0;
      
      csvContent.push(`Present,${presentCount}`);
      csvContent.push(`Late,${lateCount}`);
      csvContent.push(`Absent,${absentCount}`);
      csvContent.push(`Upcoming,${upcomingCount}`);
      
      const csvString = csvContent.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const monthStr = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '_');
      link.setAttribute('href', url);
      link.setAttribute('download', `${worker.name.replace(/\s+/g, '_')}_${monthStr}_attendance.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting monthly attendance:', error);
      alert('Failed to export monthly attendance');
    } finally {
      setExportLoading(false);
    }
  };

  // Enhanced attendance fetching with all event types
  const fetchWorkerMonthlyAttendance = async (workerId, month) => {
    try {
      const year = month.getFullYear();
      const monthNum = month.getMonth() + 1;
      
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .gte('event_date', startDateStr)
        .lte('event_date', endDateStr)
        .order('event_date', { ascending: false });
      
      if (eventsError) throw eventsError;
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('worker_id', workerId)
        .gte('event_date', startDateStr)
        .lte('event_date', endDateStr);
      
      if (attendanceError) throw attendanceError;
      
      setAllMonthEvents(events || []);
      
      const attendanceMap = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      events?.forEach(event => {
        const eventDate = new Date(event.event_date);
        eventDate.setHours(0, 0, 0, 0);
        
        if (!attendanceMap[event.event_date]) {
          attendanceMap[event.event_date] = [];
        }
        
        const workerAttendance = attendance?.find(
          att => att.event_id === event.id
        );
        
        if (workerAttendance) {
          attendanceMap[event.event_date].push({
            eventId: event.id,
            eventTitle: event.title,
            eventType: event.type,
            checkInTime: workerAttendance.check_in_time,
            startTime: event.start_time,
            endTime: event.end_time,
            status: workerAttendance.status,
            isEnded: event.is_ended,
            hasRecord: true,
            eventDate: event.event_date,
            place: event.place
          });
        } else if (eventDate < today || event.is_ended) {
          attendanceMap[event.event_date].push({
            eventId: event.id,
            eventTitle: event.title,
            eventType: event.type,
            checkInTime: null,
            startTime: event.start_time,
            endTime: event.end_time,
            status: 'absent',
            isEnded: true,
            hasRecord: false,
            eventDate: event.event_date,
            place: event.place
          });
        } else if (eventDate > today) {
          attendanceMap[event.event_date].push({
            eventId: event.id,
            eventTitle: event.title,
            eventType: event.type,
            checkInTime: null,
            startTime: event.start_time,
            endTime: event.end_time,
            status: 'upcoming',
            isEnded: false,
            hasRecord: false,
            eventDate: event.event_date,
            place: event.place
          });
        }
      });
      
      setMonthlyAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
      setMonthlyAttendance({});
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorker && showRecordsModal) {
      fetchWorkerMonthlyAttendance(selectedWorker.id, selectedMonth);
    }
  }, [selectedWorker, selectedMonth, showRecordsModal]);

  const openRecordsModal = (worker) => {
    setSelectedWorker(worker);
    setSelectedMonth(new Date());
    setShowRecordsModal(true);
    setShowCalendarView(false);
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = searchQuery === '' || 
      worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.contact?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMinistry = selectedMinistry === 'all' || worker.ministry === selectedMinistry;
    
    return matchesSearch && matchesMinistry;
  });

  // Get all events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return monthlyAttendance[dateStr] || [];
  };

  // Get color for event based on status
  const getEventColor = (event) => {
    switch (event.status) {
      case 'present':
        return 'bg-green-500';
      case 'late':
        return 'bg-yellow-500';
      case 'absent':
        return 'bg-red-500';
      case 'upcoming':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get light background color for calendar tile
  const getTileBackgroundColor = (date) => {
    const events = getEventsForDate(date);
    if (events.length === 0) return '';
    
    const hasPresent = events.some(e => e.status === 'present');
    const hasLate = events.some(e => e.status === 'late');
    const hasAbsent = events.some(e => e.status === 'absent');
    const hasUpcoming = events.some(e => e.status === 'upcoming');
    
    if (hasPresent) return 'bg-green-50';
    if (hasLate) return 'bg-yellow-50';
    if (hasAbsent) return 'bg-red-50';
    if (hasUpcoming) return 'bg-blue-50';
    
    return 'bg-gray-50';
  };

  // Enhanced calendar tile className with hover effects
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const baseClasses = 'relative transition-all duration-200 ease-in-out';
      const bgColor = getTileBackgroundColor(date);
      const hoverClass = hoveredDate === date.toDateString() ? 'shadow-lg scale-105 z-10' : '';
      return `${baseClasses} ${bgColor} ${hoverClass}`;
    }
    return '';
  };

  // Enhanced calendar tile content with better event indicators
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const events = getEventsForDate(date);
      
      if (events.length === 0) return (
        <div className="mt-1 text-xs text-gray-400 italic">
          No events
        </div>
      );
      
      const sortedEvents = [...events].sort((a, b) => {
        const statusOrder = { 'present': 1, 'late': 2, 'absent': 3, 'upcoming': 4 };
        return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
      });
      
      return (
        <div className="mt-2 space-y-1.5 w-full">
          {sortedEvents.slice(0, 2).map((event, index) => (
            <div
              key={index}
              className={`text-xs px-2 py-1 rounded-md truncate text-white font-medium shadow-sm transition-transform  ${getEventColor(event)}`}
              title={`${event.eventTitle} - ${event.status.charAt(0).toUpperCase() + event.status.slice(1)}`}
            >
              <span className="block truncate">
                {event.eventTitle.length > 12 ? event.eventTitle.substring(0, 10) + '…' : event.eventTitle}
              </span>
            </div>
          ))}
          {events.length > 2 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDateEvents({ date, events });
                setShowDayEventsModal(true);
              }}
              onMouseEnter={() => setHoveredDate(date.toDateString())}
              onMouseLeave={() => setHoveredDate(null)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors w-full text-center"
            >
              +{events.length - 2} more
            </button>
          )}
        </div>
      );
    }
    return null;
  };

  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Check if a date is in the future
  const isFutureDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate > today;
  };

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  // Get all events for this month grouped by date
  const getAllEventsForMonth = () => {
    const events = [];
    
    Object.entries(monthlyAttendance).forEach(([dateStr, dateEvents]) => {
      dateEvents.forEach(event => {
        events.push({
          ...event,
          dateStr
        });
      });
    });
    
    return events.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
  };

  return (
    <SidebarLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Worker Attendance Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            View attendance history for all workers
          </p>
        </div>

        {/* Workers List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  All Workers ({filteredWorkers.length})
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Click "View Records" to see event attendance history
                </p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search workers by name, email, or contact..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="w-full md:w-64">
                <select
                  value={selectedMinistry}
                  onChange={(e) => setSelectedMinistry(e.target.value)}
                  className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Ministries</option>
                  {ministries.map((ministry, index) => (
                    <option key={index} value={ministry}>
                      {ministry}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-2">
              {searchQuery && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  <span>Search: "{searchQuery}"</span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {selectedMinistry !== 'all' && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  <span>Ministry: {selectedMinistry}</span>
                  <button
                    onClick={() => setSelectedMinistry('all')}
                    className="ml-2 text-green-600 hover:text-green-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0c-.83.63-1.874 1-3 1a4.978 4.978 0 01-3-1m3-1a4.978 4.978 0 001-3 4.979 4.979 0 00-1-3" />
              </svg>
              <p className="text-lg font-medium">No workers found</p>
              <p className="text-sm mt-2">
                {searchQuery || selectedMinistry !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Add workers to get started'}
              </p>
              {(searchQuery || selectedMinistry !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedMinistry('all');
                  }}
                  className="cursor-pointer mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredWorkers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {worker.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {worker.ministry}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {worker.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {worker.contact || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openRecordsModal(worker)}
                            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
                          >
                            View Records
                          </button>
                          <button
                            onClick={() => exportWorkerAttendanceCSV(worker)}
                            disabled={exportLoading}
                            className={`cursor-pointer ${
                              exportLoading 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-green-800 hover:bg-green-700'
                            } text-white px-4 py-2 rounded-md font-medium text-sm transition-colors`}
                          >
                            {exportLoading ? 'Exporting...' : 'Export CSV'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Records Modal */}
        {showRecordsModal && selectedWorker && (
          <Modal onClose={() => setShowRecordsModal(false)} title="Attendance History" large>
            <div className="space-y-6">
              {/* Worker Info Header with Export Buttons */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {selectedWorker.profile_photo_url ? (
                      <img 
                        src={selectedWorker.profile_photo_url} 
                        alt={selectedWorker.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-blue-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">No photo</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{selectedWorker.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {selectedWorker.ministry}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportWorkerMonthAttendanceCSV(selectedWorker, selectedMonth)}
                      disabled={exportLoading}
                      className={`cursor-pointer ${
                        exportLoading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-800 hover:bg-green-700'
                      } text-white px-3 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-1`}
                      title="Export current month only"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {exportLoading ? '...' : 'Export this Month'}
                    </button>
                    
                    <button
                      onClick={() => exportWorkerAttendanceCSV(selectedWorker)}
                      disabled={exportLoading}
                      className={`cursor-pointer ${
                        exportLoading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-800 hover:bg-green-700'
                      } text-white px-3 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-1`}
                      title="Export complete history (all time)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {exportLoading ? '...' : 'Export all Records'}
                    </button>
                  </div>
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCalendarView(false)}
                  className={`cursor-pointer px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    !showCalendarView 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setShowCalendarView(true)}
                  className={`cursor-pointer px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    showCalendarView 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Calendar View
                </button>
              </div>

              {/* Month Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Month:
                </label>
                <input
                  type="month"
                  value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-');
                    const newMonth = new Date(year, month - 1, 1);
                    setSelectedMonth(newMonth);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {showCalendarView ? (
                /* ======================================================== */
                /* ENHANCED CALENDAR VIEW WITH IMPROVED UI                  */
                /* ======================================================== */
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Total Events</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => acc + events.length, 0)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                      <p className="text-xs text-green-600 uppercase font-semibold">Present</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'present').length, 0
                        )}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
                      <p className="text-xs text-yellow-600 uppercase font-semibold">Late</p>
                      <p className="text-2xl font-bold text-yellow-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'late').length, 0
                        )}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                      <p className="text-xs text-red-600 uppercase font-semibold">Absent</p>
                      <p className="text-2xl font-bold text-red-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'absent').length, 0
                        )}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <p className="text-xs text-blue-600 uppercase font-semibold">Upcoming</p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'upcoming').length, 0
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Enhanced Color Legend with better typography */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                      Event Status Legend
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                        <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
                        <span className="text-xs font-medium text-green-700">Present</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm"></div>
                        <span className="text-xs font-medium text-yellow-700">Late</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
                        <span className="text-xs font-medium text-red-700">Absent</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
                        <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                        <span className="text-xs font-medium text-blue-700">Upcoming</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                        <div className="w-3 h-3 rounded-full bg-gray-500 shadow-sm"></div>
                        <span className="text-xs font-medium text-gray-700">Past (No Event)</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Calendar with improved UI */}
                  <div className="bg-white border rounded-xl p-4 shadow-lg">
                    <Calendar
                      onChange={handleMonthChange}
                      value={selectedMonth}
                      view="month"
                      onActiveStartDateChange={({ activeStartDate }) => {
                        if (activeStartDate) {
                          setSelectedMonth(activeStartDate);
                        }
                      }}
                      tileClassName={tileClassName}
                      tileContent={tileContent}
                      onActiveStartDateChange={({ activeStartDate }) => {
                        if (activeStartDate) {
                          setSelectedMonth(activeStartDate);
                        }
                      }}
                      onMouseOver={({ date }) => setHoveredDate(date?.toDateString())}
                      onMouseLeave={() => setHoveredDate(null)}
                      className="border-0 w-full calendar-enhanced"
                    />
                  </div>

                  {/* All Events for This Month Section with improved styling */}
                  <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                      All Events for {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h4>
                    
                    {getAllEventsForMonth().length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-gray-500">No events found for this month</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {getAllEventsForMonth().map((event, index) => {
                          const date = new Date(event.dateStr);
                          const isPast = date < new Date() && event.status !== 'upcoming';
                          
                          return (
                            <div 
                              key={index} 
                              className={`group bg-white rounded-lg p-4 shadow-sm border-l-4 transition-all hover:shadow-md ${
                                event.status === 'present' ? 'border-l-green-500 hover:bg-green-50/50' :
                                event.status === 'late' ? 'border-l-yellow-500 hover:bg-yellow-50/50' :
                                event.status === 'absent' ? 'border-l-red-500 hover:bg-red-50/50' :
                                event.status === 'upcoming' ? 'border-l-blue-500 hover:bg-blue-50/50' :
                                'border-l-gray-500 hover:bg-gray-50/50'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                                      {event.eventTitle}
                                    </p>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                      event.eventType === 'sunday_service' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                      event.eventType === 'event' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                      event.eventType === 'meeting' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                      'bg-gray-100 text-gray-800 border border-gray-200'
                                    }`}>
                                      {event.eventType?.replace('_', ' ') || 'Event'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                                    <span className="flex items-center gap-1 text-gray-600">
                                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    {event.startTime && (
                                      <span className="flex items-center gap-1 text-gray-600">
                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {event.startTime}
                                      </span>
                                    )}
                                    {event.place && (
                                      <span className="flex items-center gap-1 text-gray-600">
                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="truncate max-w-[150px]">{event.place}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  <span className={`px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm ${
                                    event.status === 'present' ? 'bg-green-100 text-green-800 border border-green-200' :
                                    event.status === 'late' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                    event.status === 'absent' ? 'bg-red-100 text-red-800 border border-red-200' :
                                    event.status === 'upcoming' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                    'bg-gray-100 text-gray-800 border border-gray-200'
                                  }`}>
                                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                                  </span>
                                  {event.checkInTime && (
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                      {new Date(event.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ======================================================== */
                /* LIST VIEW (UNCHANGED - PRESERVED)                        */
                /* ======================================================== */
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Total Events</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => acc + events.length, 0)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs text-green-600 uppercase font-semibold">Present</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'present').length, 0
                        )}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-xs text-yellow-600 uppercase font-semibold">Late</p>
                      <p className="text-2xl font-bold text-yellow-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'late').length, 0
                        )}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-xs text-red-600 uppercase font-semibold">Absent</p>
                      <p className="text-2xl font-bold text-red-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'absent').length, 0
                        )}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs text-blue-600 uppercase font-semibold">Upcoming</p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        {Object.values(monthlyAttendance).reduce((acc, events) => 
                          acc + events.filter(e => e.status === 'upcoming').length, 0
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      All Events for {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}:
                    </h4>
                    
                    {Object.keys(monthlyAttendance).length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p className="text-sm">No events found for this month</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(monthlyAttendance)
                          .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
                          .map(([dateStr, events]) => {
                            const date = new Date(dateStr);
                            
                            return (
                              <div key={dateStr} className="bg-white rounded-lg p-4 shadow-sm">
                                <div className="font-semibold text-gray-800 mb-3">
                                  {date.toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    month: 'long', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                  {date.toDateString() === new Date().toDateString() && (
                                    <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                      Today
                                    </span>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  {events.map((event, index) => (
                                    <div key={index} className={`flex items-center justify-between p-3 rounded border-l-4 ${
                                      event.status === 'present' ? 'border-l-green-500 bg-green-50' :
                                      event.status === 'late' ? 'border-l-yellow-500 bg-yellow-50' :
                                      event.status === 'absent' ? 'border-l-red-500 bg-red-50' :
                                      event.status === 'upcoming' ? 'border-l-blue-500 bg-blue-50' :
                                      'border-l-gray-500 bg-gray-50'
                                    }`}>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-medium text-gray-900 text-sm">{event.eventTitle}</p>
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                            event.eventType === 'sunday_service' ? 'bg-purple-100 text-purple-800' :
                                            event.eventType === 'event' ? 'bg-blue-100 text-blue-800' :
                                            event.eventType === 'meeting' ? 'bg-orange-100 text-orange-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {event.eventType?.replace('_', ' ') || 'Event'}
                                          </span>
                                        </div>
                                        {event.checkInTime ? (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Check-in: {new Date(event.checkInTime).toLocaleTimeString('en-US', {
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })} 
                                            {event.startTime && ` • Event: ${event.startTime} - ${event.endTime}`}
                                          </p>
                                        ) : (
                                          <p className={`text-xs font-medium mt-1 ${
                                            event.status === 'absent' ? 'text-red-600' :
                                            event.status === 'upcoming' ? 'text-blue-600' :
                                            'text-gray-500'
                                          }`}>
                                            {event.status === 'absent' ? 'No check-in recorded (Absent)' :
                                             event.status === 'upcoming' ? 'Upcoming event' :
                                             'No check-in recorded'}
                                          </p>
                                        )}
                                        {event.place && (
                                          <p className="text-xs text-gray-400 mt-1">
                                            📍 {event.place}
                                          </p>
                                        )}
                                      </div>
                                      <span className={`ml-4 px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                                        event.status === 'present' ? 'bg-green-100 text-green-800' :
                                        event.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                        event.status === 'absent' ? 'bg-red-100 text-red-800' :
                                        event.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {event.status?.charAt(0).toUpperCase() + event.status?.slice(1)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Modal>
        )}
        
        {/* Enhanced Day Events Modal with better UI */}
        {showDayEventsModal && selectedDateEvents && (
          <Modal onClose={() => setShowDayEventsModal(false)} title={`Events for ${selectedDateEvents.date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          })}`} large={false}>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {selectedDateEvents.events.map((event, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border-l-4 transition-all hover:shadow-md ${
                    event.status === 'present' ? 'border-l-green-500 bg-green-50 hover:bg-green-100' :
                    event.status === 'late' ? 'border-l-yellow-500 bg-yellow-50 hover:bg-yellow-100' :
                    event.status === 'absent' ? 'border-l-red-500 bg-red-50 hover:bg-red-100' :
                    event.status === 'upcoming' ? 'border-l-blue-500 bg-blue-50 hover:bg-blue-100' :
                    'border-l-gray-500 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{event.eventTitle}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            event.eventType === 'sunday_service' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            event.eventType === 'event' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            event.eventType === 'meeting' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                            'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {event.eventType?.replace('_', ' ') || 'Event'}
                          </span>
                          {event.startTime && (
                            <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-600 border border-gray-200">
                              {event.startTime} - {event.endTime}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm ${
                        event.status === 'present' ? 'bg-green-100 text-green-800 border border-green-200' :
                        event.status === 'late' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                        event.status === 'absent' ? 'bg-red-100 text-red-800 border border-red-200' :
                        event.status === 'upcoming' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}>
                        {event.status?.charAt(0).toUpperCase() + event.status?.slice(1)}
                      </span>
                    </div>
                    
                    {event.place && (
                      <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {event.place}
                      </p>
                    )}
                    
                    {event.checkInTime ? (
                      <p className="text-xs text-gray-600 flex items-center gap-1 mt-2 bg-white p-2 rounded-md">
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Checked in: {new Date(event.checkInTime).toLocaleTimeString()}
                      </p>
                    ) : event.status === 'upcoming' ? (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-2 bg-blue-50 p-2 rounded-md">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Upcoming event - not yet started
                      </p>
                    ) : (
                      <p className="text-xs text-red-600 flex items-center gap-1 mt-2 bg-red-50 p-2 rounded-md">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        No check-in recorded
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Modal>
        )}
      </div>

      {/* Enhanced Calendar Styles */}
      <style>{`
        .react-calendar {
          width: 100% !important;
          border: none !important;
          font-family: inherit !important;
          background: transparent !important;
        }
        
        .react-calendar__month-view__weekdays {
          text-transform: uppercase !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          color: #6b7280 !important;
          padding: 0.5rem 0 !important;
        }
        
        .react-calendar__month-view__weekdays__weekday {
          padding: 0.5rem !important;
        }
        
        .react-calendar__month-view__weekdays abbr {
          text-decoration: none !important;
          cursor: default !important;
        }
        
        .react-calendar__tile {
          position: relative !important;
          min-height: 120px !important;
          height: auto !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          padding: 12px 8px !important;
          overflow: visible !important;
          border-radius: 8px !important;
          transition: all 0.2s ease-in-out !important;
          border: 1px solid transparent !important;
        }
        
        .react-calendar__tile:hover {
          background-color: #f9fafb !important;
          border-color: #e5e7eb !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
        }
        
        .react-calendar__tile--now {
          background: #eff6ff !important;
          position: relative !important;
          border: 2px solid #3b82f6 !important;
        }
        
        .react-calendar__tile--now:hover {
          background: #dbeafe !important;
        }
        
        .react-calendar__tile--active {
          background: #3b82f6 !important;
          color: white !important;
        }
        
        .react-calendar__tile--active:hover {
          background: #2563eb !important;
        }
        
        .react-calendar__navigation {
          margin-bottom: 1rem !important;
        }
        
        .react-calendar__navigation button {
          color: #374151 !important;
          font-weight: 600 !important;
          font-size: 1rem !important;
          padding: 0.5rem 1rem !important;
          border-radius: 6px !important;
          transition: all 0.2s !important;
        }
        
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: #f3f4f6 !important;
          transform: scale(1.05) !important;
        }
        
        .react-calendar__month-view__days__day {
          font-weight: 500 !important;
        }
        
        .react-calendar__month-view__days__day--weekend {
          color: #dc2626 !important;
        }
        
        .react-calendar__month-view__days__day--neighboringMonth {
          opacity: 0.4 !important;
        }
        
        /* Custom scrollbar for event lists */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .react-calendar__tile {
            min-height: 80px !important;
            padding: 6px 4px !important;
          }
          
          .react-calendar__tile > div {
            font-size: 0.7rem !important;
          }
        }
      `}</style>
    </SidebarLayout>
  );
}

function Modal({ children, onClose, title, large = false }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-xl ${large ? 'max-w-6xl' : 'max-w-md'} w-full shadow-2xl my-8 transform transition-all duration-300 scale-100`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-gray-400 hover:text-gray-600 text-2xl leading-none hover:bg-gray-100 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}