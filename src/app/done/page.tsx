'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'
import ConfirmModal from '@/components/ConfirmModal'
import type { Board, Task } from '@/types'

export default function DonePage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [doneTasks, setDoneTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [pendingClear, setPendingClear] = useState(false)

  useEffect(() => {
    const loadBoards = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberships } = await supabase
        .from('board_members')
        .select('board_id')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) {
        setLoading(false)
        return
      }

      const boardIds = memberships.map((m: { board_id: string }) => m.board_id)
      const { data: fetchedBoards } = await supabase
        .from('boards')
        .select('*')
        .in('id', boardIds)
        .order('created_at', { ascending: true })

      if (fetchedBoards && fetchedBoards.length > 0) {
        setBoards(fetchedBoards)
        setSelectedBoardId(fetchedBoards[0].id)
      }

      setLoading(false)
    }

    loadBoards()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedBoardId) return

    const loadDone = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('board_id', selectedBoardId)
        .eq('done', true)
        .order('done_at', { ascending: false })

      setDoneTasks(data ?? [])
    }

    loadDone()
  }, [selectedBoardId]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearDoneHistory = () => {
    if (!selectedBoardId || doneTasks.length === 0) return
    setPendingClear(true)
  }

  const confirmClear = async () => {
    setPendingClear(false)
    setClearing(true)
    const supabase = createClient()
    await supabase
      .from('tasks')
      .delete()
      .eq('board_id', selectedBoardId)
      .eq('done', true)
    setDoneTasks([])
    setClearing(false)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 px-4 h-12 flex items-center gap-3 border-b border-white/[0.08]"
        style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}
      >
        <Link
          href="/"
          className="text-[13px] text-white/50 hover:text-white transition-colors duration-100"
        >
          ← Back to board
        </Link>

        <span className="text-white/20">|</span>

        <h1 className="text-[13px] font-semibold text-white">Done history</h1>

        {boards.length > 1 && (
          <>
            <span className="text-white/20">|</span>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="text-[13px] border border-white/10 rounded-lg px-2 py-1 bg-white/[0.06] text-white"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="flex-1" />

        {doneTasks.length > 0 && (
          <button
            onClick={clearDoneHistory}
            disabled={clearing}
            className="text-xs text-white/40 hover:text-red-400 border border-white/10 hover:border-red-400/30 rounded-lg px-3 py-1 transition-all duration-150 disabled:opacity-50"
          >
            {clearing ? 'Clearing...' : 'Clear all'}
          </button>
        )}
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-[14px] text-white/40">Loading...</p>
        ) : doneTasks.length === 0 ? (
          <p className="text-[14px] text-white/40">No completed tasks yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left font-medium text-white/50 text-[11px] uppercase tracking-wide py-2 pr-4">Task</th>
                <th className="text-left font-medium text-white/50 text-[11px] uppercase tracking-wide py-2 pr-4 whitespace-nowrap">Column</th>
                <th className="text-left font-medium text-white/50 text-[11px] uppercase tracking-wide py-2 whitespace-nowrap">Done at</th>
              </tr>
            </thead>
            <tbody>
              {doneTasks.map((task) => (
                <tr key={task.id} className="border-b border-white/[0.06]">
                  <td className="py-2.5 pr-4 text-white/80 text-[13px] break-words max-w-[16rem]">
                    {task.text}
                  </td>
                  <td className="py-2.5 pr-4 text-white/40 text-[13px] whitespace-nowrap">
                    {task.done_from_column ?? '—'}
                  </td>
                  <td className="py-2.5 text-white/30 whitespace-nowrap text-[11px]">
                    {formatDate(task.done_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {pendingClear && (
        <ConfirmModal
          message={`Clear all ${doneTasks.length} completed task${doneTasks.length !== 1 ? 's' : ''}?`}
          subMessage="This permanently removes them and cannot be undone."
          confirmLabel="Clear all"
          danger
          onConfirm={confirmClear}
          onCancel={() => setPendingClear(false)}
        />
      )}
    </div>
  )
}
