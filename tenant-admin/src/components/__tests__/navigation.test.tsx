import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navigation } from "../navigation";

// usePathname is mocked in vitest.setup to return "/"
describe("Navigation", () => {
  it("renders Dashboard link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders Drivers link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /drivers/i })).toBeInTheDocument();
  });

  it("renders Expiry requests link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /expiry requests/i })).toBeInTheDocument();
  });

  it("renders Vehicle Incomes link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /vehicle incomes/i })).toBeInTheDocument();
  });

  it("renders Vehicles link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /vehicles/i })).toBeInTheDocument();
  });

  it("renders Maintenance link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /maintenance/i })).toBeInTheDocument();
  });

  it("renders Reports link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();
  });

  it("renders Audit Trail link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /audit trail/i })).toBeInTheDocument();
  });

  it("renders Security (MFA) link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /security \(mfa\)/i })).toBeInTheDocument();
  });

  it("renders Tenant Security link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /tenant security/i })).toBeInTheDocument();
  });

  it("all nav links have correct hrefs", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /drivers/i })).toHaveAttribute("href", "/drivers");
    expect(screen.getByRole("link", { name: /expiry requests/i })).toHaveAttribute("href", "/expiry-requests");
    expect(screen.getByRole("link", { name: /vehicle incomes/i })).toHaveAttribute("href", "/incomes");
  });
});

