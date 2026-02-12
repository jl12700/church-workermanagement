import { useState, useEffect, useMemo } from 'react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import { Download, X, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const calculateAttendanceStatus = (checkInTime, eventStartTime, eventType) => {
  if (!checkInTime) return { status: 'absent', label: 'Absent', color: 'red' };
  
  const time = new Date(checkInTime);
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const totalMinutes = (hours * 60) + minutes;
  
  if (eventType === 'sunday_service') {
    if (totalMinutes >= 360 && totalMinutes < 540) {
      return { status: 'present', label: 'Present', color: 'green' };
    } else if (totalMinutes >= 540 && totalMinutes < 555) {
      return { status: 'late', label: 'Late', color: 'yellow' };
    } else {
      return { status: 'absent', label: 'Absent', color: 'red' };
    }
  }
  
  if (eventStartTime) {
    const [startHour, startMinute] = eventStartTime.split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    const minutesLate = totalMinutes - startTotalMinutes;
    
    if (minutesLate <= 15) {
      return { status: 'present', label: 'Present', color: 'green' };
    } else if (minutesLate <= 30) {
      return { status: 'late', label: 'Late', color: 'yellow' };
    } else {
      return { status: 'absent', label: 'Absent', color: 'red' };
    }
  }
  
  return { status: 'present', label: 'Present', color: 'green' };
};

