'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Board, Column, Task } from '@/types'
import ColumnComponent from './Column'

export interface DnDState {
  draggingColId: string | null
  dragOverColId: string | null
  draggingTaskId: string | null
  dragOverTaskId: string | null
  dragOverColForTask: string | null
}

interface BoardProps {
  board: Board
  columns: Column[]
  tasks: Task[]
  onColumnDeleted: (id: string) => void
  onTaskDeleted: (id: string) => void
}

export default function BoardView({ board, columns, tasks, onColumnDeleted, onTaskDeleted }: BoardProps) {
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position)

  const [draggingColId, setDraggingColId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [dragOverColForTask, setDragOverColForTask] = useState<string | null>(null)

  const addColumn = async () => {
    const supabase = createClient()
    const maxPos = columns.length > 0 ? Math.max(...columns.map((c) => c.position)) + 1 : 0
    await supabase.from('columns').insert({
      board_id: board.id,
      name: 'New column',
      position: maxPos,
    })
  }

  const clearDrag = () => {
    setDraggingColId(null)
    setDragOverColId(null)
    setDraggingTaskId(null)
    setDragOverTaskId(null)
    setDragOverColForTask(null)
  }

  // ── Column DnD ────────────────────────────────────────────────
  const handleColDragStart = (colId: string) => {
    setDraggingColId(colId)
  }

  const handleColDragOver = (colId: string) => {
    if (!draggingColId || draggingColId === colId) return
    setDragOverColId(colId)
  }

  const handleColDrop = async (targetColId: string) => {
    const id = draggingColId
    clearDrag()
    if (!id || id === targetColId) return
    const draggedCol = columns.find((c) => c.id === id)
    const targetCol = columns.find((c) => c.id === targetColId)
    if (!draggedCol || !targetCol) return
    const supabase = createClient()
    await Promise.all([
      supabase.from('columns').update({ position: targetCol.position }).eq('id', id),
      supabase.from('columns').update({ position: draggedCol.position }).eq('id', targetColId),
    ])
  }

  // ── Task DnD ──────────────────────────────────────────────────
  const handleTaskDragStart = (taskId: string) => {
    setDraggingTaskId(taskId)
  }

  const handleTaskDragOverTask = (taskId: string) => {
    setDragOverTaskId(taskId)
    setDragOverColForTask(null)
  }

  const handleTaskDragOverColEnd = (colId: string) => {
    setDragOverTaskId(null)
    setDragOverColForTask(colId)
  }

  const handleTaskDrop = async (targetColId: string, beforeTaskId: string | null) => {
    const taskId = draggingTaskId
    clearDrag()
    if (!taskId) return
    const draggedTask = tasks.find((t) => t.id === taskId)
    if (!draggedTask) return
    const sourceColId = draggedTask.column_id

    const targetColTasks = tasks
      .filter((t) => t.column_id === targetColId && t.id !== taskId)
      .sort((a, b) => a.position - b.position)

    const rawIdx = beforeTaskId !== null ? targetColTasks.findIndex((t) => t.id === beforeTaskId) : -1
    const insertIdx = rawIdx === -1 ? targetColTasks.length : rawIdx

    const newTargetOrder = [
      ...targetColTasks.slice(0, insertIdx),
      { ...draggedTask, column_id: targetColId },
      ...targetColTasks.slice(insertIdx),
    ]

    const supabase = createClient()
    const updates: PromiseLike<unknown>[] = []

    newTargetOrder.forEach((t, i) => {
      const isMovedTask = t.id === taskId
      const colChanged = isMovedTask && sourceColId !== targetColId
      const posChanged = t.position !== i
      if (colChanged || posChanged) {
        updates.push(
          supabase
            .from('tasks')
            .update({ position: i, ...(colChanged ? { column_id: targetColId } : {}) })
            .eq('id', t.id)
        )
      }
    })

    if (sourceColId !== targetColId) {
      tasks
        .filter((t) => t.column_id === sourceColId && t.id !== taskId)
        .sort((a, b) => a.position - b.position)
        .forEach((t, i) => {
          if (t.position !== i) {
            updates.push(supabase.from('tasks').update({ position: i }).eq('id', t.id))
          }
        })
    }

    if (updates.length > 0) await Promise.all(updates)
  }

  const dndState: DnDState = {
    draggingColId,
    dragOverColId,
    draggingTaskId,
    dragOverTaskId,
    dragOverColForTask,
  }

  return (
    <div className="flex items-start gap-3 p-5 overflow-x-auto min-h-[calc(100vh-48px)]">
      {sortedColumns.map((column) => (
        <ColumnComponent
          key={column.id}
          column={column}
          columns={sortedColumns}
          tasks={tasks.filter((t) => t.column_id === column.id)}
          board={board}
          onColumnDeleted={onColumnDeleted}
          onTaskDeleted={onTaskDeleted}
          dndState={dndState}
          onColDragStart={handleColDragStart}
          onColDragOver={handleColDragOver}
          onColDragLeave={() => setDragOverColId(null)}
          onColDrop={handleColDrop}
          onTaskDragStart={handleTaskDragStart}
          onTaskDragOverTask={handleTaskDragOverTask}
          onTaskDragOverColEnd={handleTaskDragOverColEnd}
          onTaskDrop={handleTaskDrop}
          onDragEnd={clearDrag}
        />
      ))}

      <button
        onClick={addColumn}
        className="flex-shrink-0 w-72 h-12 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-all duration-200"
      >
        + Add column
      </button>
    </div>
  )
}
