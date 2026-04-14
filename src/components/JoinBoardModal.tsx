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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="border border-white/10 rounded-2xl p-6 w-80"
        style={{ background: '#1c1c1e', boxShadow: 'rgba(0,0,0,0.6) 0px 20px 60px 0px' }}
      >
        <h2 className="text-[15px] font-semibold text-white tracking-[-0.2px] mb-1">Join a board</h2>
        <p className="text-xs text-white/40 mb-4">Enter the 8-character board code</p>

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
          className="w-full text-[14px] text-white border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-[#0071e3]/50 transition-colors duration-100 mb-3 bg-white/[0.06] placeholder:text-white/30 font-mono tracking-widest uppercase"
        />

        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleJoin}
            disabled={loading || code.trim().length < 6}
            className="text-[14px] bg-[#0071e3] text-white rounded-lg px-5 py-2 hover:bg-[#0077ed] transition-colors duration-150 disabled:opacity-40"
          >
            {loading ? 'Joining...' : 'Join'}
          </button>
          <button
            onClick={onClose}
            className="text-[14px] text-white/40 hover:text-white/70 transition-colors duration-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
