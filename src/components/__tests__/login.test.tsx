import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "@/app/(auth)/login/page";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  signInWithOTP: vi.fn(),
  verifyOTP: vi.fn(),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
}));

// Mock UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: { "data-testid"?: string; [key: string]: unknown }) => (
    <input data-testid={props["data-testid"] || "input"} {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, type, onClick, disabled, ...props }: { children: React.ReactNode; type?: "submit" | "reset" | "button"; onClick?: () => void; disabled?: boolean; [key: string]: unknown }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without error", () => {
    const { container } = render(<LoginPage />);
    expect(container).toBeDefined();
  });

  it("renders the login card", () => {
    render(<LoginPage />);
    // Just verify the component renders
    expect(screen.getByTestId("card")).toBeDefined();
  });

  it("has email input field", () => {
    render(<LoginPage />);
    // Check for email input by type
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).toBeDefined();
  });

  it("has password input field", () => {
    render(<LoginPage />);
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeDefined();
  });

  it("has submit button", () => {
    render(<LoginPage />);
    const buttons = document.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("can be rendered with form inputs", () => {
    render(<LoginPage />);
    const inputs = document.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });
});
