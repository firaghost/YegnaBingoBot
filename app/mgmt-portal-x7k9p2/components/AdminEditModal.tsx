import { useState } from 'react'
import { X, Save, Eye, EyeOff } from 'lucide-react'

export function AdminEditModal({ admin, isOpen, onClose, onSave, PERMISSIONS, PermissionChip }: any) {
  const [tab, setTab] = useState<'details' | 'permissions' | 'security'>('details')
  const [formData, setFormData] = useState({
    username: admin?.username || '',
    role: admin?.role || 'admin',
    telegram_id: admin?.telegram_id || '',
    new_password: '',
    confirm_password: '',
  })
  const [permissions, setPermissions] = useState(admin?.permissions || {})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!isOpen || !admin) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        ...admin,
        username: formData.username,
        role: formData.role,
        telegram_id: formData.telegram_id,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password,
        permissions,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const permissionGroups = [
    { label: 'Users', perms: PERMISSIONS.filter((p: any) => p.key.startsWith('users_')) },
    { label: 'Games', perms: PERMISSIONS.filter((p: any) => p.key.startsWith('games_')) },
    { label: 'Financial', perms: PERMISSIONS.filter((p: any) => p.key.includes('deposit') || p.key.includes('withdrawal') || p.key.includes('transaction')) },
    { label: 'Admin', perms: PERMISSIONS.filter((p: any) => p.key.includes('admin') || p.key.includes('audit')) },
    { label: 'System', perms: PERMISSIONS.filter((p: any) => p.key.includes('setting') || p.key.includes('maintenance') || p.key.includes('whitelist') || p.key.includes('broadcast')) },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit Admin: {admin.username}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-700 px-6 pt-4 bg-slate-800/30">
          {(['details', 'permissions', 'security'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Details Tab */}
          {tab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Username</label>
                <input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                  >
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Telegram ID</label>
                  <input
                    value={formData.telegram_id}
                    onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                    placeholder="Optional"
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {tab === 'permissions' && (
            <div className="space-y-6">
              {permissionGroups.map((group) => (
                <div key={group.label}>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">{group.label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {group.perms.map((p: any) => (
                      <PermissionChip
                        key={p.key}
                        label={p.label}
                        active={Boolean(permissions[p.key])}
                        onClick={() =>
                          setPermissions({
                            ...permissions,
                            [p.key]: !Boolean(permissions[p.key]),
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Security Tab */}
          {tab === 'security' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-4">Reset this admin's password. Leave blank to keep current.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">New Password</label>
                <div className="relative">
                  <input
                    value={formData.new_password}
                    onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-300"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 px-6 py-4 bg-slate-800/30 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
