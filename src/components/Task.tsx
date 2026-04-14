'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Column, Task } from '@/types'

// Approximate SVG path length for M1 4L3.5 6.5L9 1
const TICK_PATH_LEN = 13

interface TaskProps {
  task: Task
  column: Column
  onTaskDeleted: (id: string) => void
  isDragging: boolean
  isDragTarget: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOverAsTarget: () => void
  onDropOnTask: () => void
}

export default function TaskComponent({
  task,
  column,
  onTaskDeleted,
  isDragging,
  isDragTarget,
  onDragStart,
  onDragEnd,
  onDragOverAsTarget,
  onDropOnTask,
}: TaskProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.text)
  const [completing, setCompleting] = useState(false)
  const [striking, setStriking] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Sync text from realtime updates
  useEffect(() => {
    if (!editing) setText(task.text)
  }, [task.text]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── mutations ────────────────────────────────────────────────
  const saveText = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setText(task.text)
      setEditing(false)
      return
    }
    const supabase = createClient()
    await supabase.from('tasks').update({ text: trimmed }).eq('id', task.id)
    setEditing(false)
  }

  const deleteTask = async () => {
    // Optimistic: remove from parent state immediately
    onTaskDeleted(task.id)
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', task.id)
  }

  const handleComplete = async () => {
    if (completing) return
    setCompleting(true)

    // Start animation timers immediately so they're not blocked by the DB round-trip
    // tick draws in (0–300ms) → strikethrough (300–650ms) → fade (700–950ms) → remove
    setTimeout(() => setStriking(true), 300)
    setTimeout(() => setLeaving(true), 700)
    setTimeout(() => onTaskDeleted(task.id), 1000)

    // Await is required: PostgrestBuilder is a lazy PromiseLike — without it the
    // HTTP fetch never runs and the DB is never updated.
    const supabase = createClient()
    await supabase.from('tasks').update({
      done: true,
      done_at: new Date().toISOString(),
      done_from_column: column.name,
    }).eq('id', task.id)
  }

  // ── render ────────────────────────────────────────────────────
  return (
    <div
      className={`relative rounded-xl p-2.5 group transition-all duration-300 ${
        isDragging
          ? 'opacity-30 shadow-none'
          : leaving
          ? 'opacity-0 scale-95'
          : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        background: '#2c2c2e',
        boxShadow: isDragging || leaving ? 'none' : 'rgba(0,0,0,0.35) 0px 1px 5px 0px',
      }}
      draggable={!editing && !completing}
      onDragStart={(e) => {
        if (editing || completing) {
          e.preventDefault()
          return
        }
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragOverAsTarget()
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDropOnTask()
      }}
    >
      {/* Insert-before indicator */}
      {isDragTarget && !isDragging && (
          <div className="absolute -top-px left-0 right-0 h-0.5 bg-[#0071e3] rounded-full z-10" />
      )}

      <div className="flex items-start gap-2">
        {/* ── Done circle ── */}
        <button
          onClick={(e) => { e.stopPropagation(); handleComplete() }}
          title="Mark as done"
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            completing
              ? 'border-[#0071e3] bg-[#0071e3] scale-110'
              : 'border-white/25 hover:border-white/50 hover:scale-105 cursor-pointer'
          }`}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: TICK_PATH_LEN,
                strokeDashoffset: completing ? 0 : TICK_PATH_LEN,
                transition: 'stroke-dashoffset 0.28s ease 0.04s',
              }}
            />
          </svg>
        </button>

        {/* ── Task text ── */}
        <div className="flex-1 min-w-0 relative">
          {editing ? (
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={saveText}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveText()
                }
                if (e.key === 'Escape') {
                  setText(task.text)
                  setEditing(false)
                }
              }}
              rows={2}
              className="w-full text-[13px] text-white bg-transparent outline-none resize-none cursor-text select-text tracking-[-0.08px]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-[13px] text-white whitespace-pre-wrap break-words cursor-pointer tracking-[-0.08px]"
              onClick={() => !completing && setEditing(true)}
            >
              {task.text}
            </p>
          )}

          {/* Animated strikethrough */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 h-px bg-white/50 pointer-events-none"
            style={{
              width: striking ? '100%' : '0%',
              transition: striking ? 'width 0.35s ease-in-out' : 'none',
            }}
          />
        </div>

        {/* ── Delete × ── */}
        <button
          onClick={(e) => { e.stopPropagation(); deleteTask() }}
          title="Delete task"
          className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 text-base leading-none transition-all duration-100 cursor-pointer"
        >
          ×
        </button>
      </div>
    </div>
  )
}
