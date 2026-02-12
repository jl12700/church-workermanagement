import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, User, Edit, Trash2, CheckCircle, AlertCircle, Check, XCircle } from 'lucide-react';
import EventForm from './EventForm';
import EventDetailsModal from './EventDetailsModal';
import { eventService } from '../database/supabaseEvents';
import SidebarLayout from '../layout/Sidebar';

const EventCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successType, setSuccessType] = useState('success');
  const [updatingEventId, setUpdatingEventId] = useState(null);

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await eventService.getEvents();
    console.log('[loadEvents] returned', data?.length, 'events:', data?.map(e => ({ id: e.id, title: e.title })));
    setEvents(data || []);   
    setLoading(false);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    return { daysInMonth, startingDayOfWeek };
  };

  const getEventsForDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${day}`;

    return events.filter(event => event.event_date === localDateStr);
  };

  const getProposedEvents = () => {
    return events
      .filter(event => event.status === 'proposed')
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status) => {
    const colors = {
      proposed:  'bg-yellow-100 border-yellow-200 text-yellow-800',
      approved:  'bg-green-100 border-green-200 text-green-800',
      declined:  'bg-red-100 border-red-200 text-red-800',
      postponed: 'bg-orange-100 border-orange-200 text-orange-800',
      completed: 'bg-blue-100 border-blue-200 text-blue-800'
    };
    return colors[status] || colors.proposed;
  };

  const getStatusBadge = (status) => {
    const badges = {
      proposed:  'bg-yellow-500 text-white',
      approved:  'bg-green-500 text-white',
      declined:  'bg-red-500 text-white',
      postponed: 'bg-orange-500 text-white',
      completed: 'bg-blue-500 text-white'
    };
    return badges[status] || badges.proposed;
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  };

  const handleNewEvent = () => {
    setSelectedEvent(null);
    setShowEventForm(true);
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setShowEventForm(true);
    setShowEventDetails(false);
  };

  const handleCloseForm = () => {
    setShowEventForm(false);
    setSelectedEvent(null);
  };

  const handleSaveEvent = () => {
    loadEvents();
    handleCloseForm();
    setSuccessMessage('Event saved successfully');
    setSuccessType('success');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent?.id) return;

    const { error } = await eventService.deleteEvent(selectedEvent.id);

    if (error) {
      console.error('Failed to delete event:', error);
      setSuccessMessage(`Failed to delete event: ${error.message}`);
      setSuccessType('error');
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }

    await loadEvents();          
    setSelectedEvent(null);     
    setShowEventDetails(false);
    setSuccessMessage('Event deleted successfully');
    setSuccessType('success');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleQuickStatusUpdate = async (eventId, newStatus) => {
    setUpdatingEventId(eventId);
    
    const { error } = await eventService.updateEventStatus(eventId, newStatus);
    
    if (error) {
      setSuccessMessage(`Failed to update event status: ${error.message}`);
      setSuccessType('error');
      setTimeout(() => setSuccessMessage(''), 3000);
      setUpdatingEventId(null);
      return;
    }

    await loadEvents();
    setUpdatingEventId(null);
    setSuccessMessage(`Event ${newStatus} successfully`);
    setSuccessType('success');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const proposedEvents = getProposedEvents();

  return (
    <SidebarLayout>
      <div className="w-full px-6 py-6 space-y-6 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Event Calendar
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage and view all church events
            </p>
          </div>

          <button
            onClick={handleNewEvent}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm shadow-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </button>
        </div>

        {/* Success/Error Message */}
        {successMessage && (
          <div className={`p-4 rounded-lg text-sm font-medium animate-fade-in flex items-start gap-3 ${
            successType === 'error' 
              ? 'bg-red-50 border border-red-200 text-red-700' 
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}>
            {successType === 'error' ? (
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            )}
            <div>{successMessage}</div>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <button
                  onClick={previousMonth}
                  aria-label="Previous month"
                  className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={goToToday}
                  className="px-4 py-2 text-sm font-semibold border-x border-slate-200 hover:bg-gray-50 active:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  Today
                </button>

                <button
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-lg font-semibold text-slate-900">{monthYear}</h3>
            </div>
          </div>
        </div>

        {/* Main Content - Calendar and Sidebar */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Calendar - Takes 2 columns */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center font-semibold text-slate-600 py-2 text-sm">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-28 bg-slate-50 rounded-lg border border-slate-100" />
                    ))}

                    {/* Calendar days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                      const dayEvents = getEventsForDate(date);
                      const isToday = date.toDateString() === new Date().toDateString();

                      return (
                        <div
                          key={day}
                          onClick={() => setSelectedDate(date)}
                          className={`
                            h-28 p-2 border rounded-lg cursor-pointer transition-all
                            ${isToday 
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                              : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                            }
                          `}
                        >
                          <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                            {day}
                          </div>
                          <div className="space-y-1 overflow-y-auto max-h-16">
                            {dayEvents.slice(0, 2).map(event => (
                              <div
                                key={event.id}
                                onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                                className={`text-xs px-2 py-1 rounded truncate border cursor-pointer hover:shadow-sm transition ${getStatusColor(event.status)}`}
                                title={event.title}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-slate-500 px-2 font-medium">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Selected Date Events */}
              {selectedDate && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-4">
                    Events on {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </h4>
                  <div className="space-y-3">
                    {getEventsForDate(selectedDate).map(event => (
                      <EventCard key={event.id} event={event} onClick={() => handleEventClick(event)} />
                    ))}
                    {getEventsForDate(selectedDate).length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Calendar className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-slate-500 text-sm mb-2">
                          No events scheduled for this day
                        </p>
                        <button
                          onClick={handleNewEvent}
                          className="text-blue-600 text-sm font-medium hover:text-blue-700 hover:underline"
                        >
                          Create an event
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar - Proposed Events */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Pending Approval
                  </h3>
                  <span className="text-xs text-slate-500 bg-yellow-100 px-2 py-1 rounded-full font-semibold">
                    {proposedEvents.length}
                  </span>
                </div>

                {proposedEvents.length > 0 ? (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {proposedEvents.map(event => (
                      <div
                        key={event.id}
                        className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 transition-all hover:shadow-md"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 
                            className="font-semibold text-sm text-slate-900 cursor-pointer hover:text-blue-600 flex-1 pr-2"
                            onClick={() => handleEventClick(event)}
                          >
                            {event.title}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500 text-white uppercase whitespace-nowrap">
                            Proposed
                          </span>
                        </div>

                        <div className="space-y-1 mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <p className="text-xs text-slate-600">
                              {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <p className="text-xs text-slate-600">
                              {event.start_time} - {event.end_time}
                            </p>
                          </div>
                          {event.place && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <p className="text-xs text-slate-600 truncate">
                                {event.place}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleQuickStatusUpdate(event.id, 'approved')}
                            disabled={updatingEventId === event.id}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingEventId === event.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleQuickStatusUpdate(event.id, 'declined')}
                            disabled={updatingEventId === event.id}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingEventId === event.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Decline
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-slate-500 text-sm">
                      No pending events
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      All events have been reviewed
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Event Form Modal */}
        {showEventForm && (
          <EventForm
            event={selectedEvent}
            onClose={handleCloseForm}
            onSave={handleSaveEvent}
          />
        )}

        {/* Event Details Modal */}
        {showEventDetails && selectedEvent && (
          <EventDetailsModal
            event={selectedEvent}
            onClose={() => setShowEventDetails(false)}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
          />
        )}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }

        /* Custom scrollbar for proposed events */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </SidebarLayout>
  );
};

// Updated EventCard Component
const EventCard = ({ event, onClick }) => {
  const getStatusColor = (status) => {
    const colors = {
      proposed:  'bg-yellow-100 border-yellow-200 text-yellow-800',
      approved:  'bg-green-100 border-green-200 text-green-800',
      declined:  'bg-red-100 border-red-200 text-red-800',
      postponed: 'bg-orange-100 border-orange-200 text-orange-800',
      completed: 'bg-blue-100 border-blue-200 text-blue-800'
    };
    return colors[status] || colors.proposed;
  };

  const getStatusBadge = (status) => {
    const badges = {
      proposed:  'bg-yellow-500 text-white',
      approved:  'bg-green-500 text-white',
      declined:  'bg-red-500 text-white',
      postponed: 'bg-orange-500 text-white',
      completed: 'bg-blue-500 text-white'
    };
    return badges[status] || badges.proposed;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${getStatusColor(event.status)}`}
    >
      <div className="flex justify-between items-start gap-2 mb-3">
        <h5 className="font-semibold text-slate-900 text-base">{event.title}</h5>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap uppercase ${getStatusBadge(event.status)}`}>
          {event.status}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-slate-400" />
          <p className="text-xs text-slate-600">
            {event.start_time} - {event.end_time}
          </p>
        </div>

        {event.place && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-slate-400" />
            <p className="text-xs text-slate-600 truncate">
              {event.place}
            </p>
          </div>
        )}

        {event.preacher && (
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-slate-400" />
            <p className="text-xs text-slate-600 truncate">
              Speaker: {event.preacher}
            </p>
          </div>
        )}
      </div>
    </button>
  );
};

export default EventCalendar;