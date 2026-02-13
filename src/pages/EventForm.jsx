import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, User, FileText, Repeat } from 'lucide-react';
import { eventService } from '../database/supabaseEvents';
import { createRecurringEvent } from '../database/recurringEventServices';

export default function EventForm({ event, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'sunday_service',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '12:00',
    prep_time: '', // NEW: Prep time
    devotion_time: '', // NEW: Devotion time
    place: 'Church',
    location: 'Church',
    status: 'proposed',
    preacher: '',
    organizer: ''
  });

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceConfig, setRecurrenceConfig] = useState({
    pattern: 'weekly',
    dayOfWeek: 0, // Sunday
    endDate: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [timeValidationError, setTimeValidationError] = useState(''); // NEW: Time validation

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        type: event.type || 'sunday_service',
        event_date: event.event_date || new Date().toISOString().split('T')[0],
        start_time: event.start_time?.slice(0, 5) || '09:00',
        end_time: event.end_time?.slice(0, 5) || '12:00',
        prep_time: event.prep_time?.slice(0, 5) || '', // NEW: Load prep time
        devotion_time: event.devotion_time?.slice(0, 5) || '', // NEW: Load devotion time
        place: event.place || 'Church',
        location: event.location || 'Church',
        status: event.status || 'proposed',
        preacher: event.preacher || '',
        organizer: event.organizer || ''
      });
      
      // Check if event is recurring
      setIsRecurring(event.is_recurring || false);
      if (event.is_recurring) {
        setRecurrenceConfig({
          pattern: event.recurrence_pattern || 'weekly',
          dayOfWeek: event.recurrence_day_of_week ?? 0,
          endDate: event.recurrence_end_date || ''
        });
      }
    }
  }, [event]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // NEW: Clear validation error when user changes time fields
    if (['prep_time', 'devotion_time', 'end_time'].includes(name)) {
      setTimeValidationError('');
    }
  };

  const handleRecurrenceChange = (e) => {
    const { name, value } = e.target;
    setRecurrenceConfig(prev => ({ 
      ...prev, 
      [name]: name === 'dayOfWeek' ? parseInt(value) : value 
    }));
  };

  // NEW: Validate prep and devotion times
  const validateTimes = () => {
    const { prep_time, devotion_time, end_time } = formData;
    
    // Skip validation if fields are empty
    if (!prep_time && !devotion_time) {
      return true;
    }
    
    // Convert time strings to minutes for comparison
    const timeToMinutes = (timeStr) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const prepMinutes = timeToMinutes(prep_time);
    const devotionMinutes = timeToMinutes(devotion_time);
    const endMinutes = timeToMinutes(end_time);
    
    // Validate prep_time < devotion_time (if both provided)
    if (prepMinutes !== null && devotionMinutes !== null) {
      if (prepMinutes >= devotionMinutes) {
        setTimeValidationError('Prep Time must be before Devotion Time');
        return false;
      }
    }
    
    // Validate devotion_time < end_time (if both provided)
    if (devotionMinutes !== null && endMinutes !== null) {
      if (devotionMinutes >= endMinutes) {
        setTimeValidationError('Devotion Time must be before Event End Time');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setTimeValidationError('');

    // NEW: Validate times before submission
    if (!validateTimes()) {
      setSaving(false);
      return;
    }

    try {
      // NEW: Prepare data with prep_time and devotion_time (send null if empty)
      const eventDataToSave = {
        ...formData,
        prep_time: formData.prep_time || null,
        devotion_time: formData.devotion_time || null
      };

      if (isRecurring && !event) {
        // Creating new recurring event
        const result = await createRecurringEvent(eventDataToSave, recurrenceConfig);
        console.log(`Created recurring event with ${result.count} instances`);
        alert(`Successfully created ${result.count} event instances!`);
      } else if (event) {
        // Updating existing event
        const { error: updateError } = await eventService.updateEvent(event.id, eventDataToSave);
        if (updateError) throw updateError;
      } else {
        // Creating single event
        const { error: createError } = await eventService.createEvent(eventDataToSave);
        if (createError) throw createError;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const dayOfWeekOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white flex-shrink-0">
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

        {/* Form Container with Scrolling */}
        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* NEW: Time validation error */}
            {timeValidationError && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg">
                {timeValidationError}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Basic Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Sunday Service, Bible Study"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sunday_service">Sunday Service</option>
                  <option value="event">Church Event</option>
                  <option value="meeting">Meetings</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Event description..."
                />
              </div>
            </div>

            {/* Recurring Event Section - Only show for new events */}
            {!event && (
              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Repeat className="w-5 h-5 text-blue-600" />
                    Recurring Event
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Make this a recurring event
                    </span>
                  </label>
                </div>

                {isRecurring && (
                  <div className="bg-blue-50 p-4 rounded-lg space-y-4 border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Repeat Pattern *
                        </label>
                        <select
                          name="pattern"
                          value={recurrenceConfig.pattern}
                          onChange={handleRecurrenceChange}
                          className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="weekly">Every Week</option>
                          <option value="biweekly">Every 2 Weeks</option>
                          <option value="monthly">Every Month</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Day of Week *
                        </label>
                        <select
                          name="dayOfWeek"
                          value={recurrenceConfig.dayOfWeek}
                          onChange={handleRecurrenceChange}
                          className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {dayOfWeekOptions.map(day => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={recurrenceConfig.endDate}
                        onChange={handleRecurrenceChange}
                        min={formData.event_date}
                        className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to create events for 1 year
                      </p>
                    </div>

                    <div className="bg-blue-100 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> This will create individual event entries for each occurrence. 
                        {recurrenceConfig.endDate 
                          ? ` Events will be created from ${formData.event_date} to ${recurrenceConfig.endDate}.`
                          : ' Events will be created for 1 year by default.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Date & Time */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Date & Time
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isRecurring ? 'Start Date (First Occurrence) *' : 'Event Date *'}
                </label>
                <input
                  type="date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleChange}
                  required
                  className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Start Time *
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                    className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    End Time *
                  </label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    required
                    className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* NEW: Prep Time and Devotion Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Prep Time
                  </label>
                  <input
                    type="time"
                    name="prep_time"
                    value={formData.prep_time}
                    onChange={handleChange}
                    className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    When workers should start scanning
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Devotion Time
                  </label>
                  <input
                    type="time"
                    name="devotion_time"
                    value={formData.devotion_time}
                    onChange={handleChange}
                    className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Thish will be the latest time to be marked "present"
                  </p>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Location
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Place/Venue
                </label>
                <input
                  type="text"
                  name="place"
                  value={formData.place}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Main Sanctuary, Fellowship Hall"
                />
              </div>
            </div>

            {/* Additional Info */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Additional Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speaker/Preacher
                </label>
                <input
                  type="text"
                  name="preacher"
                  value={formData.preacher}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Speaker name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organizer
                </label>
                <input
                  type="text"
                  name="organizer"
                  value={formData.organizer}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Organizer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="cursor-pointer w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="proposed">Proposed</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="postponed">Postponed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-6 flex items-center justify-end gap-3  bg-white pb-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="cursor-pointer px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : event ? 'Update Event' : isRecurring ? 'Create Events' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}