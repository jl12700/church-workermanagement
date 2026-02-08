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
  ArrowRight
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
  const [eventFilter, setEventFilter] = useState('all'); // all, upcoming, past
  const [typeFilter, setTypeFilter] = useState('all'); // all, sunday_service, training, meeting
  const [hasEventToday, setHasEventToday] = useState(false);

  // Event type options with icons
  const eventTypes = [
    { value: 'all', label: '---Filter All---' },
    { value: 'sunday_service', label: 'Sunday Service', color: 'bg-purple-100 text-purple-800' },
    { value: 'training', label: 'Training', color: 'bg-blue-100 text-blue-800' },
    { value: 'meeting', label: 'Meeting', color: 'bg-orange-100 text-orange-800' },
    { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' }
  ];

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
        if (dateA >= new Date() && dateB >= new Date()) {
          // Both future/upcoming: nearest first
          return dateA - dateB;
        } else if (dateA < new Date() && dateB < new Date()) {
          // Both past: most recent first
          return dateB - dateA;
        } else {
          // Mixed past and future: future first
          return dateA < new Date() ? 1 : -1;
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

  // Filter events based on selected filters
  const getFilteredEvents = () => {
    const today = new Date().toISOString().split('T')[0];
    
    let filtered = events;
    
    // Apply event date filter
    switch(eventFilter) {
      case 'upcoming':
        // Only future approved events (not today)
        filtered = filtered.filter(event => 
          event.event_date > today && event.status === 'approved'
        );
        break;
      case 'past':
        // Past events only
        filtered = filtered.filter(event => event.event_date < today);
        break;
      case 'approved':
        // All approved events
        filtered = filtered.filter(event => event.status === 'approved');
        break;
      default:
        // All events
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
    // CRITICAL: Block viewing attendance for unapproved events
    if (event.status !== 'approved') {
      alert('Cannot view attendance for unapproved events. Please wait for admin approval.');
      return;
    }
    
    setSelectedEvent(event);
    setShowEventsPanel(false);
    await fetchAttendance(event.id);
  };

  // Fetch attendance for selected event
  const fetchAttendance = async (eventId) => {
    try {
      // Double-check event is approved before fetching attendance
      const event = events.find(e => e.id === eventId);
      if (!event || event.status !== 'approved') {
        alert('Cannot access attendance for unapproved events.');
        setSelectedEvent(null);
        return;
      }

      const { data, error } = await eventService.getEventAttendance(eventId);
      
      if (error) throw error;
      setAttendanceRecords(data || []);
      
      // Get event summary statistics
      const { data: summaryData } = await eventService.getEventSummary(eventId);
      
      // Calculate summary
      const totalWorkers = workers.length;
      const scanned = data?.length || 0;
      const absent = totalWorkers - scanned;
      
      setSummary({
        scanned,
        absent,
        totalWorkers,
        presentCount: summaryData?.present_count || 0,
        lateCount: summaryData?.late_count || 0,
        absentCount: summaryData?.absent_count || 0
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Manually add attendance
  const manuallyAddAttendance = async (workerId) => {
    try {
      // Double-check event is approved
      if (!selectedEvent || selectedEvent.status !== 'approved') {
        alert('Cannot add attendance for unapproved events.');
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

      // CRITICAL: Block export for unapproved events
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
      if (dateA > new Date() && dateB > new Date()) {
        return dateA - dateB;
      }
      
      // For past events: most recent first
      if (dateA < new Date() && dateB < new Date()) {
        return dateB - dateA;
      }
      
      // Mixed: upcoming before past
      return dateA < new Date() ? 1 : -1;
    });
  }, [events, eventFilter, typeFilter]);

  // Get event type display
  const getEventTypeDisplay = (type, status) => {
    if (type === 'sunday_service') return 'Sunday Service';
    if (type === 'training') return 'Training';
    if (type === 'meeting') return 'Meeting';
    if (type) return type.replace('_', ' ');
    return status;
  };

  // Initialize
  useEffect(() => {
    fetchEvents();
    fetchWorkers();
  }, []);

  // Real-time attendance updates
  useEffect(() => {
    if (!selectedEvent) return;
    
    // Double-check event is approved before subscribing
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
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Event Attendance</h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                Scan QR codes to record attendance for events
              </p>
            </div>
            
            {/* Scanner Button - Prominent in Header */}
            <button
              onClick={() => openScanner()}
              className={`cursor-pointer flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all shadow-md ${
                hasEventToday 
                  ? 'bg-green-600 text-white hover:bg-green-700 animate-pulse' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
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
              className="md:hidden bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm w-full mb-4"
            >
              {showEventsPanel ? 'Hide Events' : 'Show Events'}
            </button>
          )}

          {/* Event Filter Tabs for Mobile */}
          <div className="md:hidden mb-4 space-y-4">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {['all', 'upcoming', 'past', 'approved'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setEventFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                    eventFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Mobile Type Filter */}
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {eventTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                    typeFilter === type.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Events List Panel */}
          <div className={`lg:w-1/3 ${isMobile && !showEventsPanel ? 'hidden' : 'block'}`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      Events ({sortedFilteredEvents.length})
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Select event to view attendance
                    </p>
                  </div>
                  
                  {/* Desktop Filters */}
                  <div className="hidden md:flex gap-2">
                    {/* Date Filter */}
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      className="cursor-pointer text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">---All Events---</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past Events</option>
                      <option value="approved">Approved Only</option>
                    </select>
                    
                    {/* Type Filter */}
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="cursor-pointer text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : sortedFilteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="font-medium">No events found</p>
                    <p className="text-sm mt-2">Try changing your filters</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {sortedFilteredEvents.map(event => {
                      const isApproved = event.status === 'approved';
                      const isToday = event.event_date === new Date().toISOString().split('T')[0];
                      const eventType = eventTypes.find(t => t.value === event.type) || 
                                       eventTypes.find(t => t.value === 'other');
                      
                      return (
                        <div
                          key={event.id}
                          onClick={() => isApproved && viewAttendance(event)}
                          className={`border rounded-xl p-4 transition-all ${
                            !isApproved 
                              ? 'opacity-75 cursor-not-allowed bg-gray-50' 
                              : 'cursor-pointer active:scale-[0.98] hover:border-blue-300 hover:bg-gray-50'
                          } ${
                            selectedEvent?.id === event.id
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-800 text-base line-clamp-2">
                                {event.title}
                                {!isApproved && (
                                  <span className="ml-2 text-xs text-gray-500">(Pending Approval)</span>
                                )}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {new Date(event.event_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                  {isToday && (
                                    <span className="ml-2 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                      Today
                                    </span>
                                  )}
                                </span>
                                <Clock className="w-4 h-4 text-gray-400 ml-2" />
                                <span className="text-sm text-gray-600">
                                  {event.start_time}
                                </span>
                              </div>
                              {event.place && (
                                <div className="flex items-center gap-2 mt-1">
                                  <MapPin className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600 truncate">
                                    {event.place}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ml-2 ${eventType?.color || 'bg-gray-100 text-gray-800'}`}>
                              {getEventTypeDisplay(event.type, event.status)}
                            </span>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewAttendance(event);
                              }}
                              disabled={!isApproved}
                              className={`cursor-pointer flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                isApproved
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              <UserCheck className="w-4 h-4" />
                              View
                            </button>
                            
                            {/* Quick Scan Button for this specific event */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openScanner(event);
                              }}
                              disabled={!isApproved}
                              className={`cursor-pointer px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                isApproved
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
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

          {/* Attendance Details Panel */}
          <div className={`lg:w-2/3 ${isMobile && showEventsPanel ? 'hidden' : 'block'}`}>
            {selectedEvent ? (
              <div className="space-y-4 md:space-y-6">
                {/* Event Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 break-words">
                          {selectedEvent.title}
                        </h2>
                        {selectedEvent.status !== 'approved' && (
                          <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                            Pending Approval
                          </span>
                        )}
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          selectedEvent.type === 'sunday_service' ? 'bg-purple-100 text-purple-800' :
                          selectedEvent.type === 'training' ? 'bg-blue-100 text-blue-800' :
                          selectedEvent.type === 'meeting' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getEventTypeDisplay(selectedEvent.type, selectedEvent.status)}
                        </span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm md:text-base">
                            {new Date(selectedEvent.event_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          {selectedEvent.event_date === new Date().toISOString().split('T')[0] && (
                            <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm md:text-base">
                            {selectedEvent.start_time} - {selectedEvent.end_time}
                          </span>
                        </div>
                        {selectedEvent.place && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm md:text-base truncate">
                              {selectedEvent.place}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {/* Scan Button - Disabled if event not approved */}
                      <button
                        onClick={() => openScanner(selectedEvent)}
                        disabled={selectedEvent.status !== 'approved'}
                        className={`cursor-pointer px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 flex-1 md:flex-none min-w-[120px] ${
                          selectedEvent.status === 'approved'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <ScanLine className="w-4 h-4" />
                        <span className="hidden md:inline">Scan QR</span>
                        <span className="md:hidden">Scan</span>
                      </button>
                      
                      {/* Export Button - Disabled if event not approved */}
                      <button
                        onClick={exportAttendance}
                        disabled={selectedEvent.status !== 'approved'}
                        className={`cursor-pointer px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 flex-1 md:flex-none min-w-[120px] ${
                          selectedEvent.status === 'approved'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">Export</span>
                        <span className="md:hidden">CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Scan Message */}
                  {scanMessage && (
                    <div className={`mt-4 p-3 rounded-lg font-medium text-sm md:text-base ${
                      scanMessageType === 'success' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : scanMessageType === 'warning'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        : scanMessageType === 'error'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {scanMessage}
                    </div>
                  )}
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-blue-600 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Total
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.totalWorkers}</p>
                    <p className="text-xs md:text-sm text-blue-100 mt-1">Workers</p>
                  </div>

                  <div className="bg-green-600 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Present
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.scanned}</p>
                    <p className="text-xs md:text-sm text-green-100 mt-1">Checked In</p>
                  </div>

                  <div className="bg-yellow-600 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Late
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.lateCount}</p>
                    <p className="text-xs md:text-sm text-yellow-100 mt-1">Arrivals</p>
                  </div>

                  <div className="bg-red-600 rounded-xl p-4 text-white shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <UserX className="w-5 h-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Absent
                      </h3>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold">{summary.absent}</p>
                    <p className="text-xs md:text-sm text-red-100 mt-1">Not Scanned</p>
                  </div>
                </div>

                {/* Manual Entry Section - Only show for approved events */}
                {selectedEvent.status === 'approved' ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <Search className="w-5 h-5" />
                          Manual Entry
                        </h3>
                        <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      
                      <div className="mt-4">
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Search workers by name or ministry..."
                            value={manualWorkerSearch}
                            onChange={(e) => setManualWorkerSearch(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                          {filteredWorkers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8 col-span-full">
                              {manualWorkerSearch ? 'No workers found' : 'All workers checked in'}
                            </p>
                          ) : (
                            filteredWorkers.map(worker => (
                              <div key={worker.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm truncate">{worker.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{worker.ministry}</p>
                                </div>
                                <button
                                  onClick={() => manuallyAddAttendance(worker.id)}
                                  className="cursor-pointer text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors whitespace-nowrap ml-2"
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
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                    <Clock className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">Event Pending Approval</h3>
                    <p className="text-yellow-700">
                      This event is awaiting admin approval. Attendance features will be available once approved.
                    </p>
                  </div>
                )}

                {/* Attendance Records Table - Only show for approved events */}
                {selectedEvent.status === 'approved' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Attendance Records ({attendanceRecords.length})
                        </h3>
                        <span className="text-sm text-gray-500">
                          Updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>

                    {attendanceRecords.length === 0 ? (
                      <div className="text-center py-8 md:py-12 text-gray-500">
                        <UserCheck className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="font-medium">No attendance records yet</p>
                        <p className="text-sm mt-2 mb-4">
                          Start scanning QR codes to record attendance
                        </p>
                        <button
                          onClick={() => openScanner(selectedEvent)}
                          className="cursor-pointer inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                          <ScanLine className="w-5 h-5" />
                          Open Scanner for {selectedEvent.title}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {/* Mobile View */}
                        <div className="md:hidden">
                          <div className="divide-y divide-gray-200">
                            {attendanceRecords.map((record) => (
                              <div key={record.id} className="p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {record.worker?.name || 'Unknown'}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {record.worker?.ministry || 'N/A'}
                                    </p>
                                  </div>
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    record.status === 'present' ? 'bg-green-100 text-green-800' :
                                    record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {record.status?.charAt(0).toUpperCase() + record.status?.slice(1) || 'Present'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                                  <span>
                                    {new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800' :
                                    record.scan_type === 'manual' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {record.scan_type || 'qr'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Desktop Table */}
                        <table className="hidden md:table min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Time</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceRecords.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {record.worker?.name || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {record.worker?.ministry || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {new Date(record.check_in_time).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    record.scan_type === 'qr' ? 'bg-blue-100 text-blue-800' :
                                    record.scan_type === 'manual' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {record.scan_type || 'qr'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    record.status === 'present' ? 'bg-green-100 text-green-800' :
                                    record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {record.status?.charAt(0).toUpperCase() + record.status?.slice(1) || 'Present'}
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <Calendar className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Select an Event</h3>
                <p className="text-gray-600 mb-6">
                  Choose an event from the list to view and manage attendance
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {isMobile && (
                    <button
                      onClick={() => setShowEventsPanel(true)}
                      className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                    >
                      Show Events List
                    </button>
                  )}
                  <button
                    onClick={() => openScanner()}
                    className={`cursor-pointer flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium ${
                      hasEventToday
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
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