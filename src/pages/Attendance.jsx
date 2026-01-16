import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [scanMessage, setScanMessage] = useState('');
  const [scanMessageType, setScanMessageType] = useState('');
  const [summary, setSummary] = useState({ presentToday: 0, totalWorkers: 0 });
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkersList, setShowWorkersList] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedWorkerForCalendar, setSelectedWorkerForCalendar] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [viewMode, setViewMode] = useState('attendance'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('all');
  const [ministries, setMinistries] = useState([]);

  const ROWS_PER_PAGE = 50;

  
  const getAttendanceStatus = (timeString) => {
    const time = new Date(timeString);
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const totalMinutes = (hours * 60) + minutes;
    
    
    const absentThreshold = 12 * 60; 
    
    
    const lateThreshold = (9 * 60) + 30; 
    
    
    if (totalMinutes >= absentThreshold) {
      return { status: 'absent', text: 'Absent' };
    }
    
    
    if (totalMinutes >= lateThreshold) {
      return { status: 'late', text: 'Late' };
    }
    
    
    return { status: 'present', text: 'Present' };
  };

  const fetchAttendance = async (page = 1, date = selectedDate) => {
    setLoading(true);
    try {
      const from = (page - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;
      
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', date);
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', date)
        .order('time', { ascending: false })
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
      
      
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today);
      
      if (error) throw error;
      
      
      let attendedCount = 0;
      if (attendanceData) {
        attendanceData.forEach(record => {
          const status = getAttendanceStatus(record.time);
          if (status.status === 'present' || status.status === 'late') {
            attendedCount++;
          }
        });
      }
      
      const { count: totalWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true });
      
      setSummary({
        presentToday: attendedCount || 0,
        totalWorkers: totalWorkers || 0
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchWorkers = async () => {
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
    }
  };

  const fetchWorkerMonthlyAttendance = async (workerId, month) => {
    try {
      const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
      const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('worker_id', workerId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      
      const attendanceMap = {};
      data?.forEach(record => {
        attendanceMap[record.date] = {
          status: getAttendanceStatus(record.time).status,
          time: record.time
        };
      });
      
      setMonthlyAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
    }
  };

  const determineAttendanceStatus = (date, attendanceData) => {
    const dateStr = date.toISOString().split('T')[0];
    const record = attendanceData[dateStr];
    
    if (!record) return 'absent'; 
    
    return record.status; 
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const day = date.getDay();
      
      if (day === 0) {
        const status = determineAttendanceStatus(date, monthlyAttendance);
        
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

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const day = date.getDay();
      if (day === 0) {
        const status = determineAttendanceStatus(date, monthlyAttendance);
        
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

  useEffect(() => {
    if (viewMode === 'attendance') {
      fetchAttendance(currentPage, selectedDate);
    }
    fetchSummary();
    fetchWorkers();

    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance'
        },
        (payload) => {
          console.log('New attendance detected:', payload);
          
          const record = payload.new;
          setScanMessage(`✓ ${record.name} - Attendance recorded!`);
          setScanMessageType('success');
          
          if (viewMode === 'attendance') {
            fetchAttendance(currentPage, selectedDate);
          }
          fetchSummary();
          
          setTimeout(() => {
            setScanMessage('');
            setScanMessageType('');
          }, 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPage, selectedDate, viewMode]);

  useEffect(() => {
    if (selectedWorkerForCalendar && showCalendarModal) {
      fetchWorkerMonthlyAttendance(selectedWorkerForCalendar.id, selectedMonth);
    }
  }, [selectedWorkerForCalendar, selectedMonth, showCalendarModal]);

  const exportAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate)
        .order('time', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No attendance records found for this date.');
        return;
      }

      const headers = ['Name', 'Ministry', 'Date', 'Time', 'Status'];
      const csvRows = [headers.join(',')];

      data.forEach(record => {
        const time = new Date(record.time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const status = getAttendanceStatus(record.time);
        const row = [
          `"${record.name}"`,
          `"${record.ministry}"`,
          record.date,
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
      link.download = `attendance-${selectedDate}.csv`;
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

  const generateQRUrl = (qrValue) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/checkin/${qrValue}`;
  };

  const downloadQR = (worker) => {
    const svg = document.getElementById(`qr-${worker.id}`);
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 480;
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 50, 20, 300, 300);
      
      ctx.fillStyle = 'black';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(worker.name, 200, 350);
      
      ctx.font = '16px Arial';
      ctx.fillText(worker.ministry, 200, 380);
      
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText('Scan with camera to check in', 200, 420);
      
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${worker.name.replace(/\s+/g, '_')}_QR.png`;
      link.href = url;
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const downloadAllQRCodes = async () => {
    await fetchWorkers();
    setShowWorkersList(true);
  };

  const printAllQRCodes = () => {
    window.print();
  };

  const openCalendarModal = (worker) => {
    setSelectedWorkerForCalendar(worker);
    setSelectedMonth(new Date());
    setShowCalendarModal(true);
  };

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  const getSundaysInMonth = (month) => {
    const sundays = [];
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    const firstDay = new Date(year, monthNum, 1);
    const lastDay = new Date(year, monthNum + 1, 0);
    
    for (let day = firstDay; day <= lastDay; day.setDate(day.getDate() + 1)) {
      if (day.getDay() === 0) {
        sundays.push(new Date(day));
      }
    }
    
    return sundays;
  };

  
  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = searchQuery === '' || 
      worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.contact?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMinistry = selectedMinistry === 'all' || worker.ministry === selectedMinistry;
    
    return matchesSearch && matchesMinistry;
  });

  return (
    <SidebarLayout>
      <div className="p-6">
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {viewMode === 'attendance' ? 'Sunday Service Attendance' : 'Workers Directory'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {viewMode === 'attendance' 
              ? 'Track and manage Sunday service attendance' 
              : 'View and manage all registered workers'}
          </p>
        </div>

        
        <div className="mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 p-1">
            <button
              onClick={() => setViewMode('attendance')}
              className={`cursor-pointer px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'attendance' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Sunday Service Attendance
            </button>
            <button
              onClick={() => setViewMode('workers')}
              className={`cursor-pointer px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'workers' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              List of All Workers
            </button>
          </div>
        </div>

        
        {viewMode === 'attendance' && (
<div className="mb-8">
  <div className="bg-blue-600 rounded-2xl p-6 w-full max-w-sm text-white shadow-xl shadow-blue-600/20 border border-white/10 transition-all hover:shadow-2xl hover:shadow-blue-600/30">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-widest text-blue-100/80">
          Attendance Status
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tracking-tight">
            {summary.presentToday}
          </span>
          <span className="text-blue-200/60 text-xl font-medium">
            / {summary.totalWorkers}
          </span>
        </div>
        
        <p className="text-sm font-semibold text-blue-100 mt-2">
          {summary.totalWorkers > 0 
            ? `${Math.round((summary.presentToday / summary.totalWorkers) * 100)}% Present`
            : 'No workers registered'}
        </p>
      </div>
      
      <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md border border-white/10">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>

    <div className="mt-6">
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-white rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          style={{ width: `${summary.totalWorkers > 0 ? (summary.presentToday / summary.totalWorkers) * 100 : 0}%` }}
        />
      </div>
    </div>
  </div>
</div>
        )}

        {viewMode === 'attendance' ? (
          <>
            
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {attendanceRecords.map((record) => {
                          const attendance = getAttendanceStatus(record.time);
                          return (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {record.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {record.ministry}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {new Date(record.time).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {new Date(record.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  attendance.status === 'present' 
                                    ? 'bg-green-100 text-green-800'
                                    : attendance.status === 'late'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {attendance.text}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  
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
                      className=" cursor-pointer not-[]:px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    All Workers ({filteredWorkers.length})
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Click "View Records" to see monthly attendance
                  </p>
                </div>
              </div>
            </div>

          
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

            {filteredWorkers.length === 0 ? (
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
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
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
                            onClick={() => openCalendarModal(worker)}
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
        )}

        {showWorkersList && (
          <Modal onClose={() => setShowWorkersList(false)} title="Worker QR Codes" large>
            <div className="mb-4 flex justify-end gap-2 no-print">
              <button
                onClick={printAllQRCodes}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                🖨️ Print All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workers.map(worker => (
                <div key={worker.id} className="border rounded-lg p-4 text-center bg-white print-page-break">
                  <QRCodeSVG 
                    id={`qr-${worker.id}`}
                    value={generateQRUrl(worker.qr_value)}
                    size={200}
                    level="H"
                    includeMargin={true}
                    className="mx-auto"
                  />
                  <h3 className="font-bold text-gray-800 mt-3">{worker.name}</h3>
                  <p className="text-sm text-gray-600">{worker.ministry}</p>
                  <p className="text-xs text-gray-400 mt-2">Scan with camera to check in</p>
                  <button
                    onClick={() => downloadQR(worker)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 no-print"
                  >
                    Download QR
                  </button>
                </div>
              ))}
            </div>
          </Modal>
        )}

        {showCalendarModal && selectedWorkerForCalendar && (
          <Modal onClose={() => setShowCalendarModal(false)} title="Monthly Attendance" large>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800">{selectedWorkerForCalendar.name}</h3>
              <p className="text-sm text-gray-600">{selectedWorkerForCalendar.ministry}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Month:
              </label>
              <input
                type="month"
                value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  setSelectedMonth(new Date(year, month - 1, 1));
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-8">
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
                className="border rounded-lg p-4"
              />
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Legend:</h4>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center">
                  <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm text-gray-600">Present (Before 9:30 AM)</span>
                </div>
                <div className="flex items-center">
                  <div className="h-4 w-4 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-sm text-gray-600">Late (9:30 AM - 11:59 AM)</span>
                </div>
                <div className="flex items-center">
                  <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm text-gray-600">Absent (12:00 PM onwards / No check-in)</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Sunday Attendance Summary for {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {getSundaysInMonth(selectedMonth).map(sunday => {
                  const status = determineAttendanceStatus(sunday, monthlyAttendance);
                  const dateStr = sunday.toISOString().split('T')[0];
                  const record = monthlyAttendance[dateStr];
                  
                  return (
                    <div key={dateStr} className={`p-3 rounded-lg ${
                      status === 'present' ? 'bg-green-50' :
                      status === 'late' ? 'bg-yellow-50' :
                      'bg-red-50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-800">
                          {sunday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          status === 'present' ? 'bg-green-100 text-green-800' :
                          status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      {record && (
                        <p className="text-sm text-gray-600 mt-1">
                          Check-in: {new Date(record.time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Modal>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page-break { page-break-inside: avoid; }
        }
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
      `}</style>
    </SidebarLayout>
  );
}

function Modal({ children, onClose, title, large = false }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-lg ${large ? 'max-w-6xl' : 'max-w-md'} w-full shadow-xl my-8`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-gray-400 hover:text-gray-600 text-2xl leading-none no-print"
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