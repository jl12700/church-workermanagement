import { useState, useEffect, useRef } from 'react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import { eventService } from '../database/eventService';
import jsQR from 'jsqr';
import { 
  Search, 
  Camera, 
  X, 
  Download, 
  UserCheck, 
  UserX, 
  Clock,
  Users,
  Calendar,
  MapPin,
  Filter
} from 'lucide-react';

export default function EventAttendance() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [summary, setSummary] = useState({
    scanned: 0,
    absent: 0,
    totalWorkers: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0
  });
  const [scanMessage, setScanMessage] = useState('');
  const [scanMessageType, setScanMessageType] = useState('');
  const [workers, setWorkers] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [manualWorkerSearch, setManualWorkerSearch] = useState('');
  const [showEventsPanel, setShowEventsPanel] = useState(true);
  const [eventFilter, setEventFilter] = useState('all'); // all, upcoming, past
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Fetch all approved events
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await eventService.getAllEvents();
      if (error) throw error;
      
      // Sort by date (most recent first)
      const sortedEvents = (data || []).sort((a, b) => 
        new Date(b.event_date) - new Date(a.event_date)
      );
      
      setEvents(sortedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all active workers
  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('status', 'Active')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  // Filter events based on selected filter
  const getFilteredEvents = () => {
    const today = new Date().toISOString().split('T')[0];
    
    switch(eventFilter) {
      case 'upcoming':
        return events.filter(event => event.event_date >= today && event.status === 'approved');
      case 'past':
        return events.filter(event => event.event_date < today);
      case 'approved':
        return events.filter(event => event.status === 'approved');
      default:
        return events;
    }
  };

  // Fetch attendance for selected event
  const fetchAttendance = async (eventId) => {
    try {
      const { data, error } = await eventService.getEventAttendance(eventId);
      
      if (error) throw error;
      setAttendanceRecords(data || []);
      
      // Get event summary statistics
      const { data: summaryData } = await eventService.getEventSummary(eventId);
      
      // Calculate summary
      const totalWorkers = workers.length;
      const scanned = data?.length || 0;
      const absent = totalWorkers - scanned;
      
      setSummary({
        scanned,
        absent,
        totalWorkers,
        presentCount: summaryData?.present_count || 0,
        lateCount: summaryData?.late_count || 0,
        absentCount: summaryData?.absent_count || 0
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Start attendance for an event
  const startAttendance = async (event) => {
    setSelectedEvent(event);
    setScanning(true);
    setShowScanner(true);
    setShowEventsPanel(false); // Hide events panel on mobile when scanning
    await fetchAttendance(event.id);
    
    // Start camera for scanning
    startCamera();
  };

  // Start camera for QR scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.play();
        
        // Start scanning loop
        requestAnimationFrame(scanQRCode);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setScanMessage('Camera access denied. Please allow camera permissions.');
      setScanMessageType('error');
      setShowScanner(false);
      setShowEventsPanel(true); // Show events panel again
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // QR Code scanning loop
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Draw video frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for QR detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      handleQRScan(code.data);
    }

    // Continue scanning
    if (scanning) {
      requestAnimationFrame(scanQRCode);
    }
  };

  // Handle QR scan result
  const handleQRScan = async (qrData) => {
    if (scanMessage.includes('processing')) return;
    
    setScanMessage('Processing QR code...');
    setScanMessageType('info');

    try {
      const qrValue = extractQRValue(qrData);
      
      if (!qrValue) {
        setScanMessage('Invalid QR code format');
        setScanMessageType('error');
        setTimeout(() => setScanMessage(''), 3000);
        return;
      }

      const worker = workers.find(w => w.qr_value === qrValue);
      
      if (!worker) {
        setScanMessage('Worker not found');
        setScanMessageType('error');
        setTimeout(() => setScanMessage(''), 3000);
        return;
      }

      const alreadyScanned = attendanceRecords.some(record => 
        record.worker_id === worker.id
      );

      if (alreadyScanned) {
        setScanMessage(`${worker.name} already checked in`);
        setScanMessageType('warning');
        setTimeout(() => setScanMessage(''), 3000);
        return;
      }

      const { error } = await eventService.recordAttendance(
        selectedEvent.id,
        worker.id,
        'qr'
      );

      if (error) {
        if (error.message === 'Already checked in to this event') {
          setScanMessage(`${worker.name} already checked in`);
          setScanMessageType('warning');
        } else {
          throw error;
        }
      } else {
        setScanMessage(`✓ ${worker.name} checked in!`);
        setScanMessageType('success');
        await fetchAttendance(selectedEvent.id);
      }
      
      setTimeout(() => setScanMessage(''), 3000);

    } catch (error) {
      console.error('Error recording attendance:', error);
      setScanMessage('Failed to record attendance');
      setScanMessageType('error');
      setTimeout(() => setScanMessage(''), 3000);
    }
  };

  // Helper to extract QR value from scanned text
  const extractQRValue = (text) => {
    if (text.startsWith('WRK-')) {
      return text;
    }
    
    try {
      const url = new URL(text);
      const qrValue = url.pathname.split('/').pop();
      if (qrValue.startsWith('WRK-')) {
        return qrValue;
      }
    } catch {}
    
    if (text.includes('/checkin/')) {
      const parts = text.split('/checkin/');
      if (parts.length > 1 && parts[1].startsWith('WRK-')) {
        return parts[1];
      }
    }
    
    return null;
  };

  // Stop scanning
  const stopScanning = () => {
    setScanning(false);
    setShowScanner(false);
    stopCamera();
    setShowEventsPanel(true); // Show events panel again
  };

  // Manually add attendance
  const manuallyAddAttendance = async (workerId) => {
    try {
      const worker = workers.find(w => w.id === workerId);
      
      if (!worker) {
        alert('Worker not found');
        return;
      }

      const alreadyScanned = attendanceRecords.some(record => 
        record.worker_id === worker.id
      );

      if (alreadyScanned) {
        setScanMessage(`${worker.name} already checked in`);
        setScanMessageType('warning');
        setTimeout(() => setScanMessage(''), 3000);
        return;
      }

      const { error } = await eventService.recordAttendance(
        selectedEvent.id,
        worker.id,
        'manual'
      );

      if (error) {
        if (error.message === 'Already checked in to this event') {
          setScanMessage(`${worker.name} already checked in`);
          setScanMessageType('warning');
        } else {
          throw error;
        }
      } else {
        setScanMessage(`✓ ${worker.name} added!`);
        setScanMessageType('success');
        await fetchAttendance(selectedEvent.id);
      }
      
      setTimeout(() => setScanMessage(''), 3000);
    } catch (error) {
      console.error('Error adding attendance:', error);
      alert('Failed to add attendance');
    }
  };

  // Export attendance to CSV
  const exportAttendance = async () => {
    try {
      if (!selectedEvent) {
        alert('Please select an event first');
        return;
      }

      const csvContent = await eventService.exportEventAttendance(selectedEvent.id);
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${selectedEvent.title}-${selectedEvent.event_date}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert('Failed to export attendance');
    }
  };

  // Filter workers for manual search
  const filteredWorkers = workers.filter(worker => {
    const searchTerm = manualWorkerSearch.toLowerCase();
    return (
      !attendanceRecords.some(record => record.worker_id === worker.id) &&
      (worker.name.toLowerCase().includes(searchTerm) ||
       worker.ministry.toLowerCase().includes(searchTerm))
    );
  });

  // Initialize
  useEffect(() => {
    fetchEvents();
    fetchWorkers();
  }, []);

  
  useEffect(() => {
    if (!selectedEvent) return;

    const channel = supabase
      .channel(`event-attendance-${selectedEvent.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_attendance',
          filter: `event_id=eq.${selectedEvent.id}`
        },
        () => {
          fetchAttendance(selectedEvent.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEvent]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Mobile responsive breakpoints
  const isMobile = window.innerWidth < 768;

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Event Attendance</h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                Scan QR codes to record attendance for events
              </p>
            </div>
            
            {/* Mobile Toggle for Events Panel */}
            {isMobile && selectedEvent && !scanning && (
              <button
                onClick={() => setShowEventsPanel(!showEventsPanel)}
                className="md:hidden bg-blue-600 text-white p-3 rounded-lg shadow"
              >
                {showEventsPanel ? 'Hide Events' : 'Show Events'}
              </button>
            )}
          </div>

          {/* Event Filter Tabs for Mobile */}
          <div className="md:hidden mb-4">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {['all', 'upcoming', 'past', 'approved'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setEventFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    eventFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          
          <div className={`lg:w-1/3 ${isMobile && !showEventsPanel ? 'hidden' : 'block'}`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      Events ({getFilteredEvents().length})
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Select event to start attendance
                    </p>
                  </div>
                  
                  
                  <div className="hidden md:block">
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      className="cursor-pointer text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Events</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past Events</option>
                      <option value="approved">Approved Only</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : getFilteredEvents().length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="font-medium">No events found</p>
                    <p className="text-sm mt-2">Create events in the calendar</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {getFilteredEvents().map(event => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`border rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] ${
                          selectedEvent?.id === event.id
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 text-base line-clamp-2">
                              {event.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {new Date(event.event_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                              <Clock className="w-4 h-4 text-gray-400 ml-2" />
                              <span className="text-sm text-gray-600">
                                {event.start_time}
                              </span>
                            </div>
                            {event.place && (
                              <div className="flex items-center gap-2 mt-1">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 truncate">
                                  {event.place}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ml-2 ${
                            event.type === 'sunday_service' ? 'bg-purple-100 text-purple-800' :
                            event.type === 'training' ? 'bg-blue-100 text-blue-800' :
                            event.type === 'meeting' ? 'bg-orange-100 text-orange-800' :
                            event.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.type ? event.type.replace('_', ' ') : event.status}
                          </span>
                        </div>

                        <div className="mt-4">
                          {(!scanning || selectedEvent?.id !== event.id) && event.status === 'approved' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startAttendance(event);
                              }}
                              className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors active:bg-blue-800 flex items-center justify-center gap-2"
                            >
                              <Camera className="w-5 h-5" />
                              Start Attendance
                            </button>
                          ) : scanning && selectedEvent?.id === event.id ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stopScanning();
                              }}
                              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors active:bg-red-800 flex items-center justify-center gap-2"
                            >
                              <X className="w-5 h-5" />
                              Stop Scanning
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full bg-gray-400 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                            >
                              {event.status === 'approved' ? 'Start Attendance' : 'Event Not Approved'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          
          <div className={`lg:w-2/3 ${isMobile && showEventsPanel ? 'hidden' : 'block'}`}>
            {selectedEvent ? (
              <div className="space-y-4 md:space-y-6">
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl md:text-2xl font-bold text-gray-800 break-words">
                            {selectedEvent.title}
                          </h2>
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm md:text-base">
                                {new Date(selectedEvent.event_date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm md:text-base">
                                {selectedEvent.start_time} - {selectedEvent.end_time}
                              </span>
                            </div>
                            {selectedEvent.place && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm md:text-base truncate">
                                  {selectedEvent.place}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        
                        {isMobile && scanning && (
                          <button
                            onClick={stopScanning}
                            className="md:hidden bg-red-600 text-white p-2 rounded-lg"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={exportAttendance}
                        className="cursor-pointer ml-auto  bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors active:bg-green-800 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">Export CSV</span>
                        <span className="md:hidden">Export</span>
                      </button>
                    </div>
                  </div>

                  
                  {scanMessage && (
                    <div className={`mt-4 p-3 rounded-lg font-medium text-sm md:text-base ${
                      scanMessageType === 'success' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : scanMessageType === 'warning'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        : scanMessageType === 'error'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {scanMessage}
                    </div>
                  )}
                </div>

                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-blue-600 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Total Workers
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.totalWorkers}</p>
                    <p className="text-xs md:text-sm text-blue-100 mt-1">Active Workers</p>
                  </div>

                  <div className="bg-green-800 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Present
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.presentCount}</p>
                    <p className="text-xs md:text-sm text-green-100 mt-1">On Time</p>
                  </div>

                  <div className="bg-yellow-600 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Late
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.lateCount}</p>
                    <p className="text-xs md:text-sm text-yellow-100 mt-1">Late Arrivals</p>
                  </div>

                  <div className="bg-red-500 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <UserX className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Absent
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.absentCount}</p>
                    <p className="text-xs md:text-sm text-red-100 mt-1">
                      {scanning ? 'Scanning...' : 'Not Scanned'}
                    </p>
                  </div>
                </div>

                
                {scanning && showScanner && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        QR Code Scanner
                      </h3>
                      <button
                        onClick={stopScanning}
                        className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden md:inline">Stop</span>
                      </button>
                    </div>
                    
                    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
                      
                      <div className="lg:w-2/3">
                        <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 md:p-4 bg-blue-50">
                          <div className="relative aspect-square md:aspect-video">
                            <video
                              ref={videoRef}
                              className="w-full h-full object-cover rounded-lg border border-gray-300"
                              playsInline
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-48 h-48 md:w-64 md:h-64 border-2 border-blue-500 border-dashed rounded-lg"></div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-3 text-center">
                            Point camera at QR code
                          </p>
                        </div>
                      </div>

                      
                      <div className="lg:w-1/3">
                        <details className="group" open>
                          <summary className="flex items-center justify-between cursor-pointer list-none p-3 bg-gray-100 rounded-lg">
                            <h4 className="font-medium text-gray-700 flex items-center gap-2">
                              <Search className="w-4 h-4" />
                              Manual Entry
                            </h4>
                            <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          
                          <div className="mt-3">
                            <div className="mb-3">
                              <input
                                type="text"
                                placeholder="Search workers..."
                                value={manualWorkerSearch}
                                onChange={(e) => setManualWorkerSearch(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="space-y-2 max-h-[200px] md:max-h-[300px] overflow-y-auto">
                              {filteredWorkers.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">
                                  {manualWorkerSearch ? 'No workers found' : 'All checked in'}
                                </p>
                              ) : (
                                filteredWorkers.map(worker => (
                                  <div key={worker.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 text-sm truncate">{worker.name}</p>
                                      <p className="text-xs text-gray-500 truncate">{worker.ministry}</p>
                                    </div>
                                    <button
                                      onClick={() => manuallyAddAttendance(worker.id)}
                                      className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors whitespace-nowrap ml-2"
                                    >
                                      Add
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                )}

                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Attendance ({attendanceRecords.length})
                      </h3>
                      <span className="text-sm text-gray-500">
                        Updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>

                  {attendanceRecords.length === 0 ? (
                    <div className="text-center py-8 md:py-12 text-gray-500">
                      <UserCheck className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="font-medium">No attendance records</p>
                      <p className="text-sm mt-2">
                        {scanning ? 'Start scanning to record attendance' : 'Start attendance to begin'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      
                      <div className="md:hidden">
                        <div className="divide-y divide-gray-200">
                          {attendanceRecords.map((record) => (
                            <div key={record.id} className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {record.worker?.name || 'Unknown'}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {record.worker?.ministry || 'N/A'}
                                  </p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  record.status === 'present' ? 'bg-green-100 text-green-800' :
                                  record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {record.status?.charAt(0).toUpperCase() + record.status?.slice(1) || 'Present'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                                <span>
                                  {new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800' :
                                  record.scan_type === 'manual' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {record.scan_type || 'qr'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      
                      <table className="hidden md:table min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {attendanceRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {record.worker?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {record.worker?.ministry || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {new Date(record.check_in_time).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800' :
                                  record.scan_type === 'manual' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {record.scan_type || 'qr'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  record.status === 'present' ? 'bg-green-100 text-green-800' :
                                  record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {record.status?.charAt(0).toUpperCase() + record.status?.slice(1) || 'Present'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <Calendar className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Select an Event</h3>
                <p className="text-gray-600 mb-4">
                  Choose an event from the list to start managing attendance
                </p>
                {isMobile && (
                  <button
                    onClick={() => setShowEventsPanel(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                  >
                    Show Events List
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      
      <canvas ref={canvasRef} className="hidden" />
    </SidebarLayout>
  );
}