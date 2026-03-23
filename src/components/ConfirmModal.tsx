'use client'

import { useEffect } from 'react'

interface ConfirmModalProps {
  message: string
  subMessage?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  message,
  subMessage,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 pt-6 pb-5">
          <p className="text-[15px] font-medium text-gray-900 leading-snug">{message}</p>
          {subMessage && (
            <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">{subMessage}</p>
          )}
        </div>
        <div className="border-t border-gray-100 flex divide-x divide-gray-100">
          <button
            autoFocus
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors duration-150 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors duration-150 ${
              danger
                ? 'text-red-500 hover:bg-red-50'
                : 'text-black hover:bg-gray-50'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
