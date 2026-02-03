import { useState, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { eventService, workerService } from '../database/supabaseEvents';


const getTodayString = () => new Date().toISOString().split('T')[0];

const EventForm = ({ event, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    organizer: '',
    place: '',
    event_date: '',
    start_time: '',
    end_time: '',
    preacher: '',
    status: 'proposed',
    decline_reason: '',
    postpone_reason: '',
    postponed_target_date: '',
    postponed_target_time: '',
    postponed_target_end_time: '',   
    total_attendance: '',
    baptized_brethren_count: '',
    new_guests_count: '',
    completion_notes: '',
    ...event
  });

  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [workerSearch, setWorkerSearch] = useState('');   
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadWorkers();
    if (event) {
      loadEventWorkers();
    }
  }, [event]);

  const loadWorkers = async () => {
    const { data } = await workerService.getAllWorkers();
    if (data) setWorkers(data);
  };

  const loadEventWorkers = async () => {
    if (event?.id) {
      const { data } = await eventService.getEventWorkers(event.id);
      if (data) {
        setSelectedWorkers(data.map(ew => ew.worker_id));
      }
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

    
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.event_date) {
      newErrors.event_date = 'Date is required';
    } else if (formData.event_date < today) {
      newErrors.event_date = 'Event date cannot be in the past';
    }
    if (!formData.start_time) newErrors.start_time = 'Start time is required';
    if (!formData.end_time)   newErrors.end_time   = 'End time is required';

    
    if (formData.start_time && formData.end_time) {
      if (formData.end_time <= formData.start_time) {
        newErrors.end_time = 'End time must be later than start time';
      }
    }

    
    if (formData.status === 'declined' && !formData.decline_reason) {
      newErrors.decline_reason = 'Decline reason is required';
    }

    if (formData.status === 'postponed') {
      if (!formData.postpone_reason) {
        newErrors.postpone_reason = 'Postpone reason is required';
      }
      if (!formData.postponed_target_date) {
        newErrors.postponed_target_date = 'New target date is required';
      } else if (formData.postponed_target_date < today) {
        newErrors.postponed_target_date = 'Postponed date cannot be in the past';
      }
      if (!formData.postponed_target_time) {
        newErrors.postponed_target_time = 'New start time is required';
      }
      if (!formData.postponed_target_end_time) {
        newErrors.postponed_target_end_time = 'New end time is required';
      }
     
      if (formData.postponed_target_time && formData.postponed_target_end_time) {
        if (formData.postponed_target_end_time <= formData.postponed_target_time) {
          newErrors.postponed_target_end_time = 'End time must be later than start time';
        }
      }
    }

    if (formData.status === 'completed') {
      if (!formData.total_attendance) {
        newErrors.total_attendance = 'Total attendance is required';
      }
      if (!formData.baptized_brethren_count) {
        newErrors.baptized_brethren_count = 'Baptized brethren count is required';
      }
      if (!formData.new_guests_count) {
        newErrors.new_guests_count = 'New guests count is required';
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
      const {
        title,
        description,
        organizer,
        place,
        event_date,
        start_time,
        end_time,
        preacher,
        status,
        decline_reason,
        postpone_reason,
        postponed_target_date,
        postponed_target_time,
        postponed_target_end_time,
        total_attendance,
        baptized_brethren_count,
        new_guests_count,
        completion_notes
      } = formData;

      
      const effectiveDate      = status === 'postponed' ? postponed_target_date      : event_date;
      const effectiveStartTime = status === 'postponed' ? postponed_target_time      : start_time;
      const effectiveEndTime   = status === 'postponed' ? postponed_target_end_time  : end_time;

      const payload = {
        title,
        description: description || null,
        organizer:   organizer   || null,
        place:       place       || null,
        event_date:  effectiveDate,
        start_time:  effectiveStartTime,
        end_time:    effectiveEndTime,
        preacher:    preacher    || null,
        status,

        
        decline_reason:           status === 'declined'  ? decline_reason           : null,
        postpone_reason:          status === 'postponed' ? postpone_reason          : null,
        postponed_target_date:    status === 'postponed' ? postponed_target_date    : null,
        postponed_target_time:    status === 'postponed' ? postponed_target_time    : null,

        
        total_attendance:         status === 'completed' ? Number(total_attendance)         : null,
        baptized_brethren_count:  status === 'completed' ? Number(baptized_brethren_count)  : null,
        new_guests_count:         status === 'completed' ? Number(new_guests_count)         : null,
        completion_notes:         status === 'completed' ? completion_notes || null         : null
      };

      let eventId;

      if (event?.id) {
        const { error } = await eventService.updateEvent(event.id, payload);
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
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
      errors[field] ? 'border-red-500' : 'border-gray-300'
    }`;

  const errorMsg = (field) =>
    errors[field] ? <p className="text-red-500 text-xs mt-1">{errors[field]}</p> : null;

  
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl my-8 overflow-hidden flex flex-col">

       
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-800">
            {event ? 'Edit Event' : 'Create New Event'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>


        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-250px)]">

        
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} className={inputClass('title')} />
            {errorMsg('title')}
          </div>

          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organizer</label>
              <input type="text" name="organizer" value={formData.organizer} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
              <input type="text" name="place" value={formData.place} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" name="event_date" value={formData.event_date} onChange={handleChange}
                min={getTodayString()} className={inputClass('event_date')} />
              {errorMsg('event_date')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input type="time" name="start_time" value={formData.start_time} onChange={handleChange}
                className={inputClass('start_time')} />
              {errorMsg('start_time')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input type="time" name="end_time" value={formData.end_time} onChange={handleChange}
                className={inputClass('end_time')} />
              {errorMsg('end_time')}
            </div>
          </div>

        
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preacher / Speaker</label>
            <input type="text" name="preacher" value={formData.preacher} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>

         
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Functional Workers</label>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search workers…"
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            
            <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto bg-gray-50">
              {filteredWorkers.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  {workerSearch.trim() ? 'No workers found' : 'No workers available'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredWorkers.map(worker => (
                    <label key={worker.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(worker.id)}
                        onChange={() => toggleWorker(worker.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{worker.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" value={formData.status} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white">
              <option value="proposed">Proposed</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="postponed">Postponed</option>
              <option value="completed">Completed</option>
            </select>
          </div>

         
          {formData.status === 'declined' && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="block text-sm font-medium text-red-700 mb-1">Reason for Decline *</label>
              <textarea name="decline_reason" value={formData.decline_reason} onChange={handleChange} rows={2}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                  errors.decline_reason ? 'border-red-500' : 'border-gray-300'
                }`} />
              {errorMsg('decline_reason')}
            </div>
          )}

          {formData.status === 'postponed' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div>
                <label className="block text-sm font-medium text-yellow-700 mb-1">Reason for Postponement *</label>
                <textarea name="postpone_reason" value={formData.postpone_reason} onChange={handleChange} rows={2}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                    errors.postpone_reason ? 'border-red-500' : 'border-gray-300'
                  }`} />
                {errorMsg('postpone_reason')}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Date *</label>
                  <input type="date" name="postponed_target_date" value={formData.postponed_target_date}
                    onChange={handleChange} min={getTodayString()} className={inputClass('postponed_target_date')} />
                  {errorMsg('postponed_target_date')}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Start Time *</label>
                  <input type="time" name="postponed_target_time" value={formData.postponed_target_time}
                    onChange={handleChange} className={inputClass('postponed_target_time')} />
                  {errorMsg('postponed_target_time')}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New End Time *</label>
                  <input type="time" name="postponed_target_end_time" value={formData.postponed_target_end_time}
                    onChange={handleChange} className={inputClass('postponed_target_end_time')} />
                  {errorMsg('postponed_target_end_time')}
                </div>
              </div>
            </div>
          )}

          
          {formData.status === 'completed' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total *</label>
                  <input type="number" name="total_attendance" value={formData.total_attendance} onChange={handleChange}
                    className={inputClass('total_attendance')} />
                  {errorMsg('total_attendance')}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Baptized *</label>
                  <input type="number" name="baptized_brethren_count" value={formData.baptized_brethren_count} onChange={handleChange}
                    className={inputClass('baptized_brethren_count')} />
                  {errorMsg('baptized_brethren_count')}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guests *</label>
                  <input type="number" name="new_guests_count" value={formData.new_guests_count} onChange={handleChange}
                    className={inputClass('new_guests_count')} />
                  {errorMsg('new_guests_count')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea name="completion_notes" value={formData.completion_notes} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
              </div>
            </div>
          )}

          
          <div className="sticky bottom-0 bg-white pt-4 pb-2 flex gap-3 border-t mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition shadow-sm">
              {loading ? 'Saving…' : 'Save Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;