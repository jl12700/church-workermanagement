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
import MenuIcon from '@mui/icons-material/Menu';
import Logout from "../pages/Logout";

const SidebarLayout = ({ children }) => {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const location = useLocation();

  // Desktop collapse state (persisted)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });

  // Mobile drawer open state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Responsive detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      
      if (!isMobileView) {
        setIsMobileOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand attendance submenu on route match
  const [attendanceExpanded, setAttendanceExpanded] = useState(() => {
    return location.pathname.startsWith('/attendance');
  });
  
  useEffect(() => {
    if (location.pathname.startsWith('/attendance')) {
      setAttendanceExpanded(true);
    }
  }, [location.pathname]);

  const toggleAttendanceMenu = () => {
    setAttendanceExpanded(!attendanceExpanded);
  };

  // Unified toggle: desktop ↔ collapse, mobile ↔ open/close drawer
  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(prev => !prev);
    } else {
      const newState = !isCollapsed;
      setIsCollapsed(newState);
      localStorage.setItem("sidebarCollapsed", newState);
    }
  };

  // Close drawer when clicking backdrop
  const handleBackdropClick = () => setIsMobileOpen(false);

  // --- Dynamic class helpers ---
  const showLabels = isMobile ? true : !isCollapsed;
  const textClass = `transition-opacity duration-200 ${
    showLabels ? "opacity-100 ml-4" : "opacity-0 w-0"
  }`;

  // Navigation link styles
  const navLinkStyles = ({ isActive }) =>
    `text-sm text-white font-medium h-12 rounded-lg flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden ${
      isActive
        ? "bg-yellow-300/20 text-yellow-300"
        : "hover:bg-green-100/10"
    } ${
      isMobile
        ? "px-4 w-full justify-start"
        : isCollapsed
        ? "justify-center w-12 px-0"
        : "px-4 w-full"
    }`;

  const subNavLinkStyles = ({ isActive }) =>
    `text-sm text-white font-medium h-10 rounded-lg flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden ${
      isActive
        ? "bg-yellow-300/20 text-yellow-300"
        : "hover:bg-green-100/10"
    } ${
      isMobile
        ? "px-4 pl-12 w-full justify-start"
        : isCollapsed
        ? "justify-center w-12 px-0"
        : "px-4 pl-12 w-full"
    }`;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Topbar />

      {/* FIXED: Mobile menu button – positioned absolutely within the flex container */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className={`
            absolute top-4 left-4 z-50
            w-12 h-12 
            bg-[#1b2430] bg-opacity-90 backdrop-blur-sm
            rounded-lg flex items-center justify-center 
            text-white shadow-lg 
            hover:bg-[#2a3645] hover:bg-opacity-100
            transition-all duration-300 ease-in-out
            ${isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
          `}
          aria-label="Open sidebar"
          aria-expanded={false}
        >
          <MenuIcon />
        </button>
      )}

      {/* Backdrop – only on mobile when drawer is open */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 transition-opacity"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        {isMobile ? (
          /* 📱 MOBILE – fixed drawer, slides in/out */
          <aside
            className={`
              fixed top-0 left-0 z-40
              w-64 h-full
              bg-linear-to-b from-[#1b2430] to-[#121820] shadow-xl
              flex flex-col
              transition-transform duration-300 ease-in-out
              overflow-y-auto pt-16
              ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
            `}
          >
            {/* Toggle button - repositioned inside drawer header */}
            <div className="absolute top-4 right-4 z-50">
              <button
                onClick={toggleSidebar}
                className="cursor-pointer text-white hover:bg-white/10 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300"
                aria-label="Close sidebar"
                aria-expanded={isMobileOpen}
              >
                <MenuOpenIcon className="transition-transform duration-300" />
              </button>
            </div>

            <nav className="flex flex-col space-y-1 items-start h-full w-full px-4 pt-12">
              {/* Dashboard */}
              <NavLink to="/dashboard" className={navLinkStyles}>
                <DashboardIcon className="min-w-[24px]" />
                <span className="opacity-100 ml-4">Dashboard</span>
              </NavLink>
              
              {/* Worker List */}
              <NavLink to="/worker-list" className={navLinkStyles}>
                <PeopleAltIcon className="min-w-[24px]" />
                <span className="opacity-100 ml-4">Worker List</span>
              </NavLink>

              {/* Attendance - Parent Menu with Dropdown */}
              <div className="w-full">
                <button
                  onClick={toggleAttendanceMenu}
                  className={`
                    text-sm text-white font-medium h-12 rounded-lg
                    flex items-center justify-between px-4 w-full
                    transition-all duration-300 whitespace-nowrap overflow-hidden
                    ${
                      location.pathname.startsWith('/attendance')
                        ? "bg-yellow-300/20 text-yellow-300"
                        : "hover:bg-green-100/10"
                    }
                  `}
                >
                  <div className="flex items-center">
                    <AssignmentIcon className="min-w-[24px]" />
                    <span className="ml-4">Attendance</span>
                  </div>
                  <ExpandMoreIcon
                    className={`transition-transform duration-300 ${
                      attendanceExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                
                {/* Submenu */}
                {attendanceExpanded && (
                  <div className="mt-1 space-y-1">
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
                <span className="opacity-100 ml-4">Calendar</span>
              </NavLink>

              {/* Reports */}
              <NavLink to="/reports" className={navLinkStyles}>
                <AnalyticsIcon className="min-w-[24px]" />
                <span className="opacity-100 ml-4">Reports</span>
              </NavLink>

              {/* Logout */}
              <div className="mt-auto pt-4 border-t border-white/10 w-full flex flex-col items-start">
                <button
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="cursor-pointer text-sm text-red-400 font-medium hover:text-red-600 hover:bg-red-500/10 h-12 rounded-lg flex items-center px-4 w-full transition-all duration-300 whitespace-nowrap overflow-hidden"
                >
                  <LogoutIcon className="min-w-[24px]" />
                  <span className="opacity-100 ml-4">Logout</span>
                </button>
              </div>
            </nav>
          </aside>
        ) : (
          /* 🖥️ DESKTOP – part of layout, width based on collapse */
          <aside
            className={`
              ${isCollapsed ? "w-20" : "w-56"}
              bg-linear-to-b from-[#1b2430] to-[#121820] shadow-md
              flex flex-col p-4
              transition-all duration-300 ease-in-out
              shrink-0 h-full overflow-y-auto
            `}
          >
            {/* Toggle Button */}
            <div className={`flex w-full mb-2 ${isCollapsed ? "justify-center" : "justify-end"}`}>
              <button
                onClick={toggleSidebar}
                className="cursor-pointer text-white hover:bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300"
                aria-label="Collapse sidebar"
                aria-expanded={!isCollapsed}
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
                  className={`
                    text-sm text-white font-medium h-12 rounded-lg
                    flex items-center justify-between
                    transition-all duration-300 whitespace-nowrap overflow-hidden
                    ${
                      location.pathname.startsWith('/attendance')
                        ? "bg-yellow-300/20 text-yellow-300"
                        : "hover:bg-green-100/10"
                    }
                    ${isCollapsed ? "justify-center w-12 px-0" : "px-4 w-full"}
                  `}
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
                  className={`
                    cursor-pointer text-sm text-red-400 font-medium
                    hover:text-red-600 hover:bg-red-500/10
                    h-12 rounded-lg flex items-center
                    transition-all duration-300 whitespace-nowrap overflow-hidden
                    ${isCollapsed ? "justify-center w-12 px-0" : "px-4 w-full"}
                  `}
                >
                  <LogoutIcon className="min-w-[24px]" />
                  <span className={textClass}>Logout</span>
                </button>
              </div>
            </nav>
          </aside>
        )}

        {/* MAIN CONTENT */}
        <main className={`flex-1 p-6 overflow-y-auto transition-all duration-300 ease-in-out bg-gray-50 ${
          isMobile ? "w-full" : ""
        }`}>
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