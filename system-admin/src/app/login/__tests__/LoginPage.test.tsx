import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "../page";

vi.mock("@/lib/auth-actions", () => ({
  loginAction: vi.fn(() => Promise.resolve()),
}));

describe("LoginPage", () => {
  it("renders System Admin Login heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /system admin login/i })).toBeInTheDocument();
  });

  it("renders sign in subtitle", () => {
    render(<LoginPage />);
    expect(screen.getByText(/sign in with your platform admin credentials/i)).toBeInTheDocument();
  });

  it("renders email input", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/admin@platform\.com/i)).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders forgot password link", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("shows error message when searchParams.error is provided", () => {
    render(<LoginPage searchParams={{ error: "missing" }} />);
    expect(screen.getByText(/email and password are required/i)).toBeInTheDocument();
  });
});

