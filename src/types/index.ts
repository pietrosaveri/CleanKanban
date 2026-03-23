export type Board = {
  id: string
  name: string
  join_code: string
  created_by: string
  created_at: string
}

export type Column = {
  id: string
  board_id: string
  name: string
  position: number
}

export type Task = {
  id: string
  board_id: string
  column_id: string
  text: string
  position: number
  done: boolean
  done_at: string | null
  done_from_column: string | null
}

export type User = {
  id: string
  email?: string
  user_metadata?: { full_name?: string; name?: string }
}
