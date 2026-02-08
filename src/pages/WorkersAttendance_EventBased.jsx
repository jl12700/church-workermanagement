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

  const fetchWorkerMonthlyAttendance = async (workerId, month) => {
    try {
      const year = month.getFullYear();
      const monthNum = month.getMonth() + 1;
      
      // Get start and end dates for the month
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Get all events in this month
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', startDateStr)
        .lte('event_date', endDateStr);
      
      if (eventsError) throw eventsError;
      
      // Get attendance for this worker in this month
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('worker_id', workerId)
        .gte('event_date', startDateStr)
        .lte('event_date', endDateStr);
      
      if (attendanceError) throw attendanceError;
      
      // Organize attendance by date
      const attendanceMap = {};
      
      // Initialize all event dates
      events?.forEach(event => {
        if (!attendanceMap[event.event_date]) {
          attendanceMap[event.event_date] = [];
        }
      });
      
      // Add attendance records
      attendance?.forEach(record => {
        if (!attendanceMap[record.event_date]) {
          attendanceMap[record.event_date] = [];
        }
        
        // Calculate status for each attendance record
        const status = getAttendanceStatus(record.check_in_time);
        
        attendanceMap[record.event_date].push({
          eventTitle: record.event_title,
          eventType: record.event_type,
          checkInTime: record.check_in_time,
          startTime: record.start_time,
          endTime: record.end_time,
          status: status.status
        });
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

  // Helper function to determine attendance status based on time
  const getAttendanceStatus = (timeString) => {
    if (!timeString) return { status: 'absent', text: 'Absent' };
    
    const time = new Date(timeString);
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const totalMinutes = (hours * 60) + minutes;
    
    const absentThreshold = (9 * 60) + 15; // 9:15 AM (555 minutes)
    const lateThreshold = 9 * 60; // 9:00 AM (540 minutes)
    
    // Absent: 9:15 AM (555) and after, or no check-in
    if (totalMinutes >= absentThreshold) {
      return { status: 'absent', text: 'Absent' };
    }
    
    // Late: 9:00 AM (540) to 9:14 AM (554)
    if (totalMinutes >= lateThreshold && totalMinutes < absentThreshold) {
      return { status: 'late', text: 'Late' };
    }
    
    // Present: before 9:00 AM (< 540)
    return { status: 'present', text: 'Present' };
  };

  // Get Sundays in a month
  const getSundaysInMonth = (month) => {
    const sundays = [];
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    const firstDay = new Date(year, monthNum, 1);
    const lastDay = new Date(year, monthNum + 1, 0);
    
    for (let day = firstDay; day <= lastDay; day.setDate(day.getDate() + 1)) {
      if (day.getDay() === 0) { // Sunday
        sundays.push(new Date(day));
      }
    }
    
    return sundays;
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

  // Function to determine attendance status for a specific date
  const determineAttendanceStatus = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Check if it's a future date (after today)
    if (checkDate > today) {
      return null; // No status for future dates
    }
    
    // Check if we have attendance records for this date
    if (!monthlyAttendance[dateStr] || monthlyAttendance[dateStr].length === 0) {
      // No attendance record found
      // If it's today, return null (no status yet)
      if (isToday(date)) {
        return null;
      }
      // If it's a past date, check if it's Sunday (should have attendance)
      if (date.getDay() === 0) {
        return 'absent'; // Sunday with no check-in
      }
      return null; // Not a Sunday
    }
    
    // For this view, we'll take the status from the first event of the day
    const firstEvent = monthlyAttendance[dateStr][0];
    return firstEvent.status;
  };

  // Calendar tile className function
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const day = date.getDay();
      
      // Only apply styles to Sundays
      if (day === 0) {
        const status = determineAttendanceStatus(date);
        
        if (status === null) {
          return ''; // No status for future dates or today with no check-in
        }
        
        switch (status) {
          case 'present':
            return 'bg-green-100 text-green-800 font-semibold';
          case 'late':
            return 'bg-yellow-100 text-yellow-800 font-semibold';
          case 'absent':
            return 'bg-red-100 text-red-800 font-semibold';
          default:
            return '';
        }
      }
    }
    return '';
  };

  // Calendar tile content function (for colored dots)
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const day = date.getDay();
      if (day === 0) {
        const status = determineAttendanceStatus(date);
        
        // Don't show dots for future dates or today with no check-in
        if (status === null) {
          return null;
        }
        
        let dotColor = '';
        switch (status) {
          case 'present':
            dotColor = 'bg-green-500';
            break;
          case 'late':
            dotColor = 'bg-yellow-500';
            break;
          case 'absent':
            dotColor = 'bg-red-500';
            break;
        }
        
        return (
          <div className="flex justify-center mt-1">
            <div className={`h-2 w-2 rounded-full ${dotColor}`}></div>
          </div>
        );
      }
    }
    return null;
  };

  const getAttendanceSummary = () => {
    const sundays = getSundaysInMonth(selectedMonth);
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let futureCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    sundays.forEach(sunday => {
      const status = determineAttendanceStatus(sunday);
      
      // Don't count future Sundays in attendance stats
      const checkDate = new Date(sunday);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate > today) {
        futureCount++;
        return;
      }
      
      switch (status) {
        case 'present':
          presentCount++;
          break;
        case 'late':
          lateCount++;
          break;
        case 'absent':
          absentCount++;
          break;
        case null:
          // Today with no check-in yet - don't count as absent
          if (!isToday(sunday)) {
            absentCount++;
          }
          break;
      }
    });

    return { 
      totalDays: sundays.length - futureCount, // Only count past and current Sundays
      presentCount, 
      lateCount, 
      absentCount,
      futureCount
    };
  };

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  return (
    <SidebarLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Worker Attendance Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            View attendance history for all workers across all events
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
              {/* Search */}
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
              
              {/* Ministry Filter */}
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
            
            {/* Active Filters */}
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
                        <button
                          onClick={() => openRecordsModal(worker)}
                          className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
                        >
                          View Records
                        </button>
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
              {/* Worker Info Header */}
              <div className="border-b pb-4">
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
                /* Calendar View */
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Sundays (Past & Present)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {getAttendanceSummary().totalDays}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs text-green-600 uppercase font-semibold">Present</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        {getAttendanceSummary().presentCount}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-xs text-yellow-600 uppercase font-semibold">Late</p>
                      <p className="text-2xl font-bold text-yellow-600 mt-1">
                        {getAttendanceSummary().lateCount}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-xs text-red-600 uppercase font-semibold">Absent</p>
                      <p className="text-2xl font-bold text-red-600 mt-1">
                        {getAttendanceSummary().absentCount}
                      </p>
                    </div>
                  </div>

                  {/* Calendar */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
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
                      className="border-0"
                    />
                  </div>

                  {/* Legend - UPDATED with new rules */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Legend (**for Sunday Service only):</h4>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center">
                        <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm text-gray-600">Present (Before 9:00 AM)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-4 w-4 rounded-full bg-yellow-500 mr-2"></div>
                        <span className="text-sm text-gray-600">Late (9:00 AM onwards)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-sm text-gray-600">Absent (No scan by 9:15 AM)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-4 w-4 rounded-full bg-gray-300 mr-2"></div>
                        <span className="text-sm text-gray-600">Future dates / No check-in yet</span>
                      </div>
                    </div>
                  </div>

                  {/* Sunday Attendance Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Sunday Attendance for {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getSundaysInMonth(selectedMonth).map(sunday => {
                        const status = determineAttendanceStatus(sunday);
                        const dateStr = sunday.toISOString().split('T')[0];
                        const events = monthlyAttendance[dateStr];
                        const isFuture = isFutureDate(sunday);
                        const isTodayDate = isToday(sunday);
                        
                        let bgColor = 'bg-gray-50';
                        let borderColor = 'border-gray-200';
                        
                        if (isFuture) {
                          bgColor = 'bg-blue-50';
                          borderColor = 'border-blue-200';
                        } else if (status === 'present') {
                          bgColor = 'bg-green-50';
                          borderColor = 'border-green-200';
                        } else if (status === 'late') {
                          bgColor = 'bg-yellow-50';
                          borderColor = 'border-yellow-200';
                        } else if (status === 'absent') {
                          bgColor = 'bg-red-50';
                          borderColor = 'border-red-200';
                        } else if (status === null && isTodayDate) {
                          bgColor = 'bg-gray-100';
                          borderColor = 'border-gray-300';
                        }
                        
                        return (
                          <div key={dateStr} className={`p-3 rounded-lg border ${bgColor} ${borderColor}`}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-800">
                                {sunday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                {isTodayDate && (
                                  <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    Today
                                  </span>
                                )}
                                {isFuture && (
                                  <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    Future
                                  </span>
                                )}
                              </span>
                              {status && (
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  status === 'present' ? 'bg-green-100 text-green-800' :
                                  status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                              )}
                              {!status && !isFuture && isTodayDate && (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                  No check-in yet
                                </span>
                              )}
                            </div>
                            {events && events.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {events.map((event, index) => (
                                  <div key={index} className="text-sm text-gray-600">
                                    <p>
                                      {event.eventTitle}: {new Date(event.checkInTime).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {!events && status === 'absent' && !isFuture && (
                              <p className="text-sm text-gray-500 mt-1">
                                No check-in recorded (Absent after 9:15 AM)
                              </p>
                            )}
                            {isFuture && (
                              <p className="text-sm text-blue-600 mt-1">
                                Future date
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* List View */
                <>
                  {/* Summary Stats */}
                  {Object.keys(monthlyAttendance).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Days Attended</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {Object.keys(monthlyAttendance).length}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-xs text-green-600 uppercase font-semibold">Present</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">
                          {(() => {
                            let count = 0;
                            Object.values(monthlyAttendance).forEach(events => {
                              events.forEach(event => {
                                if (event.status === 'present') count++;
                              });
                            });
                            return count;
                          })()}
                        </p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <p className="text-xs text-yellow-600 uppercase font-semibold">Late</p>
                        <p className="text-2xl font-bold text-yellow-600 mt-1">
                          {(() => {
                            let count = 0;
                            Object.values(monthlyAttendance).forEach(events => {
                              events.forEach(event => {
                                if (event.status === 'late') count++;
                              });
                            });
                            return count;
                          })()}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <p className="text-xs text-red-600 uppercase font-semibold">Absent</p>
                        <p className="text-2xl font-bold text-red-600 mt-1">
                          {(() => {
                            let count = 0;
                            Object.values(monthlyAttendance).forEach(events => {
                              events.forEach(event => {
                                if (event.status === 'absent') count++;
                              });
                            });
                            return count;
                          })()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Attendance Records List */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Event Attendance for {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}:
                    </h4>
                    
                    {Object.keys(monthlyAttendance).length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p className="text-sm">No attendance records found for this month</p>
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
                                </div>
                                
                                <div className="space-y-2">
                                  {events.map((event, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900 text-sm">{event.eventTitle}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          Check-in: {new Date(event.checkInTime).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })} 
                                          {event.startTime && ` • Event: ${event.startTime} - ${event.endTime}`}
                                        </p>
                                        <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${
                                          event.eventType === 'sunday_service' ? 'bg-purple-100 text-purple-800' :
                                          event.eventType === 'training' ? 'bg-blue-100 text-blue-800' :
                                          event.eventType === 'meeting' ? 'bg-orange-100 text-orange-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {event.eventType?.replace('_', ' ') || 'Event'}
                                        </span>
                                      </div>
                                      <span className={`ml-4 px-3 py-1 text-xs font-semibold rounded-full ${
                                        event.status === 'present' ? 'bg-green-100 text-green-800' :
                                        event.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
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
      </div>

      <style>{`
        .react-calendar {
          width: 100% !important;
          border: none !important;
          font-family: inherit !important;
        }
        
        .react-calendar__month-view__weekdays {
          text-transform: uppercase !important;
          font-weight: 600 !important;
          font-size: 0.875rem !important;
          color: #4b5563 !important;
        }
        
        .react-calendar__tile--now {
          background-color: #dbeafe !important;
        }
        
        .react-calendar__tile--active {
          background-color: #3b82f6 !important;
          color: white !important;
        }
        
        .react-calendar__navigation button {
          color: #374151 !important;
          font-weight: 600 !important;
          min-width: 44px !important;
        }
        
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: #f3f4f6 !important;
        }
        
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: #f3f4f6 !important;
        }
        
        /* Highlight Sundays */
        .react-calendar__month-view__days__day--weekend:not(.react-calendar__month-view__days__day--neighboringMonth) {
          color: #dc2626 !important;
          font-weight: 600 !important;
        }
      `}</style>
    </SidebarLayout>
  );
}

function Modal({ children, onClose, title, large = false }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-lg ${large ? 'max-w-6xl' : 'max-w-md'} w-full shadow-xl my-8`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-gray-400 hover:text-gray-600 text-2xl leading-none"
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