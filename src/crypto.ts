// Fixed salt for deterministic key derivation (in production, store per-user)
const SALT = new TextEncoder().encode("indexeddb-demo-salt");

let cachedKey: CryptoKey | null = null;
let cachedPassphrase: string | null = null;

// ── Helpers ──

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Passphrase-based encryption (existing) ──

export async function deriveKey(passphrase: string): Promise<CryptoKey> {
  if (cachedKey && cachedPassphrase === passphrase) return cachedKey;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  cachedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
  cachedPassphrase = passphrase;

  return cachedKey;
}

export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Pack as "base64(iv):base64(ciphertext)"
  return `${toBase64(iv)}:${toBase64(ciphertext)}`;
}

export async function decrypt(packed: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase);
  const colonIdx = packed.indexOf(":");
  const ivB64 = packed.slice(0, colonIdx);
  const ctB64 = packed.slice(colonIdx + 1);

  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ctB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ── RSA Key Pair (hybrid encryption) ──

export interface ExportedKeyPair {
  publicKey: JsonWebKey;
  wrappedPrivateKey: string; // base64(iv):base64(wrapped-key)
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable so we can wrap/export
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", publicKey);
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt", "wrapKey"]
  );
}

// Wrap (encrypt) the private key using the passphrase-derived AES key
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  passphrase: string
): Promise<string> {
  const wrappingKey = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const wrapped = await crypto.subtle.wrapKey(
    "jwk",
    privateKey,
    wrappingKey,
    { name: "AES-GCM", iv }
  );

  return `${toBase64(iv)}:${toBase64(wrapped)}`;
}

// Unwrap (decrypt) the private key using the passphrase-derived AES key
export async function unwrapPrivateKey(
  wrappedStr: string,
  passphrase: string
): Promise<CryptoKey> {
  const wrappingKey = await deriveKey(passphrase);
  const colonIdx = wrappedStr.indexOf(":");
  const iv = fromBase64(wrappedStr.slice(0, colonIdx));
  const wrapped = fromBase64(wrappedStr.slice(colonIdx + 1));

  return crypto.subtle.unwrapKey(
    "jwk",
    wrapped,
    wrappingKey,
    { name: "AES-GCM", iv },
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt", "unwrapKey"]
  );
}

// Re-wrap private key when passphrase changes
export async function rewrapPrivateKey(
  wrappedStr: string,
  oldPassphrase: string,
  newPassphrase: string
): Promise<string> {
  const privateKey = await unwrapPrivateKey(wrappedStr, oldPassphrase);
  return wrapPrivateKey(privateKey, newPassphrase);
}

// ── Hybrid encryption: RSA-OAEP + AES-GCM ──
// Encrypts plaintext with a random AES key, then wraps that key with the RSA public key.
// Format: base64(wrappedAesKey):base64(iv):base64(ciphertext)

export async function hybridEncrypt(
  plaintext: string,
  publicKey: CryptoKey
): Promise<string> {
  // Generate a random AES-256 session key
  const sessionKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  // Encrypt the plaintext with the session key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    encoded
  );

  // Wrap the session key with the RSA public key
  const wrappedSessionKey = await crypto.subtle.wrapKey(
    "raw",
    sessionKey,
    publicKey,
    { name: "RSA-OAEP" }
  );

  return `${toBase64(wrappedSessionKey)}:${toBase64(iv)}:${toBase64(ciphertext)}`;
}

export async function hybridDecrypt(
  packed: string,
  privateKey: CryptoKey
): Promise<string> {
  const parts = packed.split(":");
  if (parts.length !== 3) throw new Error("Invalid hybrid-encrypted format");
  const [wrappedKeyB64, ivB64, ctB64] = parts;

  const wrappedSessionKey = fromBase64(wrappedKeyB64!);
  const iv = fromBase64(ivB64!);
  const ciphertext = fromBase64(ctB64!);

  // Unwrap the session key with the RSA private key
  const sessionKey = await crypto.subtle.unwrapKey(
    "raw",
    wrappedSessionKey,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ── Export notes for a recipient using their public key ──

export interface RecipientExport {
  version: 1;
  exportedAt: number;
  senderPublicKey?: JsonWebKey; // optional: sender's public key for verification
  notes: {
    title: string;
    content: string; // hybrid-encrypted with recipient's public key
    category: string;
    createdAt: number;
    updatedAt: number;
  }[];
}

export async function encryptForRecipient(
  notes: { title: string; content: string; category: string; createdAt: number; updatedAt: number }[],
  recipientPublicKey: CryptoKey,
  senderPublicKey?: JsonWebKey
): Promise<RecipientExport> {
  const encryptedNotes = await Promise.all(
    notes.map(async (note) => ({
      ...note,
      title: await hybridEncrypt(note.title, recipientPublicKey),
      content: note.content
        ? await hybridEncrypt(note.content, recipientPublicKey)
        : "",
    }))
  );

  return {
    version: 1,
    exportedAt: Date.now(),
    senderPublicKey,
    notes: encryptedNotes,
  };
}

export async function decryptFromSender(
  data: RecipientExport,
  privateKey: CryptoKey
): Promise<{ title: string; content: string; category: string; createdAt: number; updatedAt: number }[]> {
  return Promise.all(
    data.notes.map(async (note) => ({
      ...note,
      title: await hybridDecrypt(note.title, privateKey),
      content: note.content
        ? await hybridDecrypt(note.content, privateKey)
        : "",
    }))
  );
}
