import { useState } from 'react'
import { Search, Edit, Lock, Trash2, ChevronDown } from 'lucide-react'

export function AdminTable({ admins, onEdit, onResetPassword, onDelete, loading }: any) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'username' | 'role' | 'updated'>('updated')

  const filtered = admins.filter((a: any) =>
    a.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.telegram_id?.toString().includes(searchTerm)
  )

  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === 'username') return a.username.localeCompare(b.username)
    if (sortBy === 'role') return a.role.localeCompare(b.role)
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
  })

  const roleColor = (role: string) => {
    if (role === 'super_admin') return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
    if (role === 'admin') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  }

  const roleLabel = (role: string) => {
    return role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)
  }

  if (loading) {
    return <div className="text-slate-400 py-12 text-center">Loading admins…</div>
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by username or Telegram ID…"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all text-sm"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-400 focus:outline-none transition-colors"
        >
          <option value="updated">Latest Updated</option>
          <option value="username">Username</option>
          <option value="role">Role</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Username</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Role</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Telegram ID</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Permissions</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-300">Updated</th>
              <th className="px-6 py-3 text-right font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  No admins found
                </td>
              </tr>
            ) : (
              sorted.map((admin: any) => (
                <tr key={admin.id} className="border-b border-slate-700 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{admin.username}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${roleColor(admin.role)}`}>
                      {roleLabel(admin.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{admin.telegram_id || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded">
                      {Object.values(admin.permissions || {}).filter(Boolean).length} perms
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {admin.updated_at ? new Date(admin.updated_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(admin)}
                        className="p-2 rounded hover:bg-emerald-600/20 text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onResetPassword(admin)}
                        className="p-2 rounded hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Reset Password"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(admin)}
                        className="p-2 rounded hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="text-xs text-slate-400 text-right">
        Showing {sorted.length} of {admins.length} admins
      </div>
    </div>
  )
}
