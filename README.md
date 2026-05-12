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

### 4. Open http://localhost:3000

**Demo credentials:**
- admin@fluxus.com / password123
- alice@fluxus.com / password123
- bob@fluxus.com / password123
