import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, User, Users, Edit, Trash2 } from 'lucide-react';
import { eventService } from '../database/supabaseEvents';

const formatTime = (timeStr) => {
  if (!timeStr) return '—';

  const candidate = new Date(`2000-01-01T${timeStr}`);
  if (isNaN(candidate.getTime())) return '—';

  return candidate.toLocaleTimeString('en-US', {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const EventDetailsModal = ({ event, onClose, onEdit, onDelete }) => {
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEventDetails();
  }, [event.id]);

  const loadEventDetails = async () => {
    setLoading(true);

    const { data: workersData }    = await eventService.getEventWorkers(event.id);
    if (workersData) setWorkers(workersData);

    const { data: attendanceData } = await eventService.getEventAttendance(event.id);
    if (attendanceData) setAttendance(attendanceData);

    const { data: statsData }      = await eventService.getEventStats(event.id);
    if (statsData) setStats(statsData);

    setLoading(false);
  };

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this event?')) return;

  const { error } = await eventService.deleteEvent(event.id);

  if (error) {
    console.error('[deleteEvent] returned error:', error);
    alert('Error deleting event: ' + (error.message || 'Unknown error'));
    return;
  }

  onDelete();   
};


  const getStatusColor = (status) => {
    const colors = {
      proposed:  'bg-gray-100 text-gray-700',
      approved:  'bg-green-100 text-green-700',
      declined:  'bg-red-100 text-red-700',
      postponed: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-blue-100 text-blue-700'
    };
    return colors[status] || colors.proposed;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">

        
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{event.title}</h2>
            <span className={`text-xs px-3 py-1 rounded capitalize ${getStatusColor(event.status)}`}>
              {event.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(event)} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Edit Event">
              <Edit className="w-5 h-5 text-blue-600" />
            </button>
            <button onClick={handleDelete} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Delete Event">
              <Trash2 className="w-5 h-5 text-red-600" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          
          <div>
            <h3 className="text-lg font-semibold mb-3">Event Details</h3>
            <div className="space-y-2">
              {event.description && <p className="text-gray-700">{event.description}</p>}

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
                </div>

                {event.place && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4" />
                    <span>{event.place}</span>
                  </div>
                )}

                {event.organizer && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <User className="w-4 h-4" />
                    <span>{event.organizer}</span>
                  </div>
                )}

                {event.preacher && (
                  <div className="flex items-center gap-2 text-gray-700 col-span-2">
                    <Users className="w-4 h-4" />
                    <span>Preacher: {event.preacher}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

         
          {event.status === 'declined' && event.decline_reason && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">Decline Reason</h4>
              <p className="text-red-700">{event.decline_reason}</p>
            </div>
          )}

          
          {event.status === 'postponed' && event.postpone_reason && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">Postponement Details</h4>
              <p className="text-yellow-700 mb-2">{event.postpone_reason}</p>
              <p className="text-sm text-yellow-600">
                Rescheduled to: {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })} — {formatTime(event.start_time)} to {formatTime(event.end_time)}
              </p>
            </div>
          )}

         
          {event.status === 'completed' && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3">Event Summary</h4>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{event.total_attendance}</div>
                  <div className="text-xs text-blue-600">Total Attendance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{event.baptized_brethren_count}</div>
                  <div className="text-xs text-blue-600">Baptized Brethren</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{event.new_guests_count}</div>
                  <div className="text-xs text-blue-600">New Guests</div>
                </div>
              </div>
              {event.completion_notes && (
                <p className="text-sm text-blue-700">{event.completion_notes}</p>
              )}
            </div>
          )}

         
          {workers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Functional Workers ({workers.length})</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {workers.map(({ worker }) => (
                    <span key={worker.id} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {worker.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-3">Attendance ({attendance.length})</h3>

            {stats && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-green-700">{stats.total_attendance || 0}</div>
                  <div className="text-xs text-green-600">Total</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-blue-700">{stats.baptized_count || 0}</div>
                  <div className="text-xs text-blue-600">Baptized</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-purple-700">{stats.guest_count || 0}</div>
                  <div className="text-xs text-purple-600">Guests</div>
                </div>
              </div>
            )}

            {attendance.length > 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {attendance.map((record) => (
                    <div key={record.id} className="flex justify-between items-center bg-white p-2 rounded border">
                      <div>
                        <span className="font-medium">{record.member?.name || 'Unknown'}</span>
                        {record.is_guest && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Guest</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(record.check_in_time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No attendance recorded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;