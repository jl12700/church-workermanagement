
import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../database/supabase';

export default function Scanner() {
  const [scanMessage, setScanMessage] = useState('');
  const [scanMessageType, setScanMessageType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  
  const html5QrCodeScannerRef = useRef(null);

  
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

  useEffect(() => {
    fetchTodayCount();
    startScanner();

    return () => {
      if (html5QrCodeScannerRef.current) {
        html5QrCodeScannerRef.current.clear();
      }
    };
  }, []);

  
  const startScanner = () => {
    if (html5QrCodeScannerRef.current) {
      html5QrCodeScannerRef.current.clear();
    }

    const scanner = new Html5QrcodeScanner(
      "qr-reader-mobile",
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: ['QR_CODE']
      },
      false
    );

    scanner.render(onScanSuccess, onScanError);
    html5QrCodeScannerRef.current = scanner;
    setIsScanning(true);
  };

  
  const onScanSuccess = async (decodedText) => {
    if (processing) return;
    
    setProcessing(true);
    setScanMessage('⏳ Processing...');
    setScanMessageType('processing');

   
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    try {
     
      const { data: workers, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('qr_value', decodedText)
        .single();

      if (workerError || !workers) {
        setScanMessage('❌ QR Code not recognized');
        setScanMessageType('error');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setProcessing(false);
        setTimeout(() => {
          setScanMessage('');
          setScanMessageType('');
        }, 3000);
        return;
      }

     
      if (workers.status === 'Suspended') {
        setScanMessage(`⛔ ${workers.name} is suspended`);
        setScanMessageType('error');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setProcessing(false);
        setTimeout(() => {
          setScanMessage('');
          setScanMessageType('');
        }, 3000);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('worker_id', workers.id)
        .eq('date', today);

      if (existingAttendance && existingAttendance.length > 0) {
        setScanMessage(`⚠️ ${workers.name} already checked in`);
        setScanMessageType('warning');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setProcessing(false);
        setTimeout(() => {
          setScanMessage('');
          setScanMessageType('');
        }, 3000);
        return;
      }

    
      const { error: insertError } = await supabase
        .from('attendance')
        .insert([{
          worker_id: workers.id,
          name: workers.name,
          ministry: workers.ministry,
          date: today,
          time: now.toISOString(),
          status: 'Present',
          qr_value: decodedText
        }]);

      if (insertError) throw insertError;

 
      setScanMessage(`✅ ${workers.name}\n${workers.ministry}`);
      setScanMessageType('success');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      
     
      fetchTodayCount();

   
      setTimeout(() => {
        setScanMessage('');
        setScanMessageType('');
      }, 2000);

    } catch (error) {
      console.error('Error recording attendance:', error);
      setScanMessage('❌ Failed to record');
      setScanMessageType('error');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
      setTimeout(() => {
        setScanMessage('');
        setScanMessageType('');
      }, 3000);
    } finally {
      setProcessing(false);
    }
  };

  const onScanError = (error) => {
   
  };

  const getMessageStyles = () => {
    switch (scanMessageType) {
      case 'success':
        return 'bg-green-500 text-white border-green-600';
      case 'error':
        return 'bg-red-500 text-white border-red-600';
      case 'warning':
        return 'bg-yellow-500 text-white border-yellow-600';
      case 'processing':
        return 'bg-blue-500 text-white border-blue-600';
      default:
        return 'bg-gray-500 text-white border-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
     
      <div className="bg-white shadow-lg">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800 text-center">
            📱 QR Attendance Scanner
          </h1>
          <div className="mt-2 flex justify-center items-center gap-2">
            <div className="bg-blue-100 px-4 py-2 rounded-full">
              <span className="text-sm font-semibold text-blue-800">
                Today: {todayCount} checked in
              </span>
            </div>
          </div>
        </div>
      </div>

      {scanMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-md">
          <div className={`${getMessageStyles()} px-6 py-4 rounded-lg shadow-2xl border-2 text-center font-bold text-lg animate-pulse`}>
            {scanMessage.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

   
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          
          <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
            <p className="text-sm text-blue-800 text-center font-medium">
              📸 Position QR code within the frame
            </p>
          </div>

        
          <div className="p-4">
            <div id="qr-reader-mobile" className="mx-auto"></div>
          </div>

        
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium text-gray-700">
                {isScanning ? 'Scanner Active' : 'Scanner Inactive'}
              </span>
            </div>
          </div>
        </div>

      
        <div className="mt-6 bg-white bg-opacity-90 rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tips for Best Results
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Hold phone steady and ensure good lighting</li>
            <li>• Keep QR code flat and fully visible</li>
            <li>• Wait for success message before next scan</li>
            <li>• Check your internet connection if scan fails</li>
          </ul>
        </div>

       
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white bg-opacity-90 rounded-lg p-4 text-center shadow-lg">
            <div className="text-2xl font-bold text-blue-600">{todayCount}</div>
            <div className="text-xs text-gray-600 mt-1">Scans Today</div>
          </div>
          <div className="bg-white bg-opacity-90 rounded-lg p-4 text-center shadow-lg">
            <div className="text-2xl font-bold text-green-600">
              {processing ? '⏳' : '✓'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {processing ? 'Processing' : 'Ready'}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-white text-sm opacity-75">
            Keep this page open to continue scanning
          </p>
        </div>
      </div>
    </div>
  );
}