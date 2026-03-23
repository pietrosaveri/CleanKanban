# Minimal Realtime Kanban

A clean, minimal, realtime collaborative Kanban board.  
Tech: **Next.js 15** · **TypeScript** · **Tailwind CSS** · **Supabase** (Auth + Postgres + Realtime)

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the database schema

In the Supabase dashboard → **SQL Editor**, paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql).

### 3. Enable Google OAuth

In Supabase dashboard → **Authentication → Providers → Google**:
- Enable Google provider
- Add your Google OAuth Client ID and Secret  
  (Create credentials at [console.cloud.google.com](https://console.cloud.google.com))
- Set the **Authorized redirect URI** in Google Cloud Console to:  
  `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are in **Supabase dashboard → Settings → API**.

### 5. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Features

- **Google Auth** — login required, session persisted
- **Boards** — create boards, share via 8-char join code, switch between boards
- **Columns** — add, rename, delete, reorder left/right per board
- **Tasks** — add, edit, delete, move up/down, move to another column, mark done
- **Done history** — `/done` page lists completed tasks with done-date and source column
- **Realtime** — all changes sync instantly across all connected clients via Supabase Realtime

---

## Project structure

```
src/
  app/
    page.tsx              — Main Kanban board page
    done/page.tsx         — Done history page
    auth/login/page.tsx   — Login page (Google OAuth)
    auth/callback/route.ts— OAuth callback handler
    layout.tsx
    globals.css
  components/
    TopBar.tsx            — Top navigation bar
    Board.tsx             — Board layout (renders columns)
    Column.tsx            — Column with task list
    Task.tsx              — Individual task card
    CreateBoardModal.tsx  — Create new board modal
    JoinBoardModal.tsx    — Join board by code modal
  lib/
    supabaseClient.ts     — Browser Supabase client
    supabaseServer.ts     — Server Supabase client
  middleware.ts           — Auth guard (redirect if not logged in)
  types/index.ts          — Shared TypeScript types
supabase/
  schema.sql              — Full database schema with RLS policies
```

---

## Deployment

Deploy to [Vercel](https://vercel.com):

```bash
npx vercel
```

Set the same two environment variables in the Vercel project settings.  
Add your production URL to Supabase **Authentication → URL Configuration → Redirect URLs**.
