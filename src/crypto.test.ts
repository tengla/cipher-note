import { test, expect, describe } from "bun:test";
import { encrypt, decrypt } from "./crypto";

describe("crypto", () => {
  const passphrase = "test-passphrase-123";

  test("encrypt returns iv:ciphertext format", async () => {
    const result = await encrypt("hello world", passphrase);
    expect(result).toContain(":");
    const parts = result.split(":");
    expect(parts).toHaveLength(2);
    // Both parts should be valid base64
    expect(() => atob(parts[0]!)).not.toThrow();
    expect(() => atob(parts[1]!)).not.toThrow();
  });

  test("encrypt + decrypt round-trip", async () => {
    const plaintext = "Hello, CipherNotes!";
    const encrypted = await encrypt(plaintext, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe(plaintext);
  });

  test("round-trip with unicode content", async () => {
    const plaintext = "日本語テスト 🔐 émojis & spëcial çhars";
    const encrypted = await encrypt(plaintext, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe(plaintext);
  });

  test("round-trip with empty string", async () => {
    const encrypted = await encrypt("", passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe("");
  });

  test("round-trip with long content", async () => {
    const plaintext = "a".repeat(10_000);
    const encrypted = await encrypt(plaintext, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe(plaintext);
  });

  test("different passphrases produce different ciphertexts", async () => {
    const plaintext = "secret data";
    const enc1 = await encrypt(plaintext, "passphrase-one");
    const enc2 = await encrypt(plaintext, "passphrase-two");
    // Ciphertexts (after the IV) should differ
    const ct1 = enc1.split(":")[1];
    const ct2 = enc2.split(":")[1];
    expect(ct1).not.toBe(ct2);
  });

  test("same plaintext produces different ciphertexts (random IV)", async () => {
    const plaintext = "same input";
    const enc1 = await encrypt(plaintext, passphrase);
    const enc2 = await encrypt(plaintext, passphrase);
    // IVs should differ since they're random
    expect(enc1).not.toBe(enc2);
    // But both should decrypt to the same plaintext
    expect(await decrypt(enc1, passphrase)).toBe(plaintext);
    expect(await decrypt(enc2, passphrase)).toBe(plaintext);
  });

  test("decrypt with wrong passphrase throws", async () => {
    const encrypted = await encrypt("secret", passphrase);
    expect(decrypt(encrypted, "wrong-passphrase")).rejects.toThrow();
  });

  test("decrypt with corrupted ciphertext throws", async () => {
    const encrypted = await encrypt("secret", passphrase);
    const [iv] = encrypted.split(":");
    const corrupted = `${iv}:${btoa("garbage data here")}`;
    expect(decrypt(corrupted, passphrase)).rejects.toThrow();
  });

  test("IV is 12 bytes (96 bits) for AES-GCM", async () => {
    const encrypted = await encrypt("test", passphrase);
    const ivB64 = encrypted.split(":")[0]!;
    const ivBytes = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    expect(ivBytes.length).toBe(12);
  });
});
