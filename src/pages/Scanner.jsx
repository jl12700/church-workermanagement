import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../database/supabase';
import { eventService } from '../database/supabaseEvents';

export default function Scanner() {
  const [scanMessage, setScanMessage] = useState('');
  const [scanMessageType, setScanMessageType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [cameraId, setCameraId] = useState(null);
  
  // Event-related states
  const [todayEvents, setTodayEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventSelector, setShowEventSelector] = useState(false);
  
  const html5QrCodeRef = useRef(null);
  const scanCooldownRef = useRef(false);
  const lastScannedRef = useRef('');
  const resumeTimeoutRef = useRef(null);

  // Fetch today's total attendance count
  const fetchTodayCount = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);
      setTodayCount(count || 0);
    } catch (error) {
      console.error('Error fetching count:', error);
    }
  };

  // Fetch today's events
  const fetchTodayEvents = async () => {
    try {
      const { data, error } = await eventService.getTodayEvents();
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Filter only approved events
        const approvedEvents = data.filter(event => event.status === 'approved');
        setTodayEvents(approvedEvents);
        
        // Auto-select if only one event
        if (approvedEvents.length === 1) {
          setSelectedEvent(approvedEvents[0]);
          setShowEventSelector(false);
        } else if (approvedEvents.length > 1) {
          setShowEventSelector(true);
        }
      } else {
        setTodayEvents([]);
        setShowEventSelector(false);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  // Get event attendance count
  const getEventAttendanceCount = async (eventId) => {
    if (!eventId) return 0;
    try {
      const { data } = await eventService.getEventAttendance(eventId);
      return data?.length || 0;
    } catch (error) {
      console.error('Error fetching event attendance:', error);
      return 0;
    }
  };

  useEffect(() => {
    fetchTodayCount();
    fetchTodayEvents();
    initCamera();
    
    return () => {
      stopScanner();
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  // Update count when event changes
  useEffect(() => {
    if (selectedEvent) {
      updateEventCount();
    }
  }, [selectedEvent]);

  const updateEventCount = async () => {
    if (selectedEvent) {
      const count = await getEventAttendanceCount(selectedEvent.id);
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
        
        const cameraId = backCamera ? backCamera.id : devices[0].id;
        setCameraId(cameraId);
        startScanner(cameraId);
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
      // Check if there's an event selected
      if (todayEvents.length > 0 && !selectedEvent) {
        handleFeedback('Please select an event first', 'warning');
        return;
      }

      // Look up worker
      const { data: workers, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('qr_value', decodedText)
        .single();

      if (workerError || !workers) {
        handleFeedback('QR Not Recognized', 'error');
        return;
      }
      
      if (workers.status === 'Suspended') {
        handleFeedback(`${workers.name} is Suspended`, 'error');
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      // If there's an event, use event-based attendance
      if (selectedEvent) {
        // Check if already checked in to THIS event
        const { data: eventAttendance } = await supabase
          .from('event_attendance')
          .select('*')
          .eq('event_id', selectedEvent.id)
          .eq('worker_id', workers.id);

        if (eventAttendance?.length > 0) {
          handleFeedback(`${workers.name} already checked in to this event`, 'warning');
          return;
        }

        // Insert event attendance (CORRECTED - uses worker_id)
        const { error: insertError } = await supabase
          .from('event_attendance')
          .insert([{
            event_id: selectedEvent.id,
            worker_id: workers.id,
            check_in_time: new Date().toISOString(),
            scan_type: 'qr',
            is_guest: false,
            is_baptized: true
          }]);

        if (insertError) throw insertError;
        
        handleFeedback(`✓ ${workers.name} - ${selectedEvent.title}`, 'success');
        updateEventCount();
        
      } else {
        // Fallback to old daily attendance system (if no events today)
        const { data: existing } = await supabase
          .from('attendance')
          .select('*')
          .eq('worker_id', workers.id)
          .eq('date', today);

        if (existing?.length > 0) {
          handleFeedback(`${workers.name} already checked in`, 'warning');
          return;
        }

        const { error: insertError } = await supabase.from('attendance').insert([{
          worker_id: workers.id,
          name: workers.name,
          ministry: workers.ministry,
          date: today,
          time: new Date().toISOString(),
          status: 'Present',
          qr_value: decodedText
        }]);

        if (insertError) throw insertError;
        handleFeedback(`Success: ${workers.name}`, 'success');
        fetchTodayCount();
      }
      
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
    setSelectedEvent(event);
    if (event) {
      setShowEventSelector(false);
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

      {/* Header */}
      <div className="w-full max-w-sm mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Scanner</h2>
          <p className="text-sm text-gray-500">
            {selectedEvent ? selectedEvent.title : 'Attendance System'}
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-200 text-center">
          <span className="block text-xs font-bold text-gray-400 uppercase tracking-tighter">
            {selectedEvent ? 'Event Scans' : 'Total Scans'}
          </span>
          <span className="text-xl font-black text-blue-600">{todayCount}</span>
        </div>
      </div>

      {/* Event Selector */}
      {todayEvents.length > 0 && (
        <div className="w-full max-w-sm mb-4">
          {showEventSelector ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Select Event to Check In
              </label>
              <select
                value={selectedEvent?.id || ''}
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
          ) : selectedEvent && (
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-sm p-4 text-white">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">Current Event</p>
                  <p className="font-bold text-lg mt-1">{selectedEvent.title}</p>
                  <p className="text-xs opacity-90 mt-1">
                    ⏰ {selectedEvent.start_time} - {selectedEvent.end_time}
                  </p>
                  {selectedEvent.place && (
                    <p className="text-xs opacity-90">📍 {selectedEvent.place}</p>
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
              {isScanning && !processing && (
                <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-scan"></div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${processing ? 'bg-yellow-500 animate-pulse' : isScanning ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {processing ? 'Processing...' : isScanning ? 'Ready to Scan' : 'Initializing...'}
            </span>
          </div>
          
          <div className="text-xs text-gray-500">
            {processing && 'Auto-reset in 3s'}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center max-w-sm">
        {todayEvents.length > 0 && !selectedEvent ? (
          <div className="text-sm font-medium px-4 py-2 rounded-lg bg-orange-100 text-orange-800 border border-orange-200">
            ⚠️ Please select an event above to begin scanning
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
        © 2026 JCTGBTG Attendance 
      </p>
    </div>
  );
}