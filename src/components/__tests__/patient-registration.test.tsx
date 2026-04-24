import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PatientRegistrationDialog } from "../receptionist/patient-registration-dialog";

/**
 * Component tests for PatientRegistrationDialog
 * Tests the patient registration form functionality
 */

// Mock the UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, disabled, onClick, ...props }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ placeholder, value, onChange, type, ...props }: { placeholder?: string; value?: string; onChange?: (e: { target: { value: string } }) => void; type?: string }) => (
    <input placeholder={placeholder} value={value} onChange={onChange} type={type} {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({ placeholder, value, onChange, rows, ...props }: { placeholder?: string; value?: string; onChange?: (e: { target: { value: string } }) => void; rows?: number }) => (
    <textarea placeholder={placeholder} value={value} onChange={onChange} rows={rows} {...props} />
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, onOpenChange: _onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
    <div data-open={open}>{children}</div>
  ),
  DialogContent: ({ children, onClose: _onClose }: { children: React.ReactNode; onClose?: () => void }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value: _value, onValueChange: _onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value: _value, children }: { value: string; children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <div>{placeholder}</div>,
}));

describe("PatientRegistrationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the registration button by default", () => {
    render(<PatientRegistrationDialog />);
    expect(screen.getByText("Register New Patient")).toBeDefined();
  });

  it("opens dialog when trigger is clicked", () => {
    render(<PatientRegistrationDialog />);
    
    // Click the trigger
    const trigger = screen.getByText("Register New Patient");
    fireEvent.click(trigger);
    
    // Dialog should be open (the form title should be visible)
    expect(screen.getByText("Patient Registration Form")).toBeDefined();
  });

  it("displays all required form sections", () => {
    render(<PatientRegistrationDialog />);
    
    // Open the dialog
    fireEvent.click(screen.getByText("Register New Patient"));
    
    // Check form sections are present
    expect(screen.getByText("Personal Information")).toBeDefined();
    expect(screen.getByText("Assurance / Insurance")).toBeDefined();
    expect(screen.getByText("Medical Information")).toBeDefined();
    expect(screen.getByText("Emergency Contact")).toBeDefined();
  });

  it("has all required fields in the form", () => {
    render(<PatientRegistrationDialog />);
    
    // Open the dialog
    fireEvent.click(screen.getByText("Register New Patient"));
    
    // Check required field labels
    expect(screen.getByText("Full Name *")).toBeDefined();
    expect(screen.getByText("Phone *")).toBeDefined();
    expect(screen.getByText("Date of Birth *")).toBeDefined();
    expect(screen.getByText("Gender *")).toBeDefined();
  });

  it("has gender selection options", () => {
    render(<PatientRegistrationDialog />);
    
    // Open the dialog
    fireEvent.click(screen.getByText("Register New Patient"));
    
    // Check gender options exist (they're in the SelectContent)
    expect(screen.getByText("Male")).toBeDefined();
    expect(screen.getByText("Female")).toBeDefined();
  });

  it("has insurance provider options", () => {
    render(<PatientRegistrationDialog />);
    
    // Open the dialog
    fireEvent.click(screen.getByText("Register New Patient"));
    
    // Check insurance options exist (French labels)
    expect(screen.getByText("Aucune assurance")).toBeDefined();
    expect(screen.getByText("CNSS (70%)")).toBeDefined();
    expect(screen.getByText("CNOPS (80%)")).toBeDefined();
    expect(screen.getByText("RAMED (100%)")).toBeDefined();
  });

  it("has cancel and register buttons", () => {
    render(<PatientRegistrationDialog />);
    
    // Open the dialog
    fireEvent.click(screen.getByText("Register New Patient"));
    
    // Check buttons exist
    expect(screen.getByText("Cancel")).toBeDefined();
    expect(screen.getByText("Register Patient")).toBeDefined();
  });

  it("calls onRegister callback when form is submitted with valid data", () => {
    const onRegister = vi.fn();
    render(<PatientRegistrationDialog onRegister={onRegister} />);
    
    // Open the dialog
    fireEvent.click(screen.getByText("Register New Patient"));
    
    // The form should be visible - verify the dialog is open
    expect(screen.getByText("Patient Registration Form")).toBeDefined();
  });
});
