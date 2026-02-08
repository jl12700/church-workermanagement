import { supabase } from './supabase';

/**
 * Event Service
 * Handles all event-related database operations
 */
export const eventService = {
  
  /**
   * Get all events
   */
  async getAllEvents(filters = {}) {
    let query = supabase
      .from('events')
      .select('*')
      // FIXED: 'date' -> 'event_date'
      .order('event_date', { ascending: false });
    
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.startDate && filters.endDate) {
      // FIXED: 'date' -> 'event_date'
      query = query.gte('event_date', filters.startDate).lte('event_date', filters.endDate);
    }
    
    return await query;
  },

  /**
   * Get today's events
   */
  async getTodayEvents() {
    const today = new Date().toISOString().split('T')[0];
    
    return await supabase
      .from('events')
      .select('*')
      // FIXED: 'date' -> 'event_date'
      .eq('event_date', today)
      .eq('status', 'approved')
      .order('start_time', { ascending: true });
  },

  /**
   * Get events for a specific date
   */
  async getEventsByDate(date) {
    return await supabase
      .from('events')
      .select('*')
      // FIXED: 'date' -> 'event_date'
      .eq('event_date', date)
      .order('start_time', { ascending: true });
  },

  /**
   * Get Sunday Service event for a specific date
   * Creates one if it doesn't exist using database function
   */
async getSundayServiceEvent(date) {
  try {
    // SAFE fetch (no auto-throw)
    const { data: existing, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_date', date)
      .eq('type', 'sunday_service')
      .maybeSingle();

    if (existing) {
      return { data: existing, error: null };
    }

    // Create safely via RPC
    const { data: eventId, error: rpcError } = await supabase
      .rpc('create_sunday_service_event', {
        p_date: date,
        p_start_time: '08:00:00',
        p_end_time: '12:00:00'
      });

    if (rpcError) throw rpcError;

    const { data: newEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    return { data: newEvent, error: fetchError };
  } catch (error) {
    console.error('[getSundayServiceEvent]', error);
    return { data: null, error };
  }
}
,

  /**
   * Create a new event
   */
async createEvent(eventData) {
  const { data, error } = await supabase
    .from('events')
    .insert([eventData])
    .select()
    .single();

  if (error?.code === '23505') {
    throw {
      code: '23505',
      message: 'An event already exists for this date.'
    };
  }

  return { data, error };
}
,

  /**
   * Update an event
   */
  async updateEvent(eventId, updates) {
    return await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select()
      .single();
  },

  /**
   * Delete an event
   */
  async deleteEvent(eventId) {
    return await supabase
      .from('events')
      .delete()
      .eq('id', eventId);
  },

  /**
   * Get event attendance records
   */
  async getEventAttendance(eventId) {
    return await supabase
      .from('event_attendance')
      .select(`
        *,
        worker:workers(id, name, ministry, email, contact),
        event:events(id, title, type, event_date, start_time, end_time)
      `) // FIXED: 'date' -> 'event_date' inside nested select
      .eq('event_id', eventId)
      .order('check_in_time', { ascending: false });
  },

  /**
   * Get attendance status view for an event
   */
  async getEventAttendanceWithStatus(eventId) {
    return await supabase
      .from('attendance_status_view')
      .select('*')
      .eq('event_id', eventId)
      .order('check_in_time', { ascending: false });
  },

  /**
   * Record attendance for an event
   */
  async recordAttendance(eventId, workerId, scanType = 'qr') {
    // Check if already checked in
    const { data: existing } = await supabase
      .from('event_attendance')
      .select('*')
      .eq('event_id', eventId)
      .eq('worker_id', workerId)
      .single();
    
    if (existing) {
      return { 
        data: null, 
        error: { message: 'Already checked in to this event' } 
      };
    }
    
    // Record attendance
    return await supabase
      .from('event_attendance')
      .insert([{
        event_id: eventId,
        worker_id: workerId,
        check_in_time: new Date().toISOString(),
        scan_type: scanType,
        is_guest: false,
        is_baptized: true
      }])
      .select()
      .single();
  },

  /**
   * Get worker's attendance history
   */
  async getWorkerAttendance(workerId, startDate = null, endDate = null) {
    let query = supabase
      .from('attendance_status_view')
      .select('*')
      .eq('worker_id', workerId);
    
    if (startDate && endDate) {
      query = query
        .gte('event_date', startDate)
        .lte('event_date', endDate);
    }
    
    return await query.order('check_in_time', { ascending: false });
  },

  /**
   * Get worker's monthly attendance
   * Returns map of date -> attendance data
   */
  async getWorkerMonthlyAttendance(workerId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Get all attendance records for the month
    const { data, error } = await supabase
      .from('attendance_status_view')
      .select('*')
      .eq('worker_id', workerId)
      .gte('event_date', startDateStr)
      .lte('event_date', endDateStr)
      .order('event_date', { ascending: true });
    
    if (error) throw error;
    
    // Build a map: date -> array of events attended that day
    const attendanceMap = {};
    data?.forEach(record => {
      const dateKey = record.event_date;
      if (!attendanceMap[dateKey]) {
        attendanceMap[dateKey] = [];
      }
      attendanceMap[dateKey].push({
        eventId: record.event_id,
        eventTitle: record.event_title,
        eventType: record.event_type,
        status: record.status,
        checkInTime: record.check_in_time,
        startTime: record.start_time,
        endTime: record.end_time
      });
    });
    
    return { data: attendanceMap, error: null };
  },

  /**
   * Get event summary statistics
   */
  async getEventSummary(eventId) {
    const { data, error } = await supabase
      .rpc('get_event_attendance_summary', { p_event_id: eventId });
    
    if (error) {
      console.warn('RPC get_event_attendance_summary failed, using fallback:', error.message);
      
      const { data: attendance } = await this.getEventAttendanceWithStatus(eventId);
      
      return {
        data: {
          total_count: attendance?.length || 0,
          present_count: attendance?.filter(a => a.status === 'present').length || 0,
          late_count: attendance?.filter(a => a.status === 'late').length || 0,
          absent_count: attendance?.filter(a => a.status === 'absent').length || 0
        },
        error: null
      };
    }
    
    return { data: data[0], error: null };
  },

  /**
   * Calculate attendance status based on check-in time
   * Client-side fallback for status calculation
   */
  calculateStatus(checkInTime, startTime, endTime) {
    const checkIn = new Date(`2000-01-01T${checkInTime}`);
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    // Before start + 30 min = Present
    const lateThreshold = new Date(start.getTime() + 30 * 60 * 1000);
    
    if (checkIn < lateThreshold) {
      return 'present';
    } else if (checkIn < end) {
      return 'late';
    } else {
      return 'absent';
    }
  },

  /**
   * Export event attendance to CSV
   */
  async exportEventAttendance(eventId) {
    const { data, error } = await this.getEventAttendanceWithStatus(eventId);
    
    if (error || !data || data.length === 0) {
      throw new Error('No attendance records found');
    }
    
    const headers = ['Name', 'Ministry', 'Event', 'Date', 'Check-in Time', 'Status'];
    const csvRows = [headers.join(',')];
    
    data.forEach(record => {
      const checkInTime = new Date(record.check_in_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      const row = [
        `"${record.worker_name}"`,
        `"${record.ministry}"`,
        `"${record.event_title}"`,
        // FIXED: 'date' -> 'event_date'
        record.event_date,
        checkInTime,
        (record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'Present')
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }
};