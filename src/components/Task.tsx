'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Column, Task } from '@/types'

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

  const markDone = async () => {
    // Optimistic: remove from active tasks immediately
    onTaskDeleted(task.id)
    const supabase = createClient()
    await supabase
      .from('tasks')
      .update({
        done: true,
        done_at: new Date().toISOString(),
        done_from_column: column.name,
      })
      .eq('id', task.id)
  }

  // ── render ────────────────────────────────────────────────────
  return (
    <div
      className={`relative bg-white border rounded p-2 group transition-all duration-100 ${
        isDragging
          ? 'opacity-40 border-blue-300 shadow-sm'
          : 'border-gray-200 cursor-grab active:cursor-grabbing'
      }`}
      draggable={!editing}
      onDragStart={(e) => {
        if (editing) {
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
        <div className="absolute -top-px left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
      )}

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
          className="text-sm cursor-pointer whitespace-pre-wrap break-words"
          onClick={() => setEditing(true)}
        >
          {task.text}
        </p>
      )}

      {/* Action bar — visible on hover */}
      <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
        <button
          onClick={markDone}
          className="text-xs text-gray-400 hover:text-black transition-colors duration-100"
          title="Mark as done"
        >
          done
        </button>

        <button
          onClick={deleteTask}
          className="text-xs text-gray-400 hover:text-red-600 ml-auto transition-colors duration-100"
          title="Delete task"
        >
          ×
        </button>
      </div>
    </div>
  )
}
