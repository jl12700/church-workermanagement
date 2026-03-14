import { supabase } from './supabase';

// ✅ Timezone-safe local date string helper
const getLocalDateString = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const generateRecurringDates = (startDate, endDate, pattern, dayOfWeek) => {
  const dates = [];
  const start = new Date(startDate);
  const end = endDate
    ? new Date(endDate)
    : new Date(start.getFullYear() + 1, 11, 31);

  let currentDate = new Date(start);

  while (currentDate.getDay() !== dayOfWeek) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  while (currentDate <= end) {
    dates.push(getLocalDateString(currentDate)); // ✅ Fixed

    switch (pattern) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly': {
        const targetDay = currentDate.getDay();
        currentDate.setMonth(currentDate.getMonth() + 1);
        while (currentDate.getDay() !== targetDay) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
        break;
      }
      default:
        return dates;
    }
  }

  return dates;
};

export const createRecurringEvent = async (eventData, recurrenceConfig) => {
  try {
    const { data: parentEvent, error: parentError } = await supabase
      .from('events')
      .insert([{
        ...eventData,
        is_recurring: true,
        recurrence_pattern: recurrenceConfig.pattern,
        recurrence_day_of_week: recurrenceConfig.dayOfWeek,
        recurrence_end_date: recurrenceConfig.endDate || null,
        parent_event_id: null,
        is_series_instance: false
      }])
      .select()
      .single();

    if (parentError) throw parentError;

    const nextDay = new Date(eventData.event_date);
    nextDay.setDate(nextDay.getDate() + 1);

    const dates = generateRecurringDates(
      getLocalDateString(nextDay), // ✅ Fixed
      recurrenceConfig.endDate,
      recurrenceConfig.pattern,
      recurrenceConfig.dayOfWeek
    );

    const instances = [];

    for (const date of dates) {
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('event_date', date)
        .maybeSingle();

      if (!existing) {
        instances.push({
          ...eventData,
          event_date: date,
          is_recurring: false,
          recurrence_pattern: null,
          recurrence_day_of_week: null,
          recurrence_end_date: null,
          parent_event_id: parentEvent.id,
          is_series_instance: true
        });
      }
    }

    let createdInstances = [];

    if (instances.length > 0) {
      const { data, error } = await supabase
        .from('events')
        .insert(instances)
        .select();

      if (error) throw error;
      createdInstances = data;
    }

    return {
      parent: parentEvent,
      instances: createdInstances,
      count: createdInstances.length
    };
  } catch (error) {
    console.error('Error creating recurring event:', error);
    throw error;
  }
};

export const getRecurringEventInstances = async (parentEventId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('parent_event_id', parentEventId)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data;
};

export const updateRecurringEventSeries = async (parentEventId, updates) => {
  const today = getLocalDateString(); // ✅ Fixed

  await supabase.from('events').update(updates).eq('id', parentEventId);

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('parent_event_id', parentEventId)
    .gte('event_date', today);

  if (error) throw error;
  return data;
};

export const deleteRecurringEventSeries = async (parentEventId, deleteOption = 'all') => {
  const today = getLocalDateString(); // ✅ Fixed

  if (deleteOption === 'all') {
    await supabase.from('events').delete().eq('parent_event_id', parentEventId);
    await supabase.from('events').delete().eq('id', parentEventId);
  }

  if (deleteOption === 'future') {
    await supabase
      .from('events')
      .delete()
      .eq('parent_event_id', parentEventId)
      .gte('event_date', today);

    await supabase
      .from('events')
      .update({ recurrence_end_date: today })
      .eq('id', parentEventId);
  }

  return { success: true };
};

export const generateMissingInstances = async (parentEventId) => {
  const { data: parent } = await supabase
    .from('events')
    .select('*')
    .eq('id', parentEventId)
    .single();

  if (!parent || !parent.is_recurring) return { generated: 0 };

  const { data: last } = await supabase
    .from('events')
    .select('event_date')
    .eq('parent_event_id', parentEventId)
    .order('event_date', { ascending: false })
    .limit(1);

  const startDate = new Date(last?.[0]?.event_date || parent.event_date);
  startDate.setDate(startDate.getDate() + 1);

  const dates = generateRecurringDates(
    getLocalDateString(startDate), // ✅ Fixed
    parent.recurrence_end_date,
    parent.recurrence_pattern,
    parent.recurrence_day_of_week
  );

  const instances = [];

  for (const date of dates) {
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('event_date', date)
      .maybeSingle();

    if (!existing) {
      instances.push({
        ...parent,
        event_date: date,
        is_recurring: false,
        parent_event_id: parent.id,
        is_series_instance: true
      });
    }
  }

  if (instances.length === 0) return { generated: 0 };

  const { data, error } = await supabase
    .from('events')
    .insert(instances)
    .select();

  if (error) throw error;
  return { generated: data.length, instances: data };
};

export const getOrCreateSundayService = async (eventDate) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_date', eventDate)
    .eq('type', 'Sunday Service')
    .maybeSingle();

  if (error) {
    console.error('Error fetching Sunday Service:', error);
    throw error;
  }

  return data;
};

export default {
  generateRecurringDates,
  createRecurringEvent,
  getRecurringEventInstances,
  updateRecurringEventSeries,
  deleteRecurringEventSeries,
  generateMissingInstances,
  getOrCreateSundayService
};