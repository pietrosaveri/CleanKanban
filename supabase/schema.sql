-- =============================================================
-- Minimal Realtime Kanban — Supabase Database Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- =============================================================

-- ── Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS boards (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  join_code   TEXT UNIQUE NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_members (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

CREATE TABLE IF NOT EXISTS columns (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id         UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id        UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  text             TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0,
  done             BOOLEAN NOT NULL DEFAULT FALSE,
  done_at          TIMESTAMPTZ,
  done_from_column TEXT   -- stores column name at time of completion
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_board_members_user   ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_board  ON board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_columns_board        ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board          ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column         ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done           ON tasks(board_id, done);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE boards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE columns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;

-- boards policies
CREATE POLICY "Members can view their boards"
  ON boards FOR SELECT
  USING (id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create boards"
  ON boards FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Members can update boards"
  ON boards FOR UPDATE
  USING (id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

-- board_members policies
CREATE POLICY "Members can view member list"
  ON board_members FOR SELECT
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can join boards"
  ON board_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- columns policies
CREATE POLICY "Board members can view columns"
  ON columns FOR SELECT
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can create columns"
  ON columns FOR INSERT
  WITH CHECK (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can update columns"
  ON columns FOR UPDATE
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can delete columns"
  ON columns FOR DELETE
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

-- tasks policies
CREATE POLICY "Board members can view tasks"
  ON tasks FOR SELECT
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can update tasks"
  ON tasks FOR UPDATE
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can delete tasks"
  ON tasks FOR DELETE
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

-- ── Realtime ──────────────────────────────────────────────────
-- Enable realtime for all tables used by the app
ALTER PUBLICATION supabase_realtime ADD TABLE boards;
ALTER PUBLICATION supabase_realtime ADD TABLE board_members;
ALTER PUBLICATION supabase_realtime ADD TABLE columns;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
