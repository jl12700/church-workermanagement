import { useState, useEffect } from 'react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';

export default function SundayAttendance() {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [scanMessage, setScanMessage] = useState('');
  const [scanMessageType, setScanMessageType] = useState('');
  const [summary, setSummary] = useState({ 
    presentToday: 0, 
    lateToday: 0,
    absentToday: 0,
    totalWorkers: 0 
  });
  const [currentEvent, setCurrentEvent] = useState(null);

  const ROWS_PER_PAGE = 50;

  // Get attendance status based on rules
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

  // Get or create Sunday Service event
  const getOrCreateSundayServiceEvent = async (date) => {
    try {
      // First, try to fetch existing event
      const { data: existingEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('event_date', date)
        .eq('type', 'sunday_service')
        .maybeSingle();
      
      if (fetchError) {
        console.error('Error fetching event:', fetchError);
        throw fetchError;
      }
      
      // If event exists, return it
      if (existingEvent) {
        setCurrentEvent(existingEvent);
        return existingEvent;
      }
      
      // If no event exists, create one
      console.log('No Sunday Service event found, creating new one...');
      const { data: newEvent, error: createError } = await supabase
        .from('events')
        .insert([{
          title: 'Sunday Service',
          description: 'Weekly Sunday Service',
          type: 'sunday_service',
          event_date: date,
          start_time: '09:00:00',
          end_time: '12:00:00',
          status: 'approved',
          place: 'Church',
          location: 'Church'
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating event:', createError);
        throw createError;
      }
      
      console.log('Sunday Service event created:', newEvent);
      setCurrentEvent(newEvent);
      return newEvent;
    } catch (error) {
      console.error('Error in getOrCreateSundayServiceEvent:', error);
      return null;
    }
  };

  const fetchAttendance = async (page = 1, date = selectedDate) => {
    setLoading(true);
    try {
      // Get or create Sunday Service event for this date
      const event = await getOrCreateSundayServiceEvent(date);
      
      if (!event) {
        setAttendanceRecords([]);
        setTotalCount(0);
        setTotalPages(0);
        setLoading(false);
        return;
      }
      
      const from = (page - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;
      
      // Get attendance count for this event
      const { count } = await supabase
        .from('event_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id);
      
      // Get attendance records with status using the view
      const { data, error } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('event_id', event.id)
        .order('check_in_time', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      setAttendanceRecords(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / ROWS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching attendance:', error);
      alert('Failed to load attendance records. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get or create today's Sunday Service event
      const event = await getOrCreateSundayServiceEvent(today);
      
      if (!event) {
        setSummary({ presentToday: 0, lateToday: 0, absentToday: 0, totalWorkers: 0 });
        return;
      }
      
      // Get all attendance for this event
      const { data: attendanceData } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('event_id', event.id);
      
      // Calculate counts
      let presentCount = 0;
      let lateCount = 0;
      
      if (attendanceData) {
        attendanceData.forEach(record => {
          const status = getAttendanceStatus(record.check_in_time);
          if (status.status === 'present') {
            presentCount++;
          } else if (status.status === 'late') {
            lateCount++;
          }
        });
      }
      
      // Get total workers count
      const { count: totalWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true });
      
      setSummary({
        presentToday: presentCount || 0,
        lateToday: lateCount || 0,
        absentToday: (totalWorkers || 0) - (presentCount + lateCount),
        totalWorkers: totalWorkers || 0
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  useEffect(() => {
    fetchAttendance(currentPage, selectedDate);
    fetchSummary();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('event-attendance-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_attendance'
        },
        (payload) => {
          console.log('New attendance detected:', payload);
          
          // Check if this is for today's Sunday Service
          const today = new Date().toISOString().split('T')[0];
          if (selectedDate === today && currentEvent && payload.new.event_id === currentEvent.id) {
            setScanMessage(`✓ Attendance recorded!`);
            setScanMessageType('success');
            
            fetchAttendance(currentPage, selectedDate);
            fetchSummary();
            
            setTimeout(() => {
              setScanMessage('');
              setScanMessageType('');
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPage, selectedDate]);

  const exportAttendance = async () => {
    try {
      if (!currentEvent) {
        alert('No event found for this date.');
        return;
      }

      // Get attendance data
      const { data, error } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('event_id', currentEvent.id)
        .order('check_in_time', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No attendance records found for this event.');
        return;
      }

      // Create CSV
      const headers = ['Name', 'Ministry', 'Date', 'Check-in Time', 'Status'];
      const csvRows = [headers.join(',')];

      data.forEach(record => {
        const time = new Date(record.check_in_time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const status = getAttendanceStatus(record.check_in_time);
        const row = [
          `"${record.worker_name}"`,
          `"${record.ministry}"`,
          record.event_date,
          time,
          status.text
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sunday-service-${selectedDate}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert('Failed to export attendance. Please try again.');
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setCurrentPage(1);
  };

  // Get current time to check if it's past 9:15 AM
  const getCurrentTimeStatus = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = (hours * 60) + minutes;
    const absentThreshold = (9 * 60) + 15; // 9:15 AM
    
    if (totalMinutes >= absentThreshold) {
      return "It's past 9:15 AM - workers not scanned are marked as Absent";
    }
    return "Scanning still in progress until 9:15 AM";
  };

  return (
    <SidebarLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Sunday Service Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage Sunday service attendance
          </p>
          <div className="mt-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-lg">
            <strong>Attendance Rules:</strong> Present (Before 9:00 AM) • Late (9:00 AM - 9:14 AM) • Absent (9:15 AM onwards or no scan)
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Attended */}
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-100/80">
                  Total workers
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {summary.presentToday + summary.lateToday}
                  </span>
                  <span className="text-blue-200/60 text-xl font-medium">
                    / {summary.totalWorkers}
                  </span>
                </div>
                <p className="text-sm font-semibold text-blue-100 mt-2">
                  {summary.totalWorkers > 0 
                    ? `${Math.round(((summary.presentToday + summary.lateToday) / summary.totalWorkers) * 100)}% Attendance`
                    : 'No workers registered'}
                </p>
                <p className="text-xs text-blue-100/70 mt-2">{getCurrentTimeStatus()}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md border border-white/10">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Present */}
          <div className="bg-green-800 rounded-2xl p-6 text-white shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-green-100/80">
              Present
            </h3>
            <p className="text-4xl font-extrabold mt-2">{summary.presentToday}</p>
            <p className="text-sm text-green-100 mt-1">Before 9:00 AM</p>
          </div>

          {/* Late */}
          <div className="bg-yellow-600 rounded-2xl p-6 text-white shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-100/80">
              Late
            </h3>
            <p className="text-4xl font-extrabold mt-2">{summary.lateToday}</p>
            <p className="text-sm text-yellow-100 mt-1">9:00 AM - 9:14 AM</p>
          </div>

          {/* Absent */}
          <div className="bg-red-500 rounded-2xl p-6 text-white shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-red-100/80">
              Not Scanned
            </h3>
            <p className="text-4xl font-extrabold mt-2">
              {summary.totalWorkers - (summary.presentToday + summary.lateToday)}
            </p>
            <p className="text-sm text-red-100 mt-1">
              {(() => {
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes();
                const totalMinutes = (hours * 60) + minutes;
                const absentThreshold = (9 * 60) + 15;
                
                if (totalMinutes >= absentThreshold) {
                  return "Marked Absent";
                }
                return "Not yet scanned";
              })()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={exportAttendance}
              className="cursor-pointer ml-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Export CSV
            </button>
          </div>

          {scanMessage && (
            <div className={`mt-4 p-3 rounded-lg font-medium ${
              scanMessageType === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {scanMessage}
            </div>
          )}
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Attendance Records - {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Total Records: {totalCount}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No attendance records found</p>
              <p className="text-sm mt-2">Workers can scan their QR codes to check in</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => {
                      const status = getAttendanceStatus(record.check_in_time);
                      
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.worker_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {record.ministry}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(record.check_in_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              status.status === 'present' 
                                ? 'bg-green-100 text-green-800'
                                : status.status === 'late'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {status.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}