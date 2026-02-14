import { useState, useEffect, useMemo } from 'react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import { Download, X, Loader2, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isBefore, startOfDay } from 'date-fns';

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

// Ministry categories for grouping
const MINISTRY_CATEGORIES = [
  'Preacher',
  'Teacher',
  'Worship Team',
  'Tech-Prod',
  'Faces',
  'C-CUBE',
  'Comrades'
];

// Function to group attendance by ministry
const groupAttendanceByMinistry = (attendanceDetails, allWorkers) => {
  const ministryStats = {};
  
  // Initialize all categories
  MINISTRY_CATEGORIES.forEach(ministry => {
    ministryStats[ministry] = {
      total: 0,
      present: 0,
      late: 0,
      absent: 0
    };
  });
  
  // Count total workers per ministry
  allWorkers.forEach(worker => {
    if (MINISTRY_CATEGORIES.includes(worker.ministry)) {
      ministryStats[worker.ministry].total++;
    }
  });
  
  // Count attendance per ministry
  attendanceDetails.forEach(record => {
    const ministry = record.ministry;
    if (MINISTRY_CATEGORIES.includes(ministry)) {
      if (record.status.status === 'present') {
        ministryStats[ministry].present++;
      } else if (record.status.status === 'late') {
        ministryStats[ministry].late++;
      } else if (record.status.status === 'absent') {
        ministryStats[ministry].absent++;
      }
    }
  });
  
  // Calculate absent workers (those who didn't scan)
  allWorkers.forEach(worker => {
    const ministry = worker.ministry;
    if (MINISTRY_CATEGORIES.includes(ministry)) {
      const scanned = attendanceDetails.find(r => r.worker_id === worker.id);
      if (!scanned) {
        ministryStats[ministry].absent++;
      }
    }
  });
  
  return ministryStats;
};

