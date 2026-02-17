import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock next/image to avoid Next context (return a no-op component that doesn't pull in React here)
vi.mock("next/image", () => ({ default: function MockImage() { return null; } }));

// Mock next/link so we don't need Next router context
vi.mock("next/link", () => {
  const React = require("react");
  return {
    default: function MockLink({ href, children, ...rest }: { href: string; children?: unknown }) {
      return React.createElement("a", { href, ...rest }, children);
    },
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

