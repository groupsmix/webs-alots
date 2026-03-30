import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import LoginPage from "@/app/(auth)/login/page";

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

describe("Accessibility (WCAG)", () => {
  it("login page has no critical accessibility violations", async () => {
    const { container } = render(<LoginPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
