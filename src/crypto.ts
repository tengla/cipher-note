// Fixed salt for deterministic key derivation (in production, store per-user)
const SALT = new TextEncoder().encode("indexeddb-demo-salt");

let cachedKey: CryptoKey | null = null;
let cachedPassphrase: string | null = null;

async function deriveKey(passphrase: string): Promise<CryptoKey> {
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
    ["encrypt", "decrypt"]
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
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}:${ctB64}`;
}

export async function decrypt(packed: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase);
  const colonIdx = packed.indexOf(":");
  const ivB64 = packed.slice(0, colonIdx);
  const ctB64 = packed.slice(colonIdx + 1);

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
