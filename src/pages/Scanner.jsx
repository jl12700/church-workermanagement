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
        fps: 20, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
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
    handleFeedback('Processing...', 'processing');

    try {
      const { data: workers, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('qr_value', decodedText)
        .single();

      if (workerError || !workers) return handleFeedback('QR Not Recognized', 'error');
      if (workers.status === 'Suspended') return handleFeedback(`${workers.name} is Suspended`, 'error');

      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase.from('attendance').select('*').eq('worker_id', workers.id).eq('date', today);

      if (existing?.length > 0) return handleFeedback(`${workers.name} already checked in`, 'warning');

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
    } catch (e) {
      handleFeedback('Error saving scan', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleFeedback = (msg, type) => {
    setScanMessage(msg);
    setScanMessageType(type);
    setTimeout(() => { setScanMessage(''); setScanMessageType(''); }, 3000);
  };

  const onScanError = () => {};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      
     
      {scanMessage && (
        <div className={`fixed top-6 z-[100] px-6 py-3 rounded-xl shadow-lg text-white font-bold transition-all animate-fade-in
          ${scanMessageType === 'success' ? 'bg-green-600' : 
            scanMessageType === 'error' ? 'bg-red-600' : 
            scanMessageType === 'warning' ? 'bg-orange-500' : 'bg-blue-600'}`}>
          {scanMessage}
        </div>
      )}


      <div className="w-full max-w-sm mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Scanner</h2>
          <p className="text-sm text-gray-500">Attendance System</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-200 text-center">
          <span className="block text-xs font-bold text-gray-400 uppercase tracking-tighter">Total Scans</span>
          <span className="text-xl font-black text-blue-600">{todayCount}</span>
        </div>
      </div>

     
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 p-4 relative">
        
        
        <div className="relative aspect-square bg-black rounded-2xl overflow-hidden ring-4 ring-gray-50">
          <div id="qr-reader-mobile" className="w-full h-full"></div>
          
          
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[250px] h-[250px] border-2 border-white/20 rounded-xl relative">
             
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-sm"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-sm"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-sm"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-sm"></div>
              
              
              {isScanning && <div className="absolute left-0 w-full h-[2px] bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-scan"></div>}
            </div>
          </div>
        </div>

      
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {isScanning ? 'Scanner Ready' : 'Initializing...'}
          </span>
        </div>
      </div>

      <p className="mt-8 text-gray-400 text-[10px] font-bold tracking-widest uppercase">
        © 2026 JCTGBTG Attendance 
      </p>
    </div>
  );
}