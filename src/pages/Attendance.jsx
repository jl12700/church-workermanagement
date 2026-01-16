
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import SidebarLayout from '../layout/sidebar';
import { supabase } from '../database/supabase';

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

  const ROWS_PER_PAGE = 50;

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
      
      const { count: presentCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);
      
      const { count: totalWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true });
      
      setSummary({
        presentToday: presentCount || 0,
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
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

 
  useEffect(() => {
    fetchAttendance(currentPage, selectedDate);
    fetchSummary();


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
          
       
          fetchAttendance(currentPage, selectedDate);
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
  }, [currentPage, selectedDate]);


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
        const row = [
          `"${record.name}"`,
          `"${record.ministry}"`,
          record.date,
          time,
          record.status
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

  return (
    <SidebarLayout>
      <div className="p-6">
       
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Attendance Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage worker attendance
          </p>
        </div>

    
      <div className="w-43 bg-gradient-to-r from-blue-600 to-blue-600 rounded-lg shadow-xl p-6 mb-6 text-white ring-1 ring-white/20 hover:-translate-y-0.5 transition-all duration-500">
  <div className="flex items-center justify-center"> <div className="text-center"> <p className="text-blue-100 text-sm font-medium">Today's Attendance</p>
      <p className="text-3xl font-bold mt-1">
        {summary.presentToday} / {summary.totalWorkers}
      </p>
      <p className="text-blue-100 text-sm mt-1">
        {summary.totalWorkers > 0 
          ? `${Math.round((summary.presentToday / summary.totalWorkers) * 100)}% Present`
          : 'No workers registered'}
      </p>
    </div>
  </div>
</div>

      
      
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
              className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-medium transition-colors ml-auto"
            >
              📥 Export CSV
            </button>
          </div>

          {/* Scan Message */}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => (
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
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>

        {/* Workers QR Codes Modal */}
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
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page-break { page-break-inside: avoid; }
        }
      `}</style>
    </SidebarLayout>
  );
}

function Modal({ children, onClose, title, large = false }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-lg ${large ? 'max-w-6xl' : 'max-w-md'} w-full shadow-xl my-8`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none no-print"
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