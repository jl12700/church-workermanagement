import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';
import { eventService } from '../database/eventService';
import {
  Search, ScanLine, X, Download, UserCheck, UserX,
  Clock, Users, Calendar, MapPin, Filter, ArrowRight, AlertCircle
} from 'lucide-react';

// ✅ Timezone-safe local date string helper
const getLocalDateString = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
  const [eventFilter, setEventFilter] = useState('month');
  const [typeFilter, setTypeFilter] = useState('all');
  const [hasEventToday, setHasEventToday] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showEndEventModal, setShowEndEventModal] = useState(false);
  const [endEventData, setEndEventData] = useState({
    totalAttendees: '',
    totalVisitors: '',
    totalBaptized: ''
  });
  const [endEventErrors, setEndEventErrors] = useState({});

  const eventTypes = [
    { value: 'all', label: 'All Types', color: 'bg-gray-50 text-gray-700 border-gray-200' },
    { value: 'sunday_service', label: 'Sunday Service', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { value: 'event', label: 'Church Event', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'meeting', label: 'Meetings', color: 'bg-orange-50 text-orange-700 border-orange-200' }
  ];

  const isEventManuallyEnded = (event) => event?.is_ended === true;

  const isEventFinished = (event) => {
    if (!event || event.status !== 'approved') return false;
    const today = getLocalDateString(); // ✅ Fixed
    const eventDate = event.event_date;

    if (eventDate < today) return true;

    if (eventDate === today && event.end_time) {
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0];
      let endTime = event.end_time;
      if (endTime.length === 5) endTime += ':00';
      return currentTime > endTime;
    }
    return false;
  };

  const canScanEvent = (event) => {
    if (!event || event.status !== 'approved') return false;
    if (isEventManuallyEnded(event)) return false;
    const today = getLocalDateString(); // ✅ Fixed
    return event.event_date === today;
  };

  const calculateAttendanceStatus = (checkInTime, eventStartTime, eventPrepTime, eventDevotionTime) => {
    const checkIn = new Date(checkInTime);
    const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();

    const parseTime = (timeStr) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const prepMinutes = parseTime(eventPrepTime);
    const devotionMinutes = parseTime(eventDevotionTime);

    if (prepMinutes !== null && devotionMinutes !== null) {
      if (checkInMinutes >= prepMinutes && checkInMinutes <= devotionMinutes) return 'present';
      if (checkInMinutes > devotionMinutes) return 'late';
    }

    if (eventStartTime) {
      const [startHour, startMinute] = eventStartTime.split(':').map(Number);
      const startTotalMinutes = startHour * 60 + startMinute;
      if (checkInMinutes <= startTotalMinutes + 15) return 'present';
      return 'late';
    }

    return 'present';
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const monthStart = getLocalDateString(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)); // ✅ Fixed
      const monthEnd = getLocalDateString(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)); // ✅ Fixed

      const { data, error } = await eventService.getAllEvents({
        startDate: eventFilter === 'month' ? monthStart : undefined,
        endDate: eventFilter === 'month' ? monthEnd : undefined
      });

      if (error) throw error;

      const today = getLocalDateString(); // ✅ Fixed
      const sortedEvents = (data || []).sort((a, b) => {
        const dateA = new Date(a.event_date);
        const dateB = new Date(b.event_date);
        const todayDate = new Date(today);

        if (a.event_date === today && b.event_date !== today) return -1;
        if (a.event_date !== today && b.event_date === today) return 1;
        if (dateA >= todayDate && dateB >= todayDate) return dateA - dateB;
        if (dateA < todayDate && dateB < todayDate) return dateB - dateA;
        return dateA < todayDate ? 1 : -1;
      });

      setEvents(sortedEvents);

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

  const getFilteredEvents = () => {
    const today = getLocalDateString(); // ✅ Fixed
    let filtered = events;

    switch (eventFilter) {
      case 'today':
        filtered = filtered.filter(event => event.event_date === today);
        break;
      case 'upcoming':
        filtered = filtered.filter(event =>
          event.event_date > today && event.status === 'approved'
        );
        break;
      case 'past':
        filtered = filtered.filter(event => event.event_date < today);
        break;
      case 'approved':
        filtered = filtered.filter(event => event.status === 'approved');
        break;
      case 'month': {
        const monthStart = getLocalDateString(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)); // ✅ Fixed
        const monthEnd = getLocalDateString(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)); // ✅ Fixed
        filtered = filtered.filter(event => event.event_date >= monthStart && event.event_date <= monthEnd);
        break;
      }
      case 'all':
      default:
        break;
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(event => event.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => {
        const titleMatch = event.title?.toLowerCase().includes(query);
        const dateMatch = event.event_date?.includes(query);
        const typeMatch = event.type?.toLowerCase().includes(query);
        const formattedDate = new Date(event.event_date + 'T00:00:00') // ✅ Prevent date shift in display
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          .toLowerCase()
          .includes(query);
        return titleMatch || dateMatch || typeMatch || formattedDate;
      });
    }

    return filtered;
  };

  const openScanner = (eventToScan = null) => {
    const eventForScanner = eventToScan || selectedEvent;

    if (eventForScanner && eventForScanner.status !== 'approved') {
      alert('Cannot scan attendance for unapproved events. Please wait for admin approval.');
      return;
    }

    if (eventForScanner && !canScanEvent(eventForScanner)) {
      alert('Scanning is only available for today\'s events that have not been manually ended.');
      return;
    }

    if (!eventForScanner) {
      navigate('/scanner');
    } else {
      navigate('/scanner', { state: { selectedEvent: eventForScanner } });
    }
  };

  const viewAttendance = async (event) => {
    if (event.status !== 'approved') {
      alert('Cannot view attendance for unapproved events. Please wait for admin approval.');
      return;
    }

    setSelectedEvent(event);
    setShowEventsPanel(false);
    await fetchAttendance(event.id);
  };

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

      const recordsWithStatus = (data || []).map(record => {
        const status = calculateAttendanceStatus(
          record.check_in_time,
          event.start_time,
          event.prep_time,
          event.devotion_time
        );
        return { ...record, status };
      });

      setAttendanceRecords(recordsWithStatus);

      const totalWorkers = workers.length;
      const scanned = recordsWithStatus.length;
      const presentCount = recordsWithStatus.filter(r => r.status === 'present').length;
      const lateCount = recordsWithStatus.filter(r => r.status === 'late').length;
      const absentCount = isEventManuallyEnded(event) ? (totalWorkers - scanned) : 0;
      const notScanned = totalWorkers - scanned;

      setSummary({ scanned, absent: notScanned, totalWorkers, presentCount, lateCount, absentCount });
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const manuallyAddAttendance = async (workerId) => {
    try {
      if (!selectedEvent || selectedEvent.status !== 'approved') {
        alert('Cannot add attendance for unapproved events.');
        return;
      }

      if (!canScanEvent(selectedEvent)) {
        alert('Cannot add attendance – event is not available for scanning.');
        return;
      }

      const worker = workers.find(w => w.id === workerId);
      if (!worker) { alert('Worker not found'); return; }

      const alreadyScanned = attendanceRecords.some(record => record.worker_id === worker.id);
      if (alreadyScanned) {
        setScanMessage(`${worker.name} already checked in`);
        setScanMessageType('warning');
        setTimeout(() => setScanMessage(''), 3000);
        return;
      }

      const { error } = await eventService.recordAttendance(selectedEvent.id, worker.id, 'manual');

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

  const validateEndEventForm = () => {
    const errors = {};
    if (!endEventData.totalAttendees || endEventData.totalAttendees === '') {
      errors.totalAttendees = 'Total attendees is required';
    } else if (isNaN(endEventData.totalAttendees) || parseInt(endEventData.totalAttendees) < 0) {
      errors.totalAttendees = 'Must be a valid non-negative number';
    }
    if (!endEventData.totalVisitors || endEventData.totalVisitors === '') {
      errors.totalVisitors = 'Total visitors is required';
    } else if (isNaN(endEventData.totalVisitors) || parseInt(endEventData.totalVisitors) < 0) {
      errors.totalVisitors = 'Must be a valid non-negative number';
    }
    if (!endEventData.totalBaptized || endEventData.totalBaptized === '') {
      errors.totalBaptized = 'Total baptized is required';
    } else if (isNaN(endEventData.totalBaptized) || parseInt(endEventData.totalBaptized) < 0) {
      errors.totalBaptized = 'Must be a valid non-negative number';
    }
    setEndEventErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEndEvent = async () => {
    if (!validateEndEventForm()) return;

    try {
      const { error } = await supabase
        .from('events')
        .update({
          is_ended: true,
          total_attendees: parseInt(endEventData.totalAttendees),
          total_visitors: parseInt(endEventData.totalVisitors),
          total_baptized: parseInt(endEventData.totalBaptized),
          ended_at: new Date().toISOString()
        })
        .eq('id', selectedEvent.id);

      if (error) throw error;

      const updatedEvent = {
        ...selectedEvent,
        is_ended: true,
        total_attendees: parseInt(endEventData.totalAttendees),
        total_visitors: parseInt(endEventData.totalVisitors),
        total_baptized: parseInt(endEventData.totalBaptized)
      };

      setEvents(events.map(e => e.id === selectedEvent.id ? updatedEvent : e));
      setSelectedEvent(updatedEvent);
      setShowEndEventModal(false);
      setEndEventData({ totalAttendees: '', totalVisitors: '', totalBaptized: '' });
      setEndEventErrors({});

      alert('Event ended successfully!');
      await fetchAttendance(selectedEvent.id);
    } catch (error) {
      console.error('Error ending event:', error);
      alert('Failed to end event');
    }
  };

  const exportAttendance = async () => {
    try {
      if (!selectedEvent) { alert('Please select an event first'); return; }
      if (selectedEvent.status !== 'approved') { alert('Cannot export attendance for unapproved events.'); return; }
      if (attendanceRecords.length === 0 && !isEventManuallyEnded(selectedEvent)) {
        alert('No attendance records to export for ongoing event');
        return;
      }

      let csvContent;

      if (attendanceRecords.length === 0) {
        const headers = ['Name', 'Ministry', 'Check-in Time', 'Status', 'Scan Type'];
        csvContent = headers.join(',') + '\n';
        csvContent += '"No attendance records","N/A","N/A","N/A","N/A"\n';
        if (selectedEvent.total_attendees != null || selectedEvent.total_visitors != null || selectedEvent.total_baptized != null) {
          csvContent += '\n"Event Summary"\n';
          csvContent += `"Total Attendees","${selectedEvent.total_attendees || 0}"\n`;
          csvContent += `"Total Visitors","${selectedEvent.total_visitors || 0}"\n`;
          csvContent += `"Total Baptized","${selectedEvent.total_baptized || 0}"\n`;
        }
      } else {
        csvContent = await eventService.exportEventAttendance(selectedEvent.id);
      }

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

  const filteredWorkers = workers.filter(worker => {
    const searchTerm = manualWorkerSearch.toLowerCase();
    return (
      !attendanceRecords.some(record => record.worker_id === worker.id) &&
      (worker.name.toLowerCase().includes(searchTerm) ||
        worker.ministry.toLowerCase().includes(searchTerm))
    );
  });

  const sortedFilteredEvents = useMemo(() => {
    const filtered = getFilteredEvents();
    const today = getLocalDateString(); // ✅ Fixed
    const todayDate = new Date(today + 'T00:00:00');

    return filtered.sort((a, b) => {
      const dateA = new Date(a.event_date + 'T00:00:00'); // ✅ Fixed
      const dateB = new Date(b.event_date + 'T00:00:00'); // ✅ Fixed

      if (a.event_date === today && b.event_date !== today) return -1;
      if (a.event_date !== today && b.event_date === today) return 1;
      if (dateA > todayDate && dateB > todayDate) return dateA - dateB;
      if (dateA < todayDate && dateB < todayDate) return dateB - dateA;
      return dateA < todayDate ? 1 : -1;
    });
  }, [events, eventFilter, typeFilter, searchQuery, selectedMonth]);

  const getEventTypeDisplay = (type) => {
    const eventType = eventTypes.find(t => t.value === type);
    return eventType ? eventType.label : type?.replace('_', ' ') || 'Event';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700 border-green-200';
      case 'late': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'absent': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchWorkers();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [selectedMonth, eventFilter]);

  useEffect(() => {
    if (!selectedEvent) return;
    if (selectedEvent.status !== 'approved') { setSelectedEvent(null); return; }

    const channel = supabase
      .channel(`event-attendance-${selectedEvent.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_attendance',
        filter: `event_id=eq.${selectedEvent.id}`
      }, () => {
        fetchAttendance(selectedEvent.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedEvent]);

  // ✅ today computed once for JSX, timezone-safe
  const today = getLocalDateString();

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Event Attendance</h1>
              <p className="mt-1 text-sm text-gray-600">
                Scan QR codes and manage attendance for church events
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-').map(Number);
                  setSelectedMonth(new Date(year, month - 1, 1));
                  setEventFilter('month');
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => { setSelectedMonth(new Date()); setEventFilter('today'); }}
                className="px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {selectedEvent && (
          <button
            onClick={() => setShowEventsPanel(!showEventsPanel)}
            className="lg:hidden w-full mb-4 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showEventsPanel ? 'Hide Events' : 'Show Events'}
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Events List Panel */}
          <div className={`lg:col-span-5 ${selectedEvent && !showEventsPanel ? 'hidden lg:block' : ''}`}>
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search events by name, date, or type..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Date</label>
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Events</option>
                      <option value="today">Today's Events</option>
                      <option value="month">This Month</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past Events</option>
                      <option value="approved">Approved Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {eventTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-900">
                    Events ({sortedFilteredEvents.length})
                  </h2>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                ) : sortedFilteredEvents.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-500">No events found</p>
                    <p className="text-xs text-gray-400 mt-1">Try changing your filters or search</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {sortedFilteredEvents.map(event => {
                      const isApproved = event.status === 'approved';
                      const isToday = event.event_date === today; // ✅ Fixed
                      const manuallyEnded = isEventManuallyEnded(event);
                      const canScan = canScanEvent(event);
                      const eventType = eventTypes.find(t => t.value === event.type) || eventTypes[0];

                      return (
                        <div
                          key={event.id}
                          onClick={() => isApproved && viewAttendance(event)}
                          className={`border rounded-lg p-4 transition-all ${
                            !isApproved
                              ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200'
                              : 'cursor-pointer hover:border-blue-400 hover:shadow-sm'
                          } ${
                            selectedEvent?.id === event.id
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 text-sm truncate mb-1">{event.title}</h3>
                              {!isApproved && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <AlertCircle className="w-3 h-3" />
                                  Pending Approval
                                </span>
                              )}
                              {manuallyEnded && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-300 ml-2">
                                  Ended
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isToday && (
                                <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                  TODAY
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${eventType.color}`}>
                                {getEventTypeDisplay(event.type)}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 mb-3 text-xs text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>
                                {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { // ✅ Fixed
                                  month: 'short', day: 'numeric', year: 'numeric'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span>{event.start_time} - {event.end_time}</span>
                            </div>
                            {event.place && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                <span className="truncate">{event.place}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); viewAttendance(event); }}
                              disabled={!isApproved}
                              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                                isApproved
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              View
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openScanner(event); }}
                              disabled={!canScan}
                              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                                canScan
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                              title={!canScan ? (manuallyEnded ? 'Event ended' : 'Scanning only available for today\'s events') : 'Scan attendance'}
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              {manuallyEnded ? 'Ended' : 'Scan'}
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
          <div className={`lg:col-span-7 ${selectedEvent && showEventsPanel ? 'hidden lg:block' : ''}`}>
            {selectedEvent ? (
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h2 className="text-lg font-semibold text-gray-900">{selectedEvent.title}</h2>
                        {selectedEvent.status !== 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded border border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            Pending Approval
                          </span>
                        )}
                        {isEventManuallyEnded(selectedEvent) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 rounded border border-gray-300">
                            Ended
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${
                          eventTypes.find(t => t.value === selectedEvent.type)?.color || 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {getEventTypeDisplay(selectedEvent.type)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            {new Date(selectedEvent.event_date + 'T00:00:00').toLocaleDateString('en-US', { // ✅ Fixed
                              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                            })}
                          </span>
                          {selectedEvent.event_date === today && ( // ✅ Fixed
                            <span className="ml-1 text-xs font-medium bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                              TODAY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>{selectedEvent.start_time} - {selectedEvent.end_time}</span>
                        </div>
                        {selectedEvent.place && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="truncate">{selectedEvent.place}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canScanEvent(selectedEvent) && !isEventManuallyEnded(selectedEvent) && (
                        <button
                          onClick={() => setShowEndEventModal(true)}
                          className="px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap bg-red-600 hover:bg-red-700 text-white"
                        >
                          <X className="w-4 h-4" />
                          End Event
                        </button>
                      )}
                      <button
                        onClick={() => openScanner(selectedEvent)}
                        disabled={!canScanEvent(selectedEvent)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          canScanEvent(selectedEvent)
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title={!canScanEvent(selectedEvent) ? (isEventManuallyEnded(selectedEvent) ? 'Event ended' : 'Scanning only available for today\'s events') : 'Scan QR codes'}
                      >
                        <ScanLine className="w-4 h-4" />
                        {isEventManuallyEnded(selectedEvent) ? 'Event Ended' : 'Scan QR'}
                      </button>
                      <button
                        onClick={exportAttendance}
                        disabled={selectedEvent.status !== 'approved' || (!isEventManuallyEnded(selectedEvent) && attendanceRecords.length === 0)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          selectedEvent.status === 'approved' && (attendanceRecords.length > 0 || isEventManuallyEnded(selectedEvent))
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title={attendanceRecords.length === 0 && !isEventManuallyEnded(selectedEvent) ? 'Export available after event ends' : 'Export to CSV'}
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
                      </button>
                    </div>
                  </div>

                  {scanMessage && (
                    <div className={`p-3 rounded-md text-sm font-medium border ${
                      scanMessageType === 'success' ? 'bg-green-50 text-green-700 border-green-200'
                      : scanMessageType === 'warning' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {scanMessage}
                    </div>
                  )}
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-blue-600 rounded-lg p-4 text-white">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="w-4 h-4" />
                      <h3 className="text-xs font-medium uppercase tracking-wide opacity-90">Total</h3>
                    </div>
                    <p className="text-2xl font-semibold">{summary.totalWorkers}</p>
                  </div>
                  <div className="bg-green-600 rounded-lg p-4 text-white">
                    <div className="flex items-center gap-1.5 mb-2">
                      <UserCheck className="w-4 h-4" />
                      <h3 className="text-xs font-medium uppercase tracking-wide opacity-90">Present</h3>
                    </div>
                    <p className="text-2xl font-semibold">{summary.presentCount}</p>
                  </div>
                  <div className="bg-yellow-500 rounded-lg p-4 text-white">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-4 h-4" />
                      <h3 className="text-xs font-medium uppercase tracking-wide opacity-90">Late</h3>
                    </div>
                    <p className="text-2xl font-semibold">{summary.lateCount}</p>
                  </div>
                  <div className="bg-red-600 rounded-lg p-4 text-white">
                    <div className="flex items-center gap-1.5 mb-2">
                      <UserX className="w-4 h-4" />
                      <h3 className="text-xs font-medium uppercase tracking-wide opacity-90">Absent</h3>
                    </div>
                    <p className="text-2xl font-semibold">{summary.absentCount}</p>
                  </div>
                  <div className="bg-gray-600 rounded-lg p-4 text-white">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="w-4 h-4" />
                      <h3 className="text-xs font-medium uppercase tracking-wide opacity-90">Not Scanned</h3>
                    </div>
                    <p className="text-2xl font-semibold">{summary.absent}</p>
                  </div>
                </div>

                {/* Manual Entry / Status Panels */}
                {canScanEvent(selectedEvent) ? (
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none p-4 hover:bg-gray-50">
                        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          <Search className="w-4 h-4 text-gray-400" />
                          Manual Entry
                        </h3>
                        <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-4 pb-4 border-t border-gray-200">
                        <div className="mt-4 mb-3">
                          <input
                            type="text"
                            placeholder="Search workers by name or ministry..."
                            value={manualWorkerSearch}
                            onChange={(e) => setManualWorkerSearch(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                          {filteredWorkers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8 col-span-full">
                              {manualWorkerSearch ? 'No workers found' : 'All workers checked in'}
                            </p>
                          ) : (
                            filteredWorkers.map(worker => (
                              <div key={worker.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="font-medium text-gray-900 text-sm truncate">{worker.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{worker.ministry}</p>
                                </div>
                                <button
                                  onClick={() => manuallyAddAttendance(worker.id)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap"
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
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-center">
                    <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-2" />
                    <h3 className="text-sm font-medium text-amber-900 mb-1">Event Pending Approval</h3>
                    <p className="text-sm text-amber-700">This event is awaiting admin approval. Attendance features will be available once approved.</p>
                  </div>
                ) : isEventManuallyEnded(selectedEvent) ? (
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-5 text-center">
                    <Calendar className="w-10 h-10 mx-auto text-gray-500 mb-2" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">Event Ended</h3>
                    <p className="text-sm text-gray-600">This event has been manually ended. Scanning is no longer available.</p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-center">
                    <Calendar className="w-10 h-10 mx-auto text-blue-500 mb-2" />
                    <h3 className="text-sm font-medium text-blue-900 mb-1">Upcoming Event</h3>
                    <p className="text-sm text-blue-700">Scanning will be enabled on the event date.</p>
                  </div>
                )}

                {/* Attendance Records Table */}
                {selectedEvent.status === 'approved' && (
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900">
                          Attendance Records ({attendanceRecords.length})
                        </h3>
                        <span className="text-xs text-gray-500">
                          Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {attendanceRecords.length === 0 ? (
                      <div className="text-center py-12">
                        <UserCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-sm font-medium text-gray-500 mb-1">No attendance records yet</p>
                        <p className="text-xs text-gray-400 mb-4">Start scanning QR codes to record attendance</p>
                        {canScanEvent(selectedEvent) && (
                          <button
                            onClick={() => openScanner(selectedEvent)}
                            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          >
                            <ScanLine className="w-4 h-4" />
                            Open Scanner
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {/* Mobile View */}
                        <div className="sm:hidden divide-y divide-gray-200">
                          {attendanceRecords.map((record) => (
                            <div key={record.id} className="p-4 hover:bg-gray-50">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{record.worker?.name || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{record.worker?.ministry || 'N/A'}</p>
                                </div>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusBadge(record.status)}`}>
                                  {record.status?.toUpperCase() || 'PRESENT'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs text-gray-600">
                                <span>{new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`px-2 py-0.5 rounded border ${
                                  record.scan_type === 'qr' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  {(record.scan_type || 'qr').toUpperCase()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table */}
                        <table className="hidden sm:table min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Time</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceRecords.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{record.worker?.name || 'Unknown'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{record.worker?.ministry || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${
                                    record.scan_type === 'qr' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                                  }`}>
                                    {(record.scan_type || 'qr').toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusBadge(record.status)}`}>
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
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Event</h3>
                <p className="text-sm text-gray-600 mb-6">Choose an event from the list to view and manage attendance</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowEventsPanel(true)}
                    className="lg:hidden px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Show Events List
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* End Event Modal */}
      {showEndEventModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">End Event</h3>
            <p className="text-sm text-gray-600 mb-6">Please provide the following information before ending the event:</p>

            <div className="space-y-4">
              {[
                { key: 'totalAttendees', label: 'Total Number of Attendees', placeholder: 'Enter total attendees' },
                { key: 'totalVisitors', label: 'Total Number of Visitors', placeholder: 'Enter total visitors' },
                { key: 'totalBaptized', label: 'Total Number of Baptized', placeholder: 'Enter total baptized' }
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={endEventData[key]}
                    onChange={(e) => setEndEventData({ ...endEventData, [key]: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${
                      endEventErrors[key]
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder={placeholder}
                  />
                  {endEventErrors[key] && (
                    <p className="mt-1 text-xs text-red-600">{endEventErrors[key]}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEndEventModal(false);
                  setEndEventData({ totalAttendees: '', totalVisitors: '', totalBaptized: '' });
                  setEndEventErrors({});
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEndEvent}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                End Event
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}