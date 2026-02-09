import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import { eventService } from '../database/eventService';
import { 
  Search, 
  ScanLine, 
  X, 
  Download, 
  UserCheck, 
  UserX, 
  Clock,
  Users,
  Calendar,
  MapPin,
  Filter,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function EventAttendance() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [summary, setSummary] = useState({
    scanned: 0,
    absent: 0,
    totalWorkers: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0
  });
  const [scanMessage, setScanMessage] = useState('');
  const [scanMessageType, setScanMessageType] = useState('');
  const [workers, setWorkers] = useState([]);
  const [manualWorkerSearch, setManualWorkerSearch] = useState('');
  const [showEventsPanel, setShowEventsPanel] = useState(true);
  const [eventFilter, setEventFilter] = useState('all'); // all, today, upcoming, past, approved
  const [typeFilter, setTypeFilter] = useState('all'); // all, sunday_service, prayer_meeting, etc.
  const [hasEventToday, setHasEventToday] = useState(false);

  // Event type options - FIXED to match requirements
  const eventTypes = [
    { value: 'all', label: '---Filter All---', color: 'bg-gray-100 text-gray-800' },
    { value: 'sunday_service', label: 'Sunday Service', color: 'bg-purple-100 text-purple-800' },
    { value: 'prayer_meeting', label: 'Prayer Meeting', color: 'bg-blue-100 text-blue-800' },
    { value: 'bible_study', label: 'Bible Study', color: 'bg-green-100 text-green-800' },
    { value: 'meet', label: 'Meeting / Setup', color: 'bg-orange-100 text-orange-800' },
    { value: 'outreach', label: 'Workers Conference', color: 'bg-red-100 text-red-800' },
    { value: 'church_event', label: 'Church Event', color: 'bg-indigo-100 text-indigo-800' }
  ];

  // FIXED: Calculate attendance status based on check-in time
  const calculateAttendanceStatus = (checkInTime, eventStartTime, eventType) => {
    const checkIn = new Date(checkInTime);
    const checkInTimeOnly = checkIn.toTimeString().split(' ')[0]; // HH:MM:SS
    
    // Sunday Service specific logic
    if (eventType === 'sunday_service') {
      const hour = checkIn.getHours();
      const minute = checkIn.getMinutes();
      const totalMinutes = hour * 60 + minute;
      
      // 6:00 AM = 360 minutes, 9:00 AM = 540 minutes, 9:15 AM = 555 minutes
      if (totalMinutes >= 360 && totalMinutes < 540) {
        return 'present'; // 6:00 AM - 9:00 AM
      } else if (totalMinutes >= 540 && totalMinutes < 555) {
        return 'late'; // 9:00 AM - 9:15 AM
      } else {
        return 'absent'; // After 9:15 AM or before 6:00 AM
      }
    }
    
    // For other event types, compare with event start time
    if (eventStartTime) {
      const [startHour, startMinute] = eventStartTime.split(':').map(Number);
      const startTotalMinutes = startHour * 60 + startMinute;
      const checkInHour = checkIn.getHours();
      const checkInMinute = checkIn.getMinutes();
      const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
      
      // Present: On time or up to 15 minutes late
      if (checkInTotalMinutes <= startTotalMinutes + 15) {
        return 'present';
      }
      // Late: 15-30 minutes late
      else if (checkInTotalMinutes <= startTotalMinutes + 30) {
        return 'late';
      }
      // Absent: More than 30 minutes late
      else {
        return 'absent';
      }
    }
    
    return 'present'; // Default
  };

  // Helper function to check if event can be scanned
  const canScanEvent = (event) => {
    if (!event || event.status !== 'approved') return false;
    
    const today = new Date().toISOString().split('T')[0];
    const eventDate = event.event_date;
    
    // Only allow scanning for today's events or past events (not future/upcoming)
    return eventDate <= today;
  };

  // Fetch all approved events
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await eventService.getAllEvents();
      if (error) throw error;
      
      // Sort events correctly with today's events first
      const today = new Date().toISOString().split('T')[0];
      const sortedEvents = (data || []).sort((a, b) => {
        const dateA = new Date(a.event_date);
        const dateB = new Date(b.event_date);
        
        // Today's events first
        if (a.event_date === today && b.event_date !== today) return -1;
        if (a.event_date !== today && b.event_date === today) return 1;
        
        // Both are today or both are not today
        if (dateA >= new Date(today) && dateB >= new Date(today)) {
          // Both future/upcoming: nearest first
          return dateA - dateB;
        } else if (dateA < new Date(today) && dateB < new Date(today)) {
          // Both past: most recent first
          return dateB - dateA;
        } else {
          // Mixed past and future: future first
          return dateA < new Date(today) ? 1 : -1;
        }
      });
      
      setEvents(sortedEvents);
      
      // Check if there's an approved event today
      const todayApprovedEvents = sortedEvents.filter(e => 
        e.event_date === today && e.status === 'approved'
      );
      setHasEventToday(todayApprovedEvents.length > 0);
      
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all active workers
  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('status', 'Active')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  // FIXED: Filter events based on selected filters with proper "today" logic
  const getFilteredEvents = () => {
    const today = new Date().toISOString().split('T')[0];
    let filtered = events;
    
    // Apply event date filter
    switch(eventFilter) {
      case 'today':
        // NEW: Only events happening today
        filtered = filtered.filter(event => event.event_date === today);
        break;
      case 'upcoming':
        // Only future approved events (excluding today)
        filtered = filtered.filter(event => 
          event.event_date > today && event.status === 'approved'
        );
        break;
      case 'past':
        // Past events only (excluding today)
        filtered = filtered.filter(event => event.event_date < today);
        break;
      case 'approved':
        // All approved events
        filtered = filtered.filter(event => event.status === 'approved');
        break;
      case 'all':
      default:
        // FIXED: Show all events without filtering
        break;
    }
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(event => event.type === typeFilter);
    }
    
    return filtered;
  };

  // Navigate to scanner page with selected event
  const openScanner = (eventToScan = null) => {
    const eventForScanner = eventToScan || selectedEvent;
    
    // CRITICAL: Block scanner if event is not approved
    if (eventForScanner && eventForScanner.status !== 'approved') {
      alert('Cannot scan attendance for unapproved events. Please wait for admin approval.');
      return;
    }
    
    // FIXED: Block scanner for upcoming events
    if (eventForScanner && !canScanEvent(eventForScanner)) {
      alert('Cannot scan attendance for upcoming events. Scanning is only available for today\'s events.');
      return;
    }
    
    if (!eventForScanner) {
      // No event selected, let scanner auto-select (only approved events)
      navigate('/scanner');
    } else {
      // Pass the selected event to the scanner via navigation state
      navigate('/scanner', { 
        state: { selectedEvent: eventForScanner } 
      });
    }
  };

  // View attendance for an event
  const viewAttendance = async (event) => {
    // Allow viewing for all approved events (both upcoming and past)
    if (event.status !== 'approved') {
      alert('Cannot view attendance for unapproved events. Please wait for admin approval.');
      return;
    }
    
    setSelectedEvent(event);
    setShowEventsPanel(false);
    await fetchAttendance(event.id);
  };

  // FIXED: Fetch attendance with proper status calculation
  const fetchAttendance = async (eventId) => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event || event.status !== 'approved') {
        alert('Cannot access attendance for unapproved events.');
        setSelectedEvent(null);
        return;
      }

      const { data, error } = await eventService.getEventAttendance(eventId);
      
      if (error) throw error;
      
      // FIXED: Calculate status for each attendance record
      const recordsWithStatus = (data || []).map(record => {
        const status = calculateAttendanceStatus(
          record.check_in_time, 
          event.start_time, 
          event.type
        );
        return { ...record, status };
      });
      
      setAttendanceRecords(recordsWithStatus);
      
      // FIXED: Calculate accurate summary statistics
      const totalWorkers = workers.length;
      const scanned = recordsWithStatus.length;
      const presentCount = recordsWithStatus.filter(r => r.status === 'present').length;
      const lateCount = recordsWithStatus.filter(r => r.status === 'late').length;
      const absentCount = recordsWithStatus.filter(r => r.status === 'absent').length;
      const notScanned = totalWorkers - scanned;
      
      setSummary({
        scanned,
        absent: notScanned,
        totalWorkers,
        presentCount,
        lateCount,
        absentCount
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Manually add attendance
  const manuallyAddAttendance = async (workerId) => {
    try {
      if (!selectedEvent || selectedEvent.status !== 'approved') {
        alert('Cannot add attendance for unapproved events.');
        return;
      }

      // FIXED: Check if event can be scanned
      if (!canScanEvent(selectedEvent)) {
        alert('Cannot add attendance for upcoming events.');
        return;
      }

      const worker = workers.find(w => w.id === workerId);
      
      if (!worker) {
        alert('Worker not found');
        return;
      }

      const alreadyScanned = attendanceRecords.some(record => 
        record.worker_id === worker.id
      );

      if (alreadyScanned) {
        setScanMessage(`${worker.name} already checked in`);
        setScanMessageType('warning');
        setTimeout(() => setScanMessage(''), 3000);
        return;
      }

      const { error } = await eventService.recordAttendance(
        selectedEvent.id,
        worker.id,
        'manual'
      );

      if (error) {
        if (error.message === 'Already checked in to this event') {
          setScanMessage(`${worker.name} already checked in`);
          setScanMessageType('warning');
        } else {
          throw error;
        }
      } else {
        setScanMessage(`✓ ${worker.name} added!`);
        setScanMessageType('success');
        await fetchAttendance(selectedEvent.id);
      }
      
      setTimeout(() => setScanMessage(''), 3000);
    } catch (error) {
      console.error('Error adding attendance:', error);
      alert('Failed to add attendance');
    }
  };

  // Export attendance to CSV
  const exportAttendance = async () => {
    try {
      if (!selectedEvent) {
        alert('Please select an event first');
        return;
      }

      if (selectedEvent.status !== 'approved') {
        alert('Cannot export attendance for unapproved events.');
        return;
      }

      const csvContent = await eventService.exportEventAttendance(selectedEvent.id);
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${selectedEvent.title}-${selectedEvent.event_date}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert('Failed to export attendance');
    }
  };

  // Filter workers for manual search
  const filteredWorkers = workers.filter(worker => {
    const searchTerm = manualWorkerSearch.toLowerCase();
    return (
      !attendanceRecords.some(record => record.worker_id === worker.id) &&
      (worker.name.toLowerCase().includes(searchTerm) ||
       worker.ministry.toLowerCase().includes(searchTerm))
    );
  });

  // Memoized sorted events for display
  const sortedFilteredEvents = useMemo(() => {
    const filtered = getFilteredEvents();
    const today = new Date().toISOString().split('T')[0];
    
    return filtered.sort((a, b) => {
      const dateA = new Date(a.event_date);
      const dateB = new Date(b.event_date);
      
      // Today's events first
      if (a.event_date === today && b.event_date !== today) return -1;
      if (a.event_date !== today && b.event_date === today) return 1;
      
      // For upcoming events (future dates): nearest first
      if (dateA > new Date(today) && dateB > new Date(today)) {
        return dateA - dateB;
      }
      
      // For past events: most recent first
      if (dateA < new Date(today) && dateB < new Date(today)) {
        return dateB - dateA;
      }
      
      // Mixed: upcoming before past
      return dateA < new Date(today) ? 1 : -1;
    });
  }, [events, eventFilter, typeFilter]);

  // FIXED: Get event type display with proper labels
  const getEventTypeDisplay = (type) => {
    const eventType = eventTypes.find(t => t.value === type);
    return eventType ? eventType.label : type?.replace('_', ' ') || 'Event';
  };

  // FIXED: Get status badge styling
  const getStatusBadge = (status) => {
    switch(status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Initialize
  useEffect(() => {
    fetchEvents();
    fetchWorkers();
  }, []);

  // Real-time attendance updates
  useEffect(() => {
    if (!selectedEvent) return;
    
    if (selectedEvent.status !== 'approved') {
      setSelectedEvent(null);
      return;
    }

    const channel = supabase
      .channel(`event-attendance-${selectedEvent.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_attendance',
          filter: `event_id=eq.${selectedEvent.id}`
        },
        () => {
          fetchAttendance(selectedEvent.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEvent]);

  // Mobile responsive breakpoints
  const isMobile = window.innerWidth < 768;

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
        {/* Header - IMPROVED UI */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                Event Attendance
              </h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                Scan QR codes and manage attendance for church events
              </p>
            </div>
            
            {/* Scanner Button - Prominent in Header */}
            <button
              onClick={() => openScanner()}
              className={`cursor-pointer flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                hasEventToday 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 ring-2 ring-green-400 ring-offset-2' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              <ScanLine className="w-5 h-5" />
              <span className="hidden md:inline">
                {hasEventToday ? 'Scan Attendance Now' : 'Open Scanner'}
              </span>
              <span className="md:hidden">Scan</span>
            </button>
          </div>

          {/* Mobile Toggle for Events Panel */}
          {isMobile && selectedEvent && (
            <button
              onClick={() => setShowEventsPanel(!showEventsPanel)}
              className="md:hidden bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm w-full mb-4 font-medium"
            >
              {showEventsPanel ? 'Hide Events' : 'Show Events'}
            </button>
          )}

          {/* FIXED: Event Filter Tabs for Mobile - Including "Today" */}
          <div className="md:hidden mb-4 space-y-3">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {['all', 'today', 'upcoming', 'past', 'approved'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setEventFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                    eventFilter === filter
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {filter === 'all' ? 'All Events' : 
                   filter === 'today' ? 'Today' :
                   filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Mobile Type Filter */}
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {eventTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                    typeFilter === type.value
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Events List Panel - IMPROVED UI */}
          <div className={`lg:w-1/3 ${isMobile && !showEventsPanel ? 'hidden' : 'block'}`}>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Events ({sortedFilteredEvents.length})
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Select event to view attendance
                    </p>
                  </div>
                  
                  {/* FIXED: Desktop Filters - Including "Today" */}
                  <div className="hidden md:flex gap-2">
                    {/* Date Filter */}
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      className="cursor-pointer text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="all">All Events</option>
                      <option value="today">Today's Events</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past Events</option>
                      <option value="approved">Approved Only</option>
                    </select>
                    
                    {/* Type Filter */}
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="cursor-pointer text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {eventTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
                  </div>
                ) : sortedFilteredEvents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="font-semibold text-gray-700 text-lg">No events found</p>
                    <p className="text-sm mt-2">Try changing your filters</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {sortedFilteredEvents.map(event => {
                      const isApproved = event.status === 'approved';
                      const isToday = event.event_date === new Date().toISOString().split('T')[0];
                      const canScan = canScanEvent(event);
                      const eventType = eventTypes.find(t => t.value === event.type) || 
                                       eventTypes.find(t => t.value === 'all');
                      
                      return (
                        <div
                          key={event.id}
                          onClick={() => isApproved && viewAttendance(event)}
                          className={`border-2 rounded-xl p-4 transition-all ${
                            !isApproved 
                              ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200' 
                              : 'cursor-pointer hover:border-blue-400 hover:shadow-md transform hover:-translate-y-0.5'
                          } ${
                            selectedEvent?.id === event.id
                              ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-300'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900 text-base line-clamp-2 mb-2">
                                {event.title}
                              </h3>
                              {!isApproved && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-medium mb-2">
                                  <AlertCircle className="w-3 h-3" />
                                  Pending Approval
                                </span>
                              )}
                            </div>
                            
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ml-2 flex-shrink-0 ${eventType?.color || 'bg-gray-100 text-gray-800'}`}>
                              {getEventTypeDisplay(event.type)}
                            </span>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700 font-medium">
                                {new Date(event.event_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              {isToday && (
                                <span className="text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full">
                                  TODAY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700">
                                {event.start_time} - {event.end_time}
                              </span>
                            </div>
                            {event.place && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-sm text-gray-700 truncate">
                                  {event.place}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewAttendance(event);
                              }}
                              disabled={!isApproved}
                              className={`cursor-pointer flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                                isApproved
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <UserCheck className="w-4 h-4" />
                              View
                            </button>
                            
                            {/* FIXED: Quick Scan Button - Disabled for upcoming events */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openScanner(event);
                              }}
                              disabled={!canScan}
                              className={`cursor-pointer px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                                canScan
                                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                              title={!canScan ? 'Scanning only available for today\'s events' : 'Scan attendance'}
                            >
                              <ScanLine className="w-4 h-4" />
                              Scan
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Attendance Details Panel - IMPROVED UI */}
          <div className={`lg:w-2/3 ${isMobile && showEventsPanel ? 'hidden' : 'block'}`}>
            {selectedEvent ? (
              <div className="space-y-5">
                {/* Event Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                          {selectedEvent.title}
                        </h2>
                        {selectedEvent.status !== 'approved' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            Pending Approval
                          </span>
                        )}
                        <span className={`px-3 py-1.5 text-xs font-bold rounded-full border ${
                          eventTypes.find(t => t.value === selectedEvent.type)?.color || 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>
                          {getEventTypeDisplay(selectedEvent.type)}
                        </span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <span className="text-sm md:text-base font-medium">
                            {new Date(selectedEvent.event_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          {selectedEvent.event_date === new Date().toISOString().split('T')[0] && (
                            <span className="text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2.5 py-1 rounded-full">
                              TODAY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <span className="text-sm md:text-base font-medium">
                            {selectedEvent.start_time} - {selectedEvent.end_time}
                          </span>
                        </div>
                        {selectedEvent.place && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            <span className="text-sm md:text-base font-medium truncate">
                              {selectedEvent.place}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {/* FIXED: Scan Button - Disabled if upcoming */}
                      <button
                        onClick={() => openScanner(selectedEvent)}
                        disabled={!canScanEvent(selectedEvent)}
                        className={`cursor-pointer px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 flex-1 md:flex-none min-w-[120px] shadow-md ${
                          canScanEvent(selectedEvent)
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white hover:shadow-lg'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title={!canScanEvent(selectedEvent) ? 'Scanning only available for today\'s events' : 'Scan QR codes'}
                      >
                        <ScanLine className="w-4 h-4" />
                        <span className="hidden md:inline">Scan QR</span>
                        <span className="md:hidden">Scan</span>
                      </button>
                      
                      {/* Export Button */}
                      <button
                        onClick={exportAttendance}
                        disabled={selectedEvent.status !== 'approved'}
                        className={`cursor-pointer px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 flex-1 md:flex-none min-w-[120px] shadow-md ${
                          selectedEvent.status === 'approved'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-lg'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">Export CSV</span>
                        <span className="md:hidden">Export</span>
                      </button>
                    </div>
                  </div>

                  {/* Scan Message */}
                  {scanMessage && (
                    <div className={`mt-4 p-4 rounded-xl font-semibold text-sm md:text-base border-2 ${
                      scanMessageType === 'success' 
                        ? 'bg-green-50 text-green-800 border-green-200' 
                        : scanMessageType === 'warning'
                        ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                        : scanMessageType === 'error'
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                      {scanMessage}
                    </div>
                  )}
                </div>

                {/* FIXED: Statistics Cards with proper color coding */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-6 h-6" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Total
                      </h3>
                    </div>
                    <p className="text-3xl md:text-4xl font-extrabold">{summary.totalWorkers}</p>
                    <p className="text-sm text-blue-100 mt-1 font-medium">Workers</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <UserCheck className="w-6 h-6" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Present
                      </h3>
                    </div>
                    <p className="text-3xl md:text-4xl font-extrabold">{summary.presentCount}</p>
                    <p className="text-sm text-green-100 mt-1 font-medium">On Time</p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-6 h-6" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Late
                      </h3>
                    </div>
                    <p className="text-3xl md:text-4xl font-extrabold">{summary.lateCount}</p>
                    <p className="text-sm text-yellow-100 mt-1 font-medium">Arrivals</p>
                  </div>

                  <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <UserX className="w-6 h-6" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Absent
                      </h3>
                    </div>
                    <p className="text-3xl md:text-4xl font-extrabold">{summary.absent}</p>
                    <p className="text-sm text-red-100 mt-1 font-medium">Not Scanned</p>
                  </div>
                </div>

                {/* FIXED: Manual Entry Section - Only for scannable events */}
                {canScanEvent(selectedEvent) ? (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 md:p-6">
                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Search className="w-5 h-5 text-blue-600" />
                          Manual Entry
                        </h3>
                        <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      
                      <div className="mt-4">
                        <div className="mb-4">
                          <input
                            type="text"
                            placeholder="Search workers by name or ministry..."
                            value={manualWorkerSearch}
                            onChange={(e) => setManualWorkerSearch(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                          {filteredWorkers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8 col-span-full font-medium">
                              {manualWorkerSearch ? 'No workers found' : 'All workers checked in'}
                            </p>
                          ) : (
                            filteredWorkers.map(worker => (
                              <div key={worker.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-gray-900 text-sm truncate">{worker.name}</p>
                                  <p className="text-xs text-gray-600 truncate font-medium">{worker.ministry}</p>
                                </div>
                                <button
                                  onClick={() => manuallyAddAttendance(worker.id)}
                                  className="cursor-pointer text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap ml-2 font-bold shadow-md hover:shadow-lg"
                                >
                                  Add
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                ) : selectedEvent.status !== 'approved' ? (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                    <h3 className="text-lg font-bold text-amber-900 mb-2">Event Pending Approval</h3>
                    <p className="text-amber-800 font-medium">
                      This event is awaiting admin approval. Attendance features will be available once approved.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 text-center">
                    <Calendar className="w-12 h-12 mx-auto text-blue-500 mb-3" />
                    <h3 className="text-lg font-bold text-blue-900 mb-2">Upcoming Event - View Only</h3>
                    <p className="text-blue-800 font-medium">
                      Scanning will be enabled on the event date. You can view this event in read-only mode.
                    </p>
                  </div>
                )}

                {/* FIXED: Attendance Records Table with proper status colors */}
                {selectedEvent.status === 'approved' && (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-gray-900">
                          Attendance Records ({attendanceRecords.length})
                        </h3>
                        <span className="text-sm text-gray-600 font-medium">
                          Updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>

                    {attendanceRecords.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <UserCheck className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <p className="font-bold text-gray-700 text-lg">No attendance records yet</p>
                        <p className="text-sm mt-2 mb-6 font-medium">
                          Start scanning QR codes to record attendance
                        </p>
                        {canScanEvent(selectedEvent) && (
                          <button
                            onClick={() => openScanner(selectedEvent)}
                            className="cursor-pointer inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl"
                          >
                            <ScanLine className="w-5 h-5" />
                            Open Scanner for {selectedEvent.title}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {/* Mobile View */}
                        <div className="md:hidden">
                          <div className="divide-y divide-gray-200">
                            {attendanceRecords.map((record) => (
                              <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <p className="font-bold text-gray-900">
                                      {record.worker?.name || 'Unknown'}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1 font-medium">
                                      {record.worker?.ministry || 'N/A'}
                                    </p>
                                  </div>
                                  <span className={`px-3 py-1.5 text-xs font-bold rounded-full border-2 ${getStatusBadge(record.status)}`}>
                                    {record.status?.toUpperCase() || 'PRESENT'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                  <span className="font-medium">
                                    {new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                  <span className={`px-2.5 py-1 text-xs rounded-full font-bold ${
                                    record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                    record.scan_type === 'manual' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                    'bg-gray-100 text-gray-800 border border-gray-200'
                                  }`}>
                                    {(record.scan_type || 'qr').toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Desktop Table */}
                        <table className="hidden md:table min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Ministry</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Check-in Time</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Method</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceRecords.map((record) => (
                              <tr key={record.id} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                  {record.worker?.name || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                  {record.worker?.ministry || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                  {new Date(record.check_in_time).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                                    record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                    record.scan_type === 'manual' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                    'bg-gray-100 text-gray-800 border-gray-200'
                                  }`}>
                                    {(record.scan_type || 'qr').toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-3 py-1.5 inline-flex text-xs font-bold rounded-full border-2 ${getStatusBadge(record.status)}`}>
                                    {record.status?.toUpperCase() || 'PRESENT'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
                <Calendar className="w-20 h-20 mx-auto text-blue-500 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Select an Event</h3>
                <p className="text-gray-600 mb-8 font-medium">
                  Choose an event from the list to view and manage attendance
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {isMobile && (
                    <button
                      onClick={() => setShowEventsPanel(true)}
                      className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl"
                    >
                      Show Events List
                    </button>
                  )}
                  <button
                    onClick={() => openScanner()}
                    className={`cursor-pointer flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all ${
                      hasEventToday
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                        : 'bg-gradient-to-r from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-700'
                    }`}
                  >
                    <ScanLine className="w-5 h-5" />
                    {hasEventToday ? 'Scan Attendance Now' : 'Open Scanner'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}