"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Bot = {
  id: string
  name: string
  avatar?: string | null
  active: boolean
  difficulty: 'easy' | 'medium' | 'hard' | 'unbeatable'
  behavior_profile: any
  win_probability: number
  waiting_mode: 'always_waiting' | 'only_when_assigned'
  total_games?: number
  wins?: number
  losses?: number
  total_earnings?: number
  updated_at?: string
}

export default function AdminBotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Filters
  const [q, setQ] = useState('')
  const [filterActive, setFilterActive] = useState<'all'|'active'|'inactive'>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<'all'|'easy'|'medium'|'hard'|'unbeatable'>('all')
  const [filterWaiting, setFilterWaiting] = useState<'all'|'always_waiting'|'only_when_assigned'>('all')

  // Drawer for create/edit
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    difficulty: 'medium' as 'easy'|'medium'|'hard'|'unbeatable',
    win_probability: 0.5,
    waiting_mode: 'always_waiting' as 'always_waiting'|'only_when_assigned',
    active: true,
    behavior_profile: {
      mark_delay_ms: [500, 2000],
      error_rate: 0.1,
      check_bingo_interval_ms: [300, 800],
      chat_enabled: false,
      chat_messages: [],
      aggressiveness: 0.5
    } as any
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [seedNames, setSeedNames] = useState<string>('Fira_Ghost\nAbebeT\nSelamA\nDawit_123\nHana_M')
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected])

  const filtered = useMemo(() => {
    let list = bots
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter(b => b.name.toLowerCase().includes(s))
    }
    if (filterActive !== 'all') list = list.filter(b => filterActive === 'active' ? b.active : !b.active)
    if (filterDifficulty !== 'all') list = list.filter(b => b.difficulty === filterDifficulty)
    if (filterWaiting !== 'all') list = list.filter(b => b.waiting_mode === filterWaiting)
    return list
  }, [bots, q, filterActive, filterDifficulty, filterWaiting])

  const metrics = useMemo(() => {
    const total = bots.length
    const active = bots.filter(b => b.active).length
    const earnings = bots.reduce((s, b) => s + (b.total_earnings || 0), 0)
    const withWL = bots.filter(b => (b.wins || 0) + (b.losses || 0) > 0)
    const avgWinRate = withWL.length ? (withWL.reduce((s, b) => s + ((b.wins || 0) / ((b.wins || 0) + (b.losses || 0))), 0) / withWL.length) : 0
    return { total, active, earnings, avgWinRate }
  }, [bots])

  const openCreate = () => {
    setEditId(null)
    setForm({
      name: '', difficulty: 'medium', waiting_mode: 'always_waiting', win_probability: 0.5, active: true,
      behavior_profile: { mark_delay_ms: [500,2000], error_rate: 0.1, check_bingo_interval_ms: [300,800], chat_enabled: false, chat_messages: [], aggressiveness: 0.5 }
    })
    setShowAdvanced(false)
    setDrawerOpen(true)
  }

  const openEdit = (bot: Bot) => {
    setEditId(bot.id)
    setForm({
      name: bot.name,
      difficulty: bot.difficulty,
      waiting_mode: bot.waiting_mode,
      win_probability: bot.win_probability,
      active: bot.active,
      behavior_profile: bot.behavior_profile || { mark_delay_ms: [500,2000], error_rate: 0.1, check_bingo_interval_ms: [300,800], chat_enabled: false, chat_messages: [], aggressiveness: 0.5 }
    })
    setShowAdvanced(false)
    setDrawerOpen(true)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bots', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load bots')
      setBots(json.bots || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveForm = async () => {
    setError(null); setMessage(null)
    try {
      if (editId) {
        const res = await fetch(`/api/admin/bots/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to save bot')
        setMessage('Bot updated')
      } else {
        const res = await fetch('/api/admin/bots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to create bot')
        setMessage('Bot created')
      }
      closeDrawer()
      refresh()
    } catch (e: any) { setError(e?.message || 'Save failed') }
  }

  const bulkSeed = async () => {
    try {
      const names = seedNames.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      if (names.length === 0) return
      const res = await fetch('/api/admin/bots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed_names: names }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to seed')
      setMessage('Seeded successfully')
      refresh()
    } catch (e: any) { setError(e?.message || 'Seed failed') }
  }

  const bulkUpdateActive = async (active: boolean) => {
    if (selectedIds.length === 0) return
    setLoading(true)
    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/admin/bots/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })))
      setMessage(`Updated ${selectedIds.length} bot(s)`) 
      setSelected({})
      refresh()
    } catch (e: any) { setError(e?.message || 'Bulk update failed') }
    finally { setLoading(false) }
  }

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Delete ${selectedIds.length} selected bot(s)?`)) return
    setLoading(true)
    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/admin/bots/${id}`, { method: 'DELETE' })))
      setMessage(`Deleted ${selectedIds.length} bot(s)`) 
      setSelected({})
      refresh()
    } catch (e: any) { setError(e?.message || 'Bulk delete failed') } 
    finally { setLoading(false) }
  }

  // Derived: claim delay preview from behavior_profile
  const delayPreview = useMemo(() => {
    const range = Array.isArray((form.behavior_profile || {}).check_bingo_interval_ms) ? form.behavior_profile.check_bingo_interval_ms : [300,800]
    const min = Math.max(50, range[0] || 300)
    const max = Math.max(min+1, range[1] || 800)
    const bias = Math.floor((1 - Math.min(1, Math.max(0, form.win_probability))) * (max-min) * 0.5)
    return { min, max: max - bias }
  }, [form.behavior_profile, form.win_probability])

  // Helpers: presets and normalizers
  const applyPreset = (preset: 'easy'|'medium'|'hard') => {
    const presets: Record<string, any> = {
      easy: { mark_delay_ms: [700, 1600], error_rate: 0.15, check_bingo_interval_ms: [600, 1200], chat_enabled: false, chat_messages: [], aggressiveness: 0.3 },
      medium: { mark_delay_ms: [500, 1200], error_rate: 0.1, check_bingo_interval_ms: [300, 800], chat_enabled: false, chat_messages: [], aggressiveness: 0.5 },
      hard: { mark_delay_ms: [200, 800], error_rate: 0.03, check_bingo_interval_ms: [200, 500], chat_enabled: false, chat_messages: [], aggressiveness: 0.8 },
    }
    setForm(v => ({
      ...v,
      difficulty: preset,
      behavior_profile: presets[preset]
    }))
  }

  const bp = useMemo(() => {
    const b = form.behavior_profile || {}
    const md = Array.isArray(b.mark_delay_ms) ? b.mark_delay_ms : [500, 2000]
    const ci = Array.isArray(b.check_bingo_interval_ms) ? b.check_bingo_interval_ms : [300, 800]
    const er = typeof b.error_rate === 'number' ? b.error_rate : 0.1
    const ag = typeof b.aggressiveness === 'number' ? b.aggressiveness : 0.5
    const ce = !!b.chat_enabled
    const cm = Array.isArray(b.chat_messages) ? b.chat_messages : []
    return { mark_delay_ms: md, check_bingo_interval_ms: ci, error_rate: er, aggressiveness: ag, chat_enabled: ce, chat_messages: cm }
  }, [form.behavior_profile])

  const updateBP = (next: Partial<typeof bp>) => {
    setForm(v => ({ ...v, behavior_profile: { ...bp, ...next } }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Bots</h1>
            <p className="text-gray-300 text-sm">Manage bot players, behavior, and automation</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/mgmt-portal-x7k9p2/bots/stats" className="text-blue-300 hover:text-blue-200 text-sm underline">View Stats</Link>
            <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm">+ Add Bot</button>
          </div>
        </div>

        {error && <div className="bg-red-500/20 border border-red-500/40 text-red-200 px-3 py-2 rounded mb-3 text-sm">{error}</div>}
        {message && <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 px-3 py-2 rounded mb-3 text-sm">{message}</div>}

        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Total Bots</div>
            <div className="text-white text-xl font-bold">{metrics.total}</div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Active</div>
            <div className="text-white text-xl font-bold">{metrics.active}</div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Total Earnings</div>
            <div className="text-white text-xl font-bold">{(metrics.earnings || 0).toLocaleString()} ETB</div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Avg Win Rate</div>
            <div className="text-white text-xl font-bold">{(metrics.avgWinRate * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/10 border border-white/20 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 text-xs">Search</label>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name" className="rounded border px-3 py-2" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 text-xs">Status</label>
              <select value={filterActive} onChange={e=>setFilterActive(e.target.value as any)} className="rounded border px-3 py-2">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 text-xs">Difficulty</label>
              <select value={filterDifficulty} onChange={e=>setFilterDifficulty(e.target.value as any)} className="rounded border px-3 py-2">
                <option value="all">All Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="unbeatable">Unbeatable</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-300 text-xs">Waiting</label>
              <select value={filterWaiting} onChange={e=>setFilterWaiting(e.target.value as any)} className="rounded border px-3 py-2">
                <option value="all">All Waiting Modes</option>
                <option value="always_waiting">Always Waiting</option>
                <option value="only_when_assigned">Only When Assigned</option>
              </select>
            </div>
            <div className="flex items-end md:items-center gap-2">
              <button disabled={selectedIds.length===0} onClick={()=>bulkUpdateActive(true)} className="bg-emerald-600/80 hover:bg-emerald-600 text-white px-3 py-2 rounded text-sm disabled:opacity-40">Activate</button>
              <button disabled={selectedIds.length===0} onClick={()=>bulkUpdateActive(false)} className="bg-yellow-600/80 hover:bg-yellow-600 text-white px-3 py-2 rounded text-sm disabled:opacity-40">Deactivate</button>
              <button disabled={selectedIds.length===0} onClick={bulkDelete} className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-2 rounded text-sm disabled:opacity-40">Delete</button>
            </div>
          </div>
          <div className="mt-2 text-gray-300 text-xs">Selected: {selectedIds.length}</div>
        </div>

        {/* Bulk seed */}
        <div className="bg-white/10 border border-white/20 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-semibold">Bulk Seed</div>
            <button onClick={bulkSeed} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm">Seed</button>
          </div>
          <p className="text-gray-300 text-xs mb-2">One name per line. Quickly creates multiple bots with default settings (Medium). You can edit them later.</p>
          <textarea rows={4} value={seedNames} onChange={e=>setSeedNames(e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>

        {/* Table */}
        <div className="bg-white/10 border border-white/20 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10 text-gray-300">
                <th className="p-3"><input type="checkbox" aria-label="select all" onChange={e=>{
                  const all: Record<string, boolean> = {}
                  filtered.forEach(b => all[b.id] = e.target.checked)
                  setSelected(all)
                }} /></th>
                <th className="p-3">Name</th>
                <th className="p-3">Status</th>
                <th className="p-3">Difficulty</th>
                <th className="p-3">Waiting</th>
                <th className="p-3">Win%</th>
                <th className="p-3">Earnings</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(bot => (
                <tr key={bot.id} className="border-b border-white/10">
                  <td className="p-3 align-middle"><input type="checkbox" checked={!!selected[bot.id]} onChange={e=>setSelected(s=>({ ...s, [bot.id]: e.target.checked }))} /></td>
                  <td className="p-3 align-middle text-white">{bot.name}</td>
                  <td className="p-3 align-middle">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${bot.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>{bot.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="p-3 align-middle text-gray-200 capitalize">{bot.difficulty}</td>
                  <td className="p-3 align-middle text-gray-200">{bot.waiting_mode.replace('_',' ')}</td>
                  <td className="p-3 align-middle text-gray-200">{(bot.win_probability * 100).toFixed(0)}%</td>
                  <td className="p-3 align-middle text-gray-200">{(bot.total_earnings || 0).toLocaleString()} ETB</td>
                  <td className="p-3 align-middle text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={()=>openEdit(bot)} className="bg-blue-600/80 hover:bg-blue-600 text-white px-3 py-1.5 rounded">Edit</button>
                      <button onClick={async ()=>{ if (confirm(`Delete ${bot.name}?`)) { await fetch(`/api/admin/bots/${bot.id}`, { method: 'DELETE' }); refresh() } }} className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-300">No bots found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={closeDrawer}></div>
          <div className="absolute right-0 top-0 h-full w-full sm:w-[440px] bg-gray-900 border-l border-white/10 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">{editId ? 'Edit Bot' : 'Create Bot'}</h3>
              <button onClick={closeDrawer} className="text-gray-300 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <input className="w-full rounded border px-3 py-2" placeholder="Name" value={form.name} onChange={e=>setForm(v=>({ ...v, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-gray-300 text-xs">Difficulty</label>
                  <select className="rounded border px-3 py-2" value={form.difficulty} onChange={e=>setForm(v=>({ ...v, difficulty: e.target.value as any }))}>
                    <option value="easy">easy</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                    <option value="unbeatable">unbeatable</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-gray-300 text-xs">Waiting Mode</label>
                  <select className="rounded border px-3 py-2" value={form.waiting_mode} onChange={e=>setForm(v=>({ ...v, waiting_mode: e.target.value as any }))}>
                    <option value="always_waiting">always_waiting</option>
                    <option value="only_when_assigned">only_when_assigned</option>
                  </select>
                </div>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-300">Apply Preset:</span>
                <button type="button" onClick={()=>applyPreset('easy')} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200 hover:bg-white/20">Easy</button>
                <button type="button" onClick={()=>applyPreset('medium')} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200 hover:bg-white/20">Medium</button>
                <button type="button" onClick={()=>applyPreset('hard')} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200 hover:bg-white/20">Hard</button>
              </div>

              <label className="text-gray-300 text-sm">Win Probability: <span className="font-semibold text-white">{(form.win_probability*100).toFixed(0)}%</span></label>
              <input type="range" min={0} max={1} step={0.01} value={form.win_probability} onChange={e=>setForm(v=>({ ...v, win_probability: parseFloat(e.target.value) }))} className="w-full" />
              <div className="text-gray-400 text-xs">Claim delay preview: ~{delayPreview.min}-{delayPreview.max} ms</div>
              <div className="flex items-center gap-2">
                <input id="active" type="checkbox" checked={form.active} onChange={e=>setForm(v=>({ ...v, active: e.target.checked }))} />
                <label htmlFor="active" className="text-gray-200 text-sm">Active</label>
              </div>

              {/* Behavior - easy controls */}
              <div className="mt-2 space-y-2">
                <div className="text-gray-300 text-sm font-semibold">Behavior</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-400 text-xs">Mark Delay Min (ms)</label>
                    <input type="number" min={50} max={5000} value={bp.mark_delay_ms[0]} onChange={e=>{
                      const v = Math.max(50, Math.min(5000, parseInt(e.target.value||'0')))
                      updateBP({ mark_delay_ms: [v, Math.max(v, bp.mark_delay_ms[1])] })
                    }} className="w-full rounded border px-2 py-1" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Mark Delay Max (ms)</label>
                    <input type="number" min={50} max={5000} value={bp.mark_delay_ms[1]} onChange={e=>{
                      const v = Math.max(50, Math.min(5000, parseInt(e.target.value||'0')))
                      updateBP({ mark_delay_ms: [Math.min(v, bp.mark_delay_ms[0]), v] })
                    }} className="w-full rounded border px-2 py-1" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Check Bingo Min (ms)</label>
                    <input type="number" min={50} max={5000} value={bp.check_bingo_interval_ms[0]} onChange={e=>{
                      const v = Math.max(50, Math.min(5000, parseInt(e.target.value||'0')))
                      updateBP({ check_bingo_interval_ms: [v, Math.max(v, bp.check_bingo_interval_ms[1])] })
                    }} className="w-full rounded border px-2 py-1" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Check Bingo Max (ms)</label>
                    <input type="number" min={50} max={5000} value={bp.check_bingo_interval_ms[1]} onChange={e=>{
                      const v = Math.max(50, Math.min(5000, parseInt(e.target.value||'0')))
                      updateBP({ check_bingo_interval_ms: [Math.min(v, bp.check_bingo_interval_ms[0]), v] })
                    }} className="w-full rounded border px-2 py-1" />
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Error Rate ({Math.round(bp.error_rate*100)}%)</label>
                  <input type="range" min={0} max={0.3} step={0.01} value={bp.error_rate} onChange={e=>updateBP({ error_rate: parseFloat(e.target.value) })} className="w-full" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Aggressiveness ({Math.round(bp.aggressiveness*100)}%)</label>
                  <input type="range" min={0} max={1} step={0.01} value={bp.aggressiveness} onChange={e=>updateBP({ aggressiveness: parseFloat(e.target.value) })} className="w-full" />
                </div>
                <div className="flex items-center gap-2">
                  <input id="chat_enabled" type="checkbox" checked={bp.chat_enabled} onChange={e=>updateBP({ chat_enabled: e.target.checked })} />
                  <label htmlFor="chat_enabled" className="text-gray-200 text-sm">Enable Bot Chat</label>
                </div>
                {bp.chat_enabled && (
                  <div>
                    <label className="text-gray-400 text-xs">Chat Messages (one per line)</label>
                    <textarea rows={3} className="w-full rounded border px-3 py-2" value={(bp.chat_messages||[]).join('\n')} onChange={e=>updateBP({ chat_messages: e.target.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) })} />
                  </div>
                )}
              </div>

              <button onClick={()=>setShowAdvanced(s=>!s)} className="text-blue-300 underline text-sm">{showAdvanced ? 'Hide' : 'Show'} JSON (Advanced)</button>
              {showAdvanced && (
                <textarea rows={8} className="w-full rounded border px-3 py-2 font-mono text-sm" value={JSON.stringify(form.behavior_profile, null, 2)} onChange={e=>{
                  try { setForm(v=>({ ...v, behavior_profile: JSON.parse(e.target.value) })) } catch {}
                }} />
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <button onClick={saveForm} disabled={!form.name} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-40">{editId ? 'Save Changes' : 'Create Bot'}</button>
                <button onClick={closeDrawer} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
