-- =============================================================
-- Fix: boards SELECT policy must also allow the board creator
-- (needed because after INSERT the user isn't a member yet when
--  the chained .select() fires)
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================

DROP POLICY IF EXISTS "Members can view their boards" ON boards;

CREATE POLICY "Members can view their boards"
  ON boards FOR SELECT
  USING (created_by = auth.uid() OR is_board_member(id));
