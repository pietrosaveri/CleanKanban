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
  isColumnDragging: boolean
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
  isColumnDragging,
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
      className={`relative bg-white border rounded-xl p-2 group transition-all duration-300 ${
        isDragging
          ? 'opacity-40 border-gray-300 shadow-none'
          : leaving
          ? 'opacity-0 scale-95'
          : 'border-gray-200 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing'
      }`}
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
        if (isColumnDragging) return   // let column drag events bubble to Column
        e.stopPropagation()
        onDragOverAsTarget()
      }}
      onDrop={(e) => {
        e.preventDefault()
        if (isColumnDragging) return
        e.stopPropagation()
        onDropOnTask()
      }}
    >
      <div className="flex items-start gap-2">
        {/* ── Done circle ── */}
        <button
          onClick={(e) => { e.stopPropagation(); handleComplete() }}
          title="Mark as done"
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            completing
              ? 'border-black bg-black scale-110'
              : 'border-gray-300 hover:border-gray-600 hover:scale-105 cursor-pointer'
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
              className="w-full text-sm bg-transparent outline-none resize-none cursor-text select-text"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-sm whitespace-pre-wrap break-words cursor-pointer"
              onClick={() => !completing && setEditing(true)}
            >
              {task.text}
            </p>
          )}

          {/* Animated strikethrough */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 h-px bg-gray-500 pointer-events-none"
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
          className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-base leading-none transition-all duration-100 cursor-pointer"
        >
          ×
        </button>
      </div>
    </div>
  )
}
