import { useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'

export function CreateAdminCard({ newAdmin, setNewAdmin, onSubmit, PERMISSIONS, PermissionChip }: any) {
  const [expanded, setExpanded] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const canSubmit = newAdmin.username && newAdmin.password

  return (
    <div className="bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-900 rounded-2xl border border-blue-700/20 overflow-hidden shadow-xl">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-blue-950/20 transition-colors border-b border-blue-700/20"
      >
        <div className="text-left">
          <h3 className="text-lg font-bold text-white">Create New Admin</h3>
          <p className="text-xs text-slate-400 mt-1">Add a new admin account with role and permissions</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-6 py-6 space-y-6 border-t border-blue-700/20">
          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Username</label>
              <input
                value={newAdmin.username || ''}
                onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                placeholder="e.g., admin_user"
                autoComplete="off"
                name="new_admin_username"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  value={newAdmin.password || ''}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Strong password"
                  autoComplete="new-password"
                  name="new_admin_password"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Role</label>
              <select
                value={newAdmin.role || 'admin'}
                onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all text-sm"
              >
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Telegram ID</label>
              <input
                value={newAdmin.telegram_id || ''}
                onChange={(e) => setNewAdmin({ ...newAdmin, telegram_id: e.target.value })}
                placeholder="Optional"
                autoComplete="off"
                name="new_admin_telegram_id"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all text-sm"
              />
            </div>
          </div>

          {/* Permissions */}
          <div className="border-t border-blue-700/20 pt-6">
            <label className="block text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {PERMISSIONS.map((p: any) => (
                <PermissionChip
                  key={p.key}
                  label={p.label}
                  active={Boolean(newAdmin.permissions?.[p.key])}
                  onClick={() =>
                    setNewAdmin({
                      ...newAdmin,
                      permissions: { ...newAdmin.permissions, [p.key]: !Boolean(newAdmin.permissions?.[p.key]) },
                    })
                  }
                />
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Admin
          </button>
        </div>
      )}
    </div>
  )
}
