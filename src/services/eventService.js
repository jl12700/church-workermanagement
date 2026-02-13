// ============================================================================
// EVENT SERVICE - UPDATED VERSION
// ============================================================================
// Enhanced with manual event ending support and new attendance fields
// ============================================================================

import { supabase } from './supabase';

export const eventService = {
  // =========================================================================
  // EVENT CRUD OPERATIONS
  // =========================================================================
  
  /**
   * Get all events with optional filters
   */
  async getAllEvents(filters = {}) {
    let query = supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });
    
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.startDate && filters.endDate) {
      query = query.gte('event_date', filters.startDate).lte('event_date', filters.endDate);
    }
    
    return await query;
  },

  /**
   * Get event by ID
   */
  async getEventById(eventId) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    
    return { data, error };
  },

  /**
   * Get today's events
   */
  async getTodayEvents() {
    const today = new Date().toISOString().split('T')[0];
    
    return await supabase
      .from('events')
      .select('*')
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
      .eq('event_date', date)
      .order('start_time', { ascending: true });
  },

  /**
   * Get Sunday Service event for a specific date
   * Creates one if it doesn't exist using database function
   */
  async getSundayServiceEvent(date) {
    try {
      // Check if event exists
      const { data: existing, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('event_date', date)
        .eq('type', 'sunday_service')
        .single();
      
      if (existing) {
        return { data: existing, error: null };
      }
      
      // Use database function to create Sunday Service event (if available)
      const { data: eventId, error: rpcError } = await supabase
        .rpc('create_sunday_service_event', {
          p_date: date,
          p_start_time: '08:00:00',
          p_end_time: '12:00:00'
        });
      
      if (rpcError) throw rpcError;
      
      // Fetch the newly created event
      const { data: newEvent, error: newError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      return { data: newEvent, error: newError };
    } catch (error) {
      console.error('Error in getSundayServiceEvent:', error);
      return { data: null, error };
    }
  },

  /**
   * Get all Sunday service events (including recurring instances)
   */
  async getSundayServiceEvents(startDate, endDate) {
    let query = supabase
      .from('events')
      .select('*')
      .eq('type', 'sunday_service')
      .eq('status', 'approved');

    if (startDate) {
      query = query.gte('event_date', startDate);
    }
    if (endDate) {
      query = query.lte('event_date', endDate);
    }

    query = query.order('event_date', { ascending: true });

    const { data, error } = await query;
    return { data, error };
  },

  /**
   * Create a new event
   */
  async createEvent(eventData) {
    return await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();
  },

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
   * NEW: Manually end an event with attendance summary
   */
  async endEvent(eventId, summaryData) {
    return await supabase
      .from('events')
      .update({
        is_ended: true,
        total_attendees: summaryData.totalAttendees,
        total_visitors: summaryData.totalVisitors,
        total_baptized: summaryData.totalBaptized,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();
  },

  // =========================================================================
  // ATTENDANCE OPERATIONS - UPDATED FOR NEW STATUS LOGIC
  // =========================================================================
  
  /**
   * Record attendance for an event
   * Updated to support new prep_time and devotion_time fields
   */
  async recordAttendance(eventId, workerId, scanType = 'qr', options = {}) {
    try {
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
      const { data, error } = await supabase
        .from('event_attendance')
        .insert([{
          event_id: eventId,
          worker_id: workerId,
          check_in_time: new Date().toISOString(),
          scan_type: scanType,
          is_guest: options.isGuest || false,
          is_baptized: options.isBaptized !== undefined ? options.isBaptized : true,
          notes: options.notes || null
        }])
        .select(`
          *,
          worker:workers(*),
          event:events(*)
        `)
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error recording attendance:', error);
      return { data: null, error };
    }
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
        event:events(id, title, type, event_date, start_time, end_time, prep_time, devotion_time)
      `)
      .eq('event_id', eventId)
      .order('check_in_time', { ascending: false });
  },

  /**
   * Get attendance using the status view
   */
  async getEventAttendanceWithStatus(eventId) {
    return await supabase
      .from('attendance_status_view')
      .select('*')
      .eq('event_id', eventId)
      .order('check_in_time', { ascending: false });
  },

  /**
   * Get attendance by view with filters
   */
  async getAttendanceByView(filters = {}) {
    let query = supabase
      .from('attendance_status_view')
      .select('*');

    if (filters.workerId) {
      query = query.eq('worker_id', filters.workerId);
    }
    if (filters.eventId) {
      query = query.eq('event_id', filters.eventId);
    }
    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }
    if (filters.startDate) {
      query = query.gte('event_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('event_date', filters.endDate);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('event_date', { ascending: false });

    const { data, error } = await query;
    return { data, error };
  },

  /**
   * Update attendance check-in time
   */
  async updateAttendanceTime(attendanceId, newCheckInTime) {
    const { data, error } = await supabase
      .from('event_attendance')
      .update({ 
        check_in_time: newCheckInTime 
      })
      .eq('id', attendanceId)
      .select(`
        *,
        worker:workers(*),
        event:events(*)
      `)
      .single();

    return { data, error };
  },

  /**
   * Delete attendance record
   */
  async deleteAttendance(attendanceId) {
    const { error } = await supabase
      .from('event_attendance')
      .delete()
      .eq('id', attendanceId);

    return { error };
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
        status: record.status || 'present',
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
    // Try to use RPC first (if available)
    const { data, error } = await supabase
      .rpc('get_event_attendance_summary', { p_event_id: eventId });
    
    if (error) {
      console.warn('RPC get_event_attendance_summary failed, calculating manually:', error.message);
      
      // Fallback: Calculate manually
      const { data: attendance } = await this.getEventAttendanceWithStatus(eventId);
      
      const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
      const lateCount = attendance?.filter(a => a.status === 'late').length || 0;
      const absentCount = attendance?.filter(a => a.status === 'absent').length || 0;
      
      return {
        data: {
          total_count: attendance?.length || 0,
          present_count: presentCount,
          late_count: lateCount,
          absent_count: absentCount
        },
        error: null
      };
    }
    
    return { data: data[0], error: null };
  },

  /**
   * Get attendance summary for an event
   */
  async getEventAttendanceSummary(eventId) {
    try {
      // Get total workers
      const { count: totalWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');

      // Get attendance with status breakdown
      const { data: attendance, error } = await supabase
        .from('event_attendance')
        .select('attendance_status')
        .eq('event_id', eventId);

      if (error) throw error;

      const summary = {
        totalWorkers: totalWorkers || 0,
        scanned: attendance?.length || 0,
        present: attendance?.filter(a => a.attendance_status === 'present').length || 0,
        late: attendance?.filter(a => a.attendance_status === 'late').length || 0,
        absent: attendance?.filter(a => a.attendance_status === 'absent').length || 0,
        notScanned: (totalWorkers || 0) - (attendance?.length || 0)
      };

      return { data: summary, error: null };
    } catch (error) {
      console.error('Error getting attendance summary:', error);
      return { data: null, error };
    }
  },

  /**
   * NEW: Calculate attendance status based on prep/devotion times
   * This is client-side logic that matches the new requirements
   */
  calculateAttendanceStatus(checkInTime, prepTime, devotionTime, startTime) {
    const checkIn = new Date(checkInTime);
    const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
    
    const parseTime = (timeStr) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const prepMinutes = parseTime(prepTime);
    const devotionMinutes = parseTime(devotionTime);
    
    // New logic: Present if between prep and devotion time
    if (prepMinutes !== null && devotionMinutes !== null) {
      if (checkInMinutes >= prepMinutes && checkInMinutes <= devotionMinutes) {
        return 'present';
      } else if (checkInMinutes > devotionMinutes) {
        return 'late';
      }
    }
    
    // Fallback to basic logic
    if (startTime) {
      const startMinutes = parseTime(startTime);
      if (startMinutes !== null) {
        if (checkInMinutes <= startMinutes + 15) {
          return 'present';
        } else {
          return 'late';
        }
      }
    }
    
    return 'present';
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
        record.event_date,
        checkInTime,
        (record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'Present')
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  },

  // =========================================================================
  // RECURRING EVENTS SUPPORT
  // =========================================================================
  
  /**
   * Get attendance for recurring event series
   */
  async getSeriesAttendance(parentEventId) {
    try {
      // Get all events in the series
      const { data: seriesEvents } = await supabase
        .from('events')
        .select('id, event_date, title')
        .or(`id.eq.${parentEventId},parent_event_id.eq.${parentEventId}`)
        .order('event_date', { ascending: true });

      if (!seriesEvents) return { data: null, error: 'Series not found' };

      // Get attendance for all events in series
      const eventIds = seriesEvents.map(e => e.id);
      const { data: attendance } = await supabase
        .from('attendance_status_view')
        .select('*')
        .in('event_id', eventIds)
        .order('event_date', { ascending: true });

      return { 
        data: {
          events: seriesEvents,
          attendance: attendance || []
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error getting series attendance:', error);
      return { data: null, error };
    }
  },

  /**
   * Verify worker attendance sync for a specific date range
   * Useful for debugging sync issues
   */
  async verifyAttendanceSync(startDate, endDate) {
    try {
      // Get attendance from view
      const { data: viewData } = await this.getAttendanceByView({
        startDate,
        endDate
      });

      // Get attendance from table
      const { data: tableData } = await supabase
        .from('event_attendance')
        .select(`
          *,
          event:events!inner(event_date, type, start_time)
        `)
        .gte('event:events.event_date', startDate)
        .lte('event:events.event_date', endDate);

      return {
        data: {
          viewRecords: viewData?.length || 0,
          tableRecords: tableData?.length || 0,
          synced: viewData?.length === tableData?.length,
          viewData,
          tableData
        },
        error: null
      };
    } catch (error) {
      console.error('Error verifying sync:', error);
      return { data: null, error };
    }
  }
};

export default eventService;