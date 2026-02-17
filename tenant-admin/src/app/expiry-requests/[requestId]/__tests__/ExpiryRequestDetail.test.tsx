import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpiryRequestDetail } from "../ExpiryRequestDetail";

const request = {
  id: "req-1",
  userId: "user-1",
  status: "pending",
  requestedLicenseExpiry: "2025-12-31",
  requestedPrdpExpiry: "2025-11-15",
  requestedMedicalCertificateExpiry: null,
  supportingDocumentIds: ["doc-1"],
  submittedAt: "2025-01-15T10:00:00Z",
};

const profile = {
  id: "user-1",
  firstName: "Jane",
  lastName: "Driver",
  licenseExpiry: "2024-06-01",
  prdpExpiry: "2024-05-01",
  medicalCertificateExpiry: null,
};

const supportingDocs = [
  { id: "doc-1", documentType: "drivers_license", fileName: "license.pdf", createdAt: "2025-01-15T10:00:00Z" },
];

describe("ExpiryRequestDetail", () => {
  it("renders driver name and submitted date", () => {
    const approveRequest = vi.fn(() => Promise.resolve({ success: true }));
    const rejectRequest = vi.fn(() => Promise.resolve({ success: true }));
    render(
      <ExpiryRequestDetail
        request={request}
        profile={profile}
        supportingDocs={supportingDocs}
        approveRequest={approveRequest}
        rejectRequest={rejectRequest}
      />
    );
    expect(screen.getByText(/jane driver/i)).toBeInTheDocument();
    expect(screen.getByText(/expiry update request/i)).toBeInTheDocument();
  });

  it("renders current vs requested dates table", () => {
    const approveRequest = vi.fn(() => Promise.resolve({ success: true }));
    const rejectRequest = vi.fn(() => Promise.resolve({ success: true }));
    render(
      <ExpiryRequestDetail
        request={request}
        profile={profile}
        supportingDocs={supportingDocs}
        approveRequest={approveRequest}
        rejectRequest={rejectRequest}
      />
    );
    expect(screen.getByText(/Driver's licence/i)).toBeInTheDocument();
    expect(screen.getByText(/PRDP certificate/i)).toBeInTheDocument();
    expect(screen.getByText(/Medical certificate/i)).toBeInTheDocument();
  });

  it("renders supporting documents section with download link", () => {
    const approveRequest = vi.fn(() => Promise.resolve({ success: true }));
    const rejectRequest = vi.fn(() => Promise.resolve({ success: true }));
    render(
      <ExpiryRequestDetail
        request={request}
        profile={profile}
        supportingDocs={supportingDocs}
        approveRequest={approveRequest}
        rejectRequest={rejectRequest}
      />
    );
    expect(screen.getByText(/Supporting documents/i)).toBeInTheDocument();
    const downloadLink = screen.getByRole("link", { name: /download/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute("href", "/api/drivers/user-1/documents/doc-1/download");
  });

  it("renders Approve and Reject buttons", () => {
    const approveRequest = vi.fn(() => Promise.resolve({ success: true }));
    const rejectRequest = vi.fn(() => Promise.resolve({ success: true }));
    render(
      <ExpiryRequestDetail
        request={request}
        profile={profile}
        supportingDocs={supportingDocs}
        approveRequest={approveRequest}
        rejectRequest={rejectRequest}
      />
    );
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });
});

