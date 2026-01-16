import { useState, useEffect } from 'react';
import { supabase } from '../database/supabase';

export default function CheckIn() {

  const qrValue = window.location.pathname.split('/checkin/')[1];
  
  const [status, setStatus] = useState('processing');
  const [workerName, setWorkerName] = useState('');
  const [message, setMessage] = useState('Processing check-in...');

  useEffect(() => {
    if (qrValue) {
      processCheckIn();
    } else {
      setStatus('error');
      setMessage('Invalid QR Code');
    }
  }, [qrValue]);

  const processCheckIn = async () => {
    try {
      
      const { data: workers, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('qr_value', qrValue)
        .single();

      if (workerError || !workers) {
        setStatus('error');
        setMessage('Invalid QR Code');
        setWorkerName('Worker not found');
        return;
      }

      setWorkerName(workers.name);

   
      if (workers.status === 'Suspended') {
        setStatus('suspended');
        setMessage('Account Suspended');
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
        setStatus('duplicate');
        setMessage('Already Checked In Today');
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
          qr_value: qrValue
        }]);

      if (insertError) {
        console.error('Insert error:', insertError);
        setStatus('error');
        setMessage('Failed to record attendance');
        return;
      }

   
      setStatus('success');
      setMessage('Check-in Successful!');

      
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);

    } catch (error) {
      console.error('Check-in error:', error);
      setStatus('error');
      setMessage('An error occurred');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return (
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-16 h-16 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'duplicate':
        return (
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-16 h-16 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'suspended':
        return (
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-16 h-16 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          </div>
        );
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'from-green-500 to-green-600';
      case 'error':
      case 'suspended':
        return 'from-red-500 to-red-600';
      case 'duplicate':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${getStatusColor()} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {getStatusIcon()}
        
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {message}
        </h1>
        
        <p className="text-xl text-gray-600 mb-6">
          {workerName}
        </p>

        {status === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800">
              ✓ Your attendance has been recorded
            </p>
            <p className="text-xs text-green-600 mt-1">
              {new Date().toLocaleString()}
            </p>
          </div>
        )}

        {status === 'duplicate' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              You have already checked in today
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              No need to scan again
            </p>
          </div>
        )}

        {status === 'suspended' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">
              Your account is currently suspended
            </p>
            <p className="text-xs text-red-600 mt-1">
              Please contact the administrator
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">
              Unable to process check-in
            </p>
            <p className="text-xs text-red-600 mt-1">
              Please try scanning again or contact support
            </p>
          </div>
        )}

        {status === 'processing' && (
          <p className="text-sm text-gray-500">
            Please wait while we process your check-in...
          </p>
        )}

        {status !== 'processing' && (
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {status === 'success' ? 'Redirecting...' : 'Go to Home'}
          </button>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Church Attendance System
          </p>
        </div>
      </div>
    </div>
  );
}