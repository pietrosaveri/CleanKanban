'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import type { Board, User } from '@/types'
import ConfirmModal from './ConfirmModal'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState(false)

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleDeleteAccount = async () => {
    setPendingDeleteAccount(false)
    const supabase = createClient()
    // Delete owned boards (cascades to columns & tasks via FK)
    const { data: ownedBoards } = await supabase
      .from('boards')
      .select('id')
      .eq('owner_id', user?.id)
    if (ownedBoards && ownedBoards.length > 0) {
      await supabase.from('boards').delete().in('id', ownedBoards.map((b) => b.id))
    }
    // Remove memberships
    await supabase.from('board_members').delete().eq('user_id', user?.id)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('')

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
      <div className="flex items-center gap-2">
        {currentBoard && (
          <Link
            href="/done"
            className="text-sm text-gray-500 hover:text-black transition-colors duration-150 whitespace-nowrap border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1 font-medium"
          >
            Done history
          </Link>
        )}

        {/* User circle */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold select-none transition-all duration-150 ${
              userMenuOpen
                ? 'bg-black text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={displayName}
          >
            {initials || '?'}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-56 overflow-hidden py-1">
              {/* Email */}
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setUserMenuOpen(false); handleLogout() }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              >
                Log out
              </button>
              <button
                onClick={() => { setUserMenuOpen(false); setPendingDeleteAccount(true) }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors duration-150"
              >
                Delete account
              </button>
            </div>
          )}
        </div>
      </div>

      {pendingDeleteAccount && (
        <ConfirmModal
          message="Delete your account?"
          subMessage="All your boards and tasks will be permanently removed. This cannot be undone."
          confirmLabel="Delete account"
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setPendingDeleteAccount(false)}
        />
      )}
    </header>
  )
}
