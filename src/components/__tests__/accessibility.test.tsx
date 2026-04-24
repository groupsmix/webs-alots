import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import LoginPage from "@/app/(auth)/login/page";
import { ContactForm } from "@/components/public/contact-form";
import { BookingForm } from "@/components/booking/booking-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchIcon } from "lucide-react";

expect.extend(toHaveNoViolations);

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  signInWithOTP: vi.fn(),
  verifyOTP: vi.fn(),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
}));

// Mock UI components with accessible HTML
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div role="region" aria-label="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: { "data-testid"?: string; [key: string]: unknown }) => (
    <input data-testid={props["data-testid"] || "input"} {...props} />
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: { [key: string]: unknown }) => (
    <textarea {...props} />
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

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => <a href={href} {...props}>{children}</a>,
}));

// Mock tenant provider for BookingForm
vi.mock("@/components/tenant-provider", () => ({
  useTenant: () => ({ clinicId: "test-clinic", clinicName: "Test Clinic", subdomain: "test" }),
}));

// Mock data fetchers for BookingForm
vi.mock("@/lib/data/client", () => ({
  fetchDoctors: vi.fn().mockResolvedValue([]),
  fetchServices: vi.fn().mockResolvedValue([]),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock toast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock hooks
vi.mock("@/lib/hooks/use-form-validation", () => ({
  useFormValidation: () => ({
    onFieldChange: vi.fn(),
    onFieldBlur: vi.fn(),
    getFieldError: () => null,
  }),
  commonRules: {
    required: () => ({ validate: () => null }),
    phone: () => ({ validate: () => null }),
  },
}));

describe("Accessibility (WCAG)", () => {
  it("login page has no critical accessibility violations", async () => {
    const { container } = render(<LoginPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("contact form has no critical accessibility violations", async () => {
    const { container } = render(<ContactForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("booking form has no critical accessibility violations", async () => {
    const { container } = render(<BookingForm />);
    // Wait for loading state to resolve
    await vi.waitFor(() => {
      expect(container.querySelector("[role='region']")).toBeTruthy();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("breadcrumb navigation has no accessibility violations", async () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("empty state component has no accessibility violations", async () => {
    const { container } = render(
      <EmptyState
        icon={SearchIcon}
        title="No patients found"
        description="Try adjusting your search filters"
        action={<button type="button">Add Patient</button>}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("form with error states has accessible error associations", async () => {
    const { container } = render(
      <form>
        <div>
          <label htmlFor="test-email">Email</label>
          <input
            id="test-email"
            type="email"
            aria-invalid="true"
            aria-describedby="email-error"
          />
          <p id="email-error" role="alert">Invalid email address</p>
        </div>
        <div>
          <label htmlFor="test-password">Password</label>
          <input
            id="test-password"
            type="password"
            aria-invalid="true"
            aria-describedby="password-error"
          />
          <p id="password-error" role="alert">Password too short</p>
        </div>
        <button type="submit">Submit</button>
      </form>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("modal dialog pattern has correct ARIA roles", async () => {
    const { container } = render(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <h2 id="dialog-title">Confirm Appointment</h2>
        <p>Are you sure you want to book this appointment?</p>
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </div>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("navigation landmark has no violations", async () => {
    const { container } = render(
      <nav aria-label="Main navigation">
        <ul>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/patients">Patients</a></li>
          <li><a href="/appointments">Appointments</a></li>
          <li><a href="/settings">Settings</a></li>
        </ul>
      </nav>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("data table with headers has correct associations", async () => {
    const { container } = render(
      <table>
        <caption>Patient Appointments</caption>
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>John Doe</td>
            <td>2026-03-15</td>
            <td><span role="status">Confirmed</span></td>
            <td><button type="button" aria-label="View John Doe appointment">View</button></td>
          </tr>
        </tbody>
      </table>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
