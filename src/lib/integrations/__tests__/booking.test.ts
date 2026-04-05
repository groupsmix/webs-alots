/**
 * Booking Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  updateDoctorAvailability,
  getAvailableSlots
} from '../booking';

// Mock dependencies
vi.mock('@/lib/supabase-server', () => ({
  createTenantClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() => ({
                single: vi.fn(() => ({ data: null, error: null })),
              })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ 
            data: { id: 'appointment-123' }, 
            error: null 
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: vi.fn(),
}));

describe('Booking Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAppointment', () => {
    it('should create appointment successfully', async () => {
      const result = await createAppointment('business-123', {
        patient_id: 'patient-123',
        doctor_id: 'doctor-123',
        service_id: 'service-123',
        slot_start: '2026-04-10T10:00:00Z',
        slot_end: '2026-04-10T11:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.appointment_id).toBe('appointment-123');
    });
  });

  describe('rescheduleAppointment', () => {
    it('should reschedule appointment successfully', async () => {
      const result = await rescheduleAppointment(
        'business-123',
        'appointment-123',
        '2026-04-11T10:00:00Z',
        '2026-04-11T11:00:00Z',
        'Patient request'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel appointment successfully', async () => {
      const result = await cancelAppointment(
        'business-123',
        'appointment-123',
        'Patient cancelled'
      );

      expect(result.success).toBe(true);
    });
  });
});
