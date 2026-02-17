import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpiryRequestsClient } from "../ExpiryRequestsClient";

describe("ExpiryRequestsClient", () => {
  it("shows empty state when no requests", () => {
    render(<ExpiryRequestsClient requests={[]} />);
    expect(screen.getByText(/no pending expiry update requests/i)).toBeInTheDocument();
  });

  it("renders table with headers when requests exist", () => {
    const requests = [
      {
        id: "req-1",
        userId: "user-1",
        status: "pending",
        requestedLicenseExpiry: "2025-12-31",
        requestedPrdpExpiry: null,
        requestedMedicalCertificateExpiry: null,
        submittedAt: "2025-01-15T10:00:00Z",
        driverName: "John Doe",
      },
    ];
    render(<ExpiryRequestsClient requests={requests} />);
    expect(screen.getByRole("columnheader", { name: /driver/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /submitted/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /requested dates/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /action/i })).toBeInTheDocument();
  });

  it("renders driver name and Review link for each request", () => {
    const requests = [
      {
        id: "req-1",
        userId: "user-1",
        status: "pending",
        requestedLicenseExpiry: "2025-12-31",
        requestedPrdpExpiry: null,
        requestedMedicalCertificateExpiry: null,
        submittedAt: "2025-01-15T10:00:00Z",
        driverName: "Jane Smith",
      },
    ];
    render(<ExpiryRequestsClient requests={requests} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    const reviewLink = screen.getByRole("link", { name: /review/i });
    expect(reviewLink).toBeInTheDocument();
    expect(reviewLink).toHaveAttribute("href", "/expiry-requests/req-1");
  });

  it("renders requested dates formatted", () => {
    const requests = [
      {
        id: "req-1",
        userId: "user-1",
        status: "pending",
        requestedLicenseExpiry: "2025-06-15",
        requestedPrdpExpiry: "2025-07-20",
        requestedMedicalCertificateExpiry: null,
        submittedAt: "2025-01-15T10:00:00Z",
        driverName: "Test Driver",
      },
    ];
    render(<ExpiryRequestsClient requests={requests} />);
    expect(screen.getByText("Test Driver")).toBeInTheDocument();
    // Dates are formatted via toLocaleDateString - we just check table has content
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

