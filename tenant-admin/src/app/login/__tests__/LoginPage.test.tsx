import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "../page";

vi.mock("@/lib/auth-actions", () => ({
  loginAction: vi.fn(() => Promise.resolve(null)),
}));

describe("LoginPage", () => {
  it("renders Welcome Back heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });

  it("renders email-first subtitle", () => {
    render(<LoginPage />);
    expect(screen.getByText(/sign in with your tenant admin email/i)).toBeInTheDocument();
  });

  it("does not render tenant picker", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("option", { name: /select your tenant/i })).not.toBeInTheDocument();
  });

  it("renders email input", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/admin@tenant\.com/i)).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
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
});
