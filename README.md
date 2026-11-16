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

## How a board is laid out

Boards are not created as "sprint" or "kanban" boards any more. Every board has
the same four sections, in this order:

1. **Project Overview** — the project canvas: blocks of features, and the PRD
   behind each one.
2. **Project Files** — named links to the documents that describe the product.
3. **Backlog** — every ticket on the board that is not in a sprint. New tickets
   land here.
4. **Sprints** — the sprint cards, each opening its own ticket board.

A ticket is in the backlog precisely when it has no sprint. There is no backlog
column and no backlog flag, so the two can never disagree about where a ticket
is. (Boards created before this keep whatever columns they have, their own
"Backlog" column included — nothing is rewritten under them. New boards get
To Do → In Progress → Review → Done.)

**Nothing in the backlog can be assigned.** Scheduling comes first: putting a
ticket in a sprint is the act of deciding it is being done, and only then is
there anybody to give it to. An admin schedules a backlog ticket from the
backlog list, into any sprint that has not been completed and whose end date has
not passed — `backend/src/lib/sprintWindow.js` is the rule, mirrored in
`frontend/src/lib/sprintWindow.ts` so the picker only offers what the server
will accept. Pulling a ticket back out of a sprint returns it to the backlog and
clears its assignee.

The one exception is the tasks publishing a PRD raises for its administrative
blocks and its approvers: those are handed straight to the person the document
names, so they are assigned and have no sprint. They appear in the backlog list
with their owner shown.

## Panels, not pages

Four things are consulted *while* you work rather than read on their own, so
each opens as a panel beside the page from a button in the header:

- **Personas** — who we build for.
- **Initiatives** — the strategic goals. The "why" behind the tickets in front
  of you.
- **Riverly Dictionary** — the board's vocabulary.
- **Changelog** — release notes. "Did that already ship?" is a question you ask
  while looking at the work.

Reading any of them used to cost you the board or the sprint you had open, which
is the whole reason they are panels.

All four are scoped the same way: inside a board they show that board's entries,
and a new one starts on that board. Outside one they show every board you can
see and the form asks which board the entry is for. Only one is open at a time,
since they share the same space. Escape closes a panel — but not while its
create/edit form is open over it, which would discard what was typed.

`/initiatives` and `/changelog` were pages and are now redirects to the
dashboard, so an old bookmark still lands somewhere useful.

A ticket's **Initiative** field is offered in both places a ticket is written:
on the New Ticket form, and on every open ticket rather than hidden behind
"+ Add field" like the other optional fields. It was the one association nobody
made, because it was invisible at exactly the moment a ticket was being
described. In both places the picker offers that board's initiatives, and says
what to do when the board has none yet — a dropdown holding only "None" reads as
broken rather than empty.

## Products, blocks and PRDs

A project in the Project Overview holds two kinds of thing, and an admin adds
either:

- **Products** — each one exists in order to have a PRD. Naming a product opens
  the builder, and the document follows the normal flow from there. The card
  shows where sign-off stands.
- **Blocks** — a heading with its features listed under it. Adding a feature
  adds a line to that list; it starts no document.

Both have their own labelled add control in the row where the thing will appear,
rather than one button hiding a menu.

A PRD used to hang off a *feature*, which put a long document behind a bullet
point: a block is a heading and its features are a sentence each, while a PRD
carries scope, personas, approvers and sign-off. The PRDs already attached to a
feature are left exactly as they were — the feature still shows a `PRD` badge
that opens it, and it stays editable under the rules below. Only the *starting*
of one moved.

A PRD stays **editable after it is published**, right up until it is approved —
sections, administrative blocks and approvers alike. Publishing circulates a
document for sign-off; it is not the moment the document stops being written,
and a gap an approver points out has to be fixable where the author is. A block
or approver added after publishing raises its task and notifies its person
straight away; removing one takes its task with it.

Once **every** named approver has approved, the PRD is closed to editing: the
document they approved is the document that stands.

## Deploys and that "crash" in the Railway log

Both the frontend (Vercel) and the backend (Railway) deploy automatically from
`main`, so merging is the deploy. Nothing needs triggering by hand.

Railway sends `SIGTERM` to the outgoing container every time a new deployment
takes over. The backend installs a handler for it (`backend/src/index.js`):
it stops accepting connections, lets in-flight requests finish, closes the
sockets and the database, and exits 0. The start command ends with
`exec node src/index.js` so the signal reaches node directly instead of dying in
the shell npm spawned — without both halves, a perfectly healthy handover
printed four lines of

```
npm error command failed
npm error signal SIGTERM
```

against the *previous* container, which is indistinguishable from a crash in the
log view and was reported as one.

So: a green deploy badge is still not evidence the app runs — read the boot log
and check it ends with `Backend running on port 8080`. But `npm error … SIGTERM`
on a superseded deployment no longer happens at all; if you see it, something is
genuinely wrong.

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
