'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import type { Board, User } from '@/types'
import ConfirmModal from './ConfirmModal'

const MEMBER_COLORS = [
  'bg-blue-500/25 text-blue-300',
  'bg-emerald-500/25 text-emerald-300',
  'bg-violet-500/25 text-violet-300',
  'bg-amber-500/25 text-amber-300',
  'bg-rose-500/25 text-rose-300',
  'bg-cyan-500/25 text-cyan-300',
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
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

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

  // Track presence — show a green ring on online members
  useEffect(() => {
    if (!currentBoard || !user) return
    const supabase = createClient()
    const channel = supabase.channel(`presence:board:${currentBoard.id}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string }>()
        const ids = new Set(Object.keys(state))
        setOnlineUserIds(ids)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentBoard?.id, user?.id])

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
    <header
      className="sticky top-0 z-40 px-4 h-12 flex items-center gap-3 border-b border-white/[0.08]"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}
    >
      {/* Board selector */}
      <div className="flex items-center gap-0 flex-1 min-w-0" ref={menuRef}>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center gap-2 text-[13px] tracking-[-0.08px] px-3 py-1.5 rounded-lg border transition-colors duration-150 ${
              menuOpen
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/10 hover:border-white/20 text-white/80 hover:text-white'
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
            <div className="absolute left-0 top-full mt-1 z-50 border border-white/10 rounded-xl min-w-[220px] overflow-hidden" style={{ background: '#1c1c1e', boxShadow: 'rgba(0,0,0,0.5) 0px 8px 30px 0px' }}>
              {boards.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-xs text-white/40 font-medium uppercase tracking-wide">
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
                      className={`flex items-center w-full text-left px-3 py-2 text-[13px] transition-colors duration-100 ${
                        b.id === currentBoard?.id
                          ? 'bg-white/10 font-medium text-white'
                          : 'text-white/70 hover:bg-white/[0.06]'
                      }`}
                    >
                      {b.id === currentBoard?.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] mr-2.5 shrink-0" />
                      )}
                      {b.id !== currentBoard?.id && (
                        <span className="w-1.5 h-1.5 mr-2.5 shrink-0" />
                      )}
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-white/10 my-1" />
                </>
              )}

              <button
                onClick={() => {
                  onCreateBoard()
                  setMenuOpen(false)
                }}
                className="flex items-center w-full text-left px-3 py-2 text-[13px] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors duration-100 gap-2"
              >
                <span className="text-[#0071e3]">+</span>
                New board
              </button>
              <button
                onClick={() => {
                  onJoinBoard()
                  setMenuOpen(false)
                }}
                className="flex items-center w-full text-left px-3 py-2 text-[13px] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors duration-100 gap-2 mb-1"
              >
                <span className="text-[#0071e3]">→</span>
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
                  className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold select-none border-2 ${onlineUserIds.has(member.user_id) ? 'border-emerald-400' : 'border-[#1c1c1e]'} ${colorClass}`}
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
            className="text-[13px] text-white/50 hover:text-white/90 transition-colors duration-150 whitespace-nowrap border border-white/10 hover:border-white/20 rounded-lg px-3 py-1"
          >
            Done history
          </Link>
        )}

        {/* Join code */}
        {currentBoard && (
          <div className="relative" ref={joinCodeRef}>
            <button
              onClick={() => setJoinCodeOpen((v) => !v)}
              className={`text-[13px] transition-colors duration-150 whitespace-nowrap border rounded-lg px-3 py-1 ${
                joinCodeOpen
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/10 hover:border-white/20 text-white/50 hover:text-white/90'
              }`}
              title="Show join code"
            >
              Join code
            </button>
            {joinCodeOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 border border-white/10 rounded-xl w-56 p-3" style={{ background: '#1c1c1e', boxShadow: 'rgba(0,0,0,0.5) 0px 8px 30px 0px' }}>
                <p className="text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">Board join code</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-mono text-sm bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 select-all text-white tracking-widest">
                    {currentBoard.join_code}
                  </span>
                  <button
                    onClick={handleCopyJoinCode}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors duration-150 font-medium shrink-0 ${
                      copied
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'border-white/10 hover:border-white/20 text-white/60 hover:text-white'
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
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold select-none transition-all duration-150 ${
              userMenuOpen
                ? 'bg-white/20 text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/15'
            }`}
            title={displayName}
          >
            {initials || '?'}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 border border-white/10 rounded-xl w-56 overflow-hidden py-1" style={{ background: '#1c1c1e', boxShadow: 'rgba(0,0,0,0.5) 0px 8px 30px 0px' }}>
              {/* Email */}
              <div className="px-4 py-2.5 border-b border-white/10">
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setUserMenuOpen(false); handleLogout() }}
                className="w-full text-left px-4 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors duration-150"
              >
                Log out
              </button>
              <button
                onClick={checkDeleteAccount}
                className="w-full text-left px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors duration-150"
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
