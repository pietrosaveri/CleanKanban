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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[3px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="border border-white/10 rounded-2xl w-80 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ background: '#1c1c1e', boxShadow: 'rgba(0,0,0,0.6) 0px 20px 60px 0px' }}
      >
        <div className="px-6 pt-6 pb-5">
          <p className="text-[15px] font-semibold text-white leading-snug tracking-[-0.2px]">{message}</p>
          {subMessage && (
            <p className="mt-1.5 text-[13px] text-white/50 leading-relaxed">{subMessage}</p>
          )}
        </div>
        <div className="border-t border-white/10 flex divide-x divide-white/10">
          <button
            autoFocus
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm text-white/50 hover:bg-white/[0.06] transition-colors duration-150 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors duration-150 ${
              danger
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-[#0071e3] hover:bg-[#0071e3]/10'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
