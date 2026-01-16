import React, { useState } from "react"; // Added useState
import Topbar from "./Topbar";
import { NavLink } from "react-router-dom";
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LogoutIcon from '@mui/icons-material/Logout';
import Logout from "../pages/Logout";

const SidebarLayout = ({ children }) => {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Topbar />

      <div className="flex flex-1">
        <aside className="w-64 bg-linear-to-b from-[#1b2430] to-[#121820] shadow-md flex flex-col p-4">
          <nav className="flex flex-col space-y-1">
            <NavLink to="/dashboard" className={({ isActive }) => `text-sm text-white font-medium hover:bg-green-100/10 w-60 h-10 rounded-l-lg flex items-center px-4 ${isActive ? "bg-yellow-300/20" : ""}`}>
              <DashboardIcon className="mr-4" />
              Dashboard
            </NavLink>
            
            <NavLink to="/worker-list" className={({ isActive }) => `text-sm text-white font-medium hover:bg-green-100/10 w-60 h-10 rounded-l-lg flex items-center px-4 ${isActive ? "bg-yellow-300/20" : ""}`}>
              <PeopleAltIcon className="mr-4" />
              Worker List
            </NavLink>

            <NavLink to="/attendance" className={({ isActive }) => `text-sm text-white font-medium hover:bg-green-100/10 w-60 h-10 rounded-l-lg flex items-center px-4 ${isActive ? "bg-yellow-300/20" : ""}`}>
              <AssignmentIcon className="mr-4" />
              Attendance
            </NavLink>

            <NavLink to="/calendar" className={({ isActive }) => `text-sm text-white font-medium hover:bg-green-100/10 w-60 h-10 rounded-l-lg flex items-center px-4 ${isActive ? "bg-yellow-300/20" : ""}`}>
              <CalendarMonthIcon className="mr-4" />
              Calendar
            </NavLink>

            <NavLink to="/reports" className={({ isActive }) => `text-sm text-white font-medium hover:bg-green-100/10 w-60 h-10 rounded-l-lg flex items-center px-4 ${isActive ? "bg-yellow-300/20" : ""}`}>
              <AnalyticsIcon className="mr-4" />
              Reports
            </NavLink>

            {/* Changed from NavLink to button to trigger the modal */}
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="text-sm text-red-400 font-medium hover:text-red-600 hover:bg-red-500/10 w-60 h-10 rounded-l-lg flex items-center px-4 transition-colors"
            >
              <LogoutIcon className="mr-4" />
              Logout
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Logout Confirmation Modal */}
      <Logout 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)} 
      />
    </div>
  );
};

export default SidebarLayout;