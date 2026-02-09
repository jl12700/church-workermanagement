import { useState, useEffect, useMemo } from 'react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import { 
  Download, 
  Calendar, 
  Users, 
  Clock,
  FileText,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Filter,
  X,
  ChevronRight,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate attendance status based on check-in time and event type
 * Sunday Service: 6AM-9AM = Present, 9AM-9:15AM = Late, After 9:15AM = Absent
 * Other Events: On-time/15min = Present, 16-30min = Late, 30min+ = Absent
 */
const calculateAttendanceStatus = (checkInTime, eventStartTime, eventType) => {
  if (!checkInTime) return { status: 'absent', label: 'Absent', color: 'red' };
  
  const time = new Date(checkInTime);
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const totalMinutes = (hours * 60) + minutes;
  
  // Sunday Service specific logic
  if (eventType === 'sunday_service') {
    if (totalMinutes >= 360 && totalMinutes < 540) {
      return { status: 'present', label: 'Present', color: 'green' };
    } else if (totalMinutes >= 540 && totalMinutes < 555) {
      return { status: 'late', label: 'Late', color: 'yellow' };
    } else {
      return { status: 'absent', label: 'Absent', color: 'red' };
    }
  }
  
  // Other event types - compare with event start time
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

/**
 * Get status badge styling
 */
const getStatusBadge = (status) => {
  switch(status) {
    case 'present':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'late':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'absent':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Event type configuration with labels and colors
 */
const EVENT_TYPES = {
  sunday_service: { label: 'Sunday Service', color: 'bg-purple-100 text-purple-800', icon: '⛪' },
  prayer_meeting: { label: 'Prayer Meeting', color: 'bg-blue-100 text-blue-800', icon: '🙏' },
  bible_study: { label: 'Bible Study', color: 'bg-green-100 text-green-800', icon: '📖' },
  meet: { label: 'Meeting / Setup', color: 'bg-orange-100 text-orange-800', icon: '📋' },
  outreach: { label: 'Workers Conference', color: 'bg-red-100 text-red-800', icon: '🎯' },
  church_event: { label: 'Church Event', color: 'bg-indigo-100 text-indigo-800', icon: '🎉' }
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

/**
 * Summary Statistics Card Component
 */
const StatCard = ({ icon: Icon, label, value, trend, color = 'blue' }) => {
  const colorClasses = {
    blue: 'from-blue-600 to-blue-700',
    green: 'from-green-600 to-green-700',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-600 to-red-700',
    purple: 'from-purple-600 to-purple-700',
    indigo: 'from-indigo-600 to-indigo-700'
  };
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 text-white shadow-lg transform hover:scale-105 transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className="bg-white bg-opacity-20 p-3 rounded-xl">
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-semibold">
            <TrendingUp className="w-4 h-4" />
            {trend}
          </div>
        )}
      </div>
      <p className="text-sm text-white text-opacity-90 font-medium mb-1">{label}</p>
      <p className="text-4xl font-extrabold">{value}</p>
    </div>
  );
};

/**
 * Simple Bar Chart Component
 */
const SimpleBarChart = ({ data, title, xKey, yKey, color = 'blue' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No data available</p>
        </div>
      </div>
    );
  }
  
  const maxValue = Math.max(...data.map(d => d[yKey]));
  
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    orange: 'bg-orange-600'
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">{title}</h3>
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{item[xKey]}</span>
              <span className="font-bold text-gray-900">{item[yKey]}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
                style={{ width: `${(item[yKey] / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Export Button Component
 */
const ExportButton = ({ onClick, loading, type = 'CSV' }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {loading ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <Download className="w-4 h-4" />
    )}
    Export {type}
  </button>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Reports() {
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  
  const [viewMode, setViewMode] = useState('sunday'); // 'sunday', 'late', 'events'
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Date range state
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  // Data state
  const [allWorkers, setAllWorkers] = useState([]);
  const [sundayReports, setSundayReports] = useState([]);
  const [eventReports, setEventReports] = useState([]);
  const [lateWorkers, setLateWorkers] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [attendanceDetails, setAttendanceDetails] = useState([]);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [ministryFilter, setMinistryFilter] = useState('all');
  const [ministries, setMinistries] = useState([]);
  
  // Summary statistics
  const [summaryStats, setSummaryStats] = useState({
    totalEvents: 0,
    totalAttendance: 0,
    averageAttendance: 0,
    attendanceRate: 0
  });

  // ========================================
  // DATA FETCHING
  // ========================================
  
  /**
   * Fetch all active workers and extract ministries
   */
  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('status', 'Active')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      setAllWorkers(data || []);
      
      // Extract unique ministries
      const uniqueMinistries = [...new Set(data?.map(w => w.ministry).filter(Boolean))];
      setMinistries(uniqueMinistries.sort());
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };
  
  /**
   * Fetch Sunday Service Reports
   * FIXED: Now properly queries event_attendance table
   */
  const fetchSundayReports = async () => {
    setLoading(true);
    try {
      // Get Sunday service events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate)
        .order('event_date', { ascending: false });
      
      if (eventsError) throw eventsError;
      
      // FIXED: Query event_attendance with worker join for each event
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
          
          // Calculate statistics with proper status calculation
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
      
      // Calculate summary stats
      const totalEvents = reports.length;
      const totalAttendance = reports.reduce((sum, r) => sum + r.scanned, 0);
      const avgAttendance = totalEvents > 0 ? totalAttendance / totalEvents : 0;
      const avgRate = totalEvents > 0 
        ? reports.reduce((sum, r) => sum + r.attendanceRate, 0) / totalEvents 
        : 0;
      
      setSummaryStats({
        totalEvents,
        totalAttendance,
        averageAttendance: Math.round(avgAttendance),
        attendanceRate: parseFloat(avgRate.toFixed(1))
      });
      
    } catch (error) {
      console.error('Error fetching Sunday reports:', error);
      alert('Failed to load Sunday service reports');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Fetch Event Attendance Reports (all events EXCEPT Sunday Service)
   * FIXED: Now includes all event types except sunday_service
   */
  const fetchEventReports = async () => {
    setLoading(true);
    try {
      // Get all events EXCEPT sunday_service
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .neq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate)
        .order('event_date', { ascending: false });
      
      if (eventsError) throw eventsError;
      
      // FIXED: Query event_attendance with worker join for each event
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
          
          // Calculate statistics
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
      
      // Calculate summary stats
      const totalEvents = reports.length;
      const totalAttendance = reports.reduce((sum, r) => sum + r.scanned, 0);
      const avgAttendance = totalEvents > 0 ? totalAttendance / totalEvents : 0;
      const avgRate = totalEvents > 0 
        ? reports.reduce((sum, r) => sum + r.attendanceRate, 0) / totalEvents 
        : 0;
      
      setSummaryStats({
        totalEvents,
        totalAttendance,
        averageAttendance: Math.round(avgAttendance),
        attendanceRate: parseFloat(avgRate.toFixed(1))
      });
      
    } catch (error) {
      console.error('Error fetching event reports:', error);
      alert('Failed to load event attendance reports');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Fetch Late Workers Report
   * FIXED: Now properly queries event_attendance table
   */
  const fetchLateWorkers = async () => {
    setLoading(true);
    try {
      // Get Sunday service events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'sunday_service')
        .eq('status', 'approved')
        .gte('event_date', dateRange.startDate)
        .lte('event_date', dateRange.endDate);
      
      if (eventsError) throw eventsError;
      
      const lateRecords = [];
      
      // FIXED: Query event_attendance for each event
      for (const event of (events || [])) {
        const { data: attendance, error: attError } = await supabase
          .from('event_attendance')
          .select(`
            *,
            worker:workers(*)
          `)
          .eq('event_id', event.id);
        
        if (attError) throw attError;
        
        // Filter for late arrivals
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
      
      // Calculate summary stats
      setSummaryStats({
        totalEvents: events?.length || 0,
        totalLateInstances: lateRecords.length,
        uniqueWorkers: new Set(lateRecords.map(r => r.workerName)).size,
        averageLateMinutes: lateRecords.length > 0
          ? Math.round(lateRecords.reduce((sum, r) => sum + r.minutesLate, 0) / lateRecords.length)
          : 0
      });
      
    } catch (error) {
      console.error('Error fetching late workers:', error);
      alert('Failed to load late workers report');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Load attendance details for a selected report
   */
  const loadAttendanceDetails = (report) => {
    setSelectedReport(report);
    
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
  
  /**
   * Export report to CSV
   */
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
  
  /**
   * Export late workers to CSV
   */
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
  // FILTERING & COMPUTED DATA
  // ========================================
  
  /**
   * Filtered and searched reports
   */
  const filteredReports = useMemo(() => {
    let reports = viewMode === 'sunday' ? sundayReports : eventReports;
    
    // Apply event type filter
    if (eventTypeFilter !== 'all') {
      reports = reports.filter(r => r.type === eventTypeFilter);
    }
    
    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      reports = reports.filter(r => 
        r.title.toLowerCase().includes(search) ||
        r.formattedDate.toLowerCase().includes(search)
      );
    }
    
    return reports;
  }, [viewMode, sundayReports, eventReports, eventTypeFilter, searchTerm]);
  
  /**
   * Filtered late workers
   */
  const filteredLateWorkers = useMemo(() => {
    let workers = lateWorkers;
    
    // Apply ministry filter
    if (ministryFilter !== 'all') {
      workers = workers.filter(w => w.ministry === ministryFilter);
    }
    
    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      workers = workers.filter(w =>
        w.workerName.toLowerCase().includes(search) ||
        w.ministry.toLowerCase().includes(search)
      );
    }
    
    return workers;
  }, [lateWorkers, ministryFilter, searchTerm]);
  
  /**
   * Chart data for event types
   */
  const eventTypeChartData = useMemo(() => {
    const counts = {};
    
    eventReports.forEach(report => {
      const type = report.type || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
    
    return Object.entries(counts).map(([type, count]) => ({
      name: EVENT_TYPES[type]?.label || type,
      count
    }));
  }, [eventReports]);
  
  /**
   * Chart data for attendance trends
   */
  const attendanceTrendData = useMemo(() => {
    const reports = viewMode === 'sunday' ? sundayReports : eventReports;
    
    return reports.slice(0, 10).reverse().map(report => ({
      date: report.shortDate,
      attendance: report.scanned
    }));
  }, [viewMode, sundayReports, eventReports]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
            Attendance Reports
          </h1>
          <p className="text-gray-600 text-lg">
            Comprehensive analytics and insights for church attendance
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setViewMode('sunday')}
              className={`cursor-pointer px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 ${
                viewMode === 'sunday'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Calendar className="w-5 h-5" />
              Sunday Service
            </button>
            <button
              onClick={() => setViewMode('events')}
              className={`cursor-pointer px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 ${
                viewMode === 'events'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Users className="w-5 h-5" />
              Event Attendance
            </button>
            <button
              onClick={() => setViewMode('late')}
              className={`cursor-pointer px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 ${
                viewMode === 'late'
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Clock className="w-5 h-5" />
              Late Workers
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* Date Range */}
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="cursor-pointer w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all"
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="cursor-pointer w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all"
              />
            </div>
            
            {/* Event Type Filter (for events view) */}
            {viewMode === 'events' && (
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Event Type
                </label>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="cursor-pointer w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all"
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
            
            {/* Ministry Filter (for late workers) */}
            {viewMode === 'late' && (
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Ministry
                </label>
                <select
                  value={ministryFilter}
                  onChange={(e) => setMinistryFilter(e.target.value)}
                  className="cursor-pointer w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all"
                >
                  <option value="all">All Ministries</option>
                  {ministries.map(ministry => (
                    <option key={ministry} value={ministry}>{ministry}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all"
                />
                <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="cursor-pointer absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {viewMode === 'sunday' && (
            <>
              <StatCard
                icon={Calendar}
                label="Total Services"
                value={summaryStats.totalEvents}
                color="purple"
              />
              <StatCard
                icon={Users}
                label="Total Attendance"
                value={summaryStats.totalAttendance}
                color="blue"
              />
              <StatCard
                icon={TrendingUp}
                label="Avg. Attendance"
                value={summaryStats.averageAttendance}
                color="green"
              />
              <StatCard
                icon={BarChart3}
                label="Avg. Rate"
                value={`${summaryStats.attendanceRate}%`}
                color={summaryStats.attendanceRate >= 70 ? 'green' : summaryStats.attendanceRate >= 50 ? 'yellow' : 'red'}
              />
            </>
          )}
          
          {viewMode === 'events' && (
            <>
              <StatCard
                icon={Calendar}
                label="Total Events"
                value={summaryStats.totalEvents}
                color="blue"
              />
              <StatCard
                icon={Users}
                label="Total Attendance"
                value={summaryStats.totalAttendance}
                color="green"
              />
              <StatCard
                icon={TrendingUp}
                label="Avg. Attendance"
                value={summaryStats.averageAttendance}
                color="indigo"
              />
              <StatCard
                icon={BarChart3}
                label="Avg. Rate"
                value={`${summaryStats.attendanceRate}%`}
                color={summaryStats.attendanceRate >= 70 ? 'green' : summaryStats.attendanceRate >= 50 ? 'yellow' : 'red'}
              />
            </>
          )}
          
          {viewMode === 'late' && (
            <>
              <StatCard
                icon={Calendar}
                label="Services Reviewed"
                value={summaryStats.totalEvents}
                color="purple"
              />
              <StatCard
                icon={Clock}
                label="Late Instances"
                value={summaryStats.totalLateInstances}
                color="yellow"
              />
              <StatCard
                icon={Users}
                label="Unique Workers"
                value={summaryStats.uniqueWorkers}
                color="blue"
              />
              <StatCard
                icon={TrendingUp}
                label="Avg. Late (mins)"
                value={summaryStats.averageLateMinutes}
                color="red"
              />
            </>
          )}
        </div>

        {/* Analytics Charts */}
        {(viewMode === 'sunday' || viewMode === 'events') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <SimpleBarChart
              data={attendanceTrendData}
              title="Attendance Trend (Last 10 Events)"
              xKey="date"
              yKey="attendance"
              color="blue"
            />
            
            {viewMode === 'events' && eventTypeChartData.length > 0 && (
              <SimpleBarChart
                data={eventTypeChartData}
                title="Events by Type"
                xKey="name"
                yKey="count"
                color="purple"
              />
            )}
          </div>
        )}

        {/* Reports Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading reports...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Sunday Service & Event Reports */}
            {(viewMode === 'sunday' || viewMode === 'events') && (
              <div className="space-y-6">
                {filteredReports.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
                    <Calendar className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">No Reports Found</h3>
                    <p className="text-gray-600">
                      No {viewMode === 'sunday' ? 'Sunday services' : 'events'} found for the selected criteria.
                    </p>
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all"
                    >
                      {/* Report Header */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-900">
                                {report.title}
                              </h3>
                              {report.type && (
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${EVENT_TYPES[report.type]?.color}`}>
                                  {EVENT_TYPES[report.type]?.icon} {EVENT_TYPES[report.type]?.label}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span className="font-medium">{report.formattedDate}</span>
                              </div>
                              {report.startTime && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span className="font-medium">{report.startTime} - {report.endTime}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadAttendanceDetails(report)}
                              className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
                            >
                              {selectedReport?.id === report.id ? 'Hide Details' : 'View Details'}
                              <ChevronRight className={`w-4 h-4 transition-transform ${selectedReport?.id === report.id ? 'rotate-90' : ''}`} />
                            </button>
                            <button
                              onClick={() => exportToCSV(report, report.attendanceRecords.map(r => ({
                                ...r,
                                workerName: r.worker?.name || 'Unknown',
                                ministry: r.worker?.ministry || 'N/A',
                                status: calculateAttendanceStatus(r.check_in_time, report.startTime, report.type || 'sunday_service')
                              })))}
                              className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
                            >
                              <Download className="w-4 h-4" />
                              Export
                            </button>
                          </div>
                        </div>
                        
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-600 font-semibold mb-1">Total</p>
                            <p className="text-2xl font-extrabold text-blue-600">{report.totalWorkers}</p>
                          </div>
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-600 font-semibold mb-1">Present</p>
                            <p className="text-2xl font-extrabold text-green-600">{report.present}</p>
                          </div>
                          {viewMode === 'sunday' && (
                            <>
                              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <p className="text-xs text-gray-600 font-semibold mb-1">Late</p>
                                <p className="text-2xl font-extrabold text-yellow-600">{report.late}</p>
                              </div>
                              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <p className="text-xs text-gray-600 font-semibold mb-1">Absent</p>
                                <p className="text-2xl font-extrabold text-red-600">{report.absent}</p>
                              </div>
                            </>
                          )}
                          {viewMode === 'events' && (
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                              <p className="text-xs text-gray-600 font-semibold mb-1">Pending</p>
                              <p className="text-2xl font-extrabold text-yellow-600">{report.pending}</p>
                            </div>
                          )}
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-600 font-semibold mb-1">Rate</p>
                            <p className={`text-2xl font-extrabold ${
                              report.attendanceRate >= 70 ? 'text-green-600' :
                              report.attendanceRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {report.attendanceRate}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Attendance Details */}
                      {selectedReport?.id === report.id && (
                        <div className="p-6">
                          <h4 className="text-lg font-bold text-gray-900 mb-4">
                            Attendance Records ({attendanceDetails.length})
                          </h4>
                          
                          {attendanceDetails.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                              <p className="font-medium">No attendance records</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                      Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                      Ministry
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                      Check-in Time
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                      Scan Type
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {attendanceDetails.map((record, index) => (
                                    <tr key={index} className="hover:bg-blue-50 transition-colors">
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                        {record.workerName}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                        {record.ministry}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                        {new Date(record.check_in_time).toLocaleTimeString('en-US', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                          record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                          'bg-purple-100 text-purple-800 border border-purple-200'
                                        }`}>
                                          {(record.scan_type || 'qr').toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1.5 text-xs font-bold rounded-full border-2 ${getStatusBadge(record.status.status)}`}>
                                          {record.status.label.toUpperCase()}
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
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Late Workers Report */}
            {viewMode === 'late' && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 border-b border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Late Workers Report
                      </h3>
                      <p className="text-sm text-gray-600 font-medium">
                        Workers who arrived after 9:00 AM ({filteredLateWorkers.length} records)
                      </p>
                    </div>
                    {filteredLateWorkers.length > 0 && (
                      <ExportButton onClick={exportLateWorkersCSV} loading={exporting} />
                    )}
                  </div>
                </div>
                
                {filteredLateWorkers.length === 0 ? (
                  <div className="p-12 text-center">
                    <Clock className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">No Late Workers</h3>
                    <p className="text-gray-600">
                      No late arrivals found for the selected criteria.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Ministry
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Event Date
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Event Title
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Check-in Time
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Minutes Late
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredLateWorkers.map((worker, index) => (
                          <tr key={index} className="hover:bg-orange-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                              {worker.workerName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                              {worker.ministry}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                              {worker.formattedDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                              {worker.eventTitle}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                              {new Date(worker.checkInTime).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border-2 border-yellow-200">
                                {worker.minutesLate} MINS LATE
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