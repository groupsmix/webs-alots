import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { ToastProvider, useToast } from "@/components/ui/toast";

function TestConsumer() {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast("Test notification", "success")}>
      Show Toast
    </button>
  );
}

describe("ToastProvider", () => {
  it("renders children without toasts initially", () => {
    render(
      <ToastProvider>
        <p>Hello</p>
      </ToastProvider>
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("shows a toast when addToast is called", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await act(async () => {
      await user.click(screen.getByText("Show Toast"));
    });

    expect(screen.getByText("Test notification")).toBeTruthy();
  });

  it("renders toast with correct role for accessibility", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await act(async () => {
      await user.click(screen.getByText("Show Toast"));
    });

    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });
});
