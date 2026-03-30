import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import LoginPage from "@/app/(auth)/login/page";
import { BookingCalendar } from "@/components/booking/calendar";
import { PatientRegistrationDialog } from "@/components/receptionist/patient-registration-dialog";
import { OfflineIndicator } from "@/components/offline-indicator";

expect.extend(toHaveNoViolations);

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  signInWithOTP: vi.fn(),
  verifyOTP: vi.fn(),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
}));

// Mock UI components with accessible HTML
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div role="region" aria-label="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: { "data-testid"?: string; [key: string]: unknown }) => (
    <input data-testid={props["data-testid"] || "input"} {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, type, onClick, disabled, ...props }: { children: React.ReactNode; type?: "submit" | "reset" | "button"; onClick?: () => void; disabled?: boolean; [key: string]: unknown }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

// Mock clinic config for BookingCalendar
vi.mock("@/config/clinic.config", () => ({
  clinicConfig: {
    workingHours: [
      { enabled: true, start: "09:00", end: "17:00" },
      { enabled: true, start: "09:00", end: "17:00" },
      { enabled: true, start: "09:00", end: "17:00" },
      { enabled: true, start: "09:00", end: "17:00" },
      { enabled: true, start: "09:00", end: "17:00" },
      { enabled: true, start: "09:00", end: "17:00" },
      { enabled: false, start: "09:00", end: "17:00" },
    ],
  },
}));

// Mock Tooltip for BookingCalendar
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock dialog components for PatientRegistrationDialog
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
    open ? <div role="dialog" aria-modal="true">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode; onClose?: () => void }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({ placeholder, value, onChange, rows, ...props }: { placeholder?: string; value?: string; onChange?: (e: { target: { value: string } }) => void; rows?: number }) => (
    <textarea placeholder={placeholder} value={value} onChange={onChange} rows={rows} {...props} />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

// Mock locale for OfflineIndicator
vi.mock("@/components/locale-switcher", () => ({
  useLocale: () => ["fr"],
}));

vi.mock("@/lib/i18n", () => ({
  t: (_locale: string, key: string) => key,
}));

// Mock cn utility
vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | undefined | null | false)[]) => args.filter(Boolean).join(" "),
}));

describe("Accessibility (WCAG)", () => {
  it("login page has no critical accessibility violations", async () => {
    const { container } = render(<LoginPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("booking calendar has no critical accessibility violations", async () => {
    const { container } = render(
      <BookingCalendar selectedDate="" onSelectDate={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("patient registration dialog has no critical accessibility violations", async () => {
    // Render the dialog in open state by clicking the trigger
    const { container, getByText } = render(<PatientRegistrationDialog />);
    // Click trigger to open dialog
    const trigger = getByText("Register New Patient");
    trigger.click();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("offline indicator has no critical accessibility violations", async () => {
    // Simulate offline state
    const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const { container } = render(<OfflineIndicator />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    // Restore original value
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    } else {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    }
  });
});
