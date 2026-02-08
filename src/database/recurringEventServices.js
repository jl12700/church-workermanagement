// recurringEventService.js - Utilities for managing recurring events

import { supabase } from './supabase';

/**
 * Generate dates for recurring events (FUTURE ONLY)
 */
export const generateRecurringDates = (
  startDate,
  endDate,
  pattern,
  dayOfWeek
) => {
  const dates = [];

  const start = new Date(startDate);
  const end = endDate
    ? new Date(endDate)
    : new Date(start.getFullYear() + 1, 11, 31); // default: 1 year

  let currentDate = new Date(start);

  // Move forward to the next target day of week
  while (currentDate.getDay() !== dayOfWeek) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split('T')[0]);

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

/**
 * Create a recurring event series (SAFE)
 */
export const createRecurringEvent = async (eventData, recurrenceConfig) => {
  try {
    /** 1️⃣ Create PARENT event (first occurrence only) */
    const { data: parentEvent, error: parentError } = await supabase
      .from('events')
      .insert([
        {
          ...eventData,
          is_recurring: true,
          recurrence_pattern: recurrenceConfig.pattern,
          recurrence_day_of_week: recurrenceConfig.dayOfWeek,
          recurrence_end_date: recurrenceConfig.endDate || null,
          parent_event_id: null,
          is_series_instance: false
        }
      ])
      .select()
      .single();

    if (parentError) throw parentError;

    /** 2️⃣ Start recurrence AFTER first event */
    const nextDay = new Date(eventData.event_date);
    nextDay.setDate(nextDay.getDate() + 1);

    const dates = generateRecurringDates(
      nextDay.toISOString().split('T')[0],
      recurrenceConfig.endDate,
      recurrenceConfig.pattern,
      recurrenceConfig.dayOfWeek
    );

    /** 3️⃣ Prevent duplicates (DB-safe) */
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

    /** 4️⃣ Insert instances */
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

/**
 * Get all instances of a recurring event
 */
export const getRecurringEventInstances = async (parentEventId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('parent_event_id', parentEventId)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Update parent + future instances
 */
export const updateRecurringEventSeries = async (parentEventId, updates) => {
  const today = new Date().toISOString().split('T')[0];

  await supabase.from('events').update(updates).eq('id', parentEventId);

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('parent_event_id', parentEventId)
    .gte('event_date', today);

  if (error) throw error;
  return data;
};

/**
 * Delete recurring series
 */
export const deleteRecurringEventSeries = async (
  parentEventId,
  deleteOption = 'all'
) => {
  const today = new Date().toISOString().split('T')[0];

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

/**
 * Generate missing instances (on-demand)
 */
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

  const startDate = new Date(
    last?.[0]?.event_date || parent.event_date
  );
  startDate.setDate(startDate.getDate() + 1);

  const dates = generateRecurringDates(
    startDate.toISOString().split('T')[0],
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

/**
 * Get Sunday Service for a specific date (NO AUTO-CREATION)
 */
/**
 * Get Sunday Service for a specific date (NO AUTO-CREATION)
 */
export const getOrCreateSundayService = async (eventDate) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_date', eventDate)
    .eq('type', 'Sunday Service')
    .maybeSingle(); // ✅ FIX: prevents 406

  if (error) {
    console.error('Error fetching Sunday Service:', error);
    throw error;
  }

  // If no event exists, return null (expected behavior)
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

