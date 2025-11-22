"use client"

import { ReactNode } from 'react'

interface AdminConfirmModalProps {
  open: boolean
  title?: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
}

export function AdminConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
  if (!open) return null

  const confirmClasses =
    variant === 'destructive'
      ? 'bg-red-600 hover:bg-red-700 text-white border border-red-500/80'
      : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/80'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="px-5 py-4 text-sm text-slate-200">
          {typeof message === 'string' ? <p className="whitespace-pre-line">{message}</p> : message}
        </div>
        <div className="px-5 py-4 border-t border-slate-700 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 text-sm font-medium border border-slate-600 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
