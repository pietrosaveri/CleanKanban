-- Run this in the Supabase SQL editor to allow fetching member emails per board.
-- Uses SECURITY DEFINER so it can access auth.users, but manually enforces
-- the same access check: only members of the board can see each other's emails.

CREATE OR REPLACE FUNCTION get_board_members_emails(p_board_id UUID)
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bm.user_id, au.email::TEXT
  FROM board_members bm
  JOIN auth.users au ON au.id = bm.user_id
  WHERE bm.board_id = p_board_id
    AND bm.board_id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid()
    );
$$;
