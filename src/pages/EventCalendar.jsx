import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
  // This creates a YYYY-MM-DD string using local time
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const localDateStr = `${year}-${month}-${day}`;

  return events.filter(event => event.event_date === localDateStr);
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

  const getStatusColor = (status) => {
    const colors = {
      proposed:  'bg-yellow-500 text-black-700',
      approved:  'bg-green-400 text-black-700',
      declined:  'bg-red-400 text-black-700',
      postponed: 'bg-orange-400 text-black-700',
      completed: 'bg-blue-500 text-black-700'
    };
    return colors[status] || colors.proposed;
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
  };

const handleDeleteEvent = async () => {
  if (!selectedEvent?.id) return;

  const { error } = await eventService.deleteEvent(selectedEvent.id);

  if (error) {
    console.error('Failed to delete event:', error);
    return;
  }

  await loadEvents();          
  setSelectedEvent(null);     
  setShowEventDetails(false);  
};


  return (
    <SidebarLayout>
    <div className="bg-white rounded-lg shadow-lg p-6">
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-800">Event Calendar</h2>
        </div>
        <button
          onClick={handleNewEvent}
          className="cursor-pointer ml-auto flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button onClick={previousMonth} className="cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-semibold">{monthYear}</h3>
        <button onClick={nextMonth} className="cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      
      <div className="grid grid-cols-7 gap-2">
       
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}

        
        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-24 bg-gray-50 rounded-lg" />
        ))}

       
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
                h-24 p-2 border rounded-lg cursor-pointer transition-all
                ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}
              `}
            >
              <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                {day}
              </div>
              <div className="space-y-1 overflow-y-auto max-h-16">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                    className={`text-xs px-2 py-1 rounded truncate hover:opacity-80 transition ${getStatusColor(event.status)}`}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-500 px-2">+{dayEvents.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      
      {selectedDate && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-3">
            Events on {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </h4>
          <div className="space-y-2">
            {getEventsForDate(selectedDate).map(event => (
              <EventCard key={event.id} event={event} onClick={() => handleEventClick(event)} />
            ))}
            {getEventsForDate(selectedDate).length === 0 && (
              <p className="text-gray-500 text-sm">No events scheduled</p>
            )}
          </div>
        </div>
      )}

      {showEventForm && (
        <EventForm
          event={selectedEvent}
          onClose={handleCloseForm}
          onSave={handleSaveEvent}
        />
      )}

      {showEventDetails && selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setShowEventDetails(false)}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
    </SidebarLayout>
  );
};


const EventCard = ({ event, onClick }) => {
  const getStatusColor = (status) => {
    const colors = {
      proposed:  'bg-yellow-100 text-gray-700',
      approved:  'bg-green-100 text-green-700',
      declined:  'bg-red-100 text-red-700',
      postponed: 'bg-orange-100 text-yellow-700',
      completed: 'bg-blue-100 text-blue-700'
    };
    return colors[status] || colors.proposed;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white p-3 rounded-lg border border-gray-200 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex justify-between items-start mb-2">
        <h5 className="font-semibold text-gray-800">{event.title}</h5>
        <span className={`text-xs px-2 py-1 rounded capitalize ${getStatusColor(event.status)}`}>
          {event.status}
        </span>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <p>Time: {event.start_time} - {event.end_time}</p>
        {event.place    && <p>Place: {event.place}</p>}
        {event.preacher && <p>Speaker: {event.preacher}</p>}
      </div>
    </div>
  );
};

export default EventCalendar;