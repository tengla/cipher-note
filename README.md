# CipherNotes

A fully encrypted notes application that stores everything locally in the browser using IndexedDB and AES-256-GCM encryption via the Web Crypto API. No data ever leaves your browser.

## Features

- **Client-side encryption** — AES-256-GCM with PBKDF2 key derivation (100k iterations)
- **IndexedDB storage** — Notes persist locally with no server-side storage
- **Category filtering** — Organize notes by General, Work, Personal, Ideas, or Todo
- **Operation log** — Real-time panel showing encryption/decryption events
- **Matrix rain background** — Animated canvas effect
- **Glassmorphism UI** — Built with shadcn/ui components and Tailwind CSS

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS 4.1, shadcn/ui, Lucide icons
- **Encryption:** Web Crypto API (AES-256-GCM)
- **Storage:** IndexedDB

## Getting Started

```bash
# Install dependencies
bun install

# Start development server with HMR
bun dev

# Start production server
bun start
```

## Project Structure

```
src/
├── index.ts          # Bun server entry point
├── index.html        # HTML template
├── frontend.tsx      # React app entry + HMR
├── App.tsx           # Main component + Matrix rain animation
├── NotesApp.tsx      # Notes UI (create, edit, delete, filter)
├── crypto.ts         # AES-256-GCM encryption/decryption
├── db.ts             # IndexedDB operations
├── components/ui/    # shadcn/ui components
└── lib/utils.ts      # Utility functions
```

## Note

This is a demo application with a hardcoded encryption passphrase. A production version should derive the key from user-supplied input.
