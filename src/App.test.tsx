import { test, expect, describe, beforeEach } from "bun:test";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetMockDb } from "./mock-db";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetMockDb();
  });

  test("renders the passphrase prompt when locked", () => {
    render(<App />);
    expect(screen.getByText("Unlock Your Vault")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Passphrase...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();
  });

  test("renders header with app name", () => {
    render(<App />);
    expect(screen.getByText("Cipher")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  test("does not show Lock button when locked", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: /^lock$/i })).not.toBeInTheDocument();
  });

  test("unlocks and shows NotesApp after entering passphrase", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText("Passphrase...");
    await user.type(input, "my-secret");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    // Wait for NotesApp to mount and loadNotes to settle
    await waitFor(() => {
      expect(screen.getByText("Your vault is empty")).toBeInTheDocument();
    });
    expect(screen.queryByText("Unlock Your Vault")).not.toBeInTheDocument();
  });

  test("stores passphrase in sessionStorage on unlock", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText("Passphrase..."), "stored-pass");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(sessionStorage.getItem("ciphernotes-passphrase")).toBe("stored-pass");
  });

  test("restores from sessionStorage on mount", async () => {
    sessionStorage.setItem("ciphernotes-passphrase", "restored-pass");

    // NotesApp mounts immediately, so wrap in act to capture async loadNotes
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText("Your vault is empty")).toBeInTheDocument();
  });

  test("Lock button clears session and shows prompt", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("ciphernotes-passphrase", "to-clear");

    await act(async () => {
      render(<App />);
    });

    // Should be unlocked
    expect(screen.getByText("Your vault is empty")).toBeInTheDocument();

    // Click Lock
    await user.click(screen.getByRole("button", { name: /^lock$/i }));

    // Should be locked again
    expect(screen.getByText("Unlock Your Vault")).toBeInTheDocument();
    expect(sessionStorage.getItem("ciphernotes-passphrase")).toBeNull();
  });

  test("empty passphrase does not unlock", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Submit with empty input (the input has required attribute, so the form won't submit)
    await user.click(screen.getByRole("button", { name: /unlock/i }));
    expect(screen.getByText("Unlock Your Vault")).toBeInTheDocument();
  });

  test("shows footer text", () => {
    render(<App />);
    expect(screen.getByText(/Zero Server Storage/)).toBeInTheDocument();
  });
});
