-- =============================================================
-- Fix: Infinite recursion in board_members RLS policies
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Drop all existing policies that cause the recursion
DROP POLICY IF EXISTS "Members can view member list"    ON board_members;
DROP POLICY IF EXISTS "Members can view their boards"  ON boards;
DROP POLICY IF EXISTS "Members can update boards"      ON boards;
DROP POLICY IF EXISTS "Board members can view columns"  ON columns;
DROP POLICY IF EXISTS "Board members can create columns" ON columns;
DROP POLICY IF EXISTS "Board members can update columns" ON columns;
DROP POLICY IF EXISTS "Board members can delete columns" ON columns;
DROP POLICY IF EXISTS "Board members can view tasks"   ON tasks;
DROP POLICY IF EXISTS "Board members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Board members can update tasks" ON tasks;
DROP POLICY IF EXISTS "Board members can delete tasks" ON tasks;

-- 2. Helper function that checks membership WITHOUT going through RLS
--    SECURITY DEFINER = runs as the function owner, bypasses RLS on board_members
CREATE OR REPLACE FUNCTION is_board_member(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id
      AND user_id = auth.uid()
  );
$$;

-- 3. board_members: each user can only see their own membership rows (no recursion)
CREATE POLICY "Users can view own memberships"
  ON board_members FOR SELECT
  USING (user_id = auth.uid());

-- 4. boards policies
CREATE POLICY "Members can view their boards"
  ON boards FOR SELECT
  USING (is_board_member(id));

CREATE POLICY "Members can update boards"
  ON boards FOR UPDATE
  USING (is_board_member(id));

-- 5. columns policies
CREATE POLICY "Board members can view columns"
  ON columns FOR SELECT
  USING (is_board_member(board_id));

CREATE POLICY "Board members can create columns"
  ON columns FOR INSERT
  WITH CHECK (is_board_member(board_id));

CREATE POLICY "Board members can update columns"
  ON columns FOR UPDATE
  USING (is_board_member(board_id));

CREATE POLICY "Board members can delete columns"
  ON columns FOR DELETE
  USING (is_board_member(board_id));

-- 6. tasks policies
CREATE POLICY "Board members can view tasks"
  ON tasks FOR SELECT
  USING (is_board_member(board_id));

CREATE POLICY "Board members can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (is_board_member(board_id));

CREATE POLICY "Board members can update tasks"
  ON tasks FOR UPDATE
  USING (is_board_member(board_id));

CREATE POLICY "Board members can delete tasks"
  ON tasks FOR DELETE
  USING (is_board_member(board_id));
