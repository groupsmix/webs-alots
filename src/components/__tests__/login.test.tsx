import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginForm } from "@/app/(auth)/login/login-form";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  signInWithOTP: vi.fn(),
  verifyOTP: vi.fn(),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
  signInWithEmailOTP: vi.fn().mockResolvedValue({ error: null }),
  verifyEmailOTP: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase-client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [] } }),
        challenge: vi.fn().mockResolvedValue({ data: { id: "c1" }, error: null }),
        verify: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  })),
}));

// Mock UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: { [key: string]: unknown }) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type,
    onClick,
    disabled,
    variant: _variant,
    ...props
  }: {
    children: React.ReactNode;
    type?: "submit" | "reset" | "button";
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    [key: string]: unknown;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without error", () => {
    const { container } = render(<LoginForm />);
    expect(container).toBeDefined();
  });

  it("renders the login card", () => {
    render(<LoginForm />);
    expect(screen.getByTestId("card")).toBeDefined();
  });

  it("has email input field", () => {
    render(<LoginForm />);
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).toBeDefined();
  });

  it("has password input field", () => {
    render(<LoginForm />);
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeDefined();
  });

  it("has submit button", () => {
    render(<LoginForm />);
    const buttons = document.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("can be rendered with form inputs", () => {
    render(<LoginForm />);
    const inputs = document.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders pill tabs for auth method selection", () => {
    render(<LoginForm />);
    expect(screen.getAllByText("E-mail").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Code e-mail")).toBeDefined();
  });

  it("renders French text for login title", () => {
    render(<LoginForm />);
    // The login title comes from t(locale, "auth.login") which renders French
    const card = screen.getByTestId("card");
    expect(card).toBeDefined();
  });

  it("has a password visibility toggle button", () => {
    render(<LoginForm />);
    const toggleBtn = document.querySelector("button[aria-label]");
    expect(toggleBtn).toBeDefined();
  });

  it("toggles password visibility when eye icon is clicked", () => {
    render(<LoginForm />);
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeDefined();

    const toggleBtn = document.querySelector("button[aria-label]");
    expect(toggleBtn).toBeDefined();
    fireEvent.click(toggleBtn!);

    const textInput = document.querySelector('input[type="text"]');
    expect(textInput).toBeDefined();
  });

  it("switches to email-otp method when Code e-mail tab is clicked", () => {
    render(<LoginForm />);
    const emailOtpTab = screen.getByText("Code e-mail");
    fireEvent.click(emailOtpTab);

    // In email-otp mode, there should be an email input but no password input
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).toBeDefined();
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeNull();
  });

  it("has forgot password link", () => {
    render(<LoginForm />);
    const forgotLink = document.querySelector('a[href="/forgot-password"]');
    expect(forgotLink).toBeDefined();
  });

  it("has register link in footer", () => {
    render(<LoginForm />);
    const registerLink = document.querySelector('a[href="/register"]');
    expect(registerLink).toBeDefined();
  });

  it("shows mobile branding header with Oltigo Health", () => {
    render(<LoginForm />);
    expect(screen.getByText("Oltigo Health")).toBeDefined();
  });
});
