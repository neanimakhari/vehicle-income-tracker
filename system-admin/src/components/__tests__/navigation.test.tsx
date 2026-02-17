import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navigation } from "../navigation";

describe("Navigation", () => {
  it("renders Dashboard link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/");
  });

  it("renders Health link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /health/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /health/i })).toHaveAttribute("href", "/health");
  });

  it("renders Tenants link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /tenants/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tenants/i })).toHaveAttribute("href", "/tenants");
  });

  it("renders Platform Admins link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /platform admins/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /platform admins/i })).toHaveAttribute("href", "/platform-admins");
  });

  it("renders Tenant Admins link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /tenant admins/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tenant admins/i })).toHaveAttribute("href", "/tenant-admins");
  });

  it("renders Audit Logs link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /audit logs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /audit logs/i })).toHaveAttribute("href", "/audit");
  });

  it("renders Alerts link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /alerts/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /alerts/i })).toHaveAttribute("href", "/alerts");
  });

  it("renders Defaults link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /defaults/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /defaults/i })).toHaveAttribute("href", "/defaults");
  });

  it("renders Security (MFA) link", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: /security \(mfa\)/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /security \(mfa\)/i })).toHaveAttribute("href", "/mfa");
  });
});

