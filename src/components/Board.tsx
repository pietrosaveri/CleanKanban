'use client'

import { useEffect, useState } from 'react'
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
  // Holds the reordered columns immediately after a drop so the UI doesn't
  // flash back to the original order while waiting for the realtime update.
  const [optimisticColumns, setOptimisticColumns] = useState<Column[] | null>(null)
  // Same for tasks.
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null)

  // Once Supabase realtime delivers the confirmed positions, drop the
  // optimistic override so we render from the source of truth again.
  // Guard: don't clear while a column drag is in progress or the UI will flash.
  useEffect(() => {
    if (!draggingColId) setOptimisticColumns(null)
  }, [columns, draggingColId])

  useEffect(() => {
    setOptimisticTasks(null)
  }, [tasks])

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
    if (dragOverColId !== colId) setDragOverColId(colId)
  }

  const handleColDrop = async () => {
    const id = draggingColId
    const overColId = dragOverColId
    clearDrag()
    if (!id || !overColId || id === overColId) return
    const sorted = [...columns].sort((a, b) => a.position - b.position)
    const draggingIdx = sorted.findIndex((c) => c.id === id)
    if (draggingIdx === -1) return
    const without = sorted.filter((c) => c.id !== id)
    const targetIdx = without.findIndex((c) => c.id === overColId)
    if (targetIdx === -1) return
    const reordered = [...without]
    reordered.splice(targetIdx, 0, sorted[draggingIdx])
    if (reordered.every((col, i) => col.id === sorted[i]?.id)) return
    // Apply immediately so the UI stays in place while the DB round-trip happens
    setOptimisticColumns([...reordered])
    const supabase = createClient()
    await Promise.all(
      reordered.map((col, i) => supabase.from('columns').update({ position: i }).eq('id', col.id))
    )
  }

  // ── Task DnD ──────────────────────────────────────────────────
  const handleTaskDragStart = (taskId: string) => {
    setDraggingTaskId(taskId)
  }

  const handleTaskDragOverTask = (taskId: string) => {
    if (dragOverTaskId !== taskId) setDragOverTaskId(taskId)
    if (dragOverColForTask !== null) setDragOverColForTask(null)
  }

  const handleTaskDragOverColEnd = (colId: string) => {
    if (dragOverTaskId !== null) setDragOverTaskId(null)
    if (dragOverColForTask !== colId) setDragOverColForTask(colId)
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

    // Apply optimistic update immediately so the UI doesn't snap back
    // while waiting for the DB round-trip + realtime confirmation.
    const newTaskPositions = new Map<string, { position: number; column_id: string }>()
    newTargetOrder.forEach((t, i) => {
      newTaskPositions.set(t.id, { position: i, column_id: targetColId })
    })
    if (sourceColId !== targetColId) {
      tasks
        .filter((t) => t.column_id === sourceColId && t.id !== taskId)
        .sort((a, b) => a.position - b.position)
        .forEach((t, i) => {
          newTaskPositions.set(t.id, { position: i, column_id: sourceColId })
        })
    }
    setOptimisticTasks(tasks.map((t) => {
      const update = newTaskPositions.get(t.id)
      return update ? { ...t, ...update } : t
    }))

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

  // Compute live preview order while dragging a column.
  // As soon as the cursor enters any part of a column, it immediately slides
  // out of the way — the dragged column takes the hovered column's exact slot.
  // Fall back to optimisticColumns (post-drop) then sortedColumns (confirmed).
  const displayTasks = optimisticTasks ?? tasks
  let displayColumns = optimisticColumns ?? sortedColumns
  if (draggingColId && dragOverColId && draggingColId !== dragOverColId) {
    const draggingIdx = sortedColumns.findIndex((c) => c.id === draggingColId)
    if (draggingIdx !== -1) {
      const without = sortedColumns.filter((c) => c.id !== draggingColId)
      const targetIdx = without.findIndex((c) => c.id === dragOverColId)
      if (targetIdx !== -1) {
        const reordered = [...without]
        reordered.splice(targetIdx, 0, sortedColumns[draggingIdx])
        displayColumns = reordered
      }
    }
  }

  return (
    <div
      className="flex items-start gap-3 p-5 overflow-x-auto min-h-[calc(100vh-48px)] bg-gray-50"
      onDragOver={(e) => { if (draggingColId) e.preventDefault() }}
      onDrop={(e) => { if (draggingColId) { e.preventDefault(); handleColDrop() } }}
    >
      {displayColumns.map((column, index) => (
        <ColumnComponent
          key={column.id}
          column={column}
          colIndex={index}
          tasks={displayTasks.filter((t) => t.column_id === column.id)}
          board={board}
          onColumnDeleted={onColumnDeleted}
          onTaskDeleted={onTaskDeleted}
          dndState={dndState}
          onColDragStart={handleColDragStart}
          onColDragOver={handleColDragOver}
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
        className="flex-shrink-0 w-72 h-12 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-gray-400 hover:border-gray-500 hover:text-gray-700 hover:bg-white transition-all duration-200"
      >
        + Add column
      </button>
    </div>
  )
}