const getStatusBadge = (status) => {
  switch(status) {
    case 'present':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'late':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'absent':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const EVENT_TYPES = {
  sunday_service: { label: 'Sunday Service', color: 'bg-purple-50 text-purple-700' },
  prayer_meeting: { label: 'Prayer Meeting', color: 'bg-blue-50 text-blue-700' },
  bible_study: { label: 'Bible Study', color: 'bg-green-50 text-green-700' },
  meet: { label: 'Meeting / Setup', color: 'bg-orange-50 text-orange-700' },
  outreach: { label: 'Workers Conference', color: 'bg-red-50 text-red-700' },
  church_event: { label: 'Church Event', color: 'bg-indigo-50 text-indigo-700' }
};

// ============================================================================
// SUBCOMPONENT: Export Button
// ============================================================================
const ExportButton = ({ onClick, loading, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
  >
    {loading ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
    ) : (
      <Download className="w-3.5 h-3.5 mr-1" />
    )}
    {children || 'Export CSV'}
  </button>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Reports() {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  
  const [viewMode, setViewMode] = useState('sunday');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  const [allWorkers, setAllWorkers] = useState([]);
  const [sundayReports, setSundayReports] = useState([]);
  const [eventReports, setEventReports] = useState([]);
  const [lateWorkers, setLateWorkers] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [attendanceDetails, setAttendanceDetails] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [ministryFilter, setMinistryFilter] = useState('all');
  const [ministries, setMinistries] = useState([]);
  
  // Sorting state
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = latest first, 'asc' = oldest first

  // ========================================
  // DATA FETCHING (unchanged)
  // ========================================
  
  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('status', 'Active')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      setAllWorkers(data || []);
      const uniqueMinistries = [...new Set(data?.map(w => w.ministry).filter(Boolean))];
      setMinistries(uniqueMinistries.sort());
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };
  
  const fetchSundayReports = async () => {
    setLoading(true);
    try {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate)
        .order('event_date', { ascending: false });
      
      if (eventsError) throw eventsError;
      
      const reports = await Promise.all(
        (events || []).map(async (event) => {
          const { data: attendance, error: attError } = await supabase
            .from('event_attendance')
            .select(`
              *,
              worker:workers(*)
            `)
            .eq('event_id', event.id);
          
          if (attError) throw attError;
          
          const totalWorkers = allWorkers.length;
          let presentCount = 0;
          let lateCount = 0;
          let absentFromLate = 0;
          
          (attendance || []).forEach(record => {
            const status = calculateAttendanceStatus(
              record.check_in_time, 
              event.start_time, 
              event.type
            );
            if (status.status === 'present') presentCount++;
            else if (status.status === 'late') lateCount++;
            else if (status.status === 'absent') absentFromLate++;
          });
          
          const scannedCount = attendance?.length || 0;
          const notScanned = Math.max(0, totalWorkers - scannedCount);
          const totalAbsent = notScanned + absentFromLate;
          const attendanceRate = totalWorkers > 0 
            ? ((presentCount + lateCount) / totalWorkers) * 100 
            : 0;
          
          return {
            id: event.id,
            date: event.event_date,
            formattedDate: format(parseISO(event.event_date), 'EEEE, MMMM d, yyyy'),
            shortDate: format(parseISO(event.event_date), 'MMM d, yyyy'),
            title: event.title,
            totalWorkers,
            present: presentCount,
            late: lateCount,
            absent: totalAbsent,
            scanned: scannedCount,
            attendanceRate: parseFloat(attendanceRate.toFixed(1)),
            attendanceRecords: attendance || []
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
  
  const fetchEventReports = async () => {
    setLoading(true);
    try {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .neq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate)
        .order('event_date', { ascending: false });
      
      if (eventsError) throw eventsError;
      
      const reports = await Promise.all(
        (events || []).map(async (event) => {
          const { data: attendance, error: attError } = await supabase
            .from('event_attendance')
            .select(`
              *,
              worker:workers(*)
            `)
            .eq('event_id', event.id);
          
          if (attError) throw attError;
          
          const totalWorkers = allWorkers.length;
          const scannedCount = attendance?.length || 0;
          const pending = Math.max(0, totalWorkers - scannedCount);
          const attendanceRate = totalWorkers > 0 
            ? (scannedCount / totalWorkers) * 100 
            : 0;
          
          return {
            id: event.id,
            date: event.event_date,
            formattedDate: format(parseISO(event.event_date), 'EEEE, MMMM d, yyyy'),
            shortDate: format(parseISO(event.event_date), 'MMM d, yyyy'),
            title: event.title,
            type: event.type,
            place: event.place,
            startTime: event.start_time,
            endTime: event.end_time,
            totalWorkers,
            scanned: scannedCount,
            pending,
            attendanceRate: parseFloat(attendanceRate.toFixed(1)),
            attendanceRecords: attendance || []
          };
        })
      );
      
      setEventReports(reports);
    } catch (error) {
      console.error('Error fetching event reports:', error);
      alert('Failed to load event attendance reports');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchLateWorkers = async () => {
    setLoading(true);
    try {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate);
      
      if (eventsError) throw eventsError;
      
      const lateRecords = [];
      
      for (const event of (events || [])) {
        const { data: attendance, error: attError } = await supabase
          .from('event_attendance')
          .select(`
            *,
            worker:workers(*)
          `)
          .eq('event_id', event.id);
        
        if (attError) throw attError;
        
        (attendance || []).forEach(record => {
          const status = calculateAttendanceStatus(
            record.check_in_time,
            event.start_time,
            event.type
          );
          
          if (status.status === 'late' && record.worker) {
            const checkInTime = new Date(record.check_in_time);
            const hours = checkInTime.getHours();
            const minutes = checkInTime.getMinutes();
            const totalMinutes = (hours * 60) + minutes;
            const minutesLate = Math.max(0, totalMinutes - (9 * 60));
            
            lateRecords.push({
              id: record.id,
              workerName: record.worker.name,
              ministry: record.worker.ministry,
              eventDate: event.event_date,
              eventTitle: event.title,
              formattedDate: format(parseISO(event.event_date), 'MMM d, yyyy'),
              checkInTime: record.check_in_time,
              minutesLate,
              status
            });
          }
        });
      }
      
      setLateWorkers(lateRecords);
    } catch (error) {
      console.error('Error fetching late workers:', error);
      alert('Failed to load late workers report');
    } finally {
      setLoading(false);
    }
  };
  
  const loadAttendanceDetails = (report) => {
    setSelectedReport(prev => prev?.id === report.id ? null : report);
    
    if (report.attendanceRecords) {
      const details = report.attendanceRecords.map(record => {
        const status = calculateAttendanceStatus(
          record.check_in_time,
          report.startTime,
          report.type || 'sunday_service'
        );
        
        return {
          ...record,
          workerName: record.worker?.name || 'Unknown',
          ministry: record.worker?.ministry || 'N/A',
          status
        };
      });
      
      setAttendanceDetails(details);
    }
  };

  // ========================================
  // EXPORT FUNCTIONS (unchanged)
  // ========================================
  
  const exportToCSV = (report, details) => {
    setExporting(true);
    
    try {
      const headers = ['Name', 'Ministry', 'Check-in Time', 'Status', 'Event Date'];
      const rows = [headers.join(',')];
      
      details.forEach(record => {
        const row = [
          `"${record.workerName}"`,
          `"${record.ministry}"`,
          `"${new Date(record.check_in_time).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}"`,
          `"${record.status.label}"`,
          `"${report.formattedDate}"`
        ];
        rows.push(row.join(','));
      });
      
      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.type || 'sunday-service'}-${report.date}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };
  
  const exportLateWorkersCSV = () => {
    setExporting(true);
    
    try {
      const headers = ['Name', 'Ministry', 'Event Date', 'Event Title', 'Check-in Time', 'Minutes Late'];
      const rows = [headers.join(',')];
      
      filteredLateWorkers.forEach(worker => {
        const row = [
          `"${worker.workerName}"`,
          `"${worker.ministry}"`,
          `"${worker.formattedDate}"`,
          `"${worker.eventTitle}"`,
          `"${new Date(worker.checkInTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}"`,
          `"${worker.minutesLate} minutes"`
        ];
        rows.push(row.join(','));
      });
      
      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `late-workers-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  // ========================================
  // FILTERING & SORTING
  // ========================================
  
  // Toggle sort order
  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };
  
  // Filtered and sorted reports
  const filteredReports = useMemo(() => {
    let reports = viewMode === 'sunday' ? sundayReports : eventReports;
    
    if (eventTypeFilter !== 'all') {
      reports = reports.filter(r => r.type === eventTypeFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      reports = reports.filter(r => 
        r.title.toLowerCase().includes(search) ||
        r.formattedDate.toLowerCase().includes(search)
      );
    }
    
    // Sort by date
    return [...reports].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [viewMode, sundayReports, eventReports, eventTypeFilter, searchTerm, sortOrder]);
  
  const filteredLateWorkers = useMemo(() => {
    let workers = lateWorkers;
    
    if (ministryFilter !== 'all') {
      workers = workers.filter(w => w.ministry === ministryFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      workers = workers.filter(w =>
        w.workerName.toLowerCase().includes(search) ||
        w.ministry.toLowerCase().includes(search)
      );
    }
    
    return workers;
  }, [lateWorkers, ministryFilter, searchTerm]);

  // ========================================
  // EFFECTS (unchanged)
  // ========================================
  
  useEffect(() => {
    fetchWorkers();
  }, []);
  
  useEffect(() => {
    if (allWorkers.length > 0) {
      switch (viewMode) {
        case 'sunday':
          fetchSundayReports();
          break;
        case 'events':
          fetchEventReports();
          break;
        case 'late':
          fetchLateWorkers();
          break;
      }
    }
  }, [viewMode, dateRange, allWorkers]);

  // ========================================
  // RENDER — enhanced with depth, compact dates, sorting
  // ========================================
  
  return (
    <SidebarLayout>
      <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 md:p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Attendance Reports</h1>
          <p className="text-sm text-gray-500 mt-1">View and export attendance records</p>
        </div>

        {/* View Mode Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setViewMode('sunday')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 ${
                viewMode === 'sunday'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sunday Service
            </button>
            <button
              onClick={() => setViewMode('events')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 ${
                viewMode === 'events'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Event Attendance
            </button>
            <button
              onClick={() => setViewMode('late')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 ${
                viewMode === 'late'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Late Workers
            </button>
          </nav>
        </div>

        {/* Filters — compact, with shadow and border */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* Date range — reduced width */}
            <div className="flex flex-col w-full md:w-auto md:max-w-[160px]">
              <label className="text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full"
              />
            </div>
            <div className="flex flex-col w-full md:w-auto md:max-w-[160px]">
              <label className="text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full"
              />
            </div>

            {/* Event Type Filter (events view) */}
            {viewMode === 'events' && (
              <div className="flex flex-col w-full md:w-auto md:min-w-[160px]">
                <label className="text-xs font-medium text-gray-500 mb-1">Event Type</label>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full"
                >
                  <option value="all">All Types</option>
                  {Object.entries(EVENT_TYPES)
                    .filter(([key]) => key !== 'sunday_service')
                    .map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))
                  }
                </select>
              </div>
            )}

            {/* Ministry Filter (late workers view) */}
            {viewMode === 'late' && (
              <div className="flex flex-col w-full md:w-auto md:min-w-[160px]">
                <label className="text-xs font-medium text-gray-500 mb-1">Ministry</label>
                <select
                  value={ministryFilter}
                  onChange={(e) => setMinistryFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full"
                >
                  <option value="all">All Ministries</option>
                  {ministries.map(ministry => (
                    <option key={ministry} value={ministry}>{ministry}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-500 mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className=" border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* SUNDAY & EVENT REPORTS — table with sortable date */}
            {(viewMode === 'sunday' || viewMode === 'events') && (
              <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {/* Date column with sort toggle */}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={toggleSort}
                          className="flex items-center gap-1 hover:text-gray-700"
                        >
                          Date
                          {sortOrder === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                      {viewMode === 'events' && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                      {viewMode === 'sunday' && (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                        </>
                      )}
                      {viewMode === 'events' && (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scanned</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                        </>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReports.length === 0 ? (
                      <tr>
                        <td colSpan={viewMode === 'sunday' ? 9 : 10} className="px-4 py-8 text-center text-gray-500">
                          No reports found for the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredReports.map((report) => (
                        <>
                          {/* Main report row */}
                          <tr key={report.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                              {report.shortDate}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                              {report.title}
                            </td>
                            {viewMode === 'events' && (
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-md ${EVENT_TYPES[report.type]?.color || 'bg-gray-100 text-gray-800'}`}>
                                  {EVENT_TYPES[report.type]?.label || report.type}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.totalWorkers}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.present || report.scanned}</td>
                            {viewMode === 'sunday' && (
                              <>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.late}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.absent}</td>
                              </>
                            )}
                            {viewMode === 'events' && (
                              <>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.scanned}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.pending}</td>
                              </>
                            )}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                                report.attendanceRate >= 70 ? 'bg-green-50 text-green-700' :
                                report.attendanceRate >= 50 ? 'bg-yellow-50 text-yellow-700' :
                                'bg-red-50 text-red-700'
                              }`}>
                                {report.attendanceRate}%
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => loadAttendanceDetails(report)}
                                  className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 px-2 py-1 rounded-md bg-white hover:bg-gray-50 shadow-sm"
                                >
                                  {selectedReport?.id === report.id ? 'Hide' : 'View'}
                                </button>
                                <ExportButton
                                  onClick={() => exportToCSV(report, report.attendanceRecords.map(r => ({
                                    ...r,
                                    workerName: r.worker?.name || 'Unknown',
                                    ministry: r.worker?.ministry || 'N/A',
                                    status: calculateAttendanceStatus(r.check_in_time, report.startTime, report.type || 'sunday_service')
                                  })))}
                                  loading={exporting}
                                  disabled={report.attendanceRecords.length === 0}
                                >
                                  Export
                                </ExportButton>
                              </div>
                            </td>
                          </tr>
                          {/* Expanded attendance details row */}
                          {selectedReport?.id === report.id && (
                            <tr className="bg-gray-50">
                              <td colSpan={viewMode === 'sunday' ? 9 : 10} className="px-4 py-4">
                                <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
                                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                    <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                                      Attendance Records ({attendanceDetails.length})
                                    </h4>
                                  </div>
                                  {attendanceDetails.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-gray-500 text-sm">
                                      No attendance records
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Name</th>
                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Ministry</th>
                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Check-in</th>
                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Scan Type</th>
                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {attendanceDetails.map((record, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                              <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                                {record.workerName}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                                {record.ministry}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                                {new Date(record.check_in_time).toLocaleTimeString('en-US', {
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                                                  record.scan_type === 'qr' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                                }`}>
                                                  {(record.scan_type || 'qr').toUpperCase()}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-md border ${getStatusBadge(record.status.status)}`}>
                                                  {record.status.label}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* LATE WORKERS REPORT — table with depth */}
            {viewMode === 'late' && (
              <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-gray-700">Late Workers Report</h3>
                  <ExportButton
                    onClick={exportLateWorkersCSV}
                    loading={exporting}
                    disabled={filteredLateWorkers.length === 0}
                  >
                    Export CSV
                  </ExportButton>
                </div>
                {filteredLateWorkers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No late workers found for the selected criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Title</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minutes Late</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredLateWorkers.map((worker, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{worker.workerName}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{worker.ministry}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{worker.formattedDate}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{worker.eventTitle}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {new Date(worker.checkInTime).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-md bg-yellow-50 text-yellow-700 border border-yellow-200">
                                {worker.minutesLate} min
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SidebarLayout>
  );
}