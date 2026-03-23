'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Board, Column, Task, User } from '@/types'
import TopBar from '@/components/TopBar'
import BoardView from '@/components/Board'
import CreateBoardModal from '@/components/CreateBoardModal'
import JoinBoardModal from '@/components/JoinBoardModal'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [boards, setBoards] = useState<Board[]>([])
  const [currentBoard, setCurrentBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [initializing, setInitializing] = useState(true)

  const channelRef = useRef<RealtimeChannel | null>(null)

  // ── initial load ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setUser(user as User)

      const { data: memberships } = await supabase
        .from('board_members')
        .select('board_id')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) return

      const boardIds = memberships.map((m: { board_id: string }) => m.board_id)
      const { data: fetchedBoards } = await supabase
        .from('boards')
        .select('*')
        .in('id', boardIds)
        .order('created_at', { ascending: true })

      if (fetchedBoards && fetchedBoards.length > 0) {
        setBoards(fetchedBoards)
        setCurrentBoard(fetchedBoards[0])
      }
    }

    init().finally(() => setInitializing(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── load board data + subscribe to realtime ────────────────────
  useEffect(() => {
    if (!currentBoard) return

    const supabase = createClient()

    const loadBoardData = async () => {
      const [{ data: cols }, { data: tsks }] = await Promise.all([
        supabase
          .from('columns')
          .select('*')
          .eq('board_id', currentBoard.id)
          .order('position'),
        supabase
          .from('tasks')
          .select('*')
          .eq('board_id', currentBoard.id)
          .eq('done', false)
          .order('position'),
      ])
      setColumns(cols ?? [])
      setTasks(tsks ?? [])
    }

    loadBoardData()

    // Unsubscribe from previous channel
    if (channelRef.current) {
      const supabasePrev = createClient()
      supabasePrev.removeChannel(channelRef.current)
    }

    // Subscribe to realtime changes.
    // INSERT/UPDATE use board_id filter (works because payload.new has board_id).
    // DELETE uses no filter — payload.old only contains the PK, so server-side
    // filtering by board_id would silently drop DELETE events. Client-side we
    // only remove IDs that exist in our local state, so extra events are no-ops.
    const channel = supabase
      .channel(`board:${currentBoard.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'columns', filter: `board_id=eq.${currentBoard.id}` },
        (payload) => {
          setColumns((prev) =>
            prev.find((c) => c.id === (payload.new as Column).id)
              ? prev
              : [...prev, payload.new as Column].sort((a, b) => a.position - b.position)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'columns', filter: `board_id=eq.${currentBoard.id}` },
        (payload) => {
          setColumns((prev) =>
            prev
              .map((c) => (c.id === (payload.new as Column).id ? (payload.new as Column) : c))
              .sort((a, b) => a.position - b.position)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'columns' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setColumns((prev) => prev.filter((c) => c.id !== deletedId))
          setTasks((prev) => prev.filter((t) => t.column_id !== deletedId))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks', filter: `board_id=eq.${currentBoard.id}` },
        (payload) => {
          const t = payload.new as Task
          if (!t.done) {
            setTasks((prev) =>
              prev.find((x) => x.id === t.id)
                ? prev
                : [...prev, t].sort((a, b) => a.position - b.position)
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `board_id=eq.${currentBoard.id}` },
        (payload) => {
          const t = payload.new as Task
          if (t.done) {
            // Delay removal so a locally-running completion animation (1 s) can
            // finish before the component is unmounted.  For remote completions
            // the 1.2 s delay is imperceptible.
            setTimeout(
              () => setTasks((prev) => prev.filter((x) => x.id !== t.id)),
              1200
            )
          } else {
            setTasks((prev) =>
              prev
                .map((x) => (x.id === t.id ? t : x))
                .sort((a, b) => a.position - b.position)
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setTasks((prev) => prev.filter((x) => x.id !== deletedId))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      const supabaseCleanup = createClient()
      supabaseCleanup.removeChannel(channel)
    }
  }, [currentBoard?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── optimistic delete callbacks ────────────────────────────────
  const handleColumnDeleted = (id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id))
    setTasks((prev) => prev.filter((t) => t.column_id !== id))
  }

  const handleTaskDeleted = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  // ── render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {initializing && (
        <div className="loading-overlay">
          <span className="loader" />
        </div>
      )}
      <TopBar
        boards={boards}
        currentBoard={currentBoard}
        user={user}
        onBoardChange={setCurrentBoard}
        onCreateBoard={() => setShowCreateModal(true)}
        onJoinBoard={() => setShowJoinModal(true)}
      />

      {currentBoard ? (
        <BoardView
          board={currentBoard}
          columns={columns}
          tasks={tasks}
          onColumnDeleted={handleColumnDeleted}
          onTaskDeleted={handleTaskDeleted}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] gap-3">
          <p className="text-sm text-gray-400">No boards yet.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm border border-black rounded px-4 py-1.5 hover:bg-black hover:text-white transition-colors duration-150"
            >
              Create a board
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="text-sm border border-gray-200 rounded px-4 py-1.5 hover:border-black transition-colors duration-150"
            >
              Join a board
            </button>
          </div>
        </div>
      )}

      {showCreateModal && user && (
        <CreateBoardModal
          userId={user.id}
          onClose={() => setShowCreateModal(false)}
          onCreated={(board) => {
            setBoards((prev) => [...prev, board])
            setCurrentBoard(board)
          }}
        />
      )}

      {showJoinModal && user && (
        <JoinBoardModal
          userId={user.id}
          onClose={() => setShowJoinModal(false)}
          onJoined={(board) => {
            setBoards((prev) =>
              prev.find((b) => b.id === board.id) ? prev : [...prev, board]
            )
            setCurrentBoard(board)
          }}
        />
      )}
    </div>
  )
}
