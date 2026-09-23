import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IncomesClient } from "../IncomesClient";

const noop = () => Promise.resolve({ success: true });

describe("IncomesClient", () => {
  const defaultProps = {
    incomes: [],
    drivers: [],
    vehicles: [],
    trips: [],
    scholarPayments: [],
    createIncome: noop,
    updateIncome: noop,
    deleteIncome: noop,
    approveIncome: noop,
    rejectIncome: noop,
  };

  it("renders search input", () => {
    render(<IncomesClient {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("renders status filter tabs", () => {
    render(<IncomesClient {...defaultProps} />);
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pending approval/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /missing income today/i })).toBeInTheDocument();
  });

  it("shows synthesized missing vehicle rows", () => {
    render(
      <IncomesClient
        {...defaultProps}
        missingVehicleLabels={["Taxi 1", "Taxi 2"]}
        incomes={[
          {
            id: "inc-1",
            vehicle: "Other",
            driverName: "Driver 1",
            income: 100,
            loggedOn: "2025-01-15T10:00:00Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /missing income today/i }));
    expect(screen.getByText("Taxi 1")).toBeInTheDocument();
    expect(screen.getByText("Taxi 2")).toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Missing$/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders table headers when incomes are provided", () => {
    const incomes = [
      {
        id: "inc-1",
        vehicle: "V1",
        driverName: "Driver 1",
        income: 100,
        loggedOn: "2025-01-15T10:00:00Z",
      },
    ];
    render(<IncomesClient {...defaultProps} incomes={incomes} />);
    expect(screen.getByText("V1")).toBeInTheDocument();
    expect(screen.getByText("Driver 1")).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it("shows approval status column", () => {
    const incomes = [
      {
        id: "inc-1",
        vehicle: "V1",
        driverName: "Driver 1",
        income: 100,
        loggedOn: "2025-01-15T10:00:00Z",
        approvalStatus: "pending",
      },
    ];
    render(<IncomesClient {...defaultProps} incomes={incomes} />);
    const pendingBadges = screen.getAllByText(/^Pending$/);
    expect(pendingBadges.length).toBeGreaterThanOrEqual(1);
    expect(pendingBadges.some((el) => el.tagName === "SPAN")).toBe(true);
  });
});
