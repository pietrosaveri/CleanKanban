'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import type { Board, User } from '@/types'
import ConfirmModal from './ConfirmModal'

const MEMBER_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

interface TopBarProps {
  boards: Board[]
  currentBoard: Board | null
  user: User | null
  boardMembers: { user_id: string; email: string }[]
  onBoardChange: (board: Board) => void
  onCreateBoard: () => void
  onJoinBoard: () => void
}

export default function TopBar({
  boards,
  currentBoard,
  user,
  boardMembers,
  onBoardChange,
  onCreateBoard,
  onJoinBoard,
}: TopBarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [membersExpanded, setMembersExpanded] = useState(false)
  const [hoveredMember, setHoveredMember] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [deleteAccountState, setDeleteAccountState] = useState<null | 'warning' | 'confirm'>(null)
  const [sharedBoardCount, setSharedBoardCount] = useState(0)
  const [joinCodeOpen, setJoinCodeOpen] = useState(false)
  const joinCodeRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (joinCodeRef.current && !joinCodeRef.current.contains(e.target as Node)) {
        setJoinCodeOpen(false)
      }
    }
    if (joinCodeOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [joinCodeOpen])

  const handleCopyJoinCode = () => {
    if (!currentBoard) return
    navigator.clipboard.writeText(currentBoard.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const checkDeleteAccount = async () => {
    setUserMenuOpen(false)
    const supabase = createClient()
    // Find boards the user owns
    const { data: ownedBoards } = await supabase
      .from('boards')
      .select('id')
      .eq('created_by', user?.id)

    if (!ownedBoards || ownedBoards.length === 0) {
      setDeleteAccountState('confirm')
      return
    }

    // Check if any of those boards have OTHER members
    const ownedIds = ownedBoards.map((b) => b.id)
    const { data: otherMembers } = await supabase
      .from('board_members')
      .select('board_id')
      .in('board_id', ownedIds)
      .neq('user_id', user?.id)

    const distinctBoards = new Set((otherMembers ?? []).map((m) => m.board_id))
    if (distinctBoards.size > 0) {
      setSharedBoardCount(distinctBoards.size)
      setDeleteAccountState('warning')
    } else {
      setDeleteAccountState('confirm')
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteAccountState(null)
    await fetch('/api/delete-account', { method: 'POST' })
    const supabase = createClient()
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
        {/* Board member avatars */}
        {currentBoard && boardMembers.length > 0 && (
          <div
            className="flex items-center"
            onMouseEnter={() => setMembersExpanded(true)}
            onMouseLeave={() => setMembersExpanded(false)}
          >
            {boardMembers.map((member, i) => {
              const local = member.email.split('@')[0]
              const parts = local.split(/[._+\-]/).filter(Boolean)
              const initials =
                parts.length >= 2
                  ? (parts[0][0] + parts[1][0]).toUpperCase()
                  : local.slice(0, 2).toUpperCase()
              const colorClass = MEMBER_COLORS[member.user_id.charCodeAt(0) % MEMBER_COLORS.length]
              return (
                <div
                  key={member.user_id}
                  className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold select-none border-2 border-white ${colorClass}`}
                  style={{
                    marginLeft: i === 0 ? 0 : membersExpanded ? 4 : -8,
                    zIndex: boardMembers.length - i,
                    transition: 'margin-left 200ms ease',
                  }}
                  onMouseEnter={() => setHoveredMember(member.user_id)}
                  onMouseLeave={() => setHoveredMember(null)}
                >
                  {initials}
                  {hoveredMember === member.user_id && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap pointer-events-none z-50">
                      <span
                        className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent"
                        style={{ borderBottomColor: '#111827' }}
                      />
                      {member.email}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {currentBoard && (
          <Link
            href="/done"
            className="text-sm text-gray-500 hover:text-black transition-colors duration-150 whitespace-nowrap border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1 font-medium"
          >
            Done history
          </Link>
        )}

        {/* Join code */}
        {currentBoard && (
          <div className="relative" ref={joinCodeRef}>
            <button
              onClick={() => setJoinCodeOpen((v) => !v)}
              className={`text-sm transition-colors duration-150 whitespace-nowrap border rounded-lg px-3 py-1 font-medium ${
                joinCodeOpen
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 hover:border-gray-400 text-gray-500 hover:text-black'
              }`}
              title="Show join code"
            >
              Join code
            </button>
            {joinCodeOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-56 p-3">
                <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Board join code</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-mono text-sm bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 select-all text-gray-800 tracking-widest">
                    {currentBoard.join_code}
                  </span>
                  <button
                    onClick={handleCopyJoinCode}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors duration-150 font-medium shrink-0 ${
                      copied
                        ? 'bg-green-50 border-green-300 text-green-600'
                        : 'border-gray-200 hover:border-gray-400 text-gray-600 hover:text-black'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
                onClick={checkDeleteAccount}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors duration-150"
              >
                Delete account
              </button>
            </div>
          )}
        </div>
      </div>

      {deleteAccountState === 'warning' && (
        <ConfirmModal
          message={`You own ${sharedBoardCount} board${sharedBoardCount > 1 ? 's' : ''} with other members`}
          subMessage={`Deleting your account will permanently remove ${sharedBoardCount > 1 ? 'those boards' : 'that board'} and everyone on ${sharedBoardCount > 1 ? 'them' : 'it'} will lose access. This cannot be undone.`}
          confirmLabel="Delete account"
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setDeleteAccountState(null)}
        />
      )}

      {deleteAccountState === 'confirm' && (
        <ConfirmModal
          message="Delete your account?"
          subMessage="All your boards and tasks will be permanently removed. This cannot be undone."
          confirmLabel="Delete account"
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setDeleteAccountState(null)}
        />
      )}
    </header>
  )
}
