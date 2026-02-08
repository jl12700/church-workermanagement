import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../database/supabase';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Scanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scanMessage, setScanMessage] = useState('');
  const [scanMessageType, setScanMessageType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [cameraId, setCameraId] = useState(null);
  
  // Event-related states
  const [currentEvent, setCurrentEvent] = useState(null);
  const [todayEvents, setTodayEvents] = useState([]);
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [autoSelectAttempted, setAutoSelectAttempted] = useState(false);
  
  const html5QrCodeRef = useRef(null);
  const scanCooldownRef = useRef(false);
  const lastScannedRef = useRef('');
  const resumeTimeoutRef = useRef(null);

  // Fetch and auto-select today's event
  const fetchAndSelectEvent = async () => {
    try {
      // Check if event was passed via navigation state
      const preSelectedEvent = location.state?.selectedEvent;
      
      if (preSelectedEvent) {
        // Use the pre-selected event from EventAttendance
        setCurrentEvent(preSelectedEvent);
        setTodayEvents([preSelectedEvent]);
        setShowEventSelector(false);
        handleFeedback(`Selected: ${preSelectedEvent.title}`, 'success');
        setAutoSelectAttempted(true);
        return;
      }
      
      // Otherwise, auto-select based on today's date/time
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_date', today)
        .eq('status', 'approved')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setTodayEvents(data);
        
        // Auto-select logic
        if (data.length === 1) {
          // Only one event today - auto-select it
          setCurrentEvent(data[0]);
          setShowEventSelector(false);
          handleFeedback(`Auto-selected: ${data[0].title}`, 'success');
        } else {
          // Multiple events - try to find the current/next one
          const currentOrNext = data.find(event => {
            return currentTime < event.end_time;
          });
          
          if (currentOrNext) {
            setCurrentEvent(currentOrNext);
            setShowEventSelector(false);
            handleFeedback(`Auto-selected: ${currentOrNext.title}`, 'success');
          } else {
            // All events have passed, select the last one
            setCurrentEvent(data[data.length - 1]);
            setShowEventSelector(false);
            handleFeedback(`Auto-selected: ${data[data.length - 1].title}`, 'success');
          }
        }
      } else {
        setTodayEvents([]);
        setCurrentEvent(null);
        setShowEventSelector(false);
        handleFeedback('No approved events today', 'warning');
      }
      
      setAutoSelectAttempted(true);
    } catch (error) {
      console.error('Error fetching events:', error);
      handleFeedback('Error loading events', 'error');
      setAutoSelectAttempted(true);
    }
  };

  // Get event attendance count
  const getEventAttendanceCount = async (eventId) => {
    if (!eventId) return 0;
    try {
      const { count } = await supabase
        .from('event_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);
      
      return count || 0;
    } catch (error) {
      console.error('Error fetching event attendance:', error);
      return 0;
    }
  };

  useEffect(() => {
    fetchAndSelectEvent();
    
    return () => {
      stopScanner();
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  // Initialize camera after event is selected
  useEffect(() => {
    if (currentEvent && autoSelectAttempted) {
      initCamera();
      updateEventCount();
    }
  }, [currentEvent, autoSelectAttempted]);

  // Update count when event changes
  useEffect(() => {
    if (currentEvent) {
      updateEventCount();
    }
  }, [currentEvent]);

  const updateEventCount = async () => {
    if (currentEvent) {
      const count = await getEventAttendanceCount(currentEvent.id);
      setTodayCount(count);
    }
  };

  const initCamera = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        
        const selectedCameraId = backCamera ? backCamera.id : devices[0].id;
        setCameraId(selectedCameraId);
        startScanner(selectedCameraId);
      } else {
        handleFeedback('No camera found', 'error');
      }
    } catch (err) {
      console.error('Camera error:', err);
      handleFeedback('Camera access denied', 'error');
    }
  };

  const startScanner = async (cameraId) => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode("qr-reader-mobile");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
      scanCooldownRef.current = false;
    } catch (err) {
      console.error('Scanner error:', err);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      setIsScanning(false);
      scanCooldownRef.current = false;
    } catch (err) {
      console.error('Stop scanner error:', err);
    }
  };

  const onScanSuccess = async (decodedText) => {
    if (processing || scanCooldownRef.current) return;
    
    const now = Date.now();
    if (lastScannedRef.current.text === decodedText && 
        (now - lastScannedRef.current.timestamp) < 3000) {
      return;
    }
    
    scanCooldownRef.current = true;
    lastScannedRef.current = {
      text: decodedText,
      timestamp: now
    };
    
    setProcessing(true);
    handleFeedback('Processing...', 'processing');

    try {
      // CRITICAL: Must have an event selected
      if (!currentEvent) {
        handleFeedback('No event available. Please check back later.', 'warning');
        return;
      }

      // Look up worker
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('qr_value', decodedText)
        .single();

      if (workerError || !worker) {
        handleFeedback('QR Not Recognized', 'error');
        return;
      }
      
      if (worker.status === 'Suspended') {
        handleFeedback(`${worker.name} is Suspended`, 'error');
        return;
      }

      // Check if already checked in to THIS event
      const { data: existingAttendance } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', currentEvent.id)
        .eq('worker_id', worker.id);

      if (existingAttendance?.length > 0) {
        handleFeedback(`${worker.name} already checked in`, 'warning');
        return;
      }

      // Record attendance to event
      const { error: insertError } = await supabase
        .from('event_attendance')
        .insert([{
          event_id: currentEvent.id,
          worker_id: worker.id,
          check_in_time: new Date().toISOString(),
          scan_type: 'qr',
          is_guest: false,
          is_baptized: true
        }]);

      if (insertError) throw insertError;
      
      handleFeedback(`✓ ${worker.name} - ${currentEvent.title}`, 'success');
      updateEventCount();
      
    } catch (e) {
      console.error('Scan error:', e);
      handleFeedback('Error saving scan', 'error');
    } finally {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      
      resumeTimeoutRef.current = setTimeout(() => {
        setProcessing(false);
        scanCooldownRef.current = false;
        lastScannedRef.current = '';
      }, 3000);
    }
  };

  const handleFeedback = (msg, type) => {
    setScanMessage(msg);
    setScanMessageType(type);
    setTimeout(() => { setScanMessage(''); setScanMessageType(''); }, 3000);
  };

  const handleEventChange = (eventId) => {
    const event = todayEvents.find(e => e.id === eventId);
    setCurrentEvent(event);
    if (event) {
      setShowEventSelector(false);
      handleFeedback(`Switched to: ${event.title}`, 'success');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      
      {/* Feedback Message */}
      {scanMessage && (
        <div className={`fixed top-6 z-[100] px-6 py-3 rounded-xl shadow-lg text-white font-bold transition-all animate-fade-in
          ${scanMessageType === 'success' ? 'bg-green-600' : 
            scanMessageType === 'error' ? 'bg-red-600' : 
            scanMessageType === 'warning' ? 'bg-orange-500' : 'bg-blue-600'}`}>
          {scanMessage}
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition border border-gray-200"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-semibold text-sm">Back</span>
      </button>

      {/* Header */}
      <div className="w-full max-w-sm mb-4 flex justify-between items-end mt-12">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Scanner</h2>
          <p className="text-sm text-gray-500">
            {currentEvent ? currentEvent.title : 'Event Attendance System'}
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-200 text-center">
          <span className="block text-xs font-bold text-gray-400 uppercase tracking-tighter">
            {currentEvent ? 'Scans' : 'No Event'}
          </span>
          <span className="text-xl font-black text-blue-600">{todayCount}</span>
        </div>
      </div>

      {/* Event Display/Selector */}
      {todayEvents.length > 0 ? (
        <div className="w-full max-w-sm mb-4">
          {showEventSelector ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Select Event to Check In
              </label>
              <select
                value={currentEvent?.id || ''}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">-- Select an Event --</option>
                {todayEvents.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({event.start_time} - {event.end_time})
                  </option>
                ))}
              </select>
            </div>
          ) : currentEvent && (
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-sm p-4 text-white">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">Current Event</p>
                  <p className="font-bold text-lg mt-1">{currentEvent.title}</p>
                  <p className="text-xs opacity-90 mt-1">
                    ⏰ {currentEvent.start_time} - {currentEvent.end_time}
                  </p>
                  {currentEvent.place && (
                    <p className="text-xs opacity-90">📍 {currentEvent.place}</p>
                  )}
                </div>
                {todayEvents.length > 1 && (
                  <button
                    onClick={() => setShowEventSelector(true)}
                    className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-sm mb-4 bg-orange-100 border border-orange-300 rounded-2xl p-4 text-orange-800">
          <p className="font-semibold text-sm">⚠️ No Events Today</p>
          <p className="text-xs mt-1">Please create an event before scanning.</p>
        </div>
      )}

      {/* Scanner Box */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 p-4 relative">
        <div className="relative aspect-square bg-black rounded-2xl overflow-hidden ring-4 ring-gray-50">
          <div id="qr-reader-mobile" className="w-full h-full"></div>
          
          {/* Scanner Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[250px] h-[250px] border-2 border-white/20 rounded-xl relative">
              {/* Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-sm"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-sm"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-sm"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-sm"></div>
              
              {/* Scanning Line */}
              {isScanning && !processing && currentEvent && (
                <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-scan"></div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              !currentEvent ? 'bg-orange-500 animate-pulse' :
              processing ? 'bg-yellow-500 animate-pulse' : 
              isScanning ? 'bg-green-500' : 
              'bg-gray-300'
            }`}></span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {!currentEvent ? 'No Event' :
               processing ? 'Processing...' : 
               isScanning ? 'Ready to Scan' : 
               'Initializing...'}
            </span>
          </div>
          
          <div className="text-xs text-gray-500">
            {processing && 'Auto-reset in 3s'}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center max-w-sm">
        {!currentEvent ? (
          <div className="text-sm font-medium px-4 py-2 rounded-lg bg-orange-100 text-orange-800 border border-orange-200">
            ⚠️ No approved events today. Scanner inactive.
          </div>
        ) : (
          <div className={`text-sm font-medium px-4 py-2 rounded-lg ${
            processing 
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}>
            {processing 
              ? '✓ QR code scanned. Ready for next scan in 3 seconds...' 
              : '↑ Position QR code inside the frame'}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 text-gray-400 text-[10px] font-bold tracking-widest uppercase">
        © 2026 Event-Based Attendance System
      </p>
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: calc(100% - 2px); }
          100% { top: 0; }
        }
        
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}