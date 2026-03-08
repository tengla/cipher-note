# CipherNotes

A fully encrypted notes application that stores everything locally in the browser using IndexedDB and AES-256-GCM encryption via the Web Crypto API. No data ever leaves your browser.

## Features

- **Client-side encryption** — AES-256-GCM with PBKDF2 key derivation (100k iterations)
- **Passphrase unlock** — User-supplied passphrase to encrypt & decrypt notes, stored only in session storage
- **IndexedDB storage** — Notes persist locally with no server-side storage
- **Markdown support** — Write notes in markdown with a toolbar editor and live preview
- **Custom categories** — Create, rename, reorder, delete, and color-pick categories via a built-in editor
- **Vault backup** — Export/import your encrypted vault as a JSON file to protect against browser data loss
- **Persistent storage** — Requests `navigator.storage.persist()` to prevent browser eviction of IndexedDB
- **Raw ciphertext viewer** — Toggle to inspect the encrypted content stored in IndexedDB
- **Operation log** — Real-time panel showing encryption/decryption events
- **Storage status** — Shows whether storage is persistent or evictable, plus usage stats
- **Matrix rain background** — Animated canvas effect
- **Glassmorphism UI** — Built with shadcn/ui components and Tailwind CSS

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS 4.1, shadcn/ui, Lucide icons
- **Markdown:** react-markdown, remark-gfm, rehype-sanitize
- **Encryption:** Web Crypto API (AES-256-GCM)
- **Storage:** IndexedDB (notes + categories stores)
- **Testing:** bun:test, Testing Library, happy-dom, fake-indexeddb

## Getting Started

```bash
# Install dependencies
bun install

# Start development server with HMR
bun dev

# Start production server
bun start
```

## Testing

```bash
bun test
```

## Project Structure

```
src/
├── index.ts                # Bun server entry point
├── index.html              # HTML template
├── index.css               # Global styles
├── frontend.tsx            # React app entry + HMR
├── App.tsx                 # Main component, passphrase unlock, Matrix rain
├── NotesApp.tsx            # Notes UI, category editor, export/import
├── crypto.ts               # AES-256-GCM encryption/decryption
├── db.ts                   # IndexedDB operations, vault export/import
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── markdown/           # Markdown editor & renderer
├── lib/utils.ts            # Utility functions
└── *.test.{ts,tsx}         # Test suites
```

## Data Persistence

IndexedDB is "best-effort" storage by default — browsers can evict it under disk pressure or after inactivity (Safari is especially aggressive). CipherNotes mitigates this by:

1. Requesting persistent storage on unlock so the browser won't auto-evict
2. Showing a storage status indicator (persistent vs evictable) in the UI
3. Providing vault export/import — download your encrypted vault as a `.json` backup file

The exported file contains encrypted ciphertext, so it's safe to store anywhere — it requires your passphrase to read.
