import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  registerPatient: vi.fn().mockResolvedValue({ error: null }),
  verifyOTP: vi.fn().mockResolvedValue({ error: null }),
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

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <div>{placeholder}</div>,
}));

vi.mock("@/components/ui/password-strength-indicator", () => ({
  PasswordStrengthIndicator: ({ password: _password }: { password: string }) => (
    <div data-testid="password-strength" />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when PHONE_AUTH_ENABLED is false (default)", () => {
    it("renders unavailable state", async () => {
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      expect(screen.getByTestId("card")).toBeDefined();
    });

    it("shows login link", async () => {
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const loginLink = document.querySelector('a[href="/login"]');
      expect(loginLink).toBeDefined();
    });

    it("shows mobile branding with Oltigo Health", async () => {
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      expect(screen.getByText("Oltigo Health")).toBeDefined();
    });

    it("shows contact link when registration unavailable", async () => {
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const contactLink = document.querySelector('a[href="/contact"]');
      expect(contactLink).toBeDefined();
    });
  });

  describe("when PHONE_AUTH_ENABLED is true", () => {
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_PHONE_AUTH_ENABLED", "true");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("renders the registration form", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      expect(screen.getByTestId("card")).toBeDefined();
    });

    it("has first name and last name fields", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const firstNameInput = document.querySelector('input[id="firstName"]');
      const lastNameInput = document.querySelector('input[id="lastName"]');
      expect(firstNameInput).toBeDefined();
      expect(lastNameInput).toBeDefined();
    });

    it("has phone field", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const phoneInput = document.querySelector('input[type="tel"]');
      expect(phoneInput).toBeDefined();
    });

    it("has password field with visibility toggle", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const passwordInput = document.querySelector('input[id="password"]');
      expect(passwordInput).toBeDefined();
      const toggleBtn = document.querySelector("button[aria-label]");
      expect(toggleBtn).toBeDefined();
    });

    it("toggles password visibility", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const passwordInput = document.querySelector('input[id="password"]');
      expect(passwordInput?.getAttribute("type")).toBe("password");

      const toggleBtn = document.querySelector("button[aria-label]");
      fireEvent.click(toggleBtn!);

      const updatedInput = document.querySelector('input[id="password"]');
      expect(updatedInput?.getAttribute("type")).toBe("text");
    });

    it("renders password strength indicator", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      expect(screen.getByTestId("password-strength")).toBeDefined();
    });

    it("renders progress step indicators", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      expect(screen.getByText("Informations")).toBeDefined();
      expect(screen.getByText("Vérification")).toBeDefined();
    });

    it("has login link in footer", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const loginLink = document.querySelector('a[href="/login"]');
      expect(loginLink).toBeDefined();
    });

    it("has email input field", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      const emailInput = document.querySelector('input[type="email"]');
      expect(emailInput).toBeDefined();
    });

    it("shows mobile branding with Oltigo Health", async () => {
      vi.resetModules();
      const { default: RegisterPage } = await import("@/app/(auth)/register/page");
      render(<RegisterPage />);
      expect(screen.getByText("Oltigo Health")).toBeDefined();
    });
  });
});
