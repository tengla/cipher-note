import { mock } from "bun:test";
import type { Note, Category } from "./db";

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: "General", color: "260", order: 0 },
  { id: 2, name: "Work", color: "200", order: 1 },
  { id: 3, name: "Personal", color: "330", order: 2 },
  { id: 4, name: "Ideas", color: "80", order: 3 },
  { id: 5, name: "Todo", color: "160", order: 4 },
];

// Use an object so all references (mock closures + test files) share state
export const store = {
  notes: [] as Note[],
  nextId: 1,
  categories: [...DEFAULT_CATEGORIES] as Category[],
  nextCatId: 6,
};

export function resetMockDb() {
  store.notes = [];
  store.nextId = 1;
  store.categories = [...DEFAULT_CATEGORIES];
  store.nextCatId = 6;
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
  rotatePassphrase: mock(async (_oldPassphrase: string, _newPassphrase: string) => {
    return store.notes.length;
  }),
  getAllCategories: mock(async () => [...store.categories]),
  addCategory: mock(async (cat: Omit<Category, "id">) => {
    const id = store.nextCatId++;
    store.categories.push({ ...cat, id });
    return id;
  }),
  updateCategory: mock(async (cat: Category) => {
    const idx = store.categories.findIndex((c) => c.id === cat.id);
    if (idx !== -1) store.categories[idx] = cat;
  }),
  deleteCategory: mock(async (id: number) => {
    store.categories = store.categories.filter((c) => c.id !== id);
  }),
  reorderCategories: mock(async (cats: Category[]) => {
    store.categories = cats;
  }),
  exportVault: mock(async () => ({
    version: 1,
    exportedAt: Date.now(),
    notes: [...store.notes],
    categories: [...store.categories],
  })),
  importVault: mock(async (data: { notes: Note[]; categories: Category[] }) => {
    store.notes = [...data.notes];
    store.categories = [...data.categories];
    return { notes: data.notes.length, categories: data.categories.length };
  }),
  requestPersistentStorage: mock(async () => true),
  isStoragePersisted: mock(async () => true),
  getStorageEstimate: mock(async () => ({ usage: 1024, quota: 1024 * 1024 * 100 })),
  createAndStoreKeyPair: mock(async () => ({
    id: "default",
    publicKey: { kty: "RSA", n: "mock-n", e: "AQAB" } as JsonWebKey,
    wrappedPrivateKey: "mock-wrapped",
    createdAt: Date.now(),
  })),
  getStoredKeyPair: mock(async () => undefined),
  deleteStoredKeyPair: mock(async () => {}),
  rotateKeyPairPassphrase: mock(async () => {}),
  exportForRecipient: mock(async () => ({
    version: 1,
    exportedAt: Date.now(),
    notes: [],
  })),
  importFromSender: mock(async () => 0),
}));
