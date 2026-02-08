// context/EventContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { eventService } from '../services/eventService';

const EventContext = createContext();

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within EventProvider');
  }
  return context;
};

export const EventProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    loadEvents();
    
    // Subscribe to real-time changes
    const subscription = eventService.subscribeToEvents((payload) => {
      console.log('Event changed:', payload);
      
      if (payload.eventType === 'INSERT') {
        setEvents(prev => [payload.new, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setEvents(prev => prev.map(e => 
          e.id === payload.new.id ? payload.new : e
        ));
        
        // Update selected event if it's the one that changed
        if (selectedEvent?.id === payload.new.id) {
          setSelectedEvent(payload.new);
        }
      } else if (payload.eventType === 'DELETE') {
        setEvents(prev => prev.filter(e => e.id !== payload.old.id));
        
        if (selectedEvent?.id === payload.old.id) {
          setSelectedEvent(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadEvents = async (filters = {}) => {
    setLoading(true);
    const { data, error } = await eventService.getAllEvents(filters);
    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };

  const refreshEvents = () => loadEvents();

  const value = {
    events,
    loading,
    selectedEvent,
    setSelectedEvent,
    refreshEvents,
    loadEvents
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};