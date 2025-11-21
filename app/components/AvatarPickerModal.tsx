"use client"

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { LuX, LuCheck } from 'react-icons/lu'

interface AvatarPickerModalProps {
  open: boolean
  onClose: () => void
}

const AVATAR_IMAGES = Array.from({ length: 19 }, (_, i) => `/images/${i + 1}.svg`)

export default function AvatarPickerModal({ open, onClose }: AvatarPickerModalProps) {
  const { user, refreshUser } = useAuth() as any
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !user) return
    setError('')
    const current =
      (user as any).avatar_url ||
      (user as any).profile_image_url ||
      (user as any).photo_url ||
      '/images/6.svg'
    setSelected(current)
  }, [open, user])

  if (!open || !user) return null

  const handleSave = async () => {
    if (!selected) return
    try {
      setSaving(true)
      setError('')
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: selected })
        .eq('id', user.id)

      if (error) throw error
      if (typeof refreshUser === 'function') {
        await refreshUser()
      }
      onClose()
    } catch (e: any) {
      setError(e.message || 'Failed to update avatar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-950 rounded-t-3xl border border-b-0 border-slate-800 shadow-2xl flex flex-col h-[calc(100vh-4rem)] animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-slate-50">Choose Avatar</p>
            <p className="text-xs text-slate-400">Set how you appear in the game</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
            aria-label="Close"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 rounded-full bg-cyan-500 flex items-center justify-center overflow-hidden shadow-lg">
              {selected && (
                <Image
                  src={selected}
                  alt="Selected avatar"
                  width={96}
                  height={96}
                  className="w-20 h-20"
                />
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-700 rounded-lg p-2.5 text-xs text-red-100">
              {error}
            </div>
          )}

          {/* Avatar grid */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 mb-2">CHOOSE AVATAR</p>
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_IMAGES.map((src) => {
                const active = selected === src
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSelected(src)}
                    className={`relative rounded-full p-0.5 transition-colors ${
                      active ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950' : 'hover:ring-2 hover:ring-slate-600 hover:ring-offset-2 hover:ring-offset-slate-950'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                      <Image src={src} alt="Avatar" width={56} height={56} className="w-12 h-12" />
                    </div>
                    {active && (
                      <div className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                        <LuCheck className="w-3 h-3 text-slate-900" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selected}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-2.5 rounded-full text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Set My Profile</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
