'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import type { Board, User } from '@/types'

interface TopBarProps {
  boards: Board[]
  currentBoard: Board | null
  user: User | null
  onBoardChange: (board: Board) => void
  onCreateBoard: () => void
  onJoinBoard: () => void
}

export default function TopBar({
  boards,
  currentBoard,
  user,
  onBoardChange,
  onCreateBoard,
  onJoinBoard,
}: TopBarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'

  return (
    <header className="border-b border-gray-200 px-4 h-12 flex items-center gap-3">
      {/* Board selector */}
      <div className="flex items-center gap-0 flex-1 min-w-0" ref={menuRef}>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors duration-150 ${
              menuOpen
                ? 'border-black bg-black text-white'
                : 'border-gray-200 hover:border-gray-400 text-gray-800'
            }`}
          >
            <span className="max-w-[180px] truncate font-medium">
              {currentBoard?.name ?? (boards.length > 0 ? 'Select board' : 'No boards')}
            </span>
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              className={`shrink-0 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
            >
              <path
                d="M1 1l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded shadow-md min-w-[220px] overflow-hidden">
              {boards.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                      Your boards
                    </span>
                  </div>
                  {boards.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        onBoardChange(b)
                        setMenuOpen(false)
                      }}
                      className={`flex items-center w-full text-left px-3 py-2 text-sm transition-colors duration-100 ${
                        b.id === currentBoard?.id
                          ? 'bg-gray-50 font-medium text-black'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {b.id === currentBoard?.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-black mr-2.5 shrink-0" />
                      )}
                      {b.id !== currentBoard?.id && (
                        <span className="w-1.5 h-1.5 mr-2.5 shrink-0" />
                      )}
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-gray-100 my-1" />
                </>
              )}

              <button
                onClick={() => {
                  onCreateBoard()
                  setMenuOpen(false)
                }}
                className="flex items-center w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors duration-100 gap-2"
              >
                <span className="text-gray-400">+</span>
                New board
              </button>
              <button
                onClick={() => {
                  onJoinBoard()
                  setMenuOpen(false)
                }}
                className="flex items-center w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors duration-100 gap-2 mb-1"
              >
                <span className="text-gray-400">→</span>
                Join board
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {currentBoard && (
          <Link
            href="/done"
            className="text-sm text-gray-400 hover:text-black transition-colors duration-150 whitespace-nowrap"
          >
            Done history
          </Link>
        )}

        <span className="text-xs text-gray-300 hidden sm:block">{displayName}</span>

        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-black transition-colors duration-150"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
