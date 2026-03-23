'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Board } from '@/types'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // removed ambiguous chars
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

interface CreateBoardModalProps {
  userId: string
  onClose: () => void
  onCreated: (board: Board) => void
}

export default function CreateBoardModal({ userId, onClose, onCreated }: CreateBoardModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const joinCode = generateJoinCode()

    // Insert without chaining .select() so RLS on boards SELECT doesn't block
    // (user isn't a member yet at the moment of insert)
    const { data: inserted, error: boardError } = await supabase
      .from('boards')
      .insert({ name: trimmed, join_code: joinCode, created_by: userId })
      .select()
      .single()

    if (boardError) {
      setError('Failed to create board. Please try again.')
      setLoading(false)
      return
    }

    // Add creator as a member first
    await supabase.from('board_members').insert({ board_id: inserted.id, user_id: userId })

    // Now fetch the board (user is a member, so RLS passes)
    const { data: board } = await supabase
      .from('boards')
      .select('*')
      .eq('id', inserted.id)
      .single()

    if (!board) {
      setError('Failed to load board. Please refresh.')
      setLoading(false)
      return
    }

    // Add default columns
    await supabase.from('columns').insert([
      { board_id: inserted.id, name: 'To do', position: 0 },
      { board_id: inserted.id, name: 'In progress', position: 1 },
      { board_id: inserted.id, name: 'Done', position: 2 },
    ])

    onCreated(board)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white border border-gray-200 rounded p-6 w-80 shadow-sm">
        <h2 className="text-sm font-medium mb-4">New board</h2>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Board name"
          className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-black transition-colors duration-100 mb-3"
        />

        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="text-sm border border-black rounded px-4 py-1.5 hover:bg-black hover:text-white transition-colors duration-150 disabled:opacity-40"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-black transition-colors duration-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
