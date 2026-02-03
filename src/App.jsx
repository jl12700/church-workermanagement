import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Workers from './pages/Workers'
import Attendance from './pages/Attendance'
import Reports from './pages/Reports'
import CheckIn from './pages/CheckIn'
import ProtectedRoute from './pages/ProtectedRoute'
import Scanner from './pages/Scanner'
import EventCalendar from './pages/EventCalendar'

function App() {
  return (
    <Router>
      <Routes>
        
        <Route path='/' element={<Login />} />

      
        <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path='/worker-list' element={<ProtectedRoute><Workers /></ProtectedRoute>} />
        <Route path='/attendance' element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
        <Route path='/calendar' element={<ProtectedRoute><EventCalendar /></ProtectedRoute>} />
        <Route path='/reports' element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path='/scanner' element={<Scanner />} />
        <Route path='/checkin/:qrValue' element={<CheckIn />} /> 
      </Routes>
    </Router>
  )
}

export default App