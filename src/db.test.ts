import { test, expect, describe, beforeEach } from "bun:test";
import "fake-indexeddb/auto";
import {
  addNote,
  getAllNotes,
  getNote,
  updateNote,
  deleteNote,
  getNotesByCategory,
  clearAllNotes,
  getRawNote,
  countNotes,
  rotatePassphrase,
} from "./db";

const passphrase = "test-pass";

function makeNote(overrides: Partial<{ title: string; content: string; category: string }> = {}) {
  const now = Date.now();
  return {
    title: overrides.title ?? "Test Note",
    content: overrides.content ?? "Some secret content",
    category: overrides.category ?? "General",
    createdAt: now,
    updatedAt: now,
  };
}

describe("db", () => {
  beforeEach(async () => {
    // Clear the database before each test
    // fake-indexeddb persists across calls in the same process,
    // so we need to wipe the store
    await clearAllNotes();
  });

  test("addNote returns an id", async () => {
    const id = await addNote(makeNote(), passphrase);
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  test("addNote + getNote round-trip decrypts content", async () => {
    const note = makeNote({ content: "my secret" });
    const id = await addNote(note, passphrase);
    const retrieved = await getNote(id, passphrase);
    expect(retrieved).toBeDefined();
    expect(retrieved!.title).toBe("Test Note");
    expect(retrieved!.content).toBe("my secret");
    expect(retrieved!.category).toBe("General");
    expect(retrieved!.id).toBe(id);
  });

  test("getNote returns undefined for non-existent id", async () => {
    const result = await getNote(99999, passphrase);
    expect(result).toBeUndefined();
  });

  test("getAllNotes returns all notes decrypted", async () => {
    await addNote(makeNote({ title: "Note 1", content: "content 1" }), passphrase);
    await addNote(makeNote({ title: "Note 2", content: "content 2" }), passphrase);
    await addNote(makeNote({ title: "Note 3", content: "content 3" }), passphrase);

    const notes = await getAllNotes(passphrase);
    expect(notes).toHaveLength(3);
    const titles = notes.map((n) => n.title).sort();
    expect(titles).toEqual(["Note 1", "Note 2", "Note 3"]);
  });

  test("updateNote modifies the note", async () => {
    const id = await addNote(makeNote({ title: "Original" }), passphrase);
    const original = await getNote(id, passphrase);

    await updateNote(
      { ...original!, title: "Updated", content: "new content", updatedAt: Date.now() },
      passphrase
    );

    const updated = await getNote(id, passphrase);
    expect(updated!.title).toBe("Updated");
    expect(updated!.content).toBe("new content");
  });

  test("deleteNote removes the note", async () => {
    const id = await addNote(makeNote(), passphrase);
    expect(await getNote(id, passphrase)).toBeDefined();

    await deleteNote(id);
    expect(await getNote(id, passphrase)).toBeUndefined();
  });

  test("getNotesByCategory filters correctly", async () => {
    await addNote(makeNote({ category: "Work", title: "Work note" }), passphrase);
    await addNote(makeNote({ category: "Personal", title: "Personal note" }), passphrase);
    await addNote(makeNote({ category: "Work", title: "Another work note" }), passphrase);

    const workNotes = await getNotesByCategory("Work", passphrase);
    expect(workNotes).toHaveLength(2);
    expect(workNotes.every((n) => n.category === "Work")).toBe(true);

    const personalNotes = await getNotesByCategory("Personal", passphrase);
    expect(personalNotes).toHaveLength(1);
    expect(personalNotes[0]!.title).toBe("Personal note");
  });

  test("getNotesByCategory returns empty for non-existent category", async () => {
    await addNote(makeNote({ category: "Work" }), passphrase);
    const notes = await getNotesByCategory("NonExistent", passphrase);
    expect(notes).toHaveLength(0);
  });

  test("clearAllNotes removes everything", async () => {
    await addNote(makeNote({ title: "A" }), passphrase);
    await addNote(makeNote({ title: "B" }), passphrase);
    expect(await countNotes()).toBe(2);

    await clearAllNotes();
    expect(await countNotes()).toBe(0);
    expect(await getAllNotes(passphrase)).toHaveLength(0);
  });

  test("countNotes returns correct count", async () => {
    expect(await countNotes()).toBe(0);
    await addNote(makeNote(), passphrase);
    expect(await countNotes()).toBe(1);
    await addNote(makeNote(), passphrase);
    expect(await countNotes()).toBe(2);
  });

  test("getRawNote returns encrypted ciphertext", async () => {
    const id = await addNote(makeNote({ content: "plaintext secret" }), passphrase);
    const raw = await getRawNote(id);
    expect(raw).toBeDefined();
    // Raw content should be encrypted (iv:ciphertext format), not plaintext
    expect(raw!.content).not.toBe("plaintext secret");
    expect(raw!.content).toContain(":");
  });

  test("addNote with empty content stores empty string", async () => {
    const id = await addNote(makeNote({ content: "" }), passphrase);
    const note = await getNote(id, passphrase);
    expect(note!.content).toBe("");
  });

  test("rotatePassphrase re-encrypts all notes with new passphrase", async () => {
    const newPassphrase = "new-pass";
    await addNote(makeNote({ title: "Note A", content: "secret A" }), passphrase);
    await addNote(makeNote({ title: "Note B", content: "secret B" }), passphrase);
    await addNote(makeNote({ title: "Empty", content: "" }), passphrase);

    const count = await rotatePassphrase(passphrase, newPassphrase);
    expect(count).toBe(3);

    // New passphrase should decrypt successfully
    const withNew = await getAllNotes(newPassphrase);
    expect(withNew).toHaveLength(3);
    const titles = withNew.map((n) => n.title).sort();
    expect(titles).toEqual(["Empty", "Note A", "Note B"]);
    expect(withNew.find((n) => n.title === "Note A")!.content).toBe("secret A");
    expect(withNew.find((n) => n.title === "Note B")!.content).toBe("secret B");
    expect(withNew.find((n) => n.title === "Empty")!.content).toBe("");
  });
});
