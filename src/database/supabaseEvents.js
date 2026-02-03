import { supabase } from './supabase';

export const eventService = {
  async getEvents(filters = {}) {
    let query = supabase
      .from('events')
      .select(`
        *,
        event_workers(
          *,
          worker:workers(*)
        )
      `);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.date)   query = query.eq('event_date', filters.date);

    const { data, error } = await query.order('event_date', { ascending: true });
    return { data, error };
  },

  async getEventById(id) {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_workers(
          *,
          worker:workers(*)
        )
      `)
      .eq('id', id)
      .single();

    return { data, error };
  },

  async getTodayEvents() {
    const today = new Date().toISOString().split('T')[0];
    return this.getEvents({ date: today });
  },

  

async createEvent(event) {
  const user = supabase.auth.getUser(); 
  const { data, error } = await supabase
    .from('events')
    .insert({
      ...event,
      created_by: user?.data?.user?.id 
    })
    .select()
    .single();

  return { data, error };
}
,

  async updateEvent(id, updates) {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },


  async deleteEvent(id) {
    console.log('[deleteEvent] called with id:', id, 'type:', typeof id);

    const step1 = await supabase
      .from('event_workers')
      .delete()
      .eq('event_id', id);

    console.log('[deleteEvent] step1 event_workers:', JSON.stringify(step1));

    if (step1.error) {
      return { error: { message: 'Failed to remove worker assignments: ' + step1.error.message } };
    }

    const step2 = await supabase
      .from('event_attendance')
      .delete()
      .eq('event_id', id);

    console.log('[deleteEvent] step2 event_attendance:', JSON.stringify(step2));

    if (step2.error) {
      return { error: { message: 'Failed to remove attendance records: ' + step2.error.message } };
    }

    const step3 = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    console.log('[deleteEvent] step3 events:', JSON.stringify(step3));

    if (step3.error) {
      return { error: { message: 'Failed to delete event: ' + step3.error.message } };
    }

    if (step3.count === 0) {
      return {
        error: {
          message: 'Event could not be deleted (count 0). id=' + id
        }
      };
    }

    console.log('[deleteEvent] SUCCESS — event deleted');
    return { error: null };
  },


  async replaceEventWorkers(eventId, workerIds) {
    await supabase
      .from('event_workers')
      .delete()
      .eq('event_id', eventId);

    if (!workerIds || workerIds.length === 0) {
      return { data: [], error: null };
    }

    const rows = workerIds.map(workerId => ({
      event_id: eventId,
      worker_id: workerId
    }));

    const { data, error } = await supabase
      .from('event_workers')
      .insert(rows)
      .select();

    return { data, error };
  },

  async getEventWorkers(eventId) {
    const { data, error } = await supabase
      .from('event_workers')
      .select('*, worker:workers(*)')
      .eq('event_id', eventId);

    return { data, error };
  },


  async checkInToEvent(attendance) {
    const { data: existing } = await supabase
      .from('event_attendance')
      .select('id')
      .eq('event_id', attendance.event_id)
      .eq('worker_id', attendance.worker_id)
      .maybeSingle();

    if (existing) {
      return {
        data: null,
        error: { message: 'Already checked in to this event' }
      };
    }

    const { data, error } = await supabase
      .from('event_attendance')
      .insert(attendance)
      .select()
      .single();

    return { data, error };
  },

  async getEventAttendance(eventId) {
    const { data, error } = await supabase
      .from('event_attendance')
      .select('*, worker:workers(*)')
      .eq('event_id', eventId)
      .order('check_in_time', { ascending: false });

    return { data, error };
  },


  async getEventStats(eventId) {
    const { data, error } = await supabase
      .rpc('get_event_stats', { p_event_id: eventId });

    return { data, error };
  },

  async updateEventStatus(eventId, status, additionalData = {}) {
    return this.updateEvent(eventId, { status, ...additionalData });
  }
};

export const workerService = {
  async getAllWorkers() {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .order('name');

    return { data, error };
  }
};