'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import type { Board, Column, Task } from '@/types'
import ColumnComponent from './Column'

export interface DnDState {
  draggingColId: string | null
  dragInsertIdx: number | null
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
  const [dragInsertIdx, setDragInsertIdx] = useState<number | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [dragOverColForTask, setDragOverColForTask] = useState<string | null>(null)
  // Holds the reordered columns immediately after a drop so the UI doesn't
  // flash back to the original order while waiting for the realtime update.
  const [optimisticColumns, setOptimisticColumns] = useState<Column[] | null>(null)

  // Once Supabase realtime delivers the confirmed positions, drop the
  // optimistic override so we render from the source of truth again.
  useEffect(() => {
    setOptimisticColumns(null)
  }, [columns])

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
    setDragInsertIdx(null)
    setDraggingTaskId(null)
    setDragOverTaskId(null)
    setDragOverColForTask(null)
  }

  // ── Column DnD ────────────────────────────────────────────────
  const handleColDragStart = (colId: string) => {
    setDraggingColId(colId)
  }

  const handleColDragOver = (insertIdx: number) => {
    setDragInsertIdx(insertIdx)
  }

  const handleColDrop = async () => {
    const id = draggingColId
    const insertIdx = dragInsertIdx
    clearDrag()
    if (!id || insertIdx === null) return
    const sorted = [...columns].sort((a, b) => a.position - b.position)
    const draggingIdx = sorted.findIndex((c) => c.id === id)
    if (draggingIdx === -1) return
    const without = sorted.filter((c) => c.id !== id)
    const adjustedIdx = Math.min(
      insertIdx > draggingIdx ? insertIdx - 1 : insertIdx,
      without.length
    )
    without.splice(adjustedIdx, 0, sorted[draggingIdx])
    if (without.every((col, i) => col.id === sorted[i]?.id)) return
    // Apply immediately so the UI stays in place while the DB round-trip happens
    setOptimisticColumns([...without])
    const supabase = createClient()
    await Promise.all(
      without.map((col, i) => supabase.from('columns').update({ position: i }).eq('id', col.id))
    )
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
    dragInsertIdx,
    draggingTaskId,
    dragOverTaskId,
    dragOverColForTask,
  }

  // Compute live preview order while dragging a column.
  // Uses the same index-adjustment logic as handleColDrop so the preview
  // always matches what will actually be saved on drop.
  // Fall back to optimisticColumns (post-drop) then sortedColumns (confirmed).
  let displayColumns = optimisticColumns ?? sortedColumns
  if (draggingColId && dragInsertIdx !== null) {
    const draggingIdx = sortedColumns.findIndex((c) => c.id === draggingColId)
    if (draggingIdx !== -1) {
      const without = sortedColumns.filter((c) => c.id !== draggingColId)
      const adjustedIdx = Math.min(
        dragInsertIdx > draggingIdx ? dragInsertIdx - 1 : dragInsertIdx,
        without.length
      )
      const reordered = [...without]
      reordered.splice(adjustedIdx, 0, sortedColumns[draggingIdx])
      displayColumns = reordered
    }
  }

  return (
    <div
      className="flex items-start gap-3 p-5 overflow-x-auto min-h-[calc(100vh-48px)] bg-black"
      onDragOver={(e) => { if (draggingColId) e.preventDefault() }}
      onDrop={(e) => { if (draggingColId) { e.preventDefault(); handleColDrop() } }}
    >
      {displayColumns.map((column, index) => (
        <ColumnComponent
          key={column.id}
          column={column}
          colIndex={index}
          tasks={tasks.filter((t) => t.column_id === column.id)}
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
        className="flex-shrink-0 w-72 h-12 border-2 border-dashed border-white/10 rounded-2xl text-[13px] text-white/30 hover:border-white/20 hover:text-white/60 transition-all duration-200"
      >
        + Add column
      </button>
    </div>
  )
}
