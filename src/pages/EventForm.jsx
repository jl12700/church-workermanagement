// components/EventForm.jsx
import { useState, useEffect, useMemo } from 'react';
import { X, Search, AlertCircle } from 'lucide-react';
import { EVENT_TYPES, EVENT_STATUSES } from '../utils/eventConstants';
import { workerService } from '../database/supabaseEvents';
import { eventService } from '../database/supabaseEvents';

const getTodayString = () => new Date().toISOString().split('T')[0];

const EventForm = ({ event, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: EVENT_TYPES.EVENT,
    organizer: '',
    place: '',
    event_date: '',
    start_time: '',
    end_time: '',
    preacher: '',
    status: EVENT_STATUSES.PROPOSED,
    ...event
  });

  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadWorkers();
    if (event?.id) {
      loadEventWorkers();
    }
  }, [event]);

  const loadWorkers = async () => {
    const { data } = await workerService.getAllWorkers();
    if (data) setWorkers(data);
  };

  const loadEventWorkers = async () => {
    const { data } = await eventService.getEventWorkers(event.id);
    if (data) {
      setSelectedWorkers(data.map(ew => ew.worker_id));
    }
  };

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(w => w.name.toLowerCase().includes(q));
  }, [workers, workerSearch]);

  const validateForm = () => {
    const newErrors = {};
    const today = getTodayString();

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.event_date) {
      newErrors.event_date = 'Date is required';
    } else if (formData.event_date < today && !event) {
      newErrors.event_date = 'Event date cannot be in the past';
    }
    
    if (!formData.start_time) {
      newErrors.start_time = 'Start time is required';
    }
    
    if (!formData.end_time) {
      newErrors.end_time = 'End time is required';
    } else if (formData.start_time && formData.end_time <= formData.start_time) {
      newErrors.end_time = 'End time must be after start time';
    }

    if (formData.status === EVENT_STATUSES.DECLINED && !formData.decline_reason?.trim()) {
      newErrors.decline_reason = 'Decline reason is required';
    }

    if (formData.status === EVENT_STATUSES.POSTPONED) {
      if (!formData.postpone_reason?.trim()) {
        newErrors.postpone_reason = 'Postpone reason is required';
      }
      if (!formData.postponed_target_date) {
        newErrors.postponed_target_date = 'New date is required';
      }
    }

    if (formData.status === EVENT_STATUSES.COMPLETED) {
      if (!formData.total_attendance || formData.total_attendance < 0) {
        newErrors.total_attendance = 'Total attendance is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      // 1. Destructure to clean data
      const { event_workers, id, ...cleanData } = formData;

      const payload = {
        ...cleanData,
        description: cleanData.description || null,
        organizer: cleanData.organizer || null,
        place: cleanData.place || null,
        preacher: cleanData.preacher || null
      };

      let eventId;

      if (event?.id) {
        const { data, error } = await eventService.updateEvent(event.id, payload);
        if (error) throw error;
        eventId = event.id;
      } else {
        const { data, error } = await eventService.createEvent(payload);
        if (error) throw error;
        eventId = data.id;
      }

      await eventService.replaceEventWorkers(eventId, selectedWorkers);

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      alert(error.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const toggleWorker = (workerId) => {
    setSelectedWorkers(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const inputClass = (field) =>
    `cursor-pointer w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors ${
      errors[field] ? 'border-red-500 bg-red-50' : 'border-gray-300'
    }`;

  const ErrorMessage = ({ field }) =>
    errors[field] ? (
      <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
        <AlertCircle className="w-3 h-3" />
        <span>{errors[field]}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* --- NEW HEADER FEATURE --- */}
        {/* Replaced blue gradient with the clean gray border style you requested */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-gray-800">
            {event ? 'Edit Event' : 'Create New Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* -------------------------- */}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* Title & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={inputClass('title')}
                placeholder="e.g. Workers Conference"
              />
              <ErrorMessage field="title" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className={inputClass('type')}
              >
                <option value={EVENT_TYPES.EVENT}>Event</option>
                <option value={EVENT_TYPES.TRAINING}>Training</option>
                <option value={EVENT_TYPES.MEETING}>Meeting</option>
                <option value={EVENT_TYPES.SPECIAL}>Special</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Brief description of the event..."
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
                min={event ? undefined : getTodayString()}
                className={inputClass('event_date')}
              />
              <ErrorMessage field="event_date" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                className={inputClass('start_time')}
              />
              <ErrorMessage field="start_time" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <input
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className={inputClass('end_time')}
              />
              <ErrorMessage field="end_time" />
            </div>
          </div>

          {/* Organizer & Place */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organizer
              </label>
              <input
                type="text"
                name="organizer"
                value={formData.organizer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Person or team organizing"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="place"
                value={formData.place}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Venue or location"
              />
            </div>
          </div>

          {/* Preacher/Speaker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Speaker / Preacher
            </label>
            <input
              type="text"
              name="preacher"
              value={formData.preacher}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Main speaker name"
            />
          </div>

          {/* Functional Workers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Functional Workers ({selectedWorkers.length} selected)
            </label>
            
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search workers..."
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
              {filteredWorkers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {workerSearch ? 'No workers found' : 'No workers available'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredWorkers.map(worker => (
                    <label
                      key={worker.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(worker.id)}
                        onChange={() => toggleWorker(worker.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{worker.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value={EVENT_STATUSES.PROPOSED}>Proposed</option>
              <option value={EVENT_STATUSES.APPROVED}>Approved</option>
              <option value={EVENT_STATUSES.DECLINED}>Declined</option>
              <option value={EVENT_STATUSES.POSTPONED}>Postponed</option>
              <option value={EVENT_STATUSES.COMPLETED}>Completed</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="bg-white pt-4 flex gap-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
            >
              {loading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;