// ============================================================================
// SUBCOMPONENT: Tooltip Wrapper
// ============================================================================
const Tooltip = ({ children, message, show }) => {
  if (!show) return children;
  
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
        {message}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

// ============================================================================
// SUBCOMPONENT: Export Button
// ============================================================================
const ExportButton = ({ onClick, loading, disabled, children, disabledMessage }) => (
  <Tooltip message={disabledMessage} show={disabled && disabledMessage}>
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md shadow-sm transition-colors ${
        disabled || loading
          ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'border-gray-300 text-white bg-green-800 hover:bg-green-700 cursor-pointer'
      }`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
      ) : (
        <Download className="w-3.5 h-3.5 mr-1" />
      )}
      {children || 'Export CSV'}
    </button>
  </Tooltip>
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
  const [sortOrder, setSortOrder] = useState('desc');

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  
  // Check if event has started (based on event_date)
  const hasEventStarted = (eventDate) => {
    const today = startOfDay(new Date());
    const eventDay = startOfDay(parseISO(eventDate));
    return !isBefore(today, eventDay); // Event has started if today is on or after event date
  };

  // ========================================
  // DATA FETCHING
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
            attendanceRecords: attendance || [],
            totalAttendees: event.total_attendees,
            totalVisitors: event.total_visitors,
            totalBaptized: event.total_baptized,
            isEnded: event.is_ended,
            hasStarted: hasEventStarted(event.event_date)
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
            type: event.type,
            place: event.place,
            startTime: event.start_time,
            endTime: event.end_time,
            totalWorkers,
            present: presentCount,
            late: lateCount,
            absent: totalAbsent,
            scanned: scannedCount,
            pending: Math.max(0, totalWorkers - scannedCount),
            attendanceRate: parseFloat(attendanceRate.toFixed(1)),
            attendanceRecords: attendance || [],
            totalAttendees: event.total_attendees,
            totalVisitors: event.total_visitors,
            totalBaptized: event.total_baptized,
            isEnded: event.is_ended,
            hasStarted: hasEventStarted(event.event_date)
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
  // EXPORT FUNCTIONS
  // ========================================
  
  const exportToCSV = (report, details) => {
    setExporting(true);
    
    try {
      const headers = ['Name', 'Ministry', 'Check-in Time', 'Status', 'Event Date'];
      
      if (report.isEnded && (report.totalAttendees != null || report.totalVisitors != null || report.totalBaptized != null)) {
        headers.push('Total Attendees', 'Total Visitors', 'Total Baptized');
      }
      
      const rows = [headers.join(',')];
      
      if (details.length === 0 && report.isEnded) {
        const row = [
          '"No attendance records"',
          '"N/A"',
          '"N/A"',
          '"N/A"',
          `"${report.formattedDate}"`
        ];
        
        if (report.isEnded && (report.totalAttendees != null || report.totalVisitors != null || report.totalBaptized != null)) {
          row.push(
            report.totalAttendees != null ? report.totalAttendees : 'N/A',
            report.totalVisitors != null ? report.totalVisitors : 'N/A',
            report.totalBaptized != null ? report.totalBaptized : 'N/A'
          );
        }
        
        rows.push(row.join(','));
      } else {
        details.forEach((record, index) => {
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
          
          if (index === 0 && report.isEnded && (report.totalAttendees != null || report.totalVisitors != null || report.totalBaptized != null)) {
            row.push(
              report.totalAttendees != null ? report.totalAttendees : 'N/A',
              report.totalVisitors != null ? report.totalVisitors : 'N/A',
              report.totalBaptized != null ? report.totalBaptized : 'N/A'
            );
          } else if (report.isEnded && (report.totalAttendees != null || report.totalVisitors != null || report.totalBaptized != null)) {
            row.push('', '', '');
          }
          
          rows.push(row.join(','));
        });
        
        // Add ministry summary section
        rows.push(''); // Empty line
        rows.push('Ministry Summary');
        rows.push('Ministry,Total Workers,Present,Late,Absent');
        
        const ministryStats = groupAttendanceByMinistry(details, allWorkers);
        MINISTRY_CATEGORIES.forEach(ministry => {
          const stats = ministryStats[ministry];
          rows.push(`"${ministry}",${stats.total},${stats.present},${stats.late},${stats.absent}`);
        });
      }
      
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
  
  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };
  
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
  // EFFECTS
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
  // RENDER
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

        {/* Filters */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
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

            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-500 mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
            {/* SUNDAY & EVENT REPORTS */}
            {(viewMode === 'sunday' || viewMode === 'events') && (
              <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      {/* Grouped Headers */}
                      <tr className="border-b border-gray-300">
                        <th 
                          colSpan={viewMode === 'sunday' ? 2 : 3}
                          className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300"
                        >
                          General
                        </th>
                        <th 
                          colSpan={5}
                          className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300"
                        >
                          Worker Attendance
                        </th>
                        <th 
                          colSpan={3}
                          className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300"
                        >
                          Congregation Attendance
                        </th>
                        <th 
                          colSpan={1}
                          className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                      {/* Column Headers */}
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Event</th>
                        {viewMode === 'events' && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Type</th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total No. of Workers</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Rate</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendees</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visitors</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Baptized</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredReports.length === 0 ? (
                        <tr>
                          <td colSpan={viewMode === 'sunday' ? 11 : 12} className="px-4 py-8 text-center text-gray-500">
                            No reports found for the selected criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredReports.map((report) => (
                          <>
                            <tr key={report.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-gray-900 border-r border-gray-100">
                                {report.shortDate}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 border-r border-gray-100">
                                {report.title}
                              </td>
                              {viewMode === 'events' && (
                                <td className="px-4 py-3 whitespace-nowrap border-r border-gray-100">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-md ${EVENT_TYPES[report.type]?.color || 'bg-gray-100 text-gray-800'}`}>
                                    {EVENT_TYPES[report.type]?.label || report.type}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.totalWorkers}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.present}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.late}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{report.absent}</td>
                              <td className="px-4 py-3 whitespace-nowrap border-r border-gray-100">
                                <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                                  report.attendanceRate >= 70 ? 'bg-green-50 text-green-700' :
                                  report.attendanceRate >= 50 ? 'bg-yellow-50 text-yellow-700' :
                                  'bg-red-50 text-red-700'
                                }`}>
                                  {report.attendanceRate}%
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                {report.totalAttendees != null ? report.totalAttendees : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                {report.totalVisitors != null ? report.totalVisitors : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700 border-r border-gray-100">
                                {report.totalBaptized != null ? report.totalBaptized : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Tooltip 
                                    message={!report.hasStarted ? "Event has not started yet" : ""}
                                    show={!report.hasStarted}
                                  >
                                    <button
                                      onClick={() => report.hasStarted && loadAttendanceDetails(report)}
                                      disabled={!report.hasStarted}
                                      className={`text-xs text-black border px-3 py-1.5 rounded-md shadow-sm min-w-[60px] text-center font-medium transition-colors ${
                                        !report.hasStarted
                                          ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'cursor-pointer border-blue-600 bg-blue-600 hover:bg-blue-700'
                                      }`}
                                    >
                                      {selectedReport?.id === report.id ? 'Hide' : 'View'}
                                    </button>
                                  </Tooltip>
                                  <ExportButton
                                    onClick={() => exportToCSV(report, report.attendanceRecords.map(r => ({
                                      ...r,
                                      workerName: r.worker?.name || 'Unknown',
                                      ministry: r.worker?.ministry || 'N/A',
                                      status: calculateAttendanceStatus(r.check_in_time, report.startTime, report.type || 'sunday_service')
                                    })))}
                                    loading={exporting}
                                    disabled={!report.isEnded && report.attendanceRecords.length === 0}
                                    disabledMessage={
                                      !report.isEnded && report.attendanceRecords.length === 0
                                        ? "No records available yet"
                                        : ""
                                    }
                                  >
                                    Export CSV
                                  </ExportButton>
                                </div>
                              </td>
                            </tr>
                            {selectedReport?.id === report.id && (
                              <tr className="bg-gray-50">
                                <td colSpan={viewMode === 'sunday' ? 11 : 12} className="px-4 py-4">
                                  <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
                                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                      <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Ministry Attendance Summary
                                      </h4>
                                    </div>
                                    {attendanceDetails.length === 0 ? (
                                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                                        No attendance records
                                      </div>
                                    ) : (
                                      <div className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                          {(() => {
                                            const ministryStats = groupAttendanceByMinistry(attendanceDetails, allWorkers);
                                            return MINISTRY_CATEGORIES.map(ministry => {
                                              const stats = ministryStats[ministry];
                                              const presentAndLate = stats.present + stats.late;
                                              const percentage = stats.total > 0 
                                                ? ((presentAndLate / stats.total) * 100).toFixed(0) 
                                                : 0;
                                              
                                              return (
                                                <div 
                                                  key={ministry}
                                                  className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                                                >
                                                  <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-semibold text-gray-900 text-sm">{ministry}</h5>
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                                                      percentage >= 80 ? 'bg-green-100 text-green-800' :
                                                      percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                                      'bg-red-100 text-red-800'
                                                    }`}>
                                                      {percentage}%
                                                    </span>
                                                  </div>
                                                  <div className="text-lg font-bold text-gray-900 mb-2">
                                                    {presentAndLate} / {stats.total} Workers Present
                                                  </div>
                                                  <div className="flex gap-3 text-xs">
                                                    <div className="flex items-center gap-1">
                                                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                      <span className="text-gray-600">Present: {stats.present}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                      <span className="text-gray-600">Late: {stats.late}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                      <span className="text-gray-600">Absent: {stats.absent}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            });
                                          })()}
                                        </div>
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
              </div>
            )}

            {/* LATE WORKERS REPORT */}
            {viewMode === 'late' && (
              <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-gray-700">Late Workers Report</h3>
                  <ExportButton
                    onClick={exportLateWorkersCSV}
                    loading={exporting}
                    disabled={filteredLateWorkers.length === 0}
                    disabledMessage={filteredLateWorkers.length === 0 ? "No late workers to export" : ""}
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