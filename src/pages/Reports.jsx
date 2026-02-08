import { useState, useEffect, useRef } from 'react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import { 
  Download, 
  Filter, 
  Calendar, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  BarChart3,
  PieChart,
  ChevronDown,
  ChevronUp,
  Search,
  Printer,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

export default function Reports() {
  // State for Sunday Service Reports
  const [sundayReports, setSundayReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date().setDate(new Date().getDate() - 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedSunday, setSelectedSunday] = useState(null);
  const [sundayDetails, setSundayDetails] = useState([]);
  const [sundaySummary, setSundaySummary] = useState({
    totalWorkers: 0,
    present: 0,
    late: 0,
    absent: 0,
    attendanceRate: 0
  });

  // State for Late Workers Reports
  const [lateWorkers, setLateWorkers] = useState([]);
  const [lateLoading, setLateLoading] = useState(false);
  const [lateDateRange, setLateDateRange] = useState({
    startDate: format(new Date().setDate(new Date().getDate() - 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [lateMinistryFilter, setLateMinistryFilter] = useState('all');
  const [lateMinistries, setLateMinistries] = useState([]);

  // State for Event Attendance Reports
  const [events, setEvents] = useState([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventAttendance, setEventAttendance] = useState([]);
  const [eventSummary, setEventSummary] = useState({
    total: 0,
    scanned: 0,
    pending: 0,
    rate: 0
  });

  // State for all workers
  const [allWorkers, setAllWorkers] = useState([]);
  const [ministries, setMinistries] = useState([]);

  // State for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedReport, setExpandedReport] = useState(null);
  const [viewMode, setViewMode] = useState('sunday'); // 'sunday', 'late', 'events'

  // Helper function to calculate attendance status
  const getAttendanceStatus = (checkInTime) => {
    if (!checkInTime) return { status: 'absent', text: 'Absent' };
    
    const time = new Date(checkInTime);
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const totalMinutes = (hours * 60) + minutes;
    
    const absentThreshold = (9 * 60) + 15; // 9:15 AM
    const lateThreshold = 9 * 60; // 9:00 AM
    
    if (totalMinutes >= absentThreshold) {
      return { status: 'absent', text: 'Absent' };
    }
    
    if (totalMinutes >= lateThreshold && totalMinutes < absentThreshold) {
      return { status: 'late', text: 'Late' };
    }
    
    return { status: 'present', text: 'Present' };
  };

  // Fetch all workers and ministries
  const fetchWorkersAndMinistries = async () => {
    try {
      const { data: workers, error } = await supabase
        .from('workers')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      setAllWorkers(workers || []);
      
      // Extract unique ministries
      const uniqueMinistries = [...new Set(workers?.map(worker => worker.ministry).filter(Boolean))];
      setMinistries(uniqueMinistries);
      setLateMinistries(uniqueMinistries);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  // Fetch Sunday Service Reports
  const fetchSundayReports = async () => {
    setLoading(true);
    try {
      // Get Sunday service events within date range
      const { data: sundayEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate)
        .order('event_date', { ascending: false });
      
      if (eventsError) throw eventsError;

      const reports = await Promise.all(
        (sundayEvents || []).map(async (event) => {
          // Get attendance for this event
          const { data: attendance, error: attendanceError } = await supabase
            .from('attendance_status_view')
            .select('*')
            .eq('event_id', event.id);
          
          if (attendanceError) throw attendanceError;
          
          // Calculate summary
          const totalWorkers = allWorkers.length;
          let presentCount = 0;
          let lateCount = 0;
          let absentCount = 0;
          
          if (attendance) {
            attendance.forEach(record => {
              const status = getAttendanceStatus(record.check_in_time);
              if (status.status === 'present') presentCount++;
              if (status.status === 'late') lateCount++;
              if (status.status === 'absent') absentCount++;
            });
          }
          
          // Workers who didn't check in
          absentCount += Math.max(0, totalWorkers - (presentCount + lateCount + absentCount));
          
          const attendanceRate = totalWorkers > 0 ? ((presentCount + lateCount) / totalWorkers) * 100 : 0;
          
          return {
            id: event.id,
            date: event.event_date,
            formattedDate: format(parseISO(event.event_date), 'EEEE, MMMM d, yyyy'),
            totalWorkers,
            present: presentCount,
            late: lateCount,
            absent: absentCount,
            attendanceRate: parseFloat(attendanceRate.toFixed(1)),
            eventTitle: event.title
          };
        })
      );
      
      setSundayReports(reports);
    } catch (error) {
      console.error('Error fetching Sunday reports:', error);
      alert('Failed to load Sunday service reports');
    } finally {
      setLoading(false);
    }
  };

  // Fetch details for a specific Sunday
  const fetchSundayDetails = async (eventId) => {
    try {
      const { data: attendance, error } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('event_id', eventId)
        .order('check_in_time', { ascending: false });
      
      if (error) throw error;
      
      const attendanceWithStatus = (attendance || []).map(record => ({
        ...record,
        status: getAttendanceStatus(record.check_in_time)
      }));
      
      setSundayDetails(attendanceWithStatus);
      
      // Calculate summary
      const totalWorkers = allWorkers.length;
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      
      attendanceWithStatus.forEach(record => {
        if (record.status.status === 'present') presentCount++;
        if (record.status.status === 'late') lateCount++;
        if (record.status.status === 'absent') absentCount++;
      });
      
      // Add workers who didn't check in
      absentCount += Math.max(0, totalWorkers - attendanceWithStatus.length);
      
      const attendanceRate = totalWorkers > 0 ? ((presentCount + lateCount) / totalWorkers) * 100 : 0;
      
      setSundaySummary({
        totalWorkers,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        attendanceRate: parseFloat(attendanceRate.toFixed(1))
      });
    } catch (error) {
      console.error('Error fetching Sunday details:', error);
    }
  };

  // Fetch Late Workers Reports
  const fetchLateWorkers = async () => {
    setLateLoading(true);
    try {
      // Get Sunday service events within date range
      const { data: sundayEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', lateDateRange.startDate)
        .lte('event_date', lateDateRange.endDate);
      
      if (eventsError) throw eventsError;
      
      const lateRecords = [];
      
      for (const event of (sundayEvents || [])) {
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance_status_view')
          .select('*')
          .eq('event_id', event.id);
        
        if (attendanceError) throw attendanceError;
        
        const lateAttendance = (attendance || [])
          .filter(record => {
            const status = getAttendanceStatus(record.check_in_time);
            return status.status === 'late';
          })
          .map(record => ({
            ...record,
            eventDate: event.event_date,
            eventTitle: event.title,
            formattedDate: format(parseISO(event.event_date), 'MMM d, yyyy'),
            status: getAttendanceStatus(record.check_in_time)
          }));
        
        lateRecords.push(...lateAttendance);
      }
      
      // Apply ministry filter
      let filteredRecords = lateRecords;
      if (lateMinistryFilter !== 'all') {
        filteredRecords = lateRecords.filter(record => record.ministry === lateMinistryFilter);
      }
      
      setLateWorkers(filteredRecords);
    } catch (error) {
      console.error('Error fetching late workers:', error);
      alert('Failed to load late workers report');
    } finally {
      setLateLoading(false);
    }
  };

  // Fetch Events for Event Attendance Report (EXCLUDING Sunday Service)
  const fetchEvents = async () => {
    setEventLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate)
        .eq('status', 'approved')
        .neq('type', 'sunday_service') // EXCLUDE Sunday Service events
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      
      const eventsWithSummary = await Promise.all(
        (data || []).map(async (event) => {
          const { count } = await supabase
            .from('event_attendance')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);
          
          const totalWorkers = allWorkers.length;
          const scanned = count || 0;
          const pending = Math.max(0, totalWorkers - scanned);
          const rate = totalWorkers > 0 ? (scanned / totalWorkers) * 100 : 0;
          
          return {
            ...event,
            scanned,
            pending,
            rate: parseFloat(rate.toFixed(1)),
            formattedDate: format(parseISO(event.event_date), 'MMM d, yyyy'),
            formattedTime: `${event.start_time} - ${event.end_time}`
          };
        })
      );
      
      setEvents(eventsWithSummary);
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to load events');
    } finally {
      setEventLoading(false);
    }
  };

  // Fetch attendance for a specific event
  const fetchEventAttendance = async (eventId) => {
    try {
      const { data, error } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('event_id', eventId)
        .order('check_in_time', { ascending: false });
      
      if (error) throw error;
      
      setEventAttendance(data || []);
      
      // Calculate summary
      const totalWorkers = allWorkers.length;
      const scanned = data?.length || 0;
      const pending = Math.max(0, totalWorkers - scanned);
      const rate = totalWorkers > 0 ? (scanned / totalWorkers) * 100 : 0;
      
      setEventSummary({
        total: totalWorkers,
        scanned,
        pending,
        rate: parseFloat(rate.toFixed(1))
      });
    } catch (error) {
      console.error('Error fetching event attendance:', error);
    }
  };

  // Initialize
  useEffect(() => {
    fetchWorkersAndMinistries();
  }, []);

  useEffect(() => {
    if (allWorkers.length > 0) {
      switch (viewMode) {
        case 'sunday':
          fetchSundayReports();
          break;
        case 'late':
          fetchLateWorkers();
          break;
        case 'events':
          fetchEvents();
          break;
      }
    }
  }, [viewMode, dateRange, lateDateRange, lateMinistryFilter, allWorkers]);

  // Export functions
  const exportSundayReportCSV = (report) => {
    if (!report) {
      alert('Please select a Sunday report to export');
      return;
    }

    const headers = ['Name', 'Ministry', 'Check-in Time', 'Status', 'Event Date'];
    const csvRows = [headers.join(',')];

    sundayDetails.forEach(record => {
      const row = [
        `"${record.worker_name}"`,
        `"${record.ministry}"`,
        `"${new Date(record.check_in_time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}"`,
        `"${record.status.text}"`,
        `"${report.formattedDate}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sunday-service-${report.date}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportLateWorkersCSV = () => {
    if (lateWorkers.length === 0) {
      alert('No late workers to export');
      return;
    }

    const headers = ['Name', 'Ministry', 'Event Date', 'Event Title', 'Check-in Time', 'Late Reason'];
    const csvRows = [headers.join(',')];

    lateWorkers.forEach(record => {
      const row = [
        `"${record.worker_name}"`,
        `"${record.ministry}"`,
        `"${record.formattedDate}"`,
        `"${record.event_title}"`,
        `"${new Date(record.check_in_time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })}"`,
        `"Late arrival (after 9:00 AM)"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `late-workers-${lateDateRange.startDate}-to-${lateDateRange.endDate}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportEventAttendanceCSV = (event) => {
    if (!event) {
      alert('Please select an event to export');
      return;
    }

    const headers = ['Name', 'Ministry', 'Check-in Time', 'Scan Type', 'Event Date', 'Event Time'];
    const csvRows = [headers.join(',')];

    eventAttendance.forEach(record => {
      const row = [
        `"${record.worker_name}"`,
        `"${record.ministry}"`,
        `"${new Date(record.check_in_time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })}"`,
        `"${record.scan_type}"`,
        `"${event.formattedDate}"`,
        `"${event.formattedTime}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-attendance-${event.title}-${event.event_date}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Print functions
  const printReport = (type) => {
    const printContent = document.getElementById(`${type}-report`);
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${type.charAt(0).toUpperCase() + type.slice(1)} Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
            .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Attendance Reports</h1>
          <p className="text-gray-600">
            Detailed reports for Sunday services, late workers, and event attendance
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setViewMode('sunday')}
              className={`cursor-pointer px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'sunday'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Sunday Service Reports
            </button>
            <button
              onClick={() => setViewMode('late')}
              className={`cursor-pointer px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'late'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              Late Workers Reports
            </button>
            <button
              onClick={() => setViewMode('events')}
              className={`cursor-pointer px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'events'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Users className="w-4 h-4" />
              Event Attendance
            </button>
          </div>
        </div>

        {/* Sunday Service Reports */}
        {viewMode === 'sunday' && (
          <div className="space-y-6">
            {/* Filter Section - Updated to Flexbox */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Sunday Service Reports
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => printReport('sunday')}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
              
              {/* Sunday Reports Filter Section */}
<div className="flex flex-wrap items-end gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
  
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
      Start Date
    </label>
    <div className="relative">
      <input
        type="date"
        value={dateRange.startDate}
        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
        className="cursor-pointer w-44 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      />
    </div>
  </div>

  {/* End Date */}
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
      End Date
    </label>
    <input
      type="date"
      value={dateRange.endDate}
      onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
      className="cursor-pointer w-44 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
    />
  </div>

  {/* Action Buttons */}
  <div className="flex gap-2">
    <button
      onClick={fetchSundayReports}
      className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all active:scale-95 flex items-center gap-2 shadow-sm whitespace-nowrap"
    >
      <Filter className="w-4 h-4" />
      Generate Report
    </button>

  </div>
</div>
            </div>

            {/* Reports Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {sundayReports.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Sunday Service Reports</h3>
                    <p className="text-gray-600">
                      No Sunday service reports found for the selected date range.
                    </p>
                  </div>
                ) : (
                  sundayReports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                      {/* Report Header */}
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">
                              {report.formattedDate}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{report.eventTitle}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedSunday(report);
                                fetchSundayDetails(report.id);
                                setExpandedReport(expandedReport === report.id ? null : report.id);
                              }}
                              className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {expandedReport === report.id ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  View Details
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => exportSundayReportCSV(report)}
                              className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Export CSV
                            </button>
                          </div>
                        </div>
                        
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Total Workers</p>
                            <p className="text-2xl font-bold text-blue-600">{report.totalWorkers}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Present</p>
                            <p className="text-2xl font-bold text-green-600">{report.present}</p>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Late</p>
                            <p className="text-2xl font-bold text-yellow-600">{report.late}</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Absent</p>
                            <p className="text-2xl font-bold text-red-600">{report.absent}</p>
                          </div>
                          <div className={`p-3 rounded-lg ${
                            report.attendanceRate >= 70 ? 'bg-green-50' :
                            report.attendanceRate >= 50 ? 'bg-yellow-50' : 'bg-red-50'
                          }`}>
                            <p className="text-sm text-gray-600">Attendance Rate</p>
                            <p className={`text-2xl font-bold ${
                              report.attendanceRate >= 70 ? 'text-green-600' :
                              report.attendanceRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {report.attendanceRate}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedReport === report.id && (
                        <div id="sunday-report" className="p-4 border-t border-gray-200">
                          <div className="mb-6">
                            <h4 className="font-semibold text-gray-800 mb-4">Attendance Details</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Ministry
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Check-in Time
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {sundayDetails.map((record, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {record.worker_name}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {record.ministry}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {record.check_in_time
                                          ? new Date(record.check_in_time).toLocaleTimeString('en-US', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              second: '2-digit'
                                            })
                                          : 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                          record.status.status === 'present'
                                            ? 'bg-green-100 text-green-800'
                                            : record.status.status === 'late'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {record.status.text}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Late Workers Reports */}
        {viewMode === 'late' && (
          <div className="space-y-6">
            {/* Filter Section - Updated to Flexbox */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Late Workers Reports
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => printReport('late')}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  {lateWorkers.length > 0 && (
                    <button
                      onClick={exportLateWorkersCSV}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  )}
                </div>
              </div>
              
{/* Main Container: Tight Flexbox layout */}
<div className="flex flex-wrap items-end gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
  
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Start Date
    </label>
    <input
      type="date"
      value={lateDateRange.startDate}
      onChange={(e) => setLateDateRange({ ...lateDateRange, startDate: e.target.value })}
      className="cursor-pointer w-44 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
    />
  </div>

  {/* End Date */}
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      End Date
    </label>
    <input
      type="date"
      value={lateDateRange.endDate}
      onChange={(e) => setLateDateRange({ ...lateDateRange, endDate: e.target.value })}
      className="cursor-pointer w-44 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
    />
  </div>

  {/* Ministry Filter */}
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Ministry
    </label>
    <select
      value={lateMinistryFilter}
      onChange={(e) => setLateMinistryFilter(e.target.value)}
      className="cursor-pointer w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
    >
      <option value="all">All Ministries</option>
      {lateMinistries.map((ministry, index) => (
        <option key={index} value={ministry}>
          {ministry}
        </option>
      ))}
    </select>
  </div>

  {/* Action Buttons: Grouped Together */}
  <div className="flex gap-2">
    <button
      onClick={fetchLateWorkers}
      className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all active:scale-95 flex items-center gap-2 shadow-sm"
    >
      <Filter className="w-4 h-4" />
      Generate Report
    </button>

  </div>
</div>
            </div>

            {/* Late Workers Report */}
            {lateLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div id="late-report" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-800">
                    Late Workers ({lateWorkers.length})
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Showing workers who arrived after 9:00 AM
                  </p>
                </div>
                
                {lateWorkers.length === 0 ? (
                  <div className="p-8 text-center">
                    <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Late Workers</h3>
                    <p className="text-gray-600">
                      No late workers found for the selected criteria.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ministry
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Event Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Event Title
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Check-in Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Minutes Late
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {lateWorkers.map((worker, index) => {
                          const checkInTime = new Date(worker.check_in_time);
                          const hours = checkInTime.getHours();
                          const minutes = checkInTime.getMinutes();
                          const totalMinutes = (hours * 60) + minutes;
                          const minutesLate = Math.max(0, totalMinutes - (9 * 60));
                          
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {worker.worker_name}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                {worker.ministry}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                {worker.formattedDate}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                {worker.event_title}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                {new Date(worker.check_in_time).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                  {minutesLate} mins late
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Event Attendance Reports */}
        {viewMode === 'events' && (
          <div className="space-y-6">
            {/* Filter Section - Updated to Flexbox */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Event Attendance Reports
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => printReport('events')}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
              
              {/* Flexbox container for filter controls */}
             {/* Event Attendance Filter Section */}
<div className="flex flex-wrap items-end gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
  
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
      Start Date
    </label>
    <input
      type="date"
      value={dateRange.startDate}
      onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
      className="cursor-pointer w-44 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
    />
  </div>

  {/* End Date */}
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
      End Date
    </label>
    <input
      type="date"
      value={dateRange.endDate}
      onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
      className="cursor-pointer w-44 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
    />
  </div>

  {/* Action Buttons */}
  <div className="flex gap-2">
    <button
      onClick={fetchEvents}
      className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all active:scale-95 flex items-center gap-2 shadow-sm whitespace-nowrap"
    >
      <Filter className="w-4 h-4" />
      Generate Report
    </button>

  </div>
</div>
            </div>

            {/* Events Grid */}
            {eventLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Events Found</h3>
                    <p className="text-gray-600">
                      No approved events found for the selected date range.
                    </p>
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                      {/* Event Header */}
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800">
                              {event.title}
                            </h3>
                            <div className="flex flex-wrap gap-4 mt-2">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span className="text-sm">{event.formattedDate}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm">{event.formattedTime}</span>
                              </div>
                              {event.place && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span className="text-sm">📍 {event.place}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedEvent(event);
                                fetchEventAttendance(event.id);
                                setExpandedReport(expandedReport === event.id ? null : event.id);
                              }}
                              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {expandedReport === event.id ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Hide Attendance
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  View Attendance
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => exportEventAttendanceCSV(event)}
                              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Export CSV
                            </button>
                          </div>
                        </div>
                        
                        {/* Event Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Total Workers</p>
                            <p className="text-2xl font-bold text-blue-600">{event.scanned + event.pending}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Checked In</p>
                            <p className="text-2xl font-bold text-green-600">{event.scanned}</p>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600">{event.pending}</p>
                          </div>
                          <div className={`p-3 rounded-lg ${
                            event.rate >= 70 ? 'bg-green-50' :
                            event.rate >= 50 ? 'bg-yellow-50' : 'bg-red-50'
                          }`}>
                            <p className="text-sm text-gray-600">Attendance Rate</p>
                            <p className={`text-2xl font-bold ${
                              event.rate >= 70 ? 'text-green-600' :
                              event.rate >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {event.rate}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Attendance Details */}
                      {expandedReport === event.id && (
                        <div id="events-report" className="p-4 border-t border-gray-200">
                          <div className="mb-6">
                            <h4 className="font-semibold text-gray-800 mb-4">Attendance Details</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Ministry
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Check-in Time
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Scan Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {eventAttendance.map((record, index) => {
                                    const status = getAttendanceStatus(record.check_in_time);
                                    return (
                                      <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {record.worker_name}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                          {record.ministry}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                          {record.check_in_time
                                            ? new Date(record.check_in_time).toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                              })
                                            : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800' :
                                            record.scan_type === 'manual' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {record.scan_type}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
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
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}