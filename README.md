# CipherNotes

A fully encrypted notes application that stores everything locally in the browser using IndexedDB and AES-256-GCM encryption via the Web Crypto API. No data ever leaves your browser.

## Features

- **Client-side encryption** — AES-256-GCM with PBKDF2 key derivation (100k iterations)
- **Passphrase unlock** — User-supplied passphrase to encrypt & decrypt notes, stored only in session storage
- **IndexedDB storage** — Notes persist locally with no server-side storage
- **Markdown support** — Write notes in markdown with a toolbar editor and live preview
- **Category filtering** — Organize notes by General, Work, Personal, Ideas, or Todo
- **Raw ciphertext viewer** — Toggle to inspect the encrypted content stored in IndexedDB
- **Operation log** — Real-time panel showing encryption/decryption events
- **Matrix rain background** — Animated canvas effect
- **Glassmorphism UI** — Built with shadcn/ui components and Tailwind CSS

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS 4.1, shadcn/ui, Lucide icons
- **Markdown:** react-markdown, remark-gfm, rehype-sanitize
- **Encryption:** Web Crypto API (AES-256-GCM)
- **Storage:** IndexedDB
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
├── NotesApp.tsx            # Notes UI (create, edit, delete, filter)
├── crypto.ts               # AES-256-GCM encryption/decryption
├── db.ts                   # IndexedDB operations
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── markdown/           # Markdown editor & renderer
├── lib/utils.ts            # Utility functions
└── *.test.{ts,tsx}         # Test suites
```
