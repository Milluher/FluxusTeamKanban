# FluxusTeam Kanban

## Quick Start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set up database

```bash
cd backend
npm run db:push
npm run db:generate
npm run db:seed
```

### 3. Start servers

**Terminal 1 (Backend):**
```bash
cd backend && npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend && npm run dev
```

### 4. Point the frontend at your local backend

`frontend/src/lib/api.ts` hardcodes the deployed API, so a local frontend talks to
the deployed backend rather than the one you just started. Change `baseURL` to
`http://localhost:4000/api` (or whatever `PORT` the backend logs) while working
locally.

### 5. Open http://localhost:3000

**Sign in.** `npm run db:seed` creates one admin user, `femi@fluxx.ng`, with the
password set in `backend/prisma/seed.js`. Change it after your first sign-in —
that password is committed to this repository, and the account is the super-admin
that the admin screens exempt from every guard.

The seed only runs against an empty database: it counts users first and skips if
any exist. So it will not reset a password or recreate a user you deleted, and it
is safe to leave in the backend's start command.
