# Grad Paddy — Frontend

Next.js frontend for the Grad Paddy AI agent.

## Prerequisites

- Node.js 18+
- pnpm 10+ — `npm install -g pnpm`

## Getting started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/chat` on load.

## Scripts

```bash
pnpm dev      # Development server with hot reload
pnpm build    # Production build
pnpm start    # Start production server (requires build first)
pnpm lint     # ESLint
```

## Environment variables

Create a `.env.local` file in this directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> `.env.local` is gitignored — never commit it.

## Routes

| Route | View |
|-------|------|
| `/chat` | Agent chat with live activity stream |
| `/shortlist` | Saved faculty and programs |
| `/tracker` | Application deadlines and status |
| `/drafts` | SOP and outreach prep drafts |
