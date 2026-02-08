import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Workers from './pages/Workers'
import SundayAttendance from './pages/SundayAttendance_EventBased'
import WorkersAttendance from './pages/WorkersAttendance_EventBased'
import Reports from './pages/Reports'
import CheckIn from './pages/CheckIn'
import ProtectedRoute from './pages/ProtectedRoute'
import Scanner from './pages/Scanner_EventBased'
import EventCalendar from './pages/EventCalendar'
import EventAttendance from './pages/EventAttendance'

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path='/' element={<Login />} />

        {/* Protected Routes */}
        <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path='/worker-list' element={<ProtectedRoute><Workers /></ProtectedRoute>} />

        {/* Attendance Routes - New Structure */}
        <Route path='/attendance/sunday' element={<ProtectedRoute><SundayAttendance /></ProtectedRoute>} />
        <Route path='/attendance/workers' element={<ProtectedRoute><WorkersAttendance /></ProtectedRoute>} />
        <Route path='/attendance/events' element={<ProtectedRoute><EventAttendance /></ProtectedRoute>} />

        {/* Redirect old /attendance route to Sunday Service */}
        <Route path='/attendance' element={<Navigate to="/attendance/sunday" replace />} />

        {/* Other Routes */}
        <Route path='/calendar' element={<ProtectedRoute><EventCalendar /></ProtectedRoute>} />
        <Route path='/reports' element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path='/scanner' element={<Scanner />} />
        <Route path='/checkin/:qrValue' element={<CheckIn />} /> 
      </Routes>
    </Router>
  )
}

export default App
