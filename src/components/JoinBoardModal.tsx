'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Board } from '@/types'

interface JoinBoardModalProps {
  userId: string
  onClose: () => void
  onJoined: (board: Board) => void
}

export default function JoinBoardModal({ userId, onClose, onJoined }: JoinBoardModalProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: board, error: joinError } = await supabase
      .rpc('join_board_by_code', { p_join_code: trimmed })

    if (joinError || !board) {
      setError('No board found with that code.')
      setLoading(false)
      return
    }

    onJoined(board as Board)
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
        <h2 className="text-sm font-medium mb-1">Join a board</h2>
        <p className="text-xs text-gray-400 mb-4">Enter the 8-character board code</p>

        <input
          autoFocus
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleJoin()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="XXXXXXXX"
          maxLength={8}
          className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-black transition-colors duration-100 mb-3 font-mono tracking-widest uppercase"
        />

        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleJoin}
            disabled={loading || code.trim().length < 6}
            className="text-sm border border-black rounded px-4 py-1.5 hover:bg-black hover:text-white transition-colors duration-150 disabled:opacity-40"
          >
            {loading ? 'Joining...' : 'Join'}
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
