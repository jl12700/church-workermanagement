import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../database/supabase';

const Logout = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      // Method 1: Try with 'local' scope first (safer, doesn't require valid token)
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
      
      if (localError) {
        console.warn('Local signout warning:', localError.message);
      }
      
      // Method 2: Try global signout (might fail with 403, but that's okay)
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (globalError) {
        // Ignore global signout errors - local is sufficient for most cases
        console.warn('Global signout skipped:', globalError);
      }
      
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local data and redirect, regardless of API success
      try {
        // Clear Supabase auth data
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
        
        // Clear other app data if needed
        sessionStorage.clear();
      } catch (storageError) {
        console.error('Storage clear error:', storageError);
      }
      
      setIsLoggingOut(false);
      onClose();
      
      // Navigate and reload
      navigate('/', { replace: true });
      
      // Small delay before reload to ensure navigation completes
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Confirm Logout
        </h3>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Are you sure you want to log out?
        </p>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoggingOut}
            className="cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="cursor-pointer rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-500/20 transition-all active:scale-95 hover:bg-red-700 hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoggingOut && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Logout;