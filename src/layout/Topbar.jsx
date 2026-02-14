import React from 'react';
import { Calendar } from 'lucide-react';

const Topbar = () => {
  // Get current date
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Get day of week
  const dayOfWeek = today.toLocaleDateString('en-US', {
    weekday: 'long'
  });

  return (
    <header className="w-full h-16 bg-gradient-to-r from-[#1b2430] to-[#121820] shadow-md flex items-center px-6 border-b border-gray-700/30">
      <div className="w-full flex items-center justify-between">
        {/* Left side - Title */}
        <h1 className="text-2xl font-bold text-white tracking-wide">JCTGBTG-LIPA</h1>

        {/* Right side - Date Display with improved contrast */}
        //<div className="flex items-center gap-3 bg-blue-800/40 backdrop-blur-sm px-4 py-2 rounded-lg border border-blue-500/40 shadow-lg hover:bg-blue-700/50 transition-all duration-300">
          <div className="p-1.5 bg-blue-600/60 rounded-md shadow-inner">
            <Calendar className="w-4 h-4 text-blue-100" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-blue-200">{dayOfWeek}</span>
            <span className="text-sm font-semibold text-white drop-shadow-sm">{formattedDate}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;