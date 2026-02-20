# Delivery Optimizer UI

Frontend application for optimizing delivery routes.

## Prerequisites

- Node.js 18+ or Bun
- Backend API running (see main repo README)

## Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local

Configure your backend API URL:
NEXT_PUBLIC_API_URL=http://localhost:5050

Development

npm install
npm run dev

Open http://localhost:3000

Project Structure

- src/app/ - Next.js App Router pages
- src/components/ - Reusable React components (coming soon)
- src/lib/ - Utilities and API clients (coming soon)

Connecting to Backend

The backend API (PR #27) must be running for full functionality.
See CLAUDE.md or main README for setup instructions.
