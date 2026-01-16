import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Workers from './pages/Workers'
import Attendance from './pages/Attendance'
import Calendar from './pages/Calender'
import Reports from './pages/Reports'
import CheckIn from './pages/CheckIn'

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Login />} />
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/worker-list' element={<Workers />} />
        <Route path='/attendance' element={<Attendance />} />
        <Route path='/checkin/:qrValue' element={<CheckIn />} /> {/* ✅ */}
        <Route path='/calendar' element={<Calendar />} />
        <Route path='/reports' element={<Reports />} />
      </Routes>
    </Router>
  )
}

export default App
