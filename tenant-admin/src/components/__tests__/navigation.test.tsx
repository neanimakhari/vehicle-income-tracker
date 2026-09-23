import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navigation } from "../navigation";

const ALL = [
  "trips",
  "scholar_payments",
  "tracking_live",
  "tracking_geofence",
  "notifications",
  "target_calendar",
];

describe("Navigation", () => {
  it("renders core links without entitlements prop (fail-closed hides gated)", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /drivers/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /live tracking/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /target calendar/i })).not.toBeInTheDocument();
  });

  it("renders gated links when entitled", () => {
    render(<Navigation entitlements={ALL} />);
    expect(screen.getByRole("link", { name: /live tracking/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /target calendar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scholar & staff/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /notifications/i })).toBeInTheDocument();
  });

  it("renders Expiry Requests and Vehicle Incomes", () => {
    render(<Navigation entitlements={ALL} />);
    expect(screen.getByRole("link", { name: /expiry requests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /vehicle incomes/i })).toBeInTheDocument();
  });

  it("all core nav links have correct hrefs", () => {
    render(<Navigation entitlements={ALL} />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /drivers/i })).toHaveAttribute("href", "/drivers");
    expect(screen.getByRole("link", { name: /expiry requests/i })).toHaveAttribute("href", "/expiry-requests");
    expect(screen.getByRole("link", { name: /vehicle incomes/i })).toHaveAttribute("href", "/incomes");
  });
});
