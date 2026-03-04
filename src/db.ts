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

const DB_NAME = "NotesDB";
const DB_VERSION = 1;
const STORE_NAME = "notes";

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
