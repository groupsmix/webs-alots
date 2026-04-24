/**
 * Component Testing Strategy
 *
 * This file establishes the testing patterns for the UI component library.
 * Each component should be tested for:
 * 1. Rendering without errors
 * 2. Accessibility (ARIA attributes, roles, labels)
 * 3. User interactions (click, keyboard, focus)
 * 4. Edge cases (empty data, loading states, errors)
 */
import { render, screen } from "@testing-library/react";
import { SearchIcon } from "lucide-react";
import { describe, it, expect } from "vitest";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renders with default classes", () => {
    const { container } = render(<Skeleton data-testid="skel" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toContain("animate-pulse");
  });

  it("accepts additional classNames", () => {
    const { container } = render(<Skeleton className="h-8 w-full" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-8");
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={SearchIcon}
        title="No results"
        description="Try a different search"
      />
    );
    expect(screen.getByText("No results")).toBeTruthy();
    expect(screen.getByText("Try a different search")).toBeTruthy();
  });

  it("renders action slot when provided", () => {
    render(
      <EmptyState
        icon={SearchIcon}
        title="Empty"
        action={<button>Add item</button>}
      />
    );
    expect(screen.getByText("Add item")).toBeTruthy();
  });
});

describe("Breadcrumb", () => {
  it("renders all items with correct hierarchy", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Patients", href: "/admin/patients" },
          { label: "Details" },
        ]}
      />
    );

    expect(screen.getByLabelText("Fil d'Ariane")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("Patients")).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
  });

  it("marks last item as current page", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Current Page" },
        ]}
      />
    );

    const currentPage = screen.getByText("Current Page");
    expect(currentPage.getAttribute("aria-current")).toBe("page");
  });
});
