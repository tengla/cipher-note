import { encrypt, decrypt } from "./crypto";

export interface Note {
  id?: number;
  title: string;
  content: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

// What's actually stored in IndexedDB (content is encrypted)
interface StoredNote {
  id?: number;
  title: string;
  content: string; // encrypted ciphertext
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id?: number;
  name: string;
  color: string; // oklch hue value (e.g. "260" for purple)
  order: number;
}

const DB_NAME = "NotesDB";
const DB_VERSION = 2;
const STORE_NAME = "notes";
const CATEGORY_STORE = "categories";

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "General", color: "260", order: 0 },
  { name: "Work", color: "200", order: 1 },
  { name: "Personal", color: "330", order: 2 },
  { name: "Ideas", color: "80", order: 3 },
  { name: "Todo", color: "160", order: 4 },
];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(CATEGORY_STORE)) {
        const catStore = db.createObjectStore(CATEGORY_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        catStore.createIndex("name", "name", { unique: true });
        catStore.createIndex("order", "order", { unique: false });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function addNote(note: Omit<Note, "id">, passphrase: string): Promise<number> {
  const db = await openDB();
  const stored: Omit<StoredNote, "id"> = {
    ...note,
    content: note.content ? await encrypt(note.content, passphrase) : "",
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(stored);
    request.addEventListener("success", () => resolve(request.result as number));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function decryptNote(stored: StoredNote, passphrase: string): Promise<Note> {
  if (!stored.content) return { ...stored, content: "" };
  try {
    return { ...stored, content: await decrypt(stored.content, passphrase) };
  } catch {
    // Legacy unencrypted content — return as-is
    return { ...stored };
  }
}

export async function getAllNotes(passphrase: string): Promise<Note[]> {
  const db = await openDB();
  const storedNotes: StoredNote[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
  return Promise.all(storedNotes.map((n) => decryptNote(n, passphrase)));
}

export async function getNote(id: number, passphrase: string): Promise<Note | undefined> {
  const db = await openDB();
  const stored: StoredNote | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
  return stored ? decryptNote(stored, passphrase) : undefined;
}

export async function updateNote(note: Note, passphrase: string): Promise<void> {
  const db = await openDB();
  const stored: StoredNote = {
    ...note,
    content: note.content ? await encrypt(note.content, passphrase) : "",
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(stored);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function deleteNote(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function getNotesByCategory(category: string, passphrase: string): Promise<Note[]> {
  const db = await openDB();
  const storedNotes: StoredNote[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("category");
    const request = index.getAll(category);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
  return Promise.all(storedNotes.map((n) => decryptNote(n, passphrase)));
}

export async function clearAllNotes(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function getRawNote(id: number): Promise<StoredNote | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function rotatePassphrase(oldPassphrase: string, newPassphrase: string): Promise<number> {
  const db = await openDB();
  const storedNotes: StoredNote[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });

  // Decrypt all with old passphrase, re-encrypt with new
  const reEncrypted: StoredNote[] = await Promise.all(
    storedNotes.map(async (stored) => {
      if (!stored.content) return stored;
      const plaintext = await decrypt(stored.content, oldPassphrase);
      return { ...stored, content: await encrypt(plaintext, newPassphrase) };
    })
  );

  // Write all back in a single transaction
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const note of reEncrypted) {
      store.put(note);
    }
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });

  return reEncrypted.length;
}

export async function countNotes(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

// ── Category operations ──

export async function getAllCategories(): Promise<Category[]> {
  const db = await openDB();
  const categories: Category[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readonly");
    const store = tx.objectStore(CATEGORY_STORE);
    const request = store.getAll();
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });

  // Seed defaults if store is empty
  if (categories.length === 0) {
    const seeded = await seedDefaultCategories();
    return seeded;
  }

  categories.sort((a, b) => a.order - b.order);
  return categories;
}

async function seedDefaultCategories(): Promise<Category[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readwrite");
    const store = tx.objectStore(CATEGORY_STORE);
    const results: Category[] = [];
    for (const cat of DEFAULT_CATEGORIES) {
      const req = store.add(cat);
      req.addEventListener("success", () => {
        results.push({ ...cat, id: req.result as number });
      });
    }
    tx.addEventListener("complete", () => resolve(results));
    tx.addEventListener("error", () => reject(tx.error));
  });
}

export async function addCategory(category: Omit<Category, "id">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readwrite");
    const store = tx.objectStore(CATEGORY_STORE);
    const request = store.add(category);
    request.addEventListener("success", () => resolve(request.result as number));
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function updateCategory(category: Category): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readwrite");
    const store = tx.objectStore(CATEGORY_STORE);
    const request = store.put(category);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readwrite");
    const store = tx.objectStore(CATEGORY_STORE);
    const request = store.delete(id);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function reorderCategories(categories: Category[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readwrite");
    const store = tx.objectStore(CATEGORY_STORE);
    for (const cat of categories) {
      store.put(cat);
    }
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
}
