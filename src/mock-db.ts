import { mock } from "bun:test";
import type { Note } from "./db";

// Use an object so all references (mock closures + test files) share state
export const store = {
  notes: [] as Note[],
  nextId: 1,
};

export function resetMockDb() {
  store.notes = [];
  store.nextId = 1;
}

mock.module("./db", () => ({
  addNote: mock(async (note: Omit<Note, "id">) => {
    const id = store.nextId++;
    store.notes.push({ ...note, id });
    return id;
  }),
  getAllNotes: mock(async () => [...store.notes]),
  getNote: mock(async (id: number) => store.notes.find((n) => n.id === id)),
  updateNote: mock(async (note: Note) => {
    const idx = store.notes.findIndex((n) => n.id === note.id);
    if (idx !== -1) store.notes[idx] = note;
  }),
  deleteNote: mock(async (id: number) => {
    store.notes = store.notes.filter((n) => n.id !== id);
  }),
  getNotesByCategory: mock(async (category: string) =>
    store.notes.filter((n) => n.category === category)
  ),
  clearAllNotes: mock(async () => {
    store.notes = [];
  }),
  countNotes: mock(async () => store.notes.length),
  getRawNote: mock(async (id: number) => {
    const note = store.notes.find((n) => n.id === id);
    return note ? { ...note, content: "encrypted:ciphertext" } : undefined;
  }),
}));
