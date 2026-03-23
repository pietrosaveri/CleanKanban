-- Run this in the Supabase SQL editor.
-- This function bypasses RLS only to find the board by join code and insert
-- the calling user as a member. The caller must be authenticated (auth.uid() 
-- is checked and used for the insert).

CREATE OR REPLACE FUNCTION join_board_by_code(p_join_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board boards%ROWTYPE;
BEGIN
  -- Require authenticated caller
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Find board by join code (bypasses RLS via SECURITY DEFINER)
  SELECT * INTO v_board FROM boards WHERE join_code = upper(trim(p_join_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found' USING ERRCODE = 'P0002';
  END IF;

  -- Insert membership, ignore if already a member
  INSERT INTO board_members (board_id, user_id)
  VALUES (v_board.id, auth.uid())
  ON CONFLICT (board_id, user_id) DO NOTHING;

  RETURN row_to_json(v_board);
END;
$$;
