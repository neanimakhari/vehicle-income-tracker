import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TenantsClient } from "../TenantsClient";

const noop = () => Promise.resolve({ success: true });
const noopSync = () => {};

describe("TenantsClient", () => {
  const defaultProps = {
    tenants: [],
    admins: [],
    usage: [],
    createTenant: noop,
    updateTenant: noop,
    toggleTenant: noopSync,
    toggleMfa: noopSync,
    toggleUserMfa: noopSync,
  };

  it("renders Tenants heading", () => {
    render(<TenantsClient {...defaultProps} />);
    expect(screen.getByRole("heading", { name: /tenants/i })).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<TenantsClient {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search by name, slug, contact/i)).toBeInTheDocument();
  });

  it("renders status filter with All, Active, Inactive", () => {
    render(<TenantsClient {...defaultProps} />);
    expect(screen.getByText(/status:/i)).toBeInTheDocument();
    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("All");
    expect(labels).toContain("Active");
    expect(labels).toContain("Inactive");
  });

  it("renders Add tenant and Export CSV buttons", () => {
    render(<TenantsClient {...defaultProps} />);
    expect(screen.getByRole("button", { name: /add tenant/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("renders tenant name and slug in table when tenants provided", () => {
    const tenants = [
      { id: "t1", name: "Acme Corp", slug: "acme", isActive: true },
    ];
    render(<TenantsClient {...defaultProps} tenants={tenants} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
  });

  it("shows warning when a tenant has no admin", () => {
    const tenants = [
      { id: "t1", name: "No Admin Tenant", slug: "noadmin", isActive: true },
    ];
    render(<TenantsClient {...defaultProps} tenants={tenants} admins={[]} />);
    expect(screen.getByText(/no tenant admin yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to tenant admins/i })).toHaveAttribute("href", "/tenant-admins");
  });
});

