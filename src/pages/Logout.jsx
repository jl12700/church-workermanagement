import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../database/supabase';

const Logout = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

const handleLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    onClose(); 

    navigate('/', { replace: true }); 
   
  } catch (error) {
    console.error('Error logging out:', error.message);
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
            className="cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            className="cursor-pointer rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-500/20 transition-all active:scale-95 hover:bg-red-700 hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-red-500"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Logout;