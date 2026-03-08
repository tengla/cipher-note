import { test, expect, describe, beforeEach } from "bun:test";
import { render, screen, waitFor, act, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetMockDb, store } from "./mock-db";
import { NotesApp } from "./NotesApp";
import type { Note } from "./db";

// Renders NotesApp and waits for the initial useEffect (loadNotes) to settle.
async function renderNotesApp(passphrase = "test") {
  let result: RenderResult;
  await act(async () => {
    result = render(<NotesApp passphrase={passphrase} />);
  });
  return result!;
}

describe("NotesApp", () => {
  beforeEach(() => {
    resetMockDb();
  });

  test("renders empty state when no notes", async () => {
    await renderNotesApp();
    expect(screen.getByText("Your vault is empty")).toBeInTheDocument();
  });

  test("editor is hidden by default, shown after clicking New Note", async () => {
    const user = userEvent.setup();
    await renderNotesApp();

    // Editor should not be visible initially
    expect(screen.queryByPlaceholderText("Note title...")).not.toBeInTheDocument();

    // Click "New Note" to open the editor
    await user.click(screen.getByRole("button", { name: /new note/i }));

    expect(screen.getByPlaceholderText("Note title...")).toBeInTheDocument();
  });

  test("shows operation log panel", async () => {
    await renderNotesApp();
    expect(screen.getByText("Operation Log")).toBeInTheDocument();
  });

  test("adding a note shows it in the list", async () => {
    const user = userEvent.setup();
    await renderNotesApp();

    await user.click(screen.getByRole("button", { name: /new note/i }));
    await user.type(screen.getByPlaceholderText("Note title..."), "My First Note");
    await user.click(screen.getByRole("button", { name: /encrypt & store/i }));

    await waitFor(() => {
      expect(screen.getByText("My First Note")).toBeInTheDocument();
    });
  });

  test("deleting a note removes it from the list", async () => {
    const user = userEvent.setup();
    store.notes = [
      { id: 1, title: "To Delete", content: "bye", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("To Delete")).toBeInTheDocument();

    await user.click(screen.getByTitle("Delete"));

    await waitFor(() => {
      expect(screen.queryByText("To Delete")).not.toBeInTheDocument();
    });
  });

  test("clicking edit opens editor with note data", async () => {
    const user = userEvent.setup();
    store.notes = [
      { id: 1, title: "Editable Note", content: "edit me", category: "Work", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("Editable Note")).toBeInTheDocument();

    await user.click(screen.getByTitle("Edit"));

    await waitFor(() => {
      expect(screen.getByText("Edit Note")).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText("Note title...") as HTMLInputElement;
    expect(titleInput.value).toBe("Editable Note");

    expect(screen.getByRole("button", { name: /update note/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();

    // The note list should not be visible while editing
    expect(screen.queryByText("Editable Note")).not.toBeInTheDocument();
  });

  test("cancel edit returns to list view", async () => {
    const user = userEvent.setup();
    store.notes = [
      { id: 1, title: "Note", content: "x", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("Note")).toBeInTheDocument();

    await user.click(screen.getByTitle("Edit"));

    await waitFor(() => {
      expect(screen.getByText("Edit Note")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      // Should be back to the list view with the note visible
      expect(screen.getByText("Note")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /new note/i })).toBeInTheDocument();
    });
  });

  test("shows raw encrypted content when eye icon clicked", async () => {
    const user = userEvent.setup();
    store.notes = [
      { id: 1, title: "Secret", content: "hidden", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("Secret")).toBeInTheDocument();

    await user.click(screen.getByTitle("Show encrypted"));

    await waitFor(() => {
      expect(screen.getByText("encrypted:ciphertext")).toBeInTheDocument();
      expect(screen.getByText("AES-256-GCM Ciphertext")).toBeInTheDocument();
    });
  });

  test("toggling raw view hides it on second click", async () => {
    const user = userEvent.setup();
    store.notes = [
      { id: 1, title: "Secret", content: "hidden", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("Secret")).toBeInTheDocument();

    await user.click(screen.getByTitle("Show encrypted"));
    await waitFor(() => screen.getByText("encrypted:ciphertext"));

    await user.click(screen.getByTitle("Hide encrypted"));
    await waitFor(() => {
      expect(screen.queryByText("encrypted:ciphertext")).not.toBeInTheDocument();
    });
  });

  test("clear all removes all notes", async () => {
    const user = userEvent.setup();
    store.notes = [
      { id: 1, title: "A", content: "", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
      { id: 2, title: "B", content: "", category: "Work", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear all/i }));

    await waitFor(() => {
      expect(screen.getByText("Your vault is empty")).toBeInTheDocument();
    });
  });

  test("displays note count", async () => {
    store.notes = [
      { id: 1, title: "A", content: "", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
      { id: 2, title: "B", content: "", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("2 notes encrypted")).toBeInTheDocument();
  });

  test("displays category badge on notes", async () => {
    store.notes = [
      { id: 1, title: "Work Task", content: "do stuff", category: "Work", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    const { container } = await renderNotesApp();
    expect(screen.getByText("Work Task")).toBeInTheDocument();

    const badge = container.querySelector(".badge-work");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("Work");
  });

  test("note content is displayed", async () => {
    store.notes = [
      { id: 1, title: "Title", content: "My visible content here", category: "General", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    await renderNotesApp();
    expect(screen.getByText("My visible content here")).toBeInTheDocument();
  });
});
