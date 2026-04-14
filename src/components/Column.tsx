'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
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
  onColDragOver: (colId: string) => void
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
      <motion.div
        ref={colRef}
        layout
        layoutId={column.id}
        transition={isDraggingThisCol ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 35 }}
        className={`flex-shrink-0 w-72 flex flex-col rounded-2xl select-none border ${
          isDraggingThisCol
            ? 'opacity-0 bg-white border-transparent'
            : 'bg-white shadow-sm hover:shadow-md transition-colors duration-200 border-gray-200'
        }`}
        onDragOver={(e) => {
          if (dndState.draggingColId && dndState.draggingColId !== column.id) {
            e.preventDefault()
            e.stopPropagation()
            onColDragOver(column.id)
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
            if (colRef.current) {
              const rect = colRef.current.getBoundingClientRect()
              e.dataTransfer.setDragImage(
                colRef.current,
                e.clientX - rect.left,
                e.clientY - rect.top
              )
            }
            onColDragStart(column.id)
          }}
          onDragEnd={onDragEnd}
          className="mx-3 mt-2.5 h-1.5 rounded-full bg-gray-200 hover:bg-gray-300 cursor-grab active:cursor-grabbing transition-colors duration-150"
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
              className="flex-1 text-sm font-semibold bg-transparent outline-none border-b border-black min-w-0 py-0.5"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 text-sm font-semibold cursor-text truncate tracking-tight"
              onClick={(e) => { e.stopPropagation(); setEditingName(true) }}
              title="Click to rename"
            >
              {column.name}
            </span>
          )}
          <span className="text-[11px] text-gray-400 tabular-nums shrink-0 bg-gray-200/60 rounded-full px-1.5 py-0.5 font-medium">
            {tasks.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setPendingDelete(true) }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-150 shrink-0"
            title="Delete column"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 2.5l7 7M2.5 9.5l7 -7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-gray-200/80" />

        {/* Tasks */}
        <div className="flex-1 px-3 pt-3 pb-2 overflow-y-auto max-h-[calc(100vh-160px)] space-y-2">
          {sortedTasks.map((task) => (
            <Fragment key={task.id}>
              <div
                className={`transition-all duration-100 mx-1 rounded-full ${
                  dndState.dragOverTaskId === task.id && dndState.draggingTaskId
                    ? 'h-0.5 bg-black my-1'
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
                isColumnDragging={!!dndState.draggingColId}
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
                ? 'border-2 border-dashed border-gray-300 bg-gray-50 min-h-10'
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
                className="w-full text-sm p-3 border border-gray-200 rounded-xl resize-none outline-none focus:border-black focus:ring-1 focus:ring-black/5 transition-all duration-150 bg-white"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); setNewTaskText(''); setAddingTask(false) }}
                  className="text-xs text-gray-400 hover:text-black px-3 py-1.5 rounded-lg transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); addTask() }}
                  className="text-xs font-medium bg-black text-white px-4 py-1.5 rounded-lg hover:bg-gray-800 transition-colors duration-150"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setAddingTask(true) }}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 py-2.5 border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl transition-all duration-150 hover:bg-white/60"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add task
            </button>
          )}
        </div>
      </motion.div>

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
