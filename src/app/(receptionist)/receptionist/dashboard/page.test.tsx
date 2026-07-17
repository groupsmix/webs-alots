import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentUser, fetchAppointments, fetchInvoices, fetchPatients } from "@/lib/data/client";
import Page from "./page";

type AppointmentView = {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  isFirstVisit: boolean;
  hasInsurance: boolean;
};

type InvoiceView = {
  id: string;
  patientName: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  date: string;
};

vi.mock("@/lib/data/client", () => ({
  getCurrentUser: vi.fn(),
  fetchAppointments: vi.fn(),
  fetchInvoices: vi.fn(),
  fetchPatients: vi.fn(),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    getLocalDateStr: vi.fn((date?: Date) => {
      if (date == null) return "2026-07-11";
      const day = date.getDate();
      if (day === 12) return "2026-07-12";
      if (day === 11) return "2026-06-11";
      return "2026-07-11";
    }),
  };
});

vi.mock("@/components/patient/reschedule-dialog", () => ({
  RescheduleDialog: () => null,
}));

vi.mock("@/components/receptionist/appointment-card", () => ({
  AppointmentCard: ({ appointment }: { appointment: { id: string } }) => (
    <div data-testid="appointment-card">{appointment.id}</div>
  ),
}));
vi.mock("@/components/receptionist/cash-register", () => ({
  CashRegister: () => null,
}));
vi.mock("@/components/receptionist/end-of-day-report-button", () => ({
  EndOfDayReportButton: () => null,
}));
vi.mock("@/components/receptionist/manual-booking-dialog", () => ({
  ManualBookingDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
vi.mock("@/components/receptionist/payment-dialog", () => ({
  PaymentDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
vi.mock("@/components/receptionist/quick-patient-registration", () => ({
  QuickPatientRegistration: () => null,
}));
vi.mock("@/components/receptionist/realtime-waiting-room", () => ({
  RealtimeWaitingRoom: () => null,
}));
vi.mock("@/components/receptionist/receptionist-ai-widget", () => ({
  ReceptionistAIWidget: () => null,
}));
vi.mock("@/components/receptionist/walk-in-dialog", () => ({
  WalkInDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

const OriginalDate = global.Date;

describe("ReceptionistDashboardPage", () => {
  beforeEach(() => {
    global.Date = class extends OriginalDate {
      constructor(...args: [string | number] | [number, number, ...number[]] | []) {
        if (args.length === 0) {
          super("2026-07-11T00:30:00Z");
        } else if (args.length === 1) {
          super(args[0]);
        } else {
          const [year, monthIndex, ...rest] = args as unknown as [number, number, ...number[]];
          super(
            year,
            monthIndex,
            rest[0] ?? 1,
            rest[1] ?? 0,
            rest[2] ?? 0,
            rest[3] ?? 0,
            rest[4] ?? 0,
          );
        }
      }
      static override now() {
        return new OriginalDate("2026-07-11T00:30:00Z").getTime();
      }
    } as unknown as DateConstructor;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.Date = OriginalDate;
  });

  it("uses clinic-local dates and does not double-count checked-in patients", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ clinic_id: "clinic-1" } as never);
    vi.mocked(fetchPatients).mockResolvedValue([]);
    vi.mocked(fetchAppointments).mockResolvedValue([
      {
        id: "a1",
        patientId: "p1",
        patientName: "Patient One",
        doctorId: "d1",
        doctorName: "Dr. Amine",
        serviceId: "s1",
        serviceName: "Consultation",
        date: "2026-07-11",
        time: "09:00",
        status: "confirmed",
        isFirstVisit: false,
        hasInsurance: false,
      },
      {
        id: "a2",
        patientId: "p1",
        patientName: "Patient One",
        doctorId: "d1",
        doctorName: "Dr. Amine",
        serviceId: "s1",
        serviceName: "Consultation",
        date: "2026-07-11",
        time: "10:00",
        status: "in-progress",
        isFirstVisit: false,
        hasInsurance: false,
      },
      {
        id: "a3",
        patientId: "p1",
        patientName: "Patient One",
        doctorId: "d1",
        doctorName: "Dr. Amine",
        serviceId: "s1",
        serviceName: "Consultation",
        date: "2026-07-12",
        time: "09:00",
        status: "confirmed",
        isFirstVisit: false,
        hasInsurance: false,
      },
      {
        id: "a4",
        patientId: "p1",
        patientName: "Patient One",
        doctorId: "d1",
        doctorName: "Dr. Amine",
        serviceId: "s1",
        serviceName: "Consultation",
        date: "2026-07-10",
        time: "09:00",
        status: "completed",
        isFirstVisit: false,
        hasInsurance: false,
      },
    ] as AppointmentView[]);
    vi.mocked(fetchInvoices).mockResolvedValue([
      {
        id: "i1",
        patientName: "Patient One",
        amount: 100,
        currency: "MAD",
        method: "cash",
        status: "paid",
        date: "2026-07-11",
      },
      {
        id: "i2",
        patientName: "Patient One",
        amount: 50,
        currency: "MAD",
        method: "cash",
        status: "paid",
        date: "2026-06-01",
      },
    ] as InvoiceView[]);

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("100,00 MAD")).toBeTruthy();
    });

    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("100,00 MAD")).toBeTruthy();

    expect(fetchAppointments).toHaveBeenCalledWith("clinic-1", {
      sinceDate: "2026-06-11",
    });
  });
});
