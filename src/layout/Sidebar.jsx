import React, { useState, useEffect } from "react"; 
import Topbar from "./Topbar";
import { NavLink } from "react-router-dom";
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuOpenIcon from '@mui/icons-material/MenuOpen'; 
import Logout from "../pages/Logout";

const SidebarLayout = ({ children }) => {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  }); 

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", newState);
  };


  const navLinkStyles = ({ isActive }) => 
    `text-sm text-white font-medium h-12 rounded-lg flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden ${
      isActive 
        ? "bg-yellow-300/20 text-yellow-300" 
        : "hover:bg-green-100/10"
    } ${isCollapsed ? "justify-center w-12 px-0" : "px-4 w-full"}`;

  
  const textClass = `transition-opacity duration-200 ${
    isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-4"
  }`;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Topbar />

      <div className="flex flex-1 overflow-hidden">
        <aside 
          className={`${
            isCollapsed ? "w-20" : "w-64"
          } bg-linear-to-b from-[#1b2430] to-[#121820] shadow-md flex flex-col p-4 transition-all duration-300 ease-in-out shrink-0 h-full`}
        >
          
          {/*  Right aligned if left=justify - start , if right justify-end*/}
          <div className={`flex w-full mb-2 ${isCollapsed ? "justify-center" : "justify-start"}`}>
            <button 
              onClick={toggleSidebar}
              className="text-white hover:bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300"
            >
              <MenuOpenIcon 
                className={`transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} 
              />
            </button>
          </div>

          <nav className="flex flex-col space-y-1 items-start h-full w-full">
            
            <NavLink to="/dashboard" className={navLinkStyles}>
              
              <DashboardIcon className="min-w-[24px]" />
              <span className={textClass}>Dashboard</span>
            </NavLink>
            
            <NavLink to="/worker-list" className={navLinkStyles}>
              <PeopleAltIcon className="min-w-[24px]" />
              <span className={textClass}>Worker List</span>
            </NavLink>

            <NavLink to="/attendance" className={navLinkStyles}>
              <AssignmentIcon className="min-w-[24px]" />
              <span className={textClass}>Attendance</span>
            </NavLink>

            <NavLink to="/calendar" className={navLinkStyles}>
              <CalendarMonthIcon className="min-w-[24px]" />
              <span className={textClass}>Calendar</span>
            </NavLink>

            <NavLink to="/reports" className={navLinkStyles}>
              <AnalyticsIcon className="min-w-[24px]" />
              <span className={textClass}>Reports</span>
            </NavLink>

            
            <div className={`mt-auto pt-4 border-t border-white/10 w-full flex flex-col ${isCollapsed ? "items-center" : "items-start"}`}>
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className={`cursor-pointer text-sm text-red-400 font-medium hover:text-red-600 hover:bg-red-500/10 h-12 rounded-lg flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isCollapsed ? "justify-center w-12 px-0" : "px-4 w-full"
                }`}
              >
                <LogoutIcon className="min-w-[24px]" />
                <span className={textClass}>Logout</span>
              </button>
            </div>
          </nav>
        </aside>

        
        <main className="flex-1 p-6 overflow-y-auto transition-all duration-300 ease-in-out bg-gray-50">
          <div className="mx-auto max-w-full">
            {children}
          </div>
        </main>
      </div>

      <Logout 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)} 
      />
    </div>
  );
};

export default SidebarLayout;