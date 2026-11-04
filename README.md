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

## Email notifications (Resend)

Every in-app notification (ticket assigned, @mention, PRD approval requested,
PRD section to complete, PRD approved, PRD changes requested) is also emailed to
the recipient through [Resend](https://resend.com). Email is best-effort: if it
fails, the error is logged and the in-app notification still goes out. The code
is in `backend/src/lib/email.js`.

Backend environment variables (Railway → backend service → Variables):

| Variable | Required | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | From Resend → API keys. Without it, emails are skipped. |
| `EMAIL_FROM` | for real use | e.g. `FluxusTeam <notifications@fluxx.ng>`. Must be on a domain verified in Resend. The default `onboarding@resend.dev` only delivers to the Resend account owner's own inbox. |
| `FRONTEND_URL` | no | Base for links in emails. Defaults to `https://fluxusteamkanban.vercel.app`. |
| `EMAIL_NOTIFICATIONS` | no | Set to `off` to pause emails without removing the key. |

The sending domain does not have to be the app's domain: the app can stay on
`vercel.app` while mail is sent from a domain you own (e.g. `fluxx.ng`), once
that domain's DNS records from Resend → Domains are added at its registrar.
