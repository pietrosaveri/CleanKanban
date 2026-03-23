'use client'

import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Board, Column, Task } from '@/types'
import TaskComponent from './Task'
import type { DnDState } from './Board'

interface ColumnProps {
  column: Column
  columns: Column[]
  tasks: Task[]
  board: Board
  onColumnDeleted: (id: string) => void
  onTaskDeleted: (id: string) => void
  dndState: DnDState
  onColDragStart: (colId: string) => void
  onColDragOver: (colId: string) => void
  onColDragLeave: () => void
  onColDrop: (colId: string) => void
  onTaskDragStart: (taskId: string) => void
  onTaskDragOverTask: (taskId: string) => void
  onTaskDragOverColEnd: (colId: string) => void
  onTaskDrop: (colId: string, beforeTaskId: string | null) => void
  onDragEnd: () => void
}

export default function ColumnComponent({
  column,
  columns,
  tasks,
  board,
  onColumnDeleted,
  onTaskDeleted,
  dndState,
  onColDragStart,
  onColDragOver,
  onColDragLeave,
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

  // Sync column name when updated via realtime
  useEffect(() => {
    if (!editingName) setColumnName(column.name)
  }, [column.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)

  const isDraggingThisCol = dndState.draggingColId === column.id
  const isDragTargetCol = dndState.dragOverColId === column.id

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

  const deleteColumn = async () => {
    const count = tasks.length
    const msg =
      count > 0
        ? `Delete "${column.name}" and its ${count} task${count > 1 ? 's' : ''}?`
        : `Delete column "${column.name}"?`
    if (!confirm(msg)) return
    // Optimistic: update parent state immediately
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
    <div
      className={`flex-shrink-0 w-64 flex flex-col bg-gray-50 rounded border transition-all duration-150 ${
        isDraggingThisCol
          ? 'opacity-40 border-blue-300'
          : isDragTargetCol
          ? 'border-blue-500 ring-1 ring-blue-500'
          : 'border-gray-200'
      }`}
      onDragOver={(e) => {
        if (dndState.draggingColId && dndState.draggingColId !== column.id) {
          e.preventDefault()
          onColDragOver(column.id)
        } else if (dndState.draggingTaskId) {
          e.preventDefault()
          onTaskDragOverColEnd(column.id)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          if (dndState.draggingColId) onColDragLeave()
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        if (dndState.draggingColId) {
          onColDrop(column.id)
        } else if (dndState.draggingTaskId) {
          onTaskDrop(column.id, null)
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-200">
        {/* Drag handle */}
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 select-none text-base leading-none mr-0.5"
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.effectAllowed = 'move'
            onColDragStart(column.id)
          }}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
        >
          ⠿
        </span>

        {editingName ? (
          <input
            autoFocus
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            onBlur={renameColumn}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameColumn()
              if (e.key === 'Escape') {
                setColumnName(column.name)
                setEditingName(false)
              }
            }}
            className="flex-1 text-sm font-medium bg-transparent outline-none border-b border-black min-w-0"
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium cursor-pointer truncate"
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {column.name}
          </span>
        )}

        <span className="text-xs text-gray-300 shrink-0">{tasks.length}</span>
        <button
          onClick={deleteColumn}
          className="text-xs text-gray-400 hover:text-red-600 transition-colors duration-100 px-0.5"
          title="Delete column"
        >
          ×
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 px-2 pt-2 overflow-y-auto max-h-[calc(100vh-120px)]">
        {sortedTasks.map((task) => (
          <Fragment key={task.id}>
            {/* Drop indicator: blue line above this task when drag target */}
            <div
              className={`h-0.5 rounded-full mx-1 transition-all duration-100 ${
                dndState.dragOverTaskId === task.id && dndState.draggingTaskId
                  ? 'bg-blue-500 mb-1'
                  : 'bg-transparent'
              }`}
              onDragOver={(e) => {
                if (dndState.draggingTaskId) {
                  e.preventDefault()
                  e.stopPropagation()
                  onTaskDragOverTask(task.id)
                }
              }}
              onDrop={(e) => {
                if (dndState.draggingTaskId) {
                  e.preventDefault()
                  e.stopPropagation()
                  onTaskDrop(column.id, task.id)
                }
              }}
            />
            <div className="mb-2">
              <TaskComponent
                task={task}
                column={column}
                onTaskDeleted={onTaskDeleted}
                isDragging={dndState.draggingTaskId === task.id}
                isDragTarget={dndState.dragOverTaskId === task.id}
                onDragStart={() => onTaskDragStart(task.id)}
                onDragEnd={onDragEnd}
                onDragOverAsTarget={() => {
                  if (dndState.draggingTaskId) onTaskDragOverTask(task.id)
                }}
                onDropOnTask={() => {
                  if (dndState.draggingTaskId) onTaskDrop(column.id, task.id)
                }}
              />
            </div>
          </Fragment>
        ))}

        {/* End-of-column drop zone */}
        <div
          className={`min-h-[32px] rounded mb-2 transition-all duration-100 ${
            dndState.dragOverColForTask === column.id &&
            !dndState.dragOverTaskId &&
            dndState.draggingTaskId
              ? 'border border-dashed border-blue-300 bg-blue-50'
              : ''
          }`}
          onDragOver={(e) => {
            if (dndState.draggingTaskId) {
              e.preventDefault()
              e.stopPropagation()
              onTaskDragOverColEnd(column.id)
            }
          }}
          onDrop={(e) => {
            if (dndState.draggingTaskId) {
              e.preventDefault()
              e.stopPropagation()
              onTaskDrop(column.id, null)
            }
          }}
        />

        {/* Add task form */}
        {addingTask ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addTask()
                }
                if (e.key === 'Escape') {
                  setNewTaskText('')
                  setAddingTask(false)
                }
              }}
              placeholder="Task text..."
              rows={2}
              className="w-full text-sm p-2 border border-gray-300 rounded resize-none outline-none focus:border-black transition-colors duration-100 bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={addTask}
                className="text-xs border border-black px-2 py-0.5 rounded hover:bg-black hover:text-white transition-colors duration-150"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setNewTaskText('')
                  setAddingTask(false)
                }}
                className="text-xs text-gray-400 hover:text-black transition-colors duration-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="w-full text-left text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors duration-100"
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  )
}
