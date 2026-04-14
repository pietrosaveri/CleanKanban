'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Board, Column, Task } from '@/types'
import TaskComponent from './Task'
import ConfirmModal from './ConfirmModal'
import type { DnDState } from './Board'

interface ColumnProps {
  column: Column
  colIndex: number
  tasks: Task[]
  board: Board
  onColumnDeleted: (id: string) => void
  onTaskDeleted: (id: string) => void
  dndState: DnDState
  onColDragStart: (colId: string) => void
  onColDragOver: (insertIdx: number) => void
  onColDrop: () => void
  onTaskDragStart: (taskId: string) => void
  onTaskDragOverTask: (taskId: string) => void
  onTaskDragOverColEnd: (colId: string) => void
  onTaskDrop: (colId: string, beforeTaskId: string | null) => void
  onDragEnd: () => void
}

export default function ColumnComponent({
  column,
  colIndex,
  tasks,
  board,
  onColumnDeleted,
  onTaskDeleted,
  dndState,
  onColDragStart,
  onColDragOver,
  onColDrop,
  onTaskDragStart,
  onTaskDragOverTask,
  onTaskDragOverColEnd,
  onTaskDrop,
  onDragEnd,
}: ColumnProps) {
  const [editingName, setEditingName] = useState(false)
  const [columnName, setColumnName] = useState(column.name)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)
  const colRef = useRef<HTMLDivElement>(null)

  // Sync column name when updated via realtime
  useEffect(() => {
    if (!editingName) setColumnName(column.name)
  }, [column.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)
  const isDraggingThisCol = dndState.draggingColId === column.id

  // ── mutations ─────────────────────────────────────────────────
  const renameColumn = async () => {
    const trimmed = columnName.trim()
    if (!trimmed) {
      setColumnName(column.name)
      setEditingName(false)
      return
    }
    const supabase = createClient()
    await supabase.from('columns').update({ name: trimmed }).eq('id', column.id)
    setEditingName(false)
  }

  const confirmDelete = async () => {
    setPendingDelete(false)
    onColumnDeleted(column.id)
    const supabase = createClient()
    await supabase.from('columns').delete().eq('id', column.id)
  }

  const addTask = async () => {
    const trimmed = newTaskText.trim()
    if (!trimmed) return
    const maxPos = tasks.length > 0 ? Math.max(...tasks.map((t) => t.position)) + 1 : 0
    const supabase = createClient()
    await supabase.from('tasks').insert({
      board_id: board.id,
      column_id: column.id,
      text: trimmed,
      position: maxPos,
      done: false,
    })
    setNewTaskText('')
    setAddingTask(false)
  }

  // ── render ────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={colRef}
        className={`flex-shrink-0 w-72 flex flex-col rounded-2xl transition-all duration-200 select-none ${
          isDraggingThisCol
            ? 'opacity-40 bg-[#1c1c1e] ring-2 ring-[#0071e3] ring-offset-2 ring-offset-black shadow-none'
            : 'bg-[#1c1c1e]'
        }`}
        onDragOver={(e) => {
          if (dndState.draggingColId && dndState.draggingColId !== column.id) {
            e.preventDefault()
            e.stopPropagation()
            const rect = colRef.current?.getBoundingClientRect()
            if (rect) {
              const isLeftHalf = e.clientX < rect.left + rect.width / 2
              onColDragOver(isLeftHalf ? colIndex : colIndex + 1)
            }
          } else if (dndState.draggingTaskId) {
            e.preventDefault()
            onTaskDragOverColEnd(column.id)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dndState.draggingColId) {
            onColDrop()
          } else if (dndState.draggingTaskId) {
            onTaskDrop(column.id, null)
          }
        }}
      >
        {/* Column drag handle */}
        <div
          draggable={!editingName && !addingTask}
          onDragStart={(e) => {
            if (editingName || addingTask) { e.preventDefault(); return }
            e.dataTransfer.effectAllowed = 'move'
            if (colRef.current) e.dataTransfer.setDragImage(colRef.current, 130, 20)
            onColDragStart(column.id)
          }}
          onDragEnd={onDragEnd}
          className="mx-3 mt-2.5 h-1.5 rounded-full bg-white/10 hover:bg-white/20 cursor-grab active:cursor-grabbing transition-colors duration-150"
        />

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3">
          {editingName ? (
            <input
              autoFocus
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onBlur={renameColumn}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameColumn()
                if (e.key === 'Escape') { setColumnName(column.name); setEditingName(false) }
              }}
              className="flex-1 text-[13px] font-semibold bg-transparent outline-none border-b border-white/40 text-white min-w-0 py-0.5"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 text-[13px] font-semibold cursor-text truncate tracking-tight text-white"
              onClick={(e) => { e.stopPropagation(); setEditingName(true) }}
              title="Click to rename"
            >
              {column.name}
            </span>
          )}
          <span className="text-[11px] text-white/40 tabular-nums shrink-0 bg-white/[0.08] rounded-full px-1.5 py-0.5 font-medium">
            {tasks.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setPendingDelete(true) }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 shrink-0"
            title="Delete column"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 2.5l7 7M2.5 9.5l7 -7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/[0.08]" />

        {/* Tasks */}
        <div className="flex-1 px-3 pt-3 pb-2 overflow-y-auto max-h-[calc(100vh-160px)] space-y-2">
          {sortedTasks.map((task) => (
            <Fragment key={task.id}>
              <div
                className={`transition-all duration-100 mx-1 rounded-full ${
                  dndState.dragOverTaskId === task.id && dndState.draggingTaskId
                    ? 'h-0.5 bg-[#0071e3] my-1'
                    : 'h-0'
                }`}
                onDragOver={(e) => {
                  if (dndState.draggingTaskId) { e.preventDefault(); e.stopPropagation(); onTaskDragOverTask(task.id) }
                }}
                onDrop={(e) => {
                  if (dndState.draggingTaskId) { e.preventDefault(); e.stopPropagation(); onTaskDrop(column.id, task.id) }
                }}
              />
              <TaskComponent
                task={task}
                column={column}
                onTaskDeleted={onTaskDeleted}
                isDragging={dndState.draggingTaskId === task.id}
                isDragTarget={dndState.dragOverTaskId === task.id}
                onDragStart={() => onTaskDragStart(task.id)}
                onDragEnd={onDragEnd}
                onDragOverAsTarget={() => { if (dndState.draggingTaskId) onTaskDragOverTask(task.id) }}
                onDropOnTask={() => { if (dndState.draggingTaskId) onTaskDrop(column.id, task.id) }}
              />
            </Fragment>
          ))}

          <div
            className={`min-h-[16px] rounded-xl transition-all duration-100 ${
              dndState.dragOverColForTask === column.id && !dndState.dragOverTaskId && dndState.draggingTaskId
                ? 'border-2 border-dashed border-[#0071e3]/40 bg-[#0071e3]/5 min-h-10'
                : ''
            }`}
            onDragOver={(e) => {
              if (dndState.draggingTaskId) { e.preventDefault(); e.stopPropagation(); onTaskDragOverColEnd(column.id) }
            }}
            onDrop={(e) => {
              if (dndState.draggingTaskId) { e.preventDefault(); e.stopPropagation(); onTaskDrop(column.id, null) }
            }}
          />
        </div>

        {/* Add task */}
        <div className="px-3 pb-3">
          {addingTask ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask() }
                  if (e.key === 'Escape') { setNewTaskText(''); setAddingTask(false) }
                }}
                placeholder="What needs to be done?"
                rows={2}
                className="w-full text-[13px] text-white p-3 border border-white/10 rounded-xl resize-none outline-none focus:border-[#0071e3]/50 focus:ring-1 focus:ring-[#0071e3]/10 transition-all duration-150 bg-white/[0.06] placeholder:text-white/25"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); setNewTaskText(''); setAddingTask(false) }}
                  className="text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-lg transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); addTask() }}
                  className="text-xs font-medium bg-[#0071e3] text-white px-4 py-1.5 rounded-lg hover:bg-[#0077ed] transition-colors duration-150"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setAddingTask(true) }}
              className="w-full flex items-center justify-center gap-1.5 text-[13px] text-white/30 hover:text-white/60 py-2.5 border-2 border-dashed border-white/10 hover:border-white/20 rounded-xl transition-all duration-150 hover:bg-white/[0.03]"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add task
            </button>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmModal
          message={`Delete "${column.name}"?`}
          subMessage={
            tasks.length > 0
              ? `This will also delete ${tasks.length} task${tasks.length > 1 ? 's' : ''} inside it.`
              : undefined
          }
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(false)}
        />
      )}
    </>
  )
}
