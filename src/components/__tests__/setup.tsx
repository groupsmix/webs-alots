import { vi } from "vitest";
import "@testing-library/dom";

// R2 signing secret for tests. After audit finding #8, the production code
// no longer falls back to a hardcoded "default-salt" when hashing upload keys
// or signing URLs, so every test that exercises `r2.ts` needs a real value.
// This is a test-only constant and must never be used outside Vitest.
process.env.R2_SIGNED_URL_SECRET = process.env.R2_SIGNED_URL_SECRET || "test-r2-signing-secret-0123456789abcdef";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; [key: string]: unknown }) => {
    const { src, alt, ...rest } = props;
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={src} alt={alt} {...rest} />;
  },
}));
