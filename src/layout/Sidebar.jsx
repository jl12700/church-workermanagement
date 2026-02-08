import React, { useState, useEffect } from "react"; 
import Topbar from "./Topbar";
import { NavLink, useLocation } from "react-router-dom";
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Logout from "../pages/Logout";

const SidebarLayout = ({ children }) => {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const location = useLocation();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });
  
  const [attendanceExpanded, setAttendanceExpanded] = useState(() => {
    // Auto-expand if we're on an attendance route
    return location.pathname.startsWith('/attendance');
  });

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", newState);
  };
  
  const toggleAttendanceMenu = () => {
    setAttendanceExpanded(!attendanceExpanded);
  };
  
  // Auto-expand attendance menu when navigating to attendance routes
  useEffect(() => {
    if (location.pathname.startsWith('/attendance')) {
      setAttendanceExpanded(true);
    }
  }, [location.pathname]);

  const navLinkStyles = ({ isActive }) => 
    `text-sm text-white font-medium h-12 rounded-lg flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden ${
      isActive 
        ? "bg-yellow-300/20 text-yellow-300" 
        : "hover:bg-green-100/10"
    } ${isCollapsed ? "justify-center w-12 px-0" : "px-4 w-full"}`;
  
  const subNavLinkStyles = ({ isActive }) => 
    `text-sm text-white font-medium h-10 rounded-lg flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden ${
      isActive 
        ? "bg-yellow-300/20 text-yellow-300" 
        : "hover:bg-green-100/10"
    } ${isCollapsed ? "justify-center w-12 px-0" : "px-4 pl-12 w-full"}`;

  const textClass = `transition-opacity duration-200 ${
    isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-4"
  }`;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Topbar />

      <div className="flex flex-1 overflow-hidden">
        <aside 
          className={`${
            isCollapsed ? "w-20" : "w-56"
          } bg-linear-to-b from-[#1b2430] to-[#121820] shadow-md flex flex-col p-4 transition-all duration-300 ease-in-out shrink-0 h-full overflow-y-auto`}
        >
          {/* Toggle Button */}
          <div className={`flex w-full mb-2 ${isCollapsed ? "justify-center" : "justify-end"}`}>
            <button 
              onClick={toggleSidebar}
              className="cursor-pointer text-white hover:bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300"
            >
              <MenuOpenIcon 
                className={`transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} 
              />
            </button>
          </div>

          <nav className="flex flex-col space-y-1 items-start h-full w-full">
            {/* Dashboard */}
            <NavLink to="/dashboard" className={navLinkStyles}>
              <DashboardIcon className="min-w-[24px]" />
              <span className={textClass}>Dashboard</span>
            </NavLink>
            
            {/* Worker List */}
            <NavLink to="/worker-list" className={navLinkStyles}>
              <PeopleAltIcon className="min-w-[24px]" />
              <span className={textClass}>Worker List</span>
            </NavLink>

            {/* Attendance - Parent Menu with Dropdown */}
            <div className="w-full">
              <button
                onClick={toggleAttendanceMenu}
                className={`text-sm text-white font-medium h-12 rounded-lg flex items-center justify-between transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  location.pathname.startsWith('/attendance')
                    ? "bg-yellow-300/20 text-yellow-300" 
                    : "hover:bg-green-100/10"
                } ${isCollapsed ? "justify-center w-12 px-0" : "px-4 w-full"}`}
              >
                <div className="flex items-center">
                  <AssignmentIcon className="min-w-[24px]" />
                  <span className={textClass}>Attendance</span>
                </div>
                {!isCollapsed && (
                  <ExpandMoreIcon 
                    className={`transition-transform duration-300 ${
                      attendanceExpanded ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>
              
              {/* Submenu */}
              {attendanceExpanded && !isCollapsed && (
                <div className="mt-1 space-y-1">
                  <NavLink to="/attendance/sunday" className={subNavLinkStyles}>
                    <span className="ml-4">Sunday Service</span>
                  </NavLink>

                  {/* NEW: Event Attendance */}
                  <NavLink to="/attendance/events" className={subNavLinkStyles}>
                    <span className="ml-4">Event Attendance</span>
                  </NavLink>

                  <NavLink to="/attendance/workers" className={subNavLinkStyles}>
                    <span className="ml-4">Worker Logs</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Calendar */}
            <NavLink to="/calendar" className={navLinkStyles}>
              <CalendarMonthIcon className="min-w-[24px]" />
              <span className={textClass}>Calendar</span>
            </NavLink>

            {/* Reports */}
            <NavLink to="/reports" className={navLinkStyles}>
              <AnalyticsIcon className="min-w-[24px]" />
              <span className={textClass}>Reports</span>
            </NavLink>

            {/* Logout */}
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

        {/* Main Content */}
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
