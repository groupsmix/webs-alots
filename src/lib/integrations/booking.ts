/**
 * Booking System Integration
 * 
 * Creates, updates, and manages appointments in the booking system.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { logAuditEvent } from '@/lib/audit-log';

// ========== Create Appointment ==========

export async function createAppointment(
  businessId: string,
  params: {
    patient_id: string;
    doctor_id: string;
    service_id: string;
    slot_start: string;
    slot_end: string;
    notes?: string;
    created_by?: string;
  }
): Promise<{ success: boolean; appointment_id?: string; error?: string }> {
  try {
    const supabase = await createTenantClient(businessId);

    // Validate slot availability
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', businessId)
      .eq('doctor_id', params.doctor_id)
      .eq('slot_start', params.slot_start)
      .neq('status', 'cancelled')
      .single();

    if (existingAppointment) {
      return {
        success: false,
        error: 'Time slot already booked',
      };
    }

    // Create appointment
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        clinic_id: businessId,
        patient_id: params.patient_id,
        doctor_id: params.doctor_id,
        service_id: params.service_id,
        slot_start: params.slot_start,
        slot_end: params.slot_end,
        status: 'confirmed',
        notes: params.notes,
        created_by: params.created_by || 'ai_agent',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create appointment', {
        context: 'booking-integration',
        error,
      });
      return { success: false, error: error.message };
    }

    // Log audit event
    await logAuditEvent({
      action: 'appointment.created',
      type: 'appointment',
      clinicId: businessId,
      actor: params.created_by || 'ai_agent',
      description: `AI created appointment for patient ${params.patient_id}`,
      metadata: {
        appointment_id: data.id,
        patient_id: params.patient_id,
        doctor_id: params.doctor_id,
        slot_start: params.slot_start,
      },
    });

    logger.info('Appointment created', {
      context: 'booking-integration',
      appointmentId: data.id,
    });

    return {
      success: true,
      appointment_id: data.id,
    };
  } catch (error) {
    logger.error('Failed to create appointment', {
      context: 'booking-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Reschedule Appointment ==========

export async function rescheduleAppointment(
  businessId: string,
  appointmentId: string,
  newSlotStart: string,
  newSlotEnd: string,
  reason?: string
): Promise<{ success: boolean; error?: string; original_slot?: { start: string; end: string } }> {
  try {
    const supabase = await createTenantClient(businessId);

    // Get original appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('slot_start, slot_end, doctor_id, patient_id')
      .eq('id', appointmentId)
      .eq('clinic_id', businessId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    // Check new slot availability
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', businessId)
      .eq('doctor_id', appointment.doctor_id)
      .eq('slot_start', newSlotStart)
      .neq('id', appointmentId)
      .neq('status', 'cancelled')
      .single();

    if (existingAppointment) {
      return {
        success: false,
        error: 'New time slot already booked',
      };
    }

    // Update appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        slot_start: newSlotStart,
        slot_end: newSlotEnd,
        updated_at: new Date().toISOString(),
        reschedule_reason: reason,
      })
      .eq('id', appointmentId)
      .eq('clinic_id', businessId);

    if (updateError) {
      logger.error('Failed to reschedule appointment', {
        context: 'booking-integration',
        error: updateError,
      });
      return { success: false, error: updateError.message };
    }

    // Log audit event
    await logAuditEvent({
      action: 'appointment.rescheduled',
      type: 'appointment',
      clinicId: businessId,
      actor: 'ai_agent',
      description: `AI rescheduled appointment ${appointmentId}`,
      metadata: {
        appointment_id: appointmentId,
        original_slot: { start: appointment.slot_start, end: appointment.slot_end },
        new_slot: { start: newSlotStart, end: newSlotEnd },
        reason,
      },
    });

    logger.info('Appointment rescheduled', {
      context: 'booking-integration',
      appointmentId,
    });

    return {
      success: true,
      original_slot: {
        start: appointment.slot_start,
        end: appointment.slot_end,
      },
    };
  } catch (error) {
    logger.error('Failed to reschedule appointment', {
      context: 'booking-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Cancel Appointment ==========

export async function cancelAppointment(
  businessId: string,
  appointmentId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createTenantClient(businessId);

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('clinic_id', businessId);

    if (error) {
      logger.error('Failed to cancel appointment', {
        context: 'booking-integration',
        error,
      });
      return { success: false, error: error.message };
    }

    // Log audit event
    await logAuditEvent({
      action: 'appointment.cancelled',
      type: 'appointment',
      clinicId: businessId,
      actor: 'ai_agent',
      description: `AI cancelled appointment ${appointmentId}`,
      metadata: {
        appointment_id: appointmentId,
        reason,
      },
    });

    logger.info('Appointment cancelled', {
      context: 'booking-integration',
      appointmentId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to cancel appointment', {
      context: 'booking-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Update Availability ==========

export async function updateDoctorAvailability(
  businessId: string,
  doctorId: string,
  timeSlotIds: string[],
  isActive: boolean
): Promise<{ success: boolean; error?: string; updated_count?: number }> {
  try {
    const supabase = await createTenantClient(businessId);

    const { error, count } = await supabase
      .from('time_slots')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('clinic_id', businessId)
      .eq('doctor_id', doctorId)
      .in('id', timeSlotIds);

    if (error) {
      logger.error('Failed to update availability', {
        context: 'booking-integration',
        error,
      });
      return { success: false, error: error.message };
    }

    // Log audit event
    await logAuditEvent({
      action: 'availability.updated',
      type: 'availability',
      clinicId: businessId,
      actor: 'ai_agent',
      description: `AI ${isActive ? 'enabled' : 'disabled'} ${count} time slots for doctor ${doctorId}`,
      metadata: {
        doctor_id: doctorId,
        time_slot_ids: timeSlotIds,
        is_active: isActive,
        count,
      },
    });

    logger.info('Availability updated', {
      context: 'booking-integration',
      doctorId,
      count,
    });

    return {
      success: true,
      updated_count: count || 0,
    };
  } catch (error) {
    logger.error('Failed to update availability', {
      context: 'booking-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Get Available Slots ==========

export async function getAvailableSlots(
  businessId: string,
  doctorId: string,
  date: string
): Promise<{ success: boolean; slots?: any[]; error?: string }> {
  try {
    const supabase = await createTenantClient(businessId);

    const { data: slots, error } = await supabase
      .from('time_slots')
      .select('*')
      .eq('clinic_id', businessId)
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .gte('slot_start', `${date}T00:00:00`)
      .lt('slot_start', `${date}T23:59:59`)
      .order('slot_start', { ascending: true });

    if (error) {
      logger.error('Failed to get available slots', {
        context: 'booking-integration',
        error,
      });
      return { success: false, error: error.message };
    }

    // Filter out booked slots
    const { data: appointments } = await supabase
      .from('appointments')
      .select('slot_start')
      .eq('clinic_id', businessId)
      .eq('doctor_id', doctorId)
      .gte('slot_start', `${date}T00:00:00`)
      .lt('slot_start', `${date}T23:59:59`)
      .neq('status', 'cancelled');

    const bookedTimes = new Set(appointments?.map(a => a.slot_start) || []);
    const availableSlots = slots?.filter(slot => !bookedTimes.has(slot.slot_start)) || [];

    return {
      success: true,
      slots: availableSlots,
    };
  } catch (error) {
    logger.error('Failed to get available slots', {
      context: 'booking-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